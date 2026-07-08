import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { assertMemberCanTransact } from "@/lib/member-transact-eligibility";
import {
  isFixedDepositAccountTypeName,
  isVoluntarySavingsAccountTypeName,
} from "@/lib/accounting/account-type-rules";

// POST /api/v1/transfers/internal - Process internal transfer between member accounts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const handlerUserId = (session.user as any).id;
    const body = await request.json();
    const { sourceAccountId, targetAccountId, amount, description } = body;

    // Validation
    if (!sourceAccountId || !targetAccountId || !amount) {
      return NextResponse.json(
        { success: false, error: "Source account, target account, and amount are required" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    if (sourceAccountId === targetAccountId) {
      return NextResponse.json(
        { success: false, error: "Source and target accounts must be different" },
        { status: 400 }
      );
    }

    // Fetch accounts
    const [sourceAccount, targetAccount] = await Promise.all([
      db.account.findUnique({
        where: { id: sourceAccountId },
        include: { accountType: true, member: { include: { user: true } }, institution: { include: { user: true } } },
      }),
      db.account.findUnique({
        where: { id: targetAccountId },
        include: { accountType: true, member: { include: { user: true } }, institution: { include: { user: true } } },
      }),
    ]);

    if (!sourceAccount) {
      return NextResponse.json(
        { success: false, error: "Source account not found" },
        { status: 404 }
      );
    }

    if (!targetAccount) {
      return NextResponse.json(
        { success: false, error: "Target account not found" },
        { status: 404 }
      );
    }

    if (sourceAccount.memberId) {
      try {
        await assertMemberCanTransact(sourceAccount.memberId);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : "Source member is not eligible to transact yet" },
          { status: 400 },
        );
      }
    }

    if (targetAccount.memberId) {
      try {
        await assertMemberCanTransact(targetAccount.memberId);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : "Target member is not eligible to transact yet" },
          { status: 400 },
        );
      }
    }

    if (sourceAccount.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "Source account is not active" },
        { status: 400 }
      );
    }

    if (targetAccount.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "Target account is not active" },
        { status: 400 }
      );
    }

    // Check balance
    if (sourceAccount.balance < amount) {
      return NextResponse.json(
        { success: false, error: `Insufficient balance in source account. Available: ${sourceAccount.balance.toLocaleString()}` },
        { status: 400 }
      );
    }

    // Check minimum balance
    if ((sourceAccount.balance - amount) < (sourceAccount.accountType.minBalance || 0)) {
      return NextResponse.json(
        { success: false, error: `Transfer would violate minimum balance requirement of ${sourceAccount.accountType.minBalance?.toLocaleString()}` },
        { status: 400 }
      );
    }

    // Fixed Deposit Funding Rule: Target must be funded from Voluntary Savings
    if (isFixedDepositAccountTypeName(targetAccount.accountType.name)) {
      if (!isVoluntarySavingsAccountTypeName(sourceAccount.accountType.name)) {
        return NextResponse.json(
          { success: false, error: "Fixed Deposits can only be funded from Voluntary Savings accounts" },
          { status: 400 }
        );
      }
    }

    // Fetch Chart of Accounts
    const savingsLiabilityAccount = await db.chartOfAccount.findFirst({
      where: {
        ledgerType: "LIABILITIES",
        accountName: { contains: "SAVINGS", mode: "insensitive" },
        isActive: true,
      },
    });

    // Execute transfer in transaction
    const result = await db.$transaction(async (tx) => {
      const transactionRef = `TRF-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
      const entryNumber = `JE-TRF-${Date.now()}`;

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          transactionRef,
          type: TransactionType.TRANSFER,
          amount,
          status: TransactionStatus.COMPLETED,
          description: description || `Transfer from ${sourceAccount.accountNumber} to ${targetAccount.accountNumber}`,
          memberId: sourceAccount.memberId,
          accountId: sourceAccount.id,
          processedByUserId: handlerUserId,
          channel: "INTERNAL",
        },
      });

      // Debit source account
      await tx.account.update({
        where: { id: sourceAccount.id },
        data: { balance: { decrement: amount } },
      });

      // Credit target account
      await tx.account.update({
        where: { id: targetAccount.id },
        data: { balance: { increment: amount } },
      });

      // Create journal entries (within same liability account - internal transfer)
      // Dr: Source Member Savings (reduces their liability)
      // Cr: Target Member Savings (increases their liability)
      if (savingsLiabilityAccount) {
        await tx.journalEntry.createMany({
          data: [
            {
              entryNumber,
              accountId: savingsLiabilityAccount.id,
              debitAmount: amount,
              creditAmount: 0,
              description: `Transfer from ${sourceAccount.accountNumber}`,
              transactionId: transaction.id,
              createdByUserId: handlerUserId,
            },
            {
              entryNumber,
              accountId: savingsLiabilityAccount.id,
              debitAmount: 0,
              creditAmount: amount,
              description: `Transfer to ${targetAccount.accountNumber}`,
              transactionId: transaction.id,
              createdByUserId: handlerUserId,
            },
          ],
        });

        // Note: For internal transfers within the same liability account,
        // the net effect on the account balance is zero (debit = credit)
        // So we don't update the Chart of Account balance
      }

      // Send notifications
      const sourceUserId = sourceAccount.member?.user?.id || (sourceAccount.institution as any)?.user?.id;
      const targetUserId = targetAccount.member?.user?.id || (targetAccount.institution as any)?.user?.id;

      if (sourceUserId) {
        await tx.notification.create({
          data: {
            userId: sourceUserId,
            type: "IN_APP",
            subject: "Transfer Sent",
            message: `Transfer of UGX ${amount.toLocaleString()} from your account ${sourceAccount.accountNumber} to ${targetAccount.accountNumber} has been processed successfully. Reference: ${transactionRef}`,
            targetAddress: `/dashboard/accounts`,
            status: "SENT",
            sentAt: new Date()
          },
        });
      }

      if (targetUserId && targetUserId !== sourceUserId) {
        await tx.notification.create({
          data: {
            userId: targetUserId,
            type: "IN_APP",
            subject: "Transfer Received",
            message: `You have received a transfer of UGX ${amount.toLocaleString()} into your account ${targetAccount.accountNumber} from ${sourceAccount.accountNumber}. Reference: ${transactionRef}`,
            targetAddress: `/dashboard/accounts`,
            status: "SENT",
            sentAt: new Date()
          },
        });
      }

      return {
        transactionRef,
        amount,
        sourceAccountNumber: sourceAccount.accountNumber,
        targetAccountNumber: targetAccount.accountNumber,
        sourceNewBalance: sourceAccount.balance - amount,
        targetNewBalance: targetAccount.balance + amount,
        journalEntryNumber: entryNumber,
      };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    console.error("Error processing internal transfer:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process transfer" },
      { status: 500 }
    );
  }
}
