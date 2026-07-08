import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { TransactionStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      financialTransactionId,
      externalId,
      amount,
      currency,
      payer,
      status,
      reason,
    } = body;

    console.log("MoMo Callback received:", {
      financialTransactionId,
      externalId,
      amount,
      status,
    });

    // Find the transaction by externalId (our reference)
    const transaction = await db.transaction.findUnique({
      where: { transactionRef: externalId },
    });

    if (!transaction) {
      console.error("Transaction not found for externalId:", externalId);
      return NextResponse.json(
        { message: "Transaction not found" },
        { status: 404 },
      );
    }

    // Update transaction status based on MoMo response
    const newStatus =
      status === "SUCCESSFUL"
        ? TransactionStatus.COMPLETED
        : status === "FAILED"
          ? TransactionStatus.FAILED
          : TransactionStatus.PENDING;

    await db.transaction.update({
      where: { id: transaction.id },
      data: {
        status: newStatus,
      },
    });

    // If successful and this is a deposit, update member account balance
    if (status === "SUCCESSFUL" && transaction.type === "DEPOSIT") {
      const deposit = await db.deposit.findFirst({
        where: { transactionId: transaction.id },
      });

      if (deposit) {
        await db.account.update({
          where: { id: transaction.accountId },
          data: {
            balance: { increment: Number(amount) },
          },
        });
      }
    }

    // Handle failed transactions - could trigger notifications
    if (status === "FAILED") {
      console.error("MoMo transaction failed:", {
        externalId,
        reason,
      });
    }

    return NextResponse.json(
      { message: "Callback processed successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("MoMo callback error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
