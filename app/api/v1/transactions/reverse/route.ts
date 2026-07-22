// app/api/v1/transactions/reverse
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { reverseJournalEntriesForRecord } from "@/lib/journal-entries-extended";

const REVERSAL_ALLOWED_ROLES = ["ADMIN", "BRANCHMANAGER", "ACCOUNTANT"];

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!REVERSAL_ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to reverse transactions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { transactionId, reason } = body;

    if (!transactionId || !reason) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: transactionId and reason" },
        { status: 400 }
      );
    }

    const originalTransaction = await db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        account: true,
      },
    });

    if (!originalTransaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (originalTransaction.status !== TransactionStatus.COMPLETED) {
      return NextResponse.json(
        {
          success: false,
          error: "Only completed transactions can be reversed",
        },
        { status: 400 }
      );
    }

    const hoursSince =
      (Date.now() - new Date(originalTransaction.transactionDate).getTime()) /
      (1000 * 60 * 60);

    if (hoursSince > 24 && user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "Transactions can only be reversed within 24 hours",
        },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const reversalRef = `REV-${originalTransaction.transactionRef}`;

      const reversalTransaction = await tx.transaction.create({
        data: {
          transactionRef: reversalRef,
          memberId: originalTransaction.memberId,
          institutionId: originalTransaction.institutionId,
          accountId: originalTransaction.accountId,
          branchId: originalTransaction.branchId,
          type: originalTransaction.type,
          amount: -originalTransaction.amount,
          fee: originalTransaction.fee > 0 ? -originalTransaction.fee : 0,
          status: TransactionStatus.COMPLETED,
          description: `Reversal of ${originalTransaction.transactionRef}: ${reason}`,
          transactionDate: new Date(),
          processedByUserId: user.id,
          relatedTransactionId: originalTransaction.id,
          channel: originalTransaction.channel,
        },
      });

      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.REVERSED,
          relatedTransactionId: reversalTransaction.id,
        },
      });

      const account = originalTransaction.account;
      if (account) {
        const isDeposit =
          originalTransaction.type === TransactionType.DEPOSIT ||
          originalTransaction.type === TransactionType.FEE;
        const isWithdrawal = originalTransaction.type === TransactionType.WITHDRAWAL;

        if (isDeposit) {
          const creditedAmount =
            originalTransaction.type === TransactionType.FEE
              ? originalTransaction.amount - (originalTransaction.fee || 0)
              : originalTransaction.amount;
          await tx.account.update({
            where: { id: account.id },
            data: { balance: { decrement: creditedAmount } },
          });
        } else if (isWithdrawal) {
          const totalDebited =
            originalTransaction.amount + (originalTransaction.fee || 0);
          await tx.account.update({
            where: { id: account.id },
            data: { balance: { increment: totalDebited } },
          });
        } else if (originalTransaction.type === TransactionType.TRANSFER) {
          await tx.account.update({
            where: { id: account.id },
            data: { balance: { increment: originalTransaction.amount } },
          });
        } else if (originalTransaction.type === TransactionType.LOAN_REPAYMENT) {
          await tx.account.update({
            where: { id: account.id },
            data: { balance: { increment: originalTransaction.amount } },
          });
        }
      }

      // Reverse float for WITHDRAWAL or DEPOSIT — looked up from the actual
      // FloatTransaction created at the time (via relatedTransactionId),
      // rather than recomputing the fee/agent-commission formula by hand.
      // This guarantees the reversal always matches exactly what was
      // applied, regardless of channel (CASH vs MOBILE_MONEY both touch
      // float on deposit; only CASH does on withdrawal — so this lookup
      // naturally no-ops for MOBILE_MONEY withdrawals with no extra channel
      // check needed) or agent commission structure, and avoids the two
      // formulas silently drifting apart the way they previously did (the
      // old hand-rolled reversal formulas dropped the agent's
      // commission/fee component that the forward-path formulas include).
      if (
        originalTransaction.type === TransactionType.WITHDRAWAL ||
        originalTransaction.type === TransactionType.DEPOSIT
      ) {
        const relatedFloatTxn = await tx.floatTransaction.findFirst({
          where: {
            relatedTransactionId: originalTransaction.id,
            type: originalTransaction.type,
          },
          include: { float: { select: { id: true, userId: true } } },
        });

        if (relatedFloatTxn) {
          const handlerUserId = relatedFloatTxn.float.userId;
          const handler = await tx.user.findUnique({
            where: { id: handlerUserId },
            select: { role: true },
          });
          const isAgent = handler?.role === "AGENT";
          const isWithdrawal = originalTransaction.type === TransactionType.WITHDRAWAL;

          // Withdrawal: agent float was incremented, teller float decremented — reverse the opposite way.
          // Deposit: agent float was decremented, teller float incremented — reverse the opposite way.
          const reverseDirection = isWithdrawal
            ? isAgent
              ? "decrement"
              : "increment"
            : isAgent
              ? "increment"
              : "decrement";

          await tx.userFloat.update({
            where: { userId: handlerUserId },
            data: { balance: { [reverseDirection]: relatedFloatTxn.amount } },
          });

          await tx.floatTransaction.create({
            data: {
              floatId: relatedFloatTxn.float.id,
              type: originalTransaction.type,
              amount: relatedFloatTxn.amount,
              description: `Reversal of ${isWithdrawal ? "withdrawal" : "deposit"} ${originalTransaction.transactionRef}`,
              performedByUserId: user.id,
              relatedTransactionId: reversalTransaction.id,
            },
          });
        }
      }

      // Reverse fee IncomeRecord if fees were charged
      if (originalTransaction.fee > 0) {
        const existingFeeIncome = await tx.incomeRecord.findFirst({
          where: {
            OR: [
              { description: { contains: originalTransaction.transactionRef } },
              { externalRef: originalTransaction.transactionRef },
            ],
            budgetCategory: {
              code: { in: ["405001", "405002"] },
            },
          },
        });

        if (existingFeeIncome) {
          await tx.incomeRecord.create({
            data: {
              budgetCategoryId: existingFeeIncome.budgetCategoryId,
              amount: -existingFeeIncome.amount,
              date: new Date(),
              recordDate: new Date(),
              description: `Reversal of fee for ${originalTransaction.transactionRef}: ${reason}`,
              receivedByUserId: user.id,
              branchId: originalTransaction.branchId || existingFeeIncome.branchId,
              memberId: originalTransaction.memberId,
              accountId: originalTransaction.accountId,
              status: TransactionStatus.COMPLETED,
              paymentMethod: existingFeeIncome.paymentMethod,
              externalRef: reversalRef,
            },
          });
        }
      }

      // Reverse SavingsTransaction (deposit into savings account)
      if (
        originalTransaction.type === TransactionType.DEPOSIT &&
        account
      ) {
        const savingsAccount = await tx.savingsAccount.findUnique({
          where: { accountNumber: account.accountNumber },
          select: { id: true, balance: true },
        });
        if (savingsAccount) {
          await tx.savingsTransaction.create({
            data: {
              accountId: savingsAccount.id,
              transactionType: "WITHDRAWAL",
              amount: originalTransaction.amount,
              balanceBefore: savingsAccount.balance,
              balanceAfter: savingsAccount.balance - originalTransaction.amount,
              transactionDate: new Date(),
              reference: reversalRef,
              description: `Reversal of deposit ${originalTransaction.transactionRef}`,
              tellerId: user.id,
              isReversed: true,
              reversedDate: new Date(),
              reversedBy: user.id,
            },
          });
          await tx.savingsAccount.update({
            where: { id: savingsAccount.id },
            data: { balance: { decrement: originalTransaction.amount } },
          });
        }
      }

      // Reverse the double-entry journal entries (and their ChartOfAccount
      // balance effects) that were posted for the original transaction.
      // Safe to call even if no journal entries exist for this record.
      await reverseJournalEntriesForRecord(
        originalTransaction.id,
        user.id,
        `Reversal of ${originalTransaction.transactionRef}: ${reason}`,
        tx,
        new Date(),
        originalTransaction.branchId || undefined,
      );

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
