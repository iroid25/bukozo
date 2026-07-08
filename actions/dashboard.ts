// @ts-nocheck
// actions/dashboard.ts
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export type AnalyticsTimeframe = {
  today: number;
  week: number; // Last 7 days
  month: number; // Last 28 days
  total: number;
};

export type MoneyAnalyticsTimeframe = {
  today: {
    amount: number;
    count: {
      id: number;
    };
  };
  week: {
    amount: number;
    count: {
      id: number;
    };
  };
  month: {
    amount: number;
    count: {
      id: number;
    };
  };
  total: {
    amount: number;
    count: {
      id: number;
    };
  };
};

export type DashboardAnalytics = {
  users: AnalyticsTimeframe;
  members: AnalyticsTimeframe;
  deposits: MoneyAnalyticsTimeframe;
  withdrawals: MoneyAnalyticsTimeframe;
  loans: MoneyAnalyticsTimeframe;
  mobileMoneyDeposits: MoneyAnalyticsTimeframe;
  accounts: AnalyticsTimeframe;
  statements: AnalyticsTimeframe;
};

// User Analytics
async function getUserAnalytics(
  today: Date,
  last7Days: Date,
  last28Days: Date
): Promise<AnalyticsTimeframe> {
  const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
    db.user.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    }),
    db.user.count({
      where: {
        createdAt: {
          gte: last7Days,
        },
      },
    }),
    db.user.count({
      where: {
        createdAt: {
          gte: last28Days,
        },
      },
    }),
    db.user.count(),
  ]);

  return {
    today: todayCount,
    week: weekCount,
    month: monthCount,
    total: totalCount,
  };
}

