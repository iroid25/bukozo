"use server";

import { db } from "@/prisma/db";
import type {
  Member,
  User,
  Account,
  Loan,
  Transaction,
  Deposit,
  Withdrawal,
  Statement,
} from "@prisma/client";

// =====================
// Type Definitions
// =====================

type MemberWithUser = Member & {
  user: User;
  accounts: Account[];
};

type AccountWithRelations = Account & {
  accountType: {
    id: string;
    name: string;
    interestRate: number;
    minBalance: number;
  };
  branch: {
    id: string;
    name: string;
    location: string;
  };
};

type LoanWithRelations = Loan & {
  loanApplication: {
    id: string;
    loanProduct: {
      id: string;
      name: string;
      interestRate: number;
    };
    amountApplied: number;
    applicationDate: Date;
    status: string;
  };
  branch: {
    id: string;
    name: string;
  } | null;
};

type TransactionWithRelations = Transaction & {
  account: {
    id: string;
    accountNumber: string;
  };
  processedByUser: {
    id: string;
    name: string;
  } | null;
};

type DepositWithRelations = Deposit & {
  transaction: {
    id: string;
    transactionRef: string;
    status: string;
    transactionDate: Date;
  };
  account: {
    id: string;
    accountNumber: string;
    accountType: {
      id: string;
      name: string;
    };
  };
  handler: {
    id: string;
    name: string;
  };
};

type WithdrawalWithRelations = Withdrawal & {
  transaction: {
    id: string;
    transactionRef: string;
    status: string;
    transactionDate: Date;
  };
  account: {
    id: string;
    accountNumber: string;
    accountType: {
      id: string;
      name: string;
    };
  };
  handler: {
    id: string;
    name: string;
  };
};

type StatementWithUser = Statement & {
  user: {
    id: string;
    name: string;
  } | null;
};

// =====================
// Member Functions
// =====================

/**
 * Get a member by ID with user details
 */
export async function getMember(id: string): Promise<MemberWithUser | null> {
  try {
    const member = await db.member.findUnique({
      where: { id },
      include: {
        user: true,
        accounts: true,
      },
    });
    return member;
  } catch (error) {
    console.error("Failed to fetch member:", error);
    throw new Error("Failed to fetch member");
  }
}

/**
 * Get member by member number
 */
export async function getMemberByNumber(
  memberNumber: string
): Promise<MemberWithUser | null> {
  try {
    const member = await db.member.findUnique({
      where: { memberNumber },
      include: {
        user: true,
        accounts: true,
      },
    });
    return member;
  } catch (error) {
    console.error("Failed to fetch member by number:", error);
    throw new Error("Failed to fetch member by number");
  }
}

/**
 * Get member by user ID
 */
export async function getMemberByUserId(
  userId: string
): Promise<MemberWithUser | null> {
  try {
    const member = await db.member.findUnique({
      where: { userId },
      include: {
        user: true,
        accounts: true,
      },
    });
    return member;
  } catch (error) {
    console.error("Failed to fetch member by user ID:", error);
    throw new Error("Failed to fetch member by user ID");
  }
}

// =====================
// Account Functions
// =====================

/**
 * Get member accounts with full details
 */
export async function getMemberAccounts(
  memberId: string
): Promise<AccountWithRelations[]> {
  try {
    const accounts = await db.account.findMany({
      where: { memberId },
      include: {
        accountType: {
          select: {
            id: true,
            name: true,
            interestRate: true,
            minBalance: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
      orderBy: {
        openedAt: "desc",
      },
    });
    return accounts;
  } catch (error) {
    console.error("Failed to fetch member accounts:", error);
    throw new Error("Failed to fetch member accounts");
  }
}

/**
 * Get single account details
 */
export async function getAccountById(
  accountId: string
): Promise<AccountWithRelations | null> {
  try {
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        accountType: {
          select: {
            id: true,
            name: true,
            interestRate: true,
            minBalance: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });
    return account;
  } catch (error) {
    console.error("Failed to fetch account:", error);
    throw new Error("Failed to fetch account");
  }
}

/**
 * Get total balance across all member accounts
 */
export async function getMemberTotalBalance(memberId: string): Promise<number> {
  try {
    const accounts = await db.account.findMany({
      where: {
        memberId,
        status: "ACTIVE",
      },
      select: {
        balance: true,
      },
    });

    return accounts.reduce((total, account) => total + account.balance, 0);
  } catch (error) {
    console.error("Failed to calculate total balance:", error);
    throw new Error("Failed to calculate total balance");
  }
}

// =====================
// Loan Functions
// =====================

/**
 * Get member loans with full details
 */
export async function getMemberLoans(
  memberId: string
): Promise<LoanWithRelations[]> {
  try {
    const loans = await db.loan.findMany({
      where: { memberId },
      include: {
        loanApplication: {
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                interestRate: true,
              },
            },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        disbursementDate: "desc",
      },
    });
    return loans;
  } catch (error) {
    console.error("Failed to fetch member loans:", error);
    throw new Error("Failed to fetch member loans");
  }
}

/**
 * Get active loans for a member
 */
export async function getMemberActiveLoans(
  memberId: string
): Promise<LoanWithRelations[]> {
  try {
    const loans = await db.loan.findMany({
      where: {
        memberId,
        status: {
          in: ["DISBURSED", "APPROVED"],
        },
      },
      include: {
        loanApplication: {
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                interestRate: true,
              },
            },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        disbursementDate: "desc",
      },
    });
    return loans;
  } catch (error) {
    console.error("Failed to fetch active loans:", error);
    throw new Error("Failed to fetch active loans");
  }
}

/**
 * Get total outstanding loan balance
 */
export async function getMemberOutstandingLoanBalance(
  memberId: string
): Promise<number> {
  try {
    const loans = await db.loan.findMany({
      where: {
        memberId,
        status: {
          in: ["DISBURSED", "APPROVED"],
        },
      },
      select: {
        outstandingBalance: true,
      },
    });

    return loans.reduce((total, loan) => total + loan.outstandingBalance, 0);
  } catch (error) {
    console.error("Failed to calculate outstanding balance:", error);
    throw new Error("Failed to calculate outstanding balance");
  }
}

// =====================
// Transaction Functions
// =====================

/**
 * Get member transactions
 */
export async function getMemberTransactions(
  memberId: string,
  limit?: number
): Promise<TransactionWithRelations[]> {
  try {
    const transactions = await db.transaction.findMany({
      where: { memberId },
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
          },
        },
        processedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
      take: limit,
    });
    return transactions;
  } catch (error) {
    console.error("Failed to fetch member transactions:", error);
    throw new Error("Failed to fetch member transactions");
  }
}

