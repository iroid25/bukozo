import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

/**
 * POST: Securely edit a transaction amount (Management only)
 * This handles corrections for typos (e.g., 40,000 to 400,000)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const user = await getAuthUser();
    
    // 1. Authorization: Managers and Admins ONLY
    if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Transaction edits require Manager or Admin privileges." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { newAmount, reason } = body;

    // 2. Validation
    if (newAmount === undefined || isNaN(Number(newAmount)) || Number(newAmount) < 0) {
      return NextResponse.json({ success: false, error: "Invalid amount provided." }, { status: 400 });
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ success: false, error: "A valid reason (min 5 chars) is required for the audit trail." }, { status: 400 });
    }

    const correctedAmount = Number(newAmount);

    const result = await db.$transaction(async (tx) => {
      // 3. Fetch transaction with related entities
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: {
          deposit: true,
          withdrawal: true,
          journalEntries: true,
          accountTransactions: true,
          account: true,
        },
      });

      if (!transaction) throw new Error("Transaction not found.");
      if (transaction.status === "REVERSED") throw new Error("Cannot edit a transaction that has already been reversed.");

      const oldAmount = transaction.amount;
      const diff = correctedAmount - oldAmount;

      if (diff === 0) return { transactionId, message: "No changes detected." };

      // 4. Update core Transaction record
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          amount: correctedAmount,
          notes: transaction.notes 
            ? `${transaction.notes} | Correction: ${reason} (Prev: ${oldAmount})` 
            : `Correction: ${reason} (Prev: ${oldAmount})`,
        },
      });

      // 5. Handle specific operation types (Deposit/Withdrawal)
      if (transaction.deposit) {
        await tx.deposit.update({
          where: { id: transaction.deposit.id },
          data: { amount: correctedAmount }
        });
        
        // Update Account Balance (Deposit adds to balance)
        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: diff } }
        });
      }

      if (transaction.withdrawal) {
        await tx.withdrawal.update({
          where: { id: transaction.withdrawal.id },
          data: { amount: correctedAmount }
        });
        
        // Update Account Balance (Withdrawal subtracts from balance)
        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { decrement: diff } }
        });
      }

      // Check for Loan Repayment (via relationship or transaction type)
      if (transaction.type === "LOAN_REPAYMENT" && transaction.loanId) {
        const repayment = await tx.loanRepayment.findFirst({
           where: { transactionId: transaction.id }
        });
        if (repayment) {
            await tx.loanRepayment.update({
                where: { id: repayment.id },
                data: { amount: correctedAmount }
            });
            
            // Note: Robust principal/interest splitting adjustment would require re-running loan logic.
            // For a simple correction, we at least update the recorded amount.
        }
        
        // Update Loan balance
        // If they repaid MORE than originally recorded (diff > 0), the LOAN balance should DECREASE more.
        await tx.loan.update({
           where: { id: transaction.loanId },
           data: {
               amountPaid: { increment: diff },
               outstandingBalance: { decrement: diff }
           }
        });
      }

      // 6. Synchronize General Ledger (Journal Entries)
      for (const je of transaction.journalEntries) {
        const isDebit = je.debitAmount > 0;
        
        // Update Journal Entry
        await tx.journalEntry.update({
          where: { id: je.id },
          data: {
            debitAmount: isDebit ? correctedAmount : 0,
            creditAmount: !isDebit ? correctedAmount : 0,
          }
        });

        // Update Chart of Accounts balances
        const coa = await tx.chartOfAccount.findUnique({ where: { id: je.accountId } });
        if (coa) {
          // NATURAL BALANCE LOGIC:
          // Assets/Expenses: Balance = Debits - Credits
          // Liabilities/Income/Equity: Balance = Credits - Debits
          const isDebitNatural = ["ASSETS", "EXPENDITURES"].includes(coa.ledgerType);
          
          let balanceUpdateValue = isDebit ? diff : -diff; // Impact on Asset
          if (!isDebitNatural) balanceUpdateValue = -balanceUpdateValue; // Reverse for L/E/I

          await tx.chartOfAccount.update({
            where: { id: je.accountId },
            data: {
              debitBalance: isDebit ? { increment: diff } : undefined,
              creditBalance: !isDebit ? { increment: diff } : undefined,
              balance: { increment: balanceUpdateValue }
            }
          });
        }
      }

      // 7. Log Immutable Audit Trail
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "RECONCILIATION_CORRECTION",
          entityType: "TRANSACTION",
          entityId: transactionId,
          oldValue: { amount: oldAmount, type: transaction.type },
          newValue: { amount: correctedAmount, reason },
          details: { 
            diff, 
            ref: transaction.transactionRef,
            account: transaction.account.accountNumber
          },
          timestamp: new Date(),
        },
      });

      return {
        id: transactionId,
        oldAmount,
        newAmount: correctedAmount,
        diff
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Transaction Edit Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to edit transaction." }, { status: 500 });
  }
}