// Deposit Analytics
async function getDepositAnalytics(
  today: Date,
  last7Days: Date,
  last28Days: Date
): Promise<MoneyAnalyticsTimeframe> {
  const [todayStats, weekStats, monthStats, totalStats] = await Promise.all([
    db.deposit.aggregate({
      where: {
        depositDate: {
          gte: today,
        },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.deposit.aggregate({
      where: {
        depositDate: {
          gte: last7Days,
        },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.deposit.aggregate({
      where: {
        depositDate: {
          gte: last28Days,
        },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.deposit.aggregate({
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  return {
    today: {
      amount: todayStats._sum.amount || 0,
      count: todayStats._count || 0,
    },
    week: { amount: weekStats._sum.amount || 0, count: weekStats._count || 0 },
    month: {
      amount: monthStats._sum.amount || 0,
      count: monthStats._count || 0,
    },
    total: {
      amount: totalStats._sum.amount || 0,
      count: totalStats._count || 0,
    },
  };
}

// Withdrawal Analytics
async function getWithdrawalAnalytics(
  today: Date,
  last7Days: Date,
  last28Days: Date
): Promise<MoneyAnalyticsTimeframe> {
  const [todayStats, weekStats, monthStats, totalStats] = await Promise.all([
    db.withdrawal.aggregate({
      where: {
        withdrawalDate: {
          gte: today,
        },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.withdrawal.aggregate({
      where: {
        withdrawalDate: {
          gte: last7Days,
        },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.withdrawal.aggregate({
      where: {
        withdrawalDate: {
          gte: last28Days,
        },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.withdrawal.aggregate({
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  return {
    today: {
      amount: todayStats._sum.amount || 0,
      count: todayStats._count || 0,
    },
    week: { amount: weekStats._sum.amount || 0, count: weekStats._count || 0 },
    month: {
      amount: monthStats._sum.amount || 0,
      count: monthStats._count || 0,
    },
    total: {
      amount: totalStats._sum.amount || 0,
      count: totalStats._count || 0,
    },
  };
}

// Loan Analytics
async function getLoanAnalytics(
  today: Date,
  last7Days: Date,
  last28Days: Date
): Promise<MoneyAnalyticsTimeframe> {
  const [todayStats, weekStats, monthStats, totalStats] = await Promise.all([
    db.loan.aggregate({
      where: {
        disbursementDate: {
          gte: today,
        },
      },
      _sum: { amountGranted: true },
      _count: { id: true },
    }),
    db.loan.aggregate({
      where: {
        disbursementDate: {
          gte: last7Days,
        },
      },
      _sum: { amountGranted: true },
      _count: { id: true },
    }),
    db.loan.aggregate({
      where: {
        disbursementDate: {
          gte: last28Days,
        },
      },
      _sum: { amountGranted: true },
      _count: { id: true },
    }),
    db.loan.aggregate({
      _sum: { amountGranted: true },
      _count: { id: true },
    }),
  ]);

  return {
    today: {
      amount: todayStats._sum.amountGranted || 0,
      count: todayStats._count || 0,
    },
    week: {
      amount: weekStats._sum.amountGranted || 0,
      count: weekStats._count || 0,
    },
    month: {
      amount: monthStats._sum.amountGranted || 0,
      count: monthStats._count || 0,
    },
    total: {
      amount: totalStats._sum.amountGranted || 0,
      count: totalStats._count || 0,
    },
  };
}

// Mobile Money Deposit Analytics
async function getMobileMoneyDepositAnalytics(
  today: Date,
  last7Days: Date,
  last28Days: Date
): Promise<MoneyAnalyticsTimeframe> {
  const [todayStats, weekStats, monthStats, totalStats] = await Promise.all([
    db.deposit.aggregate({
      where: {
        channel: "Mobile Money",
        depositDate: {
          gte: today,
        },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.deposit.aggregate({
      where: {
        channel: "Mobile Money",
        depositDate: {
          gte: last7Days,
        },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.deposit.aggregate({
      where: {
        channel: "Mobile Money",
        depositDate: {
          gte: last28Days,
        },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.deposit.aggregate({
      where: {
        channel: "Mobile Money",
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  return {
    today: {
      amount: todayStats._sum.amount || 0,
      count: todayStats._count || 0,
    },
    week: { amount: weekStats._sum.amount || 0, count: weekStats._count || 0 },
    month: {
      amount: monthStats._sum.amount || 0,
      count: monthStats._count || 0,
    },
    total: {
      amount: totalStats._sum.amount || 0,
      count: totalStats._count || 0,
    },
  };
}

// Account Analytics
async function getAccountAnalytics(
  today: Date,
  last7Days: Date,
  last28Days: Date
): Promise<AnalyticsTimeframe> {
  const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
    db.account.count({
      where: {
        openedAt: {
          gte: today,
        },
        status: "ACTIVE",
      },
    }),
    db.account.count({
      where: {
        openedAt: {
          gte: last7Days,
        },
        status: "ACTIVE",
      },
    }),
    db.account.count({
      where: {
        openedAt: {
          gte: last28Days,
        },
        status: "ACTIVE",
      },
    }),
    db.account.count({
      where: {
        status: "ACTIVE",
      },
    }),
  ]);

  return {
    today: todayCount,
    week: weekCount,
    month: monthCount,
    total: totalCount,
  };
}

// Statement Analytics
async function getStatementAnalytics(
  today: Date,
  last7Days: Date,
  last28Days: Date
): Promise<AnalyticsTimeframe> {
  const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
    db.statement.count({
      where: {
        statementDate: {
          gte: today,
        },
      },
    }),
    db.statement.count({
      where: {
        statementDate: {
          gte: last7Days,
        },
      },
    }),
    db.statement.count({
      where: {
        statementDate: {
          gte: last28Days,
        },
      },
    }),
    db.statement.count(),
  ]);

  return {
    today: todayCount,
    week: weekCount,
    month: monthCount,
    total: totalCount,
  };
}

export async function getDashboardAnalytics(
  userRole?: string,
  userId?: string,
  branchId?: string
) {
  try {
    const isGlobalAdmin = userRole === "ADMIN";
    const branchFilter = (!isGlobalAdmin && branchId) ? { branchId } : {};
    const memberBranchFilter = (!isGlobalAdmin && branchId) ? { user: { branchId } } : {};

    const baseAnalytics = {
      totalMembers: await db.member.count({ 
        where: { 
          isApproved: true,
          ...memberBranchFilter
        } 
      }),
      totalAccounts: await db.account.count({ 
        where: { 
          status: "ACTIVE",
          ...branchFilter
        } 
      }),
      totalTransactions: await db.transaction.count({
        where: { 
          status: "COMPLETED",
          ...( (!isGlobalAdmin && branchId) ? { account: { branchId } } : {} )
        },
      }),
      totalBalance:
        (
          await db.account.aggregate({
            _sum: { balance: true },
            where: { 
              status: "ACTIVE",
              ...branchFilter
            },
          })
        )._sum.balance || 0,
    };

    // Role-specific analytics
    switch (userRole) {
      case "ADMIN":
        return getAdminAnalytics(baseAnalytics);
      case "BRANCHMANAGER":
        return getBranchManagerAnalytics(baseAnalytics, userId);
      case "TELLER":
      case "AGENT":
        return getTellerAgentAnalytics(baseAnalytics, userId);
      case "LOANOFFICER":
        return getLoanOfficerAnalytics(baseAnalytics);
      case "ACCOUNTANT":
        return getAccountantAnalytics(baseAnalytics);
      case "MEMBER":
        return getMemberAnalytics(baseAnalytics, userId);
      default:
        return baseAnalytics;
    }
  } catch (error) {
    console.error("Error fetching dashboard analytics:", error);
    return {
      totalMembers: 0,
      totalAccounts: 0,
      totalTransactions: 0,
      totalBalance: 0,
    };
  }
}

async function getAdminAnalytics(base: any) {
  const additional = await Promise.all([
    db.user.count(),
    db.branch.count(),
    db.loan.count({ where: { status: "OVERDUE" } }),
    db.loan.aggregate({ _sum: { outstandingBalance: true } }),
  ]);

  return {
    ...base,
    totalUsers: additional[0],
    totalBranches: additional[1],
    overdueLoans: additional[2],
    totalLoanBalance: additional[3]._sum.outstandingBalance || 0,
  };
}

async function getBranchManagerAnalytics(base: any, userId?: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { branchId: true },
  });

  if (!user?.branchId) return base;

  const branchStats = await Promise.all([
    db.user.count({ where: { branchId: user.branchId, isActive: true } }),
    db.account.count({ where: { branchId: user.branchId, status: "ACTIVE" } }),
    db.loan.count({ where: { branchId: user.branchId } }),
    db.floatAllocation.aggregate({
      _sum: { amount: true },
      where: { branchId: user.branchId },
    }),
  ]);

  return {
    ...base,
    branchUsers: branchStats[0],
    branchAccounts: branchStats[1],
    branchLoans: branchStats[2],
    totalFloatAllocated: branchStats[3]._sum.amount || 0,
  };
}

async function getTellerAgentAnalytics(base: any, userId?: string) {
  const userFloat = await db.userFloat.findUnique({
    where: { userId },
    include: {
      floatTransactions: {
        where: {
          transactionDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      },
    },
  });

  const todayTransactions = await db.transaction.count({
    where: {
      processedByUserId: userId,
      transactionDate: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  });

  return {
    ...base,
    floatBalance: userFloat?.balance || 0,
    todayTransactions,
    floatTransactionsToday: userFloat?.floatTransactions.length || 0,
    lastReconciliation: userFloat?.lastReconciliation,
  };
}

async function getLoanOfficerAnalytics(base: any) {
  const loanStats = await Promise.all([
    db.loanApplication.count({ where: { status: "PENDING" } }),
    db.loan.count({ where: { status: "DISBURSED" } }),
    db.loan.count({ where: { status: "OVERDUE" } }),
    db.loan.aggregate({ _sum: { outstandingBalance: true } }),
  ]);

  return {
    ...base,
    pendingApplications: loanStats[0],
    activeLoans: loanStats[1],
    overdueLoans: loanStats[2],
    totalOutstanding: loanStats[3]._sum.outstandingBalance || 0,
  };
}

async function getAccountantAnalytics(base: any) {
  const financialStats = await Promise.all([
    db.floatAllocation.aggregate({ _sum: { amount: true } }),
    db.deposit.aggregate({ _sum: { amount: true } }),
    db.withdrawal.aggregate({ _sum: { amount: true } }),
    db.userFloat.count(),
  ]);

  return {
    ...base,
    totalFloatAllocated: financialStats[0]._sum.amount || 0,
    totalDeposits: financialStats[1]._sum.amount || 0,
    totalWithdrawals: financialStats[2]._sum.amount || 0,
    activeFloats: financialStats[3],
  };
}

async function getMemberAnalytics(base: any, userId?: string) {
  const member = await db.member.findUnique({
    where: { userId },
    include: {
      accounts: { where: { status: "ACTIVE" } },
      loans: true,
    },
  });

  // Return safe defaults if member not found
  if (!member) {
    return {
      ...base,
      myAccounts: 0,
      myBalance: 0,
      myLoans: 0,
      myOutstandingLoans: 0,
    };
  }

  const memberBalance = member.accounts.reduce(
    (sum, acc) => sum + (acc.balance || 0),
    0
  );
  const outstandingLoans = member.loans
    .filter((loan) => ["DISBURSED", "OVERDUE"].includes(loan.status))
    .reduce((sum, loan) => sum + (loan.outstandingBalance || 0), 0);

  return {
    ...base,
    myAccounts: member.accounts.length,
    myBalance: memberBalance,
    myLoans: member.loans.length,
    myOutstandingLoans: outstandingLoans,
  };
}

// Role-specific recent data functions
export async function getRecentUsers() {
  return db.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      isActive: true,
    },
  });
}

export async function getRecentMembers(branchId?: string) {
  let targetBranchId = branchId;
  if (!targetBranchId) {
    const user = await getAuthUser();
    if (user && user.role !== "ADMIN") {
      targetBranchId = user.branchId;
    }
  }

  const where = targetBranchId ? { user: { branchId: targetBranchId } } : {};
  return db.member.findMany({
    where,
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { name: true, email: true, phone: true },
      },
    },
  });
}

export async function getRecentTransactions(branchId?: string) {
  let targetBranchId = branchId;
  if (!targetBranchId) {
    const user = await getAuthUser();
    if (user && user.role !== "ADMIN") {
      targetBranchId = user.branchId;
    }
  }

  const where = targetBranchId ? { account: { branchId: targetBranchId } } : {};
  return db.transaction.findMany({
    where,
    take: 5,
    orderBy: { transactionDate: "desc" },
    include: {
      member: {
        include: { user: { select: { name: true } } },
      },
      account: {
        include: { accountType: { select: { name: true } } },
      },
    },
  });
}

export async function getRecentDeposits(branchId?: string) {
  let targetBranchId = branchId;
  if (!targetBranchId) {
    const user = await getAuthUser();
    if (user && user.role !== "ADMIN") {
      targetBranchId = user.branchId;
    }
  }

  const where = targetBranchId ? { account: { branchId: targetBranchId } } : {};
  return db.deposit.findMany({
    where,
    take: 5,
    orderBy: { depositDate: "desc" },
    include: {
      member: {
        include: { user: { select: { name: true } } },
      },
      account: {
        include: { accountType: { select: { name: true } } },
      },
    },
  });
}

export async function getRecentLoans(branchId?: string) {
  let targetBranchId = branchId;
  if (!targetBranchId) {
    const user = await getAuthUser();
    if (user && user.role !== "ADMIN") {
      targetBranchId = user.branchId;
    }
  }

  const where = targetBranchId ? { branchId: targetBranchId } : {};
  return db.loan.findMany({
    where,
    take: 5,
    orderBy: { disbursementDate: "desc" },
    include: {
      member: {
        include: { user: { select: { name: true } } },
      },
    },
  });
}

export async function getRecentFloatAllocations(branchId?: string) {
  let targetBranchId = branchId;
  if (!targetBranchId) {
    const user = await getAuthUser();
    if (user && user.role !== "ADMIN") {
      targetBranchId = user.branchId;
    }
  }

  const where = targetBranchId ? { branchId: targetBranchId } : {};
  return db.floatAllocation.findMany({
    where,
    take: 5,
    orderBy: { allocationDate: "desc" },
    include: {
      tellerAgent: { select: { name: true, role: true } },
      branch: { select: { name: true } },
    },
  });
}
