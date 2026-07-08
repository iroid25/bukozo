import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { successResponse, ApiErrors, validateRequired } from "@/lib/api-utils";

// POST /api/v1/loans/{loanId}/repayments - Make loan repayment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const handlerUserId = (session.user as any).id;
    const { id: loanId } = await params;
    const body = await request.json();

    // Validate required fields
    const validationError = validateRequired(body, ["amount", "channel"]);
    if (validationError) {
      return ApiErrors.validationError(validationError);
    }

    const { amount, channel, mobileMoneyRef, description, accountId: bodyAccountId } = body;

    if (amount <= 0) {
      return ApiErrors.validationError("Amount must be greater than zero");
    }

    // Fetch loan details
    const loan = await db.loan.findUnique({
      where: { id: loanId },
      include: {
        member: {
          include: {
            user: true,
            accounts: {
              where: { status: "ACTIVE" },
              take: 1
            }
          },
        },
        loanApplication: {
          include: {
            loanProduct: true,
          }
        },
      },
    });

    if (!loan) {
      return ApiErrors.notFound("Loan");
    }

    // Determine accountId for the transaction
    const accountId = bodyAccountId || (loan.member.accounts[0]?.id);
    
    if (!accountId) {
      return ApiErrors.validationError("Member must have an active account to process repayment transaction");
    }

    if (loan.status !== "DISBURSED") {
      return ApiErrors.validationError("Loan is not in active repayment status");
    }

    // Calculate outstanding balance
    const totalRepaid = await db.loanRepayment.aggregate({
      where: { loanId },
      _sum: { amount: true },
    });

    const outstandingBalance = loan.totalAmountDue - (totalRepaid._sum.amount || 0);

    if (amount > outstandingBalance) {
      return ApiErrors.validationError(
        `Repayment amount (${amount.toLocaleString()}) exceeds outstanding balance (${outstandingBalance.toLocaleString()})`
      );
    }

    // Fetch Chart of Accounts
    const [cashAccount, loansReceivableAccount, interestIncomeAccount] = await Promise.all([
      db.chartOfAccount.findFirst({
        where: { accountCode: "102001", isActive: true },
      }),
      db.chartOfAccount.findFirst({
        where: {
          ledgerType: "ASSETS",
          accountName: { contains: "LOAN", mode: "insensitive" },
          isActive: true,
        },
      }),
      db.chartOfAccount.findFirst({
        where: {
          ledgerType: "INCOME",
          accountName: { contains: "INTEREST", mode: "insensitive" },
          isActive: true,
        },
      }),
    ]);

    // Execute repayment in transaction
    const result = await db.$transaction(async (tx) => {
      const transactionRef = `LRP-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
      const entryNumber = `JE-LRP-${Date.now()}`;

      // Calculate principal and interest portions
      const interestRate = loan.interestRate / 100;
      const totalInterest = loan.totalAmountDue - loan.amountGranted;
      const interestPortion = Math.min(
        amount * (totalInterest / loan.totalAmountDue),
        totalInterest - (loan.interestPaid || 0)
      );
      const principalPortion = amount - interestPortion;

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          transactionRef,
          accountId,
          type: TransactionType.LOAN_REPAYMENT,
          amount,
          status: TransactionStatus.COMPLETED,
          description: description || `Loan repayment for ${loan.id}`,
          memberId: loan.memberId,
          processedByUserId: handlerUserId,
          channel,
        },
      });

      // Create loan repayment record
      const repayment = await tx.loanRepayment.create({
        data: {
          loanId,
          memberId: loan.memberId,
          amount,
          principalPaid: principalPortion,
          interestPaid: interestPortion,
          handlerUserId,
          channel,
          mobileMoneyRef: mobileMoneyRef || null,
          transactionId: transaction.id,
        },
      });

      // Update loan balances
      const newAmountPaid = loan.amountPaid + amount;
      const newOutstandingBalance = Math.max(0, loan.outstandingBalance - amount);
      const isFullyRepaid = newOutstandingBalance <= 0;
      const newStatus = isFullyRepaid 
        ? "REPAID" 
        : loan.status === "OVERDUE" ? "OVERDUE" : "DISBURSED";

      await tx.loan.update({
        where: { id: loanId },
        data: {
          amountPaid: newAmountPaid,
          outstandingBalance: newOutstandingBalance,
          principalPaid: (loan.principalPaid || 0) + principalPortion,
          interestPaid: (loan.interestPaid || 0) + interestPortion,
          status: newStatus,
        },
      });

      // Create journal entries
      if (cashAccount && loansReceivableAccount && interestIncomeAccount) {
        // Dr: Cash (Asset increases)
        // Cr: Loans Receivable (Asset decreases) - Principal portion
        // Cr: Interest Income (Income) - Interest portion

        await tx.journalEntry.createMany({
          data: [
            {
              entryNumber,
              accountId: cashAccount.id,
              debitAmount: amount,
              creditAmount: 0,
              description: `Loan repayment - ${transactionRef}`,
              transactionId: transaction.id,
              createdByUserId: handlerUserId,
            },
            {
              entryNumber,
              accountId: loansReceivableAccount.id,
              debitAmount: 0,
              creditAmount: principalPortion,
              description: `Principal repayment - ${transactionRef}`,
              transactionId: transaction.id,
              createdByUserId: handlerUserId,
            },
            {
              entryNumber,
              accountId: interestIncomeAccount.id,
              debitAmount: 0,
              creditAmount: interestPortion,
              description: `Interest income - ${transactionRef}`,
              transactionId: transaction.id,
              createdByUserId: handlerUserId,
            },
          ],
        });

        // Update Chart of Accounts balances
        await tx.chartOfAccount.update({
          where: { id: cashAccount.id },
          data: {
            debitBalance: { increment: amount },
            balance: { increment: amount },
          },
        });

        await tx.chartOfAccount.update({
          where: { id: loansReceivableAccount.id },
          data: {
            creditBalance: { increment: principalPortion },
            balance: { decrement: principalPortion },
          },
        });

        await tx.chartOfAccount.update({
          where: { id: interestIncomeAccount.id },
          data: {
            creditBalance: { increment: interestPortion },
            balance: { increment: interestPortion },
          },
        });
      }

      // Update handler float if CASH
      if (channel === "CASH") {
        const userFloat = await tx.userFloat.findUnique({
          where: { userId: handlerUserId },
        });

        if (userFloat) {
          await tx.userFloat.update({
            where: { userId: handlerUserId },
            data: { balance: { increment: amount } },
          });

          await tx.floatTransaction.create({
            data: {
              floatId: userFloat.id,
              type: TransactionType.LOAN_REPAYMENT,
              amount,
              description: `Loan repayment received - ${transactionRef}`,
              performedByUserId: handlerUserId,
              relatedTransactionId: transaction.id,
            },
          });
        }
      }

      // Send notification
      if (loan.member?.userId) {
        await tx.notification.create({
          data: {
            userId: loan.member.userId,
            type: "IN_APP",
            subject: "Loan Repayment Successful",
            message: `Loan repayment processed successfully.\n\nAmount Paid: UGX ${amount.toLocaleString()}\nPrincipal: UGX ${principalPortion.toLocaleString()}\nInterest: UGX ${interestPortion.toLocaleString()}\n\nOutstanding Balance: UGX ${newOutstandingBalance.toLocaleString()}\nReference: ${transactionRef}`,
          },
        });
      }

      return {
        repayment,
        transactionRef,
        principalPaid: principalPortion,
        interestPaid: interestPortion,
        newOutstandingBalance,
        loanStatus: newStatus,
      };
    });

    return successResponse(result, "Loan repayment processed successfully", 201);
  } catch (error: any) {
    console.error("Error processing loan repayment:", error);
    return ApiErrors.internalError(error.message);
  }
}
