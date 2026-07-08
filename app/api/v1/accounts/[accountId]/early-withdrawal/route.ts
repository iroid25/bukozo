import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { format } from "date-fns";
import { assertMemberCanTransact } from "@/lib/member-transact-eligibility";
import { isVoluntarySavingsAccountTypeName } from "@/lib/accounting/account-type-rules";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId } = await params;

    // Fetch account with related data
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        accountType: true,
        member: true,
        institution: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!account.accountType.hasFixedPeriod) {
      return NextResponse.json(
        { error: "This is not a fixed deposit account" },
        { status: 400 }
      );
    }

    if (account.memberId) {
      try {
        await assertMemberCanTransact(account.memberId);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Member is not eligible to transact yet" },
          { status: 400 },
        );
      }
    }

    // Check if already matured
    const today = new Date();
    const maturityDate = account.fixingEndDate;

    if (!maturityDate) {
      return NextResponse.json(
        { error: "Maturity date not set for this account" },
        { status: 400 }
      );
    }

    if (today >= maturityDate) {
      return NextResponse.json(
        {
          error: `Account has already matured on ${format(maturityDate, "PPP")}. Use normal withdrawal process.`,
        },
        { status: 400 }
      );
    }

    // Check if account has balance
    if (account.balance <= 0) {
      return NextResponse.json(
        { error: "Account has no balance to withdraw" },
        { status: 400 }
      );
    }

    // Find voluntary savings account to transfer to
    const voluntarySavingsCandidates = await db.account.findMany({
      where: {
        ...(account.memberId ? { memberId: account.memberId } : {}),
        ...(account.institutionId ? { institutionId: account.institutionId } : {}),
        status: "ACTIVE",
      },
      include: {
        accountType: true,
      },
      orderBy: {
        openedAt: "asc",
      },
    });

    const voluntarySavings = voluntarySavingsCandidates.find((candidate) =>
      isVoluntarySavingsAccountTypeName(candidate.accountType.name),
    );

    if (!voluntarySavings) {
      return NextResponse.json(
        {
          error: "No active voluntary savings account found. Early withdrawal requires transferring funds back to voluntary savings.",
        },
        { status: 400 }
      );
    }

    if (voluntarySavings.memberId) {
      try {
        await assertMemberCanTransact(voluntarySavings.memberId);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Member is not eligible to transact yet" },
          { status: 400 },
        );
      }
    }

    if (!isVoluntarySavingsAccountTypeName(voluntarySavings.accountType.name)) {
      return NextResponse.json(
        {
          error: "No active voluntary savings account found. Early withdrawal requires transferring funds back to voluntary savings.",
        },
        { status: 400 },
      );
    }

    // Process early withdrawal in transaction
    const result = await db.$transaction(async (tx) => {
      const principalAmount = account.balance;
      const forfeitedInterest = account.expectedInterest || 0;

      // 1. Debit fixed deposit account
      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: 0,
          status: "CLOSED",
          closedAt: new Date(),
        },
      });

      // 2. Credit voluntary savings account (principal only)
      await tx.account.update({
        where: { id: voluntarySavings.id },
        data: {
          balance: { increment: principalAmount },
        },
      });

      // 3. Create transaction records
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const transactionRef = `EWD-${timestamp}-${random}`;

      // Credit transaction for voluntary savings
      await tx.transaction.create({
        data: {
          transactionRef,
          type: TransactionType.TRANSFER,
          amount: principalAmount,
          status: TransactionStatus.COMPLETED,
          description: `Early Withdrawal from Fixed Deposit ${account.accountNumber}. Interest Forfeited: ${forfeitedInterest.toLocaleString()}`,
          currency: "UGX",
          branchId: account.branchId,
          memberId: account.memberId,
          institutionId: account.institutionId,
          accountId: voluntarySavings.id,
          processedByUserId: session.user.id,
          channel: "INTERNAL",
        },
      });

      // Debit transaction for fixed deposit
      await tx.transaction.create({
        data: {
          transactionRef: `${transactionRef}-SRC`,
          type: TransactionType.TRANSFER,
          amount: principalAmount,
          status: TransactionStatus.COMPLETED,
          description: `Early Withdrawal to ${voluntarySavings.accountNumber}. Interest Forfeited: ${forfeitedInterest.toLocaleString()}`,
          currency: "UGX",
          branchId: account.branchId,
          memberId: account.memberId,
          institutionId: account.institutionId,
          accountId: account.id,
          processedByUserId: session.user.id,
          channel: "INTERNAL",
        },
      });

      // 4. Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "EARLY_WITHDRAWAL",
          entityType: "Account",
          entityId: account.id,
          details: `Early withdrawal from fixed deposit ${account.accountNumber}. Principal returned: ${principalAmount.toLocaleString()}, Interest forfeited: ${forfeitedInterest.toLocaleString()}, Maturity date was: ${format(maturityDate, "PPP")}`,
        },
      });

      // 5. Send notification
      if (account.memberId) {
        const member = await tx.member.findUnique({
          where: { id: account.memberId },
          select: { userId: true },
        });

        if (member?.userId) {
          await tx.notification.create({
            data: {
              userId: member.userId,
              type: "IN_APP",
              subject: "Early Withdrawal Processed",
              message: `Your fixed deposit account ${account.accountNumber} has been closed early.\n\nPrincipal Returned: ${principalAmount.toLocaleString()}\nInterest Forfeited: ${forfeitedInterest.toLocaleString()}\nFunds transferred to: ${voluntarySavings.accountNumber}\n\nReference: ${transactionRef}`,
            },
          });
        }
      }

      return {
        transactionRef,
        principalReturned: principalAmount,
        interestForfeited: forfeitedInterest,
        transferredTo: voluntarySavings.accountNumber,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Early withdrawal processed successfully. Interest has been forfeited.",
      data: result,
    });
  } catch (error) {
    console.error("Early withdrawal error:", error);
    return NextResponse.json(
      {
        error: "Failed to process early withdrawal",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
