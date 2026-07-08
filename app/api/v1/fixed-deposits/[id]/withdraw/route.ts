import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { isVoluntarySavingsAccountTypeName } from "@/lib/accounting/account-type-rules";

/**
 * POST /api/v1/fixed-deposits/[id]/withdraw
 *
 * Handles both early withdrawal and maturity payout for FixedDeposit records.
 *
 * Early withdrawal (before maturityDate):
 *   - Returns principalAmount only — interest is forfeited.
 *
 * Maturity payout (on or after maturityDate):
 *   - Returns maturityAmount (principal + accrued interest).
 *
 * Funds are credited back to fundingSourceAccountId when set, otherwise
 * the member's/institution's voluntary savings account is used.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (!["ADMIN", "BRANCHMANAGER", "TELLER"].includes(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;

    const fd = await db.fixedDeposit.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, userId: true, memberNumber: true, user: { select: { name: true } } } },
        institution: { select: { id: true, userId: true, institutionName: true } },
      },
    });

    if (!fd) {
      return NextResponse.json({ error: "Fixed deposit not found" }, { status: 404 });
    }

    if (fd.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Fixed deposit is already ${fd.status.toLowerCase()} and cannot be withdrawn` },
        { status: 400 },
      );
    }

    const today = new Date();
    const isEarlyWithdrawal = today < new Date(fd.maturityDate);

    // For early withdrawal: return principal only. For maturity: return maturityAmount.
    const amountToReturn = isEarlyWithdrawal ? fd.principalAmount : fd.maturityAmount;
    const forfeitedInterest = isEarlyWithdrawal ? fd.maturityAmount - fd.principalAmount : 0;

    // Resolve the destination account:
    // 1. Use fundingSourceAccountId if it is still active.
    // 2. Fall back to any voluntary savings account for the member/institution.
    let destinationAccount: any = null;

    if (fd.fundingSourceAccountId) {
      destinationAccount = await db.account.findUnique({
        where: { id: fd.fundingSourceAccountId },
        include: { accountType: true },
      });
      // Only use it if it's still active; otherwise fall through to the lookup below.
      if (destinationAccount?.status !== "ACTIVE") {
        destinationAccount = null;
      }
    }

    if (!destinationAccount) {
      const candidates = await db.account.findMany({
        where: {
          status: "ACTIVE",
          ...(fd.memberId ? { memberId: fd.memberId } : {}),
          ...(fd.institutionId ? { institutionId: fd.institutionId } : {}),
        },
        include: { accountType: true },
        orderBy: { openedAt: "asc" },
      });
      destinationAccount = candidates.find((c) =>
        isVoluntarySavingsAccountTypeName(c.accountType?.name),
      ) ?? null;
    }

    if (!destinationAccount) {
      return NextResponse.json(
        {
          error:
            "No active voluntary savings account found to receive funds. Please ensure the member has an active voluntary savings account.",
        },
        { status: 400 },
      );
    }

    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const transactionRef = isEarlyWithdrawal
      ? `EWD-FD-${timestamp}-${random}`
      : `MAT-FD-${timestamp}-${random}`;

    const newStatus = isEarlyWithdrawal ? "WITHDRAWN" : "MATURED";
    const ownerName =
      fd.member?.user?.name || fd.institution?.institutionName || "Unknown";

    await db.$transaction(async (tx) => {
      // 1. Mark FixedDeposit as withdrawn / matured
      await tx.fixedDeposit.update({
        where: { id },
        data: {
          status: newStatus,
          isWithdrawn: true,
          withdrawnDate: today,
          withdrawnAmount: amountToReturn,
          totalInterestRealized: isEarlyWithdrawal ? 0 : fd.maturityAmount - fd.principalAmount,
        },
      });

      // 2. Credit destination savings account
      await tx.account.update({
        where: { id: destinationAccount.id },
        data: { balance: { increment: amountToReturn } },
      });

      // 3. Transaction record — destination (credit side)
      await tx.transaction.create({
        data: {
          transactionRef,
          type: TransactionType.TRANSFER,
          amount: amountToReturn,
          status: TransactionStatus.COMPLETED,
          description: isEarlyWithdrawal
            ? `Early withdrawal from FD ${fd.accountNumber}. Principal returned: ${fd.principalAmount.toLocaleString()}, Interest forfeited: ${forfeitedInterest.toLocaleString()}`
            : `Maturity payout from FD ${fd.accountNumber}. Principal: ${fd.principalAmount.toLocaleString()}, Interest earned: ${(fd.maturityAmount - fd.principalAmount).toLocaleString()}`,
          currency: "UGX",
          branchId: fd.branchId,
          memberId: fd.memberId,
          institutionId: fd.institutionId,
          accountId: destinationAccount.id,
          processedByUserId: (session.user as any).id,
          channel: "INTERNAL",
        },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          userId: (session.user as any).id,
          action: isEarlyWithdrawal ? "EARLY_WITHDRAWAL" : "MATURITY_PAYOUT",
          entityType: "FixedDeposit",
          entityId: id,
          details: isEarlyWithdrawal
            ? `Early withdrawal for FD ${fd.accountNumber} (${ownerName}). Returned: ${amountToReturn.toLocaleString()} to ${destinationAccount.accountNumber}. Forfeited interest: ${forfeitedInterest.toLocaleString()}. Maturity date was: ${new Date(fd.maturityDate).toDateString()}`
            : `Maturity payout for FD ${fd.accountNumber} (${ownerName}). Total returned: ${amountToReturn.toLocaleString()} (principal: ${fd.principalAmount.toLocaleString()} + interest: ${(amountToReturn - fd.principalAmount).toLocaleString()}) to ${destinationAccount.accountNumber}`,
        },
      });

      // 5. Notification
      const notifyUserId = fd.member?.userId || fd.institution?.userId;
      if (notifyUserId) {
        await tx.notification.create({
          data: {
            userId: notifyUserId,
            type: "IN_APP",
            subject: isEarlyWithdrawal ? "Fixed Deposit Early Withdrawal" : "Fixed Deposit Matured",
            message: isEarlyWithdrawal
              ? `Your fixed deposit ${fd.accountNumber} has been closed early.\n\nPrincipal Returned: UGX ${fd.principalAmount.toLocaleString()}\nInterest Forfeited: UGX ${forfeitedInterest.toLocaleString()}\nFunds transferred to: ${destinationAccount.accountNumber}\nReference: ${transactionRef}`
              : `Your fixed deposit ${fd.accountNumber} has matured!\n\nPrincipal: UGX ${fd.principalAmount.toLocaleString()}\nInterest Earned: UGX ${(amountToReturn - fd.principalAmount).toLocaleString()}\nTotal Paid Out: UGX ${amountToReturn.toLocaleString()}\nFunds transferred to: ${destinationAccount.accountNumber}\nReference: ${transactionRef}`,
            targetAddress: `/dashboard/accounts`,
            status: "SENT",
            sentAt: new Date(),
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: isEarlyWithdrawal
        ? "Early withdrawal processed. Interest has been forfeited."
        : "Maturity payout processed successfully.",
      data: {
        transactionRef,
        fixedDepositId: id,
        accountNumber: fd.accountNumber,
        type: isEarlyWithdrawal ? "EARLY_WITHDRAWAL" : "MATURITY_PAYOUT",
        principalAmount: fd.principalAmount,
        interestAmount: isEarlyWithdrawal ? 0 : fd.maturityAmount - fd.principalAmount,
        forfeitedInterest,
        amountReturned: amountToReturn,
        destinationAccount: destinationAccount.accountNumber,
        newStatus,
      },
    });
  } catch (error) {
    console.error("FD withdrawal error:", error);
    return NextResponse.json(
      {
        error: "Failed to process withdrawal",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
