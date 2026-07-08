// @ts-nocheck
// actions/loan-account-integration.ts
// actions/loan-account-integration.ts
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

// Generate unique transaction reference
function generateTransactionRef(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `TXN${timestamp}${random}`;
}

// Get loan and account integration data for a member
export async function getLoanAccountIntegration(memberId: string) {
  try {
    // Get member's accounts
    const accounts = await db.account.findMany({
      where: {
        memberId,
        status: "ACTIVE",
      },
      include: {
        accountType: {
          select: {
            name: true,
            interestRate: true,
          },
        },
        branch: {
          select: {
            name: true,
            location: true,
          },
        },
      },
    });

    // Get member's loans
    const loans = await db.loan.findMany({
      where: { memberId },
      include: {
        branch: {
          select: {
            name: true,
            location: true,
          },
        },
        repayments: {
          orderBy: { repaymentDate: "desc" },
          take: 5, // Get last 5 repayments
        },
      },
      orderBy: { disbursementDate: "desc" },
    });

    // Get loan-related transactions
    const loanTransactions = await db.transaction.findMany({
      where: {
        memberId,
        type: { in: ["LOAN_DISBURSEMENT", "LOAN_REPAYMENT"] },
        status: "COMPLETED",
      },
      include: {
        account: {
          select: {
            accountNumber: true,
            accountType: { select: { name: true } },
          },
        },
      },
      orderBy: { transactionDate: "desc" },
      take: 10, // Get last 10 loan transactions
    });

    return {
      accounts,
      loans,
      loanTransactions,
    };
  } catch (error) {
    console.error("Error fetching loan account integration:", error);
    return {
      accounts: [],
      loans: [],
      loanTransactions: [],
    };
  }
}

// Get eligible accounts for loan disbursement
export async function getEligibleAccountsForLoan(memberId: string) {
  try {
    const accounts = await db.account.findMany({
      where: {
        memberId,
        status: "ACTIVE",
        // Only certain account types might be eligible for loan disbursements
        accountType: {
          name: { in: ["Savings", "Current", "Checking"] }, // Adjust based on your account types
        },
      },
      include: {
        accountType: {
          select: {
            name: true,
          },
        },
      },
    });

    return accounts;
  } catch (error) {
    console.error("Error fetching eligible accounts for loan:", error);
    return [];
  }
}

// Process loan disbursement to account
export async function processLoanDisbursement(
  loanId: string,
  accountId: string
) {
  try {
    // Start transaction
    const result = await db.$transaction(async (tx) => {
      // Get loan details
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        include: { member: true },
      });

      if (!loan || loan.status !== "APPROVED") {
        throw new Error("Loan not found or not approved");
      }

      // Get account details
      const account = await tx.account.findUnique({
        where: { id: accountId },
      });

      if (!account || account.memberId !== loan.memberId) {
        throw new Error("Account not found or doesn't belong to loan member");
      }

      // Update loan status to DISBURSED
      const updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: {
          status: "DISBURSED",
          disbursementDate: new Date(),
          outstandingBalance: loan.amountGranted,
        },
      });

      // Update account balance
      const updatedAccount = await tx.account.update({
        where: { id: accountId },
        data: {
          balance: { increment: loan.amountGranted },
        },
      });

      // Create transaction record with required transactionRef
      const transaction = await tx.transaction.create({
        data: {
          transactionRef: generateTransactionRef(), // Add required field
          accountId,
          memberId: loan.memberId,
          type: "LOAN_DISBURSEMENT",
          amount: loan.amountGranted,
          description: `Loan disbursement - ${loan.id}`,
          status: "COMPLETED",
          transactionDate: new Date(),
          channel: "SYSTEM",
        },
      });

      return {
        loan: updatedLoan,
        account: updatedAccount,
        transaction,
      };
    });

    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    console.error("Error processing loan disbursement:", error);
    return {
      success: false,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to process loan disbursement",
    };
  }
}

