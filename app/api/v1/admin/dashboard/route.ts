
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { TransactionStatus, LoanStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Fetch all stats in parallel
    const [
      depositStatsToday,
      depositStatsMonth,
      depositStatsTotal,
      loanAppStats,
      userStats,
      loanPortfolioStats,
      recentTransactions,
      recentLoans,
      incomeStatsTotal
    ] = await Promise.all([
      // 1. Deposits
      db.deposit.aggregate({
        where: {
          transaction: { status: TransactionStatus.COMPLETED },
          depositDate: { gte: today, lt: tomorrow },
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.deposit.aggregate({
        where: {
          transaction: { status: TransactionStatus.COMPLETED },
          depositDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.deposit.aggregate({
        where: {
          transaction: { status: TransactionStatus.COMPLETED },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // 2. Loan Applications (individual + institution — an institution's
      // applications live in a separate model and were previously excluded,
      // understating the admin-wide pipeline numbers)
      Promise.all([
        db.loanApplication.count(),
        db.loanApplication.count({ where: { status: "PENDING" } }),
        db.loanApplication.count({ where: { status: "APPROVED" } }),
        db.institutionLoanApplication.count(),
        db.institutionLoanApplication.count({ where: { status: "PENDING" } }),
        db.institutionLoanApplication.count({ where: { status: "APPROVED" } }),
      ]),

      // 3. User Stats
      Promise.all([
        db.user.count({ where: { role: "MEMBER" } }),
        db.institution.count(),
        db.user.count({ where: { isActive: true } }),
      ]),

      // 4. Loan Portfolio (individual + institution — InstitutionLoan is a
      // separate model and was previously excluded, materially understating
      // the system-wide disbursed/outstanding totals)
      Promise.all([
        db.loan.aggregate({
          where: { status: "DISBURSED" },
          _sum: { amountGranted: true, outstandingBalance: true }
        }),
        db.loan.count({ where: { status: "DISBURSED" } }),
        db.loan.count({ where: { status: "OVERDUE" } }),
        db.institutionLoan.aggregate({
          where: { status: "DISBURSED" },
          _sum: { amountGranted: true, outstandingBalance: true },
        }),
        db.institutionLoan.count({ where: { status: "DISBURSED" } }),
        db.institutionLoan.count({ where: { status: "OVERDUE" } }),
      ]),

      // 5. Recent Data
      db.transaction.findMany({
        take: 5,
        orderBy: { transactionDate: "desc" },
        include: {
          member: { include: { user: true } },
          institution: true,
          account: true,
        },
      }),
      db.loan.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          member: { include: { user: true } },
        },
      }),
      db.incomeRecord.aggregate({
        where: {
          status: { in: [TransactionStatus.COMPLETED, "APPROVED" as any] },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        deposits: {
          today: {
            amount: Number(depositStatsToday._sum.amount || 0),
            count: depositStatsToday._count,
          },
          month: {
            amount: Number(depositStatsMonth._sum.amount || 0),
            count: depositStatsMonth._count,
          },
          total: {
            amount: Number(depositStatsTotal._sum.amount || 0),
            count: depositStatsTotal._count,
          },
        },
        loanApps: {
          total: loanAppStats[0] + loanAppStats[3],
          pending: loanAppStats[1] + loanAppStats[4],
          approved: loanAppStats[2] + loanAppStats[5],
        },
        users: {
          members: userStats[0],
          institutions: userStats[1],
          active: userStats[2],
        },
        portfolio: {
          activeDisbursedCount: loanPortfolioStats[1] + loanPortfolioStats[4],
          overdueCount: loanPortfolioStats[2] + loanPortfolioStats[5],
          totalDisbursedAmount:
            Number(loanPortfolioStats[0]._sum.amountGranted || 0) +
            Number(loanPortfolioStats[3]._sum.amountGranted || 0),
          outstandingBalance:
            Number(loanPortfolioStats[0]._sum.outstandingBalance || 0) +
            Number(loanPortfolioStats[3]._sum.outstandingBalance || 0),
        },
        recentTransactions,
        recentLoans,
        income: {
          amount: Number(incomeStatsTotal._sum.amount || 0),
          count: incomeStatsTotal._count,
        },
      },
    });
  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data", details: error.message },
      { status: 500 }
    );
  }
}
