// app/api/v1/accounts/my-account/statistics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

// GET /api/v1/accounts/my-account/statistics - Get authenticated user's account statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const member = await db.member.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member record not found" },
        { status: 404 }
      );
    }

    const accounts = await db.account.findMany({
      where: {
        memberId: member.id,
        status: "ACTIVE",
      },
      select: {
        balance: true,
        accountType: {
          select: {
            name: true,
          },
        },
      },
    });

    const [
      totalTransactions,
      todayTransactions,
      thisMonthTransactions,
      totalDeposits,
      totalWithdrawals,
      pendingTransactions,
      failedTransactions,
    ] = await Promise.all([
      db.transaction.count({
        where: {
          memberId: member.id,
          status: "COMPLETED",
        },
      }),
      db.transaction.count({
        where: {
          memberId: member.id,
          status: "COMPLETED",
          transactionDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      db.transaction.count({
        where: {
          memberId: member.id,
          status: "COMPLETED",
          transactionDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      db.transaction.aggregate({
        where: {
          memberId: member.id,
          status: "COMPLETED",
          type: { in: ["DEPOSIT", "LOAN_DISBURSEMENT"] },
        },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: {
          memberId: member.id,
          status: "COMPLETED",
          type: { in: ["WITHDRAWAL", "LOAN_REPAYMENT"] },
        },
        _sum: { amount: true },
      }),
      db.transaction.count({
        where: {
          memberId: member.id,
          status: "PENDING",
        },
      }),
      db.transaction.count({
        where: {
          memberId: member.id,
          status: "FAILED",
        },
      }),
    ]);

    const totalBalance = accounts.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    const loanStats = await db.loan.aggregate({
      where: { memberId: member.id },
      _sum: {
        amountGranted: true,
        outstandingBalance: true,
        amountPaid: true,
      },
      _count: true,
    });

    const activeLoansCount = await db.loan.count({
      where: {
        memberId: member.id,
        status: { in: ["DISBURSED", "OVERDUE"] },
      },
    });

    const typeBreakdown = await db.transaction.groupBy({
      by: ["type"],
      where: {
        memberId: member.id,
        status: "COMPLETED",
      },
      _count: true,
      _sum: { amount: true },
    });

    const channelBreakdown = await db.transaction.groupBy({
      by: ["channel"],
      where: {
        memberId: member.id,
        status: "COMPLETED",
        channel: { not: null },
      },
      _count: true,
      _sum: { amount: true },
    });

    return NextResponse.json({
      data: {
        totalBalance,
        accountsCount: accounts.length,
        accountBalances: accounts.map((account) => ({
          type: account.accountType.name,
          balance: account.balance,
        })),
        totalTransactions,
        todayTransactions,
        thisMonthTransactions,
        todayAmount: 0,
        pendingTransactions,
        failedTransactions,
        totalDeposits: totalDeposits._sum.amount || 0,
        totalWithdrawals: totalWithdrawals._sum.amount || 0,
        totalLoans: loanStats._count || 0,
        activeLoans: activeLoansCount,
        totalLoanAmount: loanStats._sum.amountGranted || 0,
        outstandingLoanBalance: loanStats._sum.outstandingBalance || 0,
        totalLoanRepaid: loanStats._sum.amountPaid || 0,
        typeBreakdown: typeBreakdown.map((item) => ({
          type: item.type,
          count: item._count,
          amount: item._sum.amount || 0,
        })),
        channelBreakdown: channelBreakdown.map((item) => ({
          channel: item.channel || "UNKNOWN",
          count: item._count,
          amount: item._sum.amount || 0,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching account statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}