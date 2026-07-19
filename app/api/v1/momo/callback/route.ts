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

    const newStatus =
      status === "SUCCESSFUL"
        ? TransactionStatus.COMPLETED
        : status === "FAILED"
          ? TransactionStatus.FAILED
          : TransactionStatus.PENDING;

    // Use a transaction with conditional update to prevent double-credit.
    // The conditional flip (WHERE status != newStatus) ensures that even if
    // the callback fires multiple times, only the first one actually changes
    // the status and increments the balance.
    const result = await db.$transaction(async (tx) => {
      // Atomically flip status only if not already in the target status
      const flipped = await tx.transaction.updateMany({
        where: {
          transactionRef: externalId,
          status: { not: newStatus },
        },
        data: { status: newStatus },
      });

      if (flipped.count === 0) {
        // Already in target status (or transaction not found) — idempotent no-op
        const existing = await tx.transaction.findUnique({
          where: { transactionRef: externalId },
        });
        return { alreadyProcessed: true, transaction: existing };
      }

      const transaction = await tx.transaction.findUnique({
        where: { transactionRef: externalId },
      });

      if (!transaction) {
        return { alreadyProcessed: false, notFound: true };
      }

      // If successful deposit, increment account balance exactly once
      if (status === "SUCCESSFUL" && transaction.type === "DEPOSIT" && transaction.accountId) {
        const deposit = await tx.deposit.findFirst({
          where: { transactionId: transaction.id },
        });

        if (deposit) {
          await tx.account.update({
            where: { id: transaction.accountId },
            data: { balance: { increment: Number(amount) } },
          });
        }
      }

      if (status === "FAILED") {
        console.error("MoMo transaction failed:", { externalId, reason });
      }

      return { alreadyProcessed: false, transaction };
    });

    if (result.notFound) {
      console.error("Transaction not found for externalId:", externalId);
      return NextResponse.json(
        { message: "Transaction not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        message: result.alreadyProcessed
          ? "Callback already processed (idempotent)"
          : "Callback processed successfully",
      },
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
