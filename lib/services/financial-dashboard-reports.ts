import { UserRole } from "@prisma/client";
import { db } from "@/prisma/db";

type ReportUser = {
  id: string;
  role: UserRole | string;
  branchId?: string | null;
};

export interface FinancialDashboardSummary {
  deposits: {
    today: number;
    thisMonth: number;
    total: number;
    count: number;
  };
  withdrawals: {
    today: number;
    thisMonth: number;
    total: number;
    count: number;
  };
  loans: {
    totalDisbursed: number;
    totalOutstanding: number;
    totalRepaid: number;
    activeLoans: number;
    overdueLoans: number;
  };
  netFlow: {
    today: number;
    thisMonth: number;
    total: number;
  };
}

function resolveScopedBranchId(user: ReportUser, requestedBranchId?: string | null) {
  if (user.role === UserRole.ADMIN) {
    if (requestedBranchId && requestedBranchId !== "all" && requestedBranchId !== "ALL") {
      return requestedBranchId;
    }
    return undefined;
  }

  return user.branchId || undefined;
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getMonthRange() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export async function getFinancialDashboardSummary(
  user: ReportUser,
  requestedBranchId?: string | null,
): Promise<FinancialDashboardSummary> {
  const branchId = resolveScopedBranchId(user, requestedBranchId);
  const today = getTodayRange();
  const month = getMonthRange();

  const depositBranchWhere = branchId ? { account: { branchId } } : {};
  const withdrawalBranchWhere = branchId ? { account: { branchId } } : {};
  const loanBranchWhere = branchId ? { branchId } : {};

  try {
    const depositsToday = await db.deposit.aggregate({
      where: {
        ...depositBranchWhere,
        depositDate: { gte: today.start, lte: today.end },
      },
      _sum: { amount: true },
    });

    const depositsMonth = await db.deposit.aggregate({
      where: {
        ...depositBranchWhere,
        depositDate: { gte: month.start, lte: month.end },
      },
      _sum: { amount: true },
    });

    const depositsTotal = await db.deposit.aggregate({
      where: depositBranchWhere,
      _sum: { amount: true },
      _count: { id: true },
    });

    const withdrawalsToday = await db.withdrawal.aggregate({
      where: {
        ...withdrawalBranchWhere,
        withdrawalDate: { gte: today.start, lte: today.end },
      },
      _sum: { amount: true },
    });

    const withdrawalsMonth = await db.withdrawal.aggregate({
      where: {
        ...withdrawalBranchWhere,
        withdrawalDate: { gte: month.start, lte: month.end },
      },
      _sum: { amount: true },
    });

    const withdrawalsTotal = await db.withdrawal.aggregate({
      where: withdrawalBranchWhere,
      _sum: { amount: true },
      _count: { id: true },
    });

    const loanSums = await db.loan.aggregate({
      where: loanBranchWhere,
      _sum: {
        amountGranted: true,
        outstandingBalance: true,
        amountPaid: true,
      },
    });

    const activeLoans = await db.loan.count({
      where: {
        ...loanBranchWhere,
        status: { in: ["DISBURSED", "OVERDUE"] },
      },
    });

    const overdueLoans = await db.loan.count({
      where: {
        ...loanBranchWhere,
        status: "OVERDUE",
      },
    });

    const depositsTodayAmount = Number(depositsToday._sum.amount) || 0;
    const depositsMonthAmount = Number(depositsMonth._sum.amount) || 0;
    const depositsTotalAmount = Number(depositsTotal._sum.amount) || 0;

    const withdrawalsTodayAmount = Number(withdrawalsToday._sum.amount) || 0;
    const withdrawalsMonthAmount = Number(withdrawalsMonth._sum.amount) || 0;
    const withdrawalsTotalAmount = Number(withdrawalsTotal._sum.amount) || 0;

    return {
      deposits: {
        today: depositsTodayAmount,
        thisMonth: depositsMonthAmount,
        total: depositsTotalAmount,
        count: Number(depositsTotal._count.id) || 0,
      },
      withdrawals: {
        today: withdrawalsTodayAmount,
        thisMonth: withdrawalsMonthAmount,
        total: withdrawalsTotalAmount,
        count: Number(withdrawalsTotal._count.id) || 0,
      },
      loans: {
        totalDisbursed: Number(loanSums._sum.amountGranted) || 0,
        totalOutstanding: Number(loanSums._sum.outstandingBalance) || 0,
        totalRepaid: Number(loanSums._sum.amountPaid) || 0,
        activeLoans,
        overdueLoans,
      },
      netFlow: {
        today: depositsTodayAmount - withdrawalsTodayAmount,
        thisMonth: depositsMonthAmount - withdrawalsMonthAmount,
        total: depositsTotalAmount - withdrawalsTotalAmount,
      },
    };
  } catch (err: any) {
    console.error("Database query failed in getFinancialDashboardSummary:", err);
    throw new Error(err.message || String(err));
  }
}

export async function getFinancialDashboardTrends(
  user: ReportUser,
  months = 12,
  requestedBranchId?: string | null,
) {
  const branchId = resolveScopedBranchId(user, requestedBranchId);

  const monthlyData = [];

  for (let i = 0; i < months; i += 1) {
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - i);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    monthEnd.setHours(23, 59, 59, 999);

    const depositWhere = {
      depositDate: { gte: monthStart, lte: monthEnd },
      ...(branchId ? { account: { branchId } } : {}),
    };

    const withdrawalWhere = {
      withdrawalDate: { gte: monthStart, lte: monthEnd },
      ...(branchId ? { account: { branchId } } : {}),
    };

    const loanWhere = {
      disbursementDate: { gte: monthStart, lte: monthEnd },
      ...(branchId ? { branchId } : {}),
    };

    try {
      // Execute sequentially inside the loop to avoid large concurrency spikes
      const deposits = await db.deposit.aggregate({
        where: depositWhere,
        _sum: { amount: true },
        _count: { id: true },
      });

      const withdrawals = await db.withdrawal.aggregate({
        where: withdrawalWhere,
        _sum: { amount: true },
        _count: { id: true },
      });

      const loans = await db.loan.aggregate({
        where: loanWhere,
        _sum: { amountGranted: true },
        _count: { id: true },
      });

      monthlyData.unshift({
        month: monthStart.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        deposits: Number(deposits._sum.amount) || 0,
        withdrawals: Number(withdrawals._sum.amount) || 0,
        loans: Number(loans._sum.amountGranted) || 0,
        netFlow:
          (Number(deposits._sum.amount) || 0) -
          (Number(withdrawals._sum.amount) || 0),
        depositCount: Number(deposits._count.id) || 0,
        withdrawalCount: Number(withdrawals._count.id) || 0,
        loanCount: Number(loans._count.id) || 0,
      });
    } catch (err: any) {
      console.error(`Error processing month ${monthStart.toISOString()}:`, err);
      throw new Error(`Trends query failed: ${err.message}`);
    }
  }

  return monthlyData;
}

