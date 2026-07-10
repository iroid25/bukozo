import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { successResponse, ApiErrors, validateRequired } from "@/lib/api-utils";
import { createSplitLoanRepaymentJournalEntry } from "@/lib/journal-entries-extended";
import { LoanService } from "@/services/loan.service";

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
    const handlerBranchId = (session.user as any).branchId || undefined;
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

    // Execute repayment in transaction
    const result = await db.$transaction(async (tx) => {
      const transactionRef = `LRP-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      const {
        interest: interestPortion,
        penalty: penaltyPortion,
        principal: principalPortion,
      } = await LoanService.calculateRepaymentSplit(loan, amount, {
        interestAmount: body.interestAmount,
        penaltyAmount: body.penaltyAmount,
        principalAmount: body.principalAmount,
      });

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

      const loanParentCategory = await tx.budgetCategory.upsert({
        where: { code: "401000" },
        update: { name: "Loan related income" },
        create: {
          name: "Loan related income",
          code: "401000",
          kind: "INCOME",
          description: "Loan related income including fees, interest and penalties",
          isActive: true,
        },
      });

      if (interestPortion > 0) {
        const interestCategory = await tx.budgetCategory.upsert({
          where: { code: "401001" },
          update: {
            parentId: loanParentCategory.id,
            name: "Interest paid",
            kind: "INCOME",
            isActive: true,
          },
          create: {
            name: "Interest paid",
            code: "401001",
            kind: "INCOME",
            description: "Interest from loans",
            isActive: true,
            parentId: loanParentCategory.id,
          },
        });

        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: interestCategory.id,
            amount: interestPortion,
            date: new Date(),
            recordDate: new Date(),
            description: `Loan repayment interest - ${transactionRef}`,
            paymentMethod: channel === "CASH" ? "CASH" : channel === "MOBILE_MONEY" ? "MOBILE_MONEY" : "BANK",
            branchId: loan.branchId || handlerBranchId,
            memberId: loan.memberId,
            receivedByUserId: handlerUserId,
            status: "COMPLETED",
            receiptNo: `LRI-${Date.now()}`,
            notes: `Principal posted separately to loans asset account`,
          },
        });
      }

      if (penaltyPortion > 0) {
        const penaltyCategory = await tx.budgetCategory.upsert({
          where: { code: "401005" },
          update: {
            parentId: loanParentCategory.id,
            name: "Loan penalty paid",
            kind: "INCOME",
            isActive: true,
          },
          create: {
            name: "Loan penalty paid",
            code: "401005",
            kind: "INCOME",
            description: "Penalty income from overdue loans",
            isActive: true,
            parentId: loanParentCategory.id,
          },
        });

        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: penaltyCategory.id,
            amount: penaltyPortion,
            date: new Date(),
            recordDate: new Date(),
            description: `Loan repayment penalty - ${transactionRef}`,
            paymentMethod: channel === "CASH" ? "CASH" : channel === "MOBILE_MONEY" ? "MOBILE_MONEY" : "BANK",
            branchId: loan.branchId || handlerBranchId,
            memberId: loan.memberId,
            receivedByUserId: handlerUserId,
            status: "COMPLETED",
            receiptNo: `LRP-${Date.now()}`,
            notes: `Penalty income posted from loan repayment`,
          },
        });
      }

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

      // Create journal entries using the shared repayment splitter so principal,
      // interest, and penalty all hit the right accounting buckets.
      await createSplitLoanRepaymentJournalEntry(
        {
          principalAmount: principalPortion,
          interestAmount: interestPortion,
          penaltyAmount: penaltyPortion,
          description: `Loan repayment - ${transactionRef}`,
          reference: transactionRef,
          transactionId: transaction.id,
          userId: handlerUserId,
          entryDate: new Date(),
          branchId: loan.branchId || undefined,
          ledgerAccountId: loan.loanApplication?.loanProduct?.ledgerAccountId || undefined,
          interestAccountId: loan.loanApplication?.loanProduct?.interestAccountId || undefined,
          penaltyAccountId: loan.loanApplication?.loanProduct?.penaltyAccountId || undefined,
        },
        tx,
      );

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