// Process loan repayment from account
export async function processLoanRepayment(
  loanId: string,
  accountId: string,
  amount: number,
  paymentType: "PRINCIPAL" | "INTEREST" | "BOTH" = "BOTH"
) {
  try {
    // Get current user for handler
    const currentUser = await getAuthUser();
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const result = await db.$transaction(async (tx) => {
      // Get loan details
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
      });

      if (!loan || loan.status !== "DISBURSED") {
        throw new Error("Loan not found or not disbursed");
      }

      // Get account details
      const account = await tx.account.findUnique({
        where: { id: accountId },
      });

      if (!account || account.memberId !== loan.memberId) {
        throw new Error("Account not found or doesn't belong to loan member");
      }

      if (account.balance < amount) {
        throw new Error("Insufficient account balance");
      }

      // Calculate repayment allocation (simplified - you might want more complex logic)
      let principalAmount = 0;
      let interestAmount = 0;

      if (paymentType === "BOTH") {
        // Split between principal and interest based on your business logic
        interestAmount = Math.min(amount * 0.2, loan.outstandingBalance * 0.1); // Example: 20% to interest
        principalAmount = amount - interestAmount;
      } else if (paymentType === "PRINCIPAL") {
        principalAmount = amount;
      } else {
        interestAmount = amount;
      }

      // Update loan
      const newOutstandingBalance = Math.max(
        0,
        loan.outstandingBalance - principalAmount
      );
      const newAmountPaid = loan.amountPaid + amount;

      const updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: {
          outstandingBalance: newOutstandingBalance,
          amountPaid: newAmountPaid,
          status: newOutstandingBalance === 0 ? "REPAID" : loan.status,
        },
      });

      // Update account balance
      const updatedAccount = await tx.account.update({
        where: { id: accountId },
        data: {
          balance: { decrement: amount },
        },
      });

      // Create repayment record
      const repayment = await tx.loanRepayment.create({
        data: {
          loanId,
          memberId: loan.memberId,
          amount,
          handlerUserId: currentUser.id, // Fixed: use current user ID
          channel: "ACCOUNT_DEBIT",
        },
      });

      // Create transaction record with required transactionRef
      const transaction = await tx.transaction.create({
        data: {
          transactionRef: generateTransactionRef(), // Add required field
          accountId,
          memberId: loan.memberId,
          type: "LOAN_REPAYMENT",
          amount,
          description: `Loan repayment - ${loan.id}`,
          status: "COMPLETED",
          transactionDate: new Date(),
          channel: "SYSTEM",
          processedByUserId: currentUser.id, // Add processor
        },
      });

      return {
        loan: updatedLoan,
        account: updatedAccount,
        repayment,
        transaction,
      };
    });

    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    console.error("Error processing loan repayment:", error);
    return {
      success: false,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to process loan repayment",
    };
  }
}

// Get loan repayment history for an account
export async function getLoanRepaymentHistory(memberId: string) {
  try {
    const repayments = await db.loanRepayment.findMany({
      where: {
        loan: { memberId },
      },
      include: {
        loan: {
          select: {
            id: true,
            amountGranted: true,
            outstandingBalance: true,
          },
        },
      },
      orderBy: { repaymentDate: "desc" },
    });

    return repayments;
  } catch (error) {
    console.error("Error fetching loan repayment history:", error);
    return [];
  }
}

// Get member account overview
export async function getMemberAccountOverview(memberId: string) {
  try {
    const accounts = await db.account.findMany({
      where: { memberId },
      include: {
        accountType: true,
        branch: true,
        _count: {
          select: { transactions: true },
        },
      },
    });

    const totalBalance = accounts.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    const accountsByType = accounts.reduce(
      (acc, account) => {
        const typeName = account.accountType.name;
        const existing = acc.find((item) => item.accountType === typeName);

        if (existing) {
          existing.count += 1;
          existing.totalBalance += account.balance;
        } else {
          acc.push({
            accountType: typeName,
            count: 1,
            totalBalance: account.balance,
          });
        }

        return acc;
      },
      [] as Array<{ accountType: string; count: number; totalBalance: number }>
    );

    return {
      totalBalance,
      accountsCount: accounts.length,
      accountsByType,
      accounts, // Include full account details
    };
  } catch (error) {
    console.error("Error fetching member account overview:", error);
    return {
      totalBalance: 0,
      accountsCount: 0,
      accountsByType: [],
      accounts: [],
    };
  }
}

// Get member loan summary
export async function getMemberLoanSummary(memberId: string) {
  try {
    const loans = await db.loan.findMany({
      where: { memberId },
      include: {
        _count: {
          select: { repayments: true },
        },
      },
    });

    const totalLoans = loans.length;
    const activeLoans = loans.filter(
      (loan) => loan.status === "DISBURSED" || loan.status === "OVERDUE"
    ).length;
    const overdueLoans = loans.filter(
      (loan) => loan.status === "OVERDUE"
    ).length;

    const totalLoanAmount = loans.reduce(
      (sum, loan) => sum + loan.amountGranted,
      0
    );
    const outstandingBalance = loans.reduce(
      (sum, loan) => sum + loan.outstandingBalance,
      0
    );
    const totalRepaid = loans.reduce((sum, loan) => sum + loan.amountPaid, 0);

    return {
      totalLoans,
      activeLoans,
      totalLoanAmount,
      outstandingBalance,
      totalRepaid,
      overdueLoans,
    };
  } catch (error) {
    console.error("Error fetching member loan summary:", error);
    return {
      totalLoans: 0,
      activeLoans: 0,
      totalLoanAmount: 0,
      outstandingBalance: 0,
      totalRepaid: 0,
      overdueLoans: 0,
    };
  }
}

// Get transactions by member ID
export async function getTransactionsByMemberId(memberId: string) {
  try {
    const transactions = await db.transaction.findMany({
      where: { memberId },
      include: {
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
      },
      orderBy: { transactionDate: "desc" },
      take: 20, // Get latest 20 transactions
    });

    return transactions;
  } catch (error) {
    console.error("Error fetching member transactions:", error);
    return [];
  }
}
