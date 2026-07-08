// actions/reports.ts
"use server";

import { db } from "@/prisma/db";
import { getDepositStatistics } from "./deposits";
import { getLoanStatistics } from "./loans";
import { getWithdrawalStatistics } from "./withdraws";

export interface FinancialSummary {
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

export async function getFinancialSummary(): Promise<FinancialSummary> {
  try {
    const [depositStats, withdrawalStats, loanStats] = await Promise.all([
      getDepositStatistics(),
      getWithdrawalStatistics(),
      getLoanStatistics(),
    ]);

    // Ensure all values are numbers, not objects
    const depositCount =
      typeof depositStats.total.count === "object"
        ? (depositStats.total.count as any)?._count ||
          (depositStats.total.count as any)?.id ||
          0
        : Number(depositStats.total.count) || 0;

    const withdrawalCount =
      typeof withdrawalStats.total.count === "object"
        ? (withdrawalStats.total.count as any)?._count ||
          (withdrawalStats.total.count as any)?.id ||
          0
        : Number(withdrawalStats.total.count) || 0;

    return {
      deposits: {
        today: Number(depositStats.today.amount) || 0,
        thisMonth: Number(depositStats.thisMonth.amount) || 0,
        total: Number(depositStats.total.amount) || 0,
        count: depositCount,
      },
      withdrawals: {
        today: Number(withdrawalStats.today.amount) || 0,
        thisMonth: Number(withdrawalStats.thisMonth.amount) || 0,
        total: Number(withdrawalStats.total.amount) || 0,
        count: withdrawalCount,
      },
      loans: {
        totalDisbursed: Number(loanStats.totalDisbursed) || 0,
        totalOutstanding: Number(loanStats.totalOutstanding) || 0,
        totalRepaid: Number(loanStats.totalRepaid) || 0,
        activeLoans: Number(loanStats.activeLoans) || 0,
        overdueLoans: Number(loanStats.overdueLoans) || 0,
      },
      netFlow: {
        today:
          (Number(depositStats.today.amount) || 0) -
          (Number(withdrawalStats.today.amount) || 0),
        thisMonth:
          (Number(depositStats.thisMonth.amount) || 0) -
          (Number(withdrawalStats.thisMonth.amount) || 0),
        total:
          (Number(depositStats.total.amount) || 0) -
          (Number(withdrawalStats.total.amount) || 0),
      },
    };
  } catch (error) {
    console.error("Error fetching financial summary:", error);
    return {
      deposits: { today: 0, thisMonth: 0, total: 0, count: 0 },
      withdrawals: { today: 0, thisMonth: 0, total: 0, count: 0 },
      loans: {
        totalDisbursed: 0,
        totalOutstanding: 0,
        totalRepaid: 0,
        activeLoans: 0,
        overdueLoans: 0,
      },
      netFlow: { today: 0, thisMonth: 0, total: 0 },
    };
  }
}

export async function getMonthlyTrends(months = 12) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const monthlyData = [];

    for (let i = 0; i < months; i++) {
      const monthStart = new Date();
      monthStart.setMonth(endDate.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthEnd.setHours(23, 59, 59, 999);

      const [deposits, withdrawals, loans] = await Promise.all([
        db.deposit.aggregate({
          where: {
            depositDate: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        db.withdrawal.aggregate({
          where: {
            withdrawalDate: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        db.loan.aggregate({
          where: {
            disbursementDate: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
          _sum: { amountGranted: true },
          _count: { id: true },
        }),
      ]);

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
    }

    return monthlyData;
  } catch (error) {
    console.error("Error fetching monthly trends:", error);
    return [];
  }
}

export async function getTransactionsByDateRange(
  startDate: Date,
  endDate: Date
) {
  try {
    const [deposits, withdrawals, loanRepayments] = await Promise.all([
      db.deposit.findMany({
        where: {
          depositDate: {
            gte: startDate,
            lte: endDate,
          },
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
        orderBy: {
          depositDate: "desc",
        },
      }),
      db.withdrawal.findMany({
        where: {
          withdrawalDate: {
            gte: startDate,
            lte: endDate,
          },
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
        orderBy: {
          withdrawalDate: "desc",
        },
      }),
      db.loanRepayment.findMany({
        where: {
          repaymentDate: {
            gte: startDate,
            lte: endDate,
          },
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
        orderBy: {
          repaymentDate: "desc",
        },
      }),
    ]);

    // Convert dates to strings to avoid serialization issues
    const serializedDeposits = deposits.map((deposit) => ({
      ...deposit,
      depositDate: deposit.depositDate.toISOString(),
      transaction: {
        ...deposit.transaction,
        transactionDate: deposit.transaction.transactionDate.toISOString(),
      },
    }));

    const serializedWithdrawals = withdrawals.map((withdrawal) => ({
      ...withdrawal,
      withdrawalDate: withdrawal.withdrawalDate.toISOString(),
      transaction: {
        ...withdrawal.transaction,
        transactionDate: withdrawal.transaction.transactionDate.toISOString(),
      },
    }));

    const serializedLoanRepayments = loanRepayments.map((repayment) => ({
      ...repayment,
      repaymentDate: repayment.repaymentDate.toISOString(),
    }));

    return {
      deposits: serializedDeposits,
      withdrawals: serializedWithdrawals,
      loanRepayments: serializedLoanRepayments,
    };
  } catch (error) {
    console.error("Error fetching transactions by date range:", error);
    return {
      deposits: [],
      withdrawals: [],
      loanRepayments: [],
    };
  }
}