export async function getFinancialTransactionsByDateRange(
  user: ReportUser,
  startDate: Date,
  endDate: Date,
  requestedBranchId?: string | null,
) {
  const branchId = resolveScopedBranchId(user, requestedBranchId);

  const [deposits, withdrawals, loanRepayments] = await Promise.all([
    db.deposit.findMany({
      where: {
        depositDate: {
          gte: startDate,
          lte: endDate,
        },
        ...(branchId ? { account: { branchId } } : {}),
      },
      include: {
        transaction: true,
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        handler: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { depositDate: "desc" },
    }),
    db.withdrawal.findMany({
      where: {
        withdrawalDate: {
          gte: startDate,
          lte: endDate,
        },
        ...(branchId ? { account: { branchId } } : {}),
      },
      include: {
        transaction: true,
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        handler: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { withdrawalDate: "desc" },
    }),
    db.loanRepayment.findMany({
      where: {
        repaymentDate: {
          gte: startDate,
          lte: endDate,
        },
        ...(branchId ? { loan: { branchId } } : {}),
      },
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        handler: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { repaymentDate: "desc" },
    }),
  ]);

  return {
    deposits: deposits.map((deposit) => ({
      ...deposit,
      depositDate: deposit.depositDate.toISOString(),
      transaction: deposit.transaction
        ? {
            ...deposit.transaction,
            transactionDate: deposit.transaction.transactionDate.toISOString(),
          }
        : null,
    })),
    withdrawals: withdrawals.map((withdrawal) => ({
      ...withdrawal,
      withdrawalDate: withdrawal.withdrawalDate.toISOString(),
      transaction: withdrawal.transaction
        ? {
            ...withdrawal.transaction,
            transactionDate:
              withdrawal.transaction.transactionDate.toISOString(),
          }
        : null,
    })),
    loanRepayments: loanRepayments.map((repayment) => ({
      ...repayment,
      repaymentDate: repayment.repaymentDate.toISOString(),
    })),
  };
}
