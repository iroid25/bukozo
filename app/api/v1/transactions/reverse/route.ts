// app/api/v1/transactions/reverse
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { TransactionStatus, TransactionType } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, userId, reason } = body;

    if (!transactionId || !userId || !reason) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get original transaction
    const originalTransaction = await db.transaction.findUnique({
      where: { id: transactionId },
      include: { account: true },
    });

    if (!originalTransaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if can be reversed
    if (originalTransaction.status !== TransactionStatus.COMPLETED) {
      return NextResponse.json(
        {
          success: false,
          error: "Only completed transactions can be reversed",
        },
        { status: 400 }
      );
    }

    // Check 24 hour window
    const hoursSince =
      (Date.now() - new Date(originalTransaction.transactionDate).getTime()) /
      (1000 * 60 * 60);

    if (hoursSince > 24) {
      return NextResponse.json(
        {
          success: false,
          error: "Transactions can only be reversed within 24 hours",
        },
        { status: 400 }
      );
    }

    // Create reversal
    const result = await db.$transaction(async (tx) => {
      const reversalRef = `REV-${originalTransaction.transactionRef}`;

      const reversalTransaction = await tx.transaction.create({
        data: {
          transactionRef: reversalRef,
          memberId: originalTransaction.memberId,
          institutionId: originalTransaction.institutionId,
          accountId: originalTransaction.accountId,
          type: originalTransaction.type,
          amount: -originalTransaction.amount,
          status: TransactionStatus.COMPLETED,
          description: `Reversal of ${originalTransaction.transactionRef}: ${reason}`,
          transactionDate: new Date(),
          processedByUserId: userId,
          relatedTransactionId: originalTransaction.id,
          channel: originalTransaction.channel,
        },
      });

      // Mark original as reversed
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.REVERSED,
          relatedTransactionId: reversalTransaction.id,
        },
      });

      // Update account balance
      const account = originalTransaction.account;
      if (account) {
        let newBalance = account.balance;
        if (originalTransaction.type === TransactionType.DEPOSIT) {
          newBalance -= originalTransaction.amount;
        } else if (originalTransaction.type === TransactionType.WITHDRAWAL) {
          newBalance += originalTransaction.amount;
        }

        await tx.account.update({
          where: { id: account.id },
          data: { balance: newBalance },
        });
      }

      return reversalTransaction;
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: "Transaction reversed successfully",
    });
  } catch (error) {
    console.error("Error reversing transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reverse transaction",
      },
      { status: 500 }
    );
  }
}