/**
 * Get transactions by date range
 */
export async function getMemberTransactionsByDateRange(
  memberId: string,
  startDate: Date,
  endDate: Date
): Promise<TransactionWithRelations[]> {
  try {
    const transactions = await db.transaction.findMany({
      where: {
        memberId,
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
          },
        },
        processedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });
    return transactions;
  } catch (error) {
    console.error("Failed to fetch transactions by date range:", error);
    throw new Error("Failed to fetch transactions by date range");
  }
}

// =====================
// Deposit Functions
// =====================

/**
 * Get member deposits
 */
export async function getMemberDeposits(
  memberId: string,
  limit?: number
): Promise<DepositWithRelations[]> {
  try {
    const deposits = await db.deposit.findMany({
      where: { memberId },
      include: {
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            status: true,
            transactionDate: true,
          },
        },
        account: {
          select: {
            id: true,
            accountNumber: true,
            accountType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        handler: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        depositDate: "desc",
      },
      take: limit,
    });
    return deposits;
  } catch (error) {
    console.error("Failed to fetch member deposits:", error);
    throw new Error("Failed to fetch member deposits");
  }
}

/**
 * Get total deposits for a period
 */
export async function getMemberTotalDeposits(
  memberId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  try {
    const whereClause: any = { memberId };

    if (startDate && endDate) {
      whereClause.depositDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const deposits = await db.deposit.findMany({
      where: whereClause,
      select: {
        amount: true,
      },
    });

    return deposits.reduce((total, deposit) => total + deposit.amount, 0);
  } catch (error) {
    console.error("Failed to calculate total deposits:", error);
    throw new Error("Failed to calculate total deposits");
  }
}

// =====================
// Withdrawal Functions
// =====================

/**
 * Get member withdrawals
 */
export async function getMemberWithdrawals(
  memberId: string,
  limit?: number
): Promise<WithdrawalWithRelations[]> {
  try {
    const withdrawals = await db.withdrawal.findMany({
      where: { memberId },
      include: {
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            status: true,
            transactionDate: true,
          },
        },
        account: {
          select: {
            id: true,
            accountNumber: true,
            accountType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        handler: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        withdrawalDate: "desc",
      },
      take: limit,
    });
    return withdrawals;
  } catch (error) {
    console.error("Failed to fetch member withdrawals:", error);
    throw new Error("Failed to fetch member withdrawals");
  }
}

/**
 * Get total withdrawals for a period
 */
export async function getMemberTotalWithdrawals(
  memberId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  try {
    const whereClause: any = { memberId };

    if (startDate && endDate) {
      whereClause.withdrawalDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const withdrawals = await db.withdrawal.findMany({
      where: whereClause,
      select: {
        amount: true,
      },
    });

    return withdrawals.reduce(
      (total, withdrawal) => total + withdrawal.amount,
      0
    );
  } catch (error) {
    console.error("Failed to calculate total withdrawals:", error);
    throw new Error("Failed to calculate total withdrawals");
  }
}

// =====================
// Statement Functions
// =====================

/**
 * Get member statements
 
// ... (keep all your existing type definitions and functions)

/**
 * Get member statements - Updated to return transformed Statement type
 */
export async function getMemberStatements(memberId: string): Promise<any[]> {
  try {
    const statements = await db.statement.findMany({
      where: { memberId },
      include: {
        member: {
          include: {
            user: true,
            accounts: {
              include: {
                accountType: true,
                branch: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
    });

    return statements.map((statement) => ({
      ...statement,
      statementDate: statement.generatedAt,
      periodStart: statement.startDate,
      periodEnd: statement.endDate || new Date(),
      fileUrl: statement.pdfPath,
      generatedByUserId: statement.userId,
      generatedByUser: statement.user
        ? {
            id: statement.user.id,
            name: statement.user.name,
            role: statement.user.role,
          }
        : null,
    })) as any[];
  } catch (error) {
    console.error("Failed to fetch member statements:", error);
    return [];
  }
}

/**
 * Generate a new statement for a member
 */
export async function generateMemberStatement(
  memberId: string,
  userId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Statement> {
  try {
    const statement = await db.statement.create({
      data: {
        memberId,
        userId: userId,
        startDate: periodStart,
        endDate: periodEnd,
        generatedAt: new Date(),
        pdfPath: `/statements/statement-${
          periodStart.toISOString().split("T")[0]
        }-${periodEnd.toISOString().split("T")[0]}.pdf`,
      },
    });

    return statement;
  } catch (error) {
    console.error("Failed to generate statement:", error);
    throw new Error("Failed to generate statement");
  }
}

// ... (keep all your other functions)

/**
 * Get statement by ID
 */
export async function getStatementById(
  statementId: string
): Promise<StatementWithUser | null> {
  try {
    const statement = await db.statement.findUnique({
      where: { id: statementId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return statement;
  } catch (error) {
    console.error("Failed to fetch statement:", error);
    throw new Error("Failed to fetch statement");
  }
}

/**
 * Generate a new statement for a member
 

// =====================
// Summary/Statistics Functions
// =====================

/**
 * Get comprehensive member summary
 */

/**
 * Get member financial statistics
 */

/**
 * Check if member can take a loan
 */

/**
 * Get comprehensive member summary
 */
export async function getMemberSummary(memberId: string) {
  try {
    const [
      member,
      accounts,
      loans,
      totalBalance,
      outstandingBalance,
      recentTransactions,
      recentDeposits,
      recentWithdrawals,
    ] = await Promise.all([
      getMember(memberId),
      getMemberAccounts(memberId),
      getMemberLoans(memberId),
      getMemberTotalBalance(memberId),
      getMemberOutstandingLoanBalance(memberId),
      getMemberTransactions(memberId, 10),
      getMemberDeposits(memberId, 5),
      getMemberWithdrawals(memberId, 5),
    ]);

    return {
      member,
      accounts,
      loans,
      totalBalance,
      outstandingBalance,
      netWorth: totalBalance - outstandingBalance,
      recentTransactions,
      recentDeposits,
      recentWithdrawals,
    };
  } catch (error) {
    console.error("Failed to fetch member summary:", error);
    throw new Error("Failed to fetch member summary");
  }
}

/**
 * Get member financial statistics
 */
export async function getMemberFinancialStats(
  memberId: string,
  startDate?: Date,
  endDate?: Date
) {
  try {
    const [totalDeposits, totalWithdrawals, totalBalance, outstandingBalance] =
      await Promise.all([
        getMemberTotalDeposits(memberId, startDate, endDate),
        getMemberTotalWithdrawals(memberId, startDate, endDate),
        getMemberTotalBalance(memberId),
        getMemberOutstandingLoanBalance(memberId),
      ]);

    return {
      totalDeposits,
      totalWithdrawals,
      netDeposits: totalDeposits - totalWithdrawals,
      totalBalance,
      outstandingBalance,
      netWorth: totalBalance - outstandingBalance,
      period: {
        startDate,
        endDate,
      },
    };
  } catch (error) {
    console.error("Failed to fetch financial statistics:", error);
    throw new Error("Failed to fetch financial statistics");
  }
}

/**
 * Check if member can take a loan
 */
export async function canMemberTakeLoan(memberId: string): Promise<{
  canTakeLoan: boolean;
  reason?: string;
  eligibleAmount?: number;
}> {
  try {
    const member = await db.member.findUnique({
      where: { id: memberId },
      select: {
        isApproved: true,
      },
    });

    if (!member || !member.isApproved) {
      return {
        canTakeLoan: false,
        reason: "Member not approved",
      };
    }

    const activeLoans = await getMemberActiveLoans(memberId);
    const totalBalance = await getMemberTotalBalance(memberId);
    const outstandingBalance = await getMemberOutstandingLoanBalance(memberId);

    // Business logic: Member can borrow up to 3x their total balance
    // and must not have more than 2 active loans
    const maxLoanAmount = totalBalance * 3;
    const eligibleAmount = maxLoanAmount - outstandingBalance;

    if (activeLoans.length >= 2) {
      return {
        canTakeLoan: false,
        reason: "Maximum number of active loans reached (2)",
        eligibleAmount: 0,
      };
    }

    if (eligibleAmount <= 0) {
      return {
        canTakeLoan: false,
        reason: "No eligible loan amount available",
        eligibleAmount: 0,
      };
    }

    return {
      canTakeLoan: true,
      eligibleAmount,
    };
  } catch (error) {
    console.error("Failed to check loan eligibility:", error);
    throw new Error("Failed to check loan eligibility");
  }
}
