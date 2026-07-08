// app/api/v1/branch-manager/trends/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveBranchManagerContext } from "@/lib/branch-manager-context";
import { TransactionType, TransactionStatus, LoanStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { branchId } = await resolveBranchManagerContext(
      {
        id: session.user.id,
        email: session.user.email,
        branchId: (session.user as { branchId?: string | null }).branchId ?? null,
      },
      true
    );

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "User not assigned to a branch" },
        { status: 400 }
      );
    }

    // Get period from query params
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30days";

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    let groupByFormat: string;
    let dateLabels: string[] = [];

    if (period === "7days") {
      startDate.setDate(startDate.getDate() - 7);
      groupByFormat = "day";
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dateLabels.push(date.toISOString().split("T")[0]);
      }
    } else if (period === "30days") {
      startDate.setDate(startDate.getDate() - 30);
      groupByFormat = "day";
      for (let i = 30; i >= 0; i -= 3) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dateLabels.push(date.toISOString().split("T")[0]);
      }
    } else {
      startDate.setMonth(startDate.getMonth() - 12);
      groupByFormat = "month";
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        dateLabels.push(
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        );
      }
    }

    // Fetch all transactions for the period
    const transactions = await db.transaction.findMany({
      where: {
        account: {
          branchId: branchId,
        },
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
        status: TransactionStatus.COMPLETED,
      },
      select: {
        transactionDate: true,
        type: true,
        amount: true,
      },
      orderBy: {
        transactionDate: "asc",
      },
    });

    // Fetch loan disbursements
    const loanDisbursements = await db.loan.findMany({
      where: {
        branchId: branchId,
        disbursementDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: [LoanStatus.DISBURSED, LoanStatus.OVERDUE, LoanStatus.REPAID],
        },
      },
      select: {
        disbursementDate: true,
        amountGranted: true,
      },
    });

    // Fetch new members
    const newMembers = await db.member.findMany({
      where: {
        accounts: {
          some: {
            branchId: branchId,
            openedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      select: {
        accounts: {
          where: {
            branchId: branchId,
          },
          select: {
            openedAt: true,
          },
          take: 1,
        },
      },
    });

    // Group data by date
    const trendsMap = new Map<
      string,
      {
        deposits: number;
        withdrawals: number;
        loanDisbursements: number;
        newMembers: number;
      }
    >();

    // Initialize all dates with zeros
    dateLabels.forEach((label) => {
      trendsMap.set(label, {
        deposits: 0,
        withdrawals: 0,
        loanDisbursements: 0,
        newMembers: 0,
      });
    });

    // Process transactions
    transactions.forEach((transaction) => {
      const date = new Date(transaction.transactionDate);
      let key: string;

      if (groupByFormat === "day") {
        key = date.toISOString().split("T")[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }

      // For 30 days view, group by 3-day intervals
      if (period === "30days") {
        const daysDiff = Math.floor(
          (endDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
        );
        const intervalIndex = Math.floor(daysDiff / 3) * 3;
        const intervalDate = new Date();
        intervalDate.setDate(intervalDate.getDate() - intervalIndex);
        key = intervalDate.toISOString().split("T")[0];
      }

      const existing = trendsMap.get(key);
      if (existing) {
        if (transaction.type === TransactionType.DEPOSIT) {
          existing.deposits += Number(transaction.amount);
        } else if (transaction.type === TransactionType.WITHDRAWAL) {
          existing.withdrawals += Number(transaction.amount);
        }
      }
    });

    // Process loan disbursements
    loanDisbursements.forEach((loan) => {
      if (!loan.disbursementDate) return;

      const date = new Date(loan.disbursementDate);
      let key: string;

      if (groupByFormat === "day") {
        key = date.toISOString().split("T")[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }

      if (period === "30days") {
        const daysDiff = Math.floor(
          (endDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
        );
        const intervalIndex = Math.floor(daysDiff / 3) * 3;
        const intervalDate = new Date();
        intervalDate.setDate(intervalDate.getDate() - intervalIndex);
        key = intervalDate.toISOString().split("T")[0];
      }

      const existing = trendsMap.get(key);
      if (existing) {
        existing.loanDisbursements += Number(loan.amountGranted);
      }
    });

    // Process new members
    newMembers.forEach((member) => {
      if (!member.accounts[0]?.openedAt) return;

      const date = new Date(member.accounts[0].openedAt);
      let key: string;

      if (groupByFormat === "day") {
        key = date.toISOString().split("T")[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }

      if (period === "30days") {
        const daysDiff = Math.floor(
          (endDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
        );
        const intervalIndex = Math.floor(daysDiff / 3) * 3;
        const intervalDate = new Date();
        intervalDate.setDate(intervalDate.getDate() - intervalIndex);
        key = intervalDate.toISOString().split("T")[0];
      }

      const existing = trendsMap.get(key);
      if (existing) {
        existing.newMembers += 1;
      }
    });

    // Convert map to array
    const trends = Array.from(trendsMap.entries()).map(([date, data]) => ({
      date: groupByFormat === "month" ? date : date.substring(5),
      deposits: data.deposits,
      withdrawals: data.withdrawals,
      loanDisbursements: data.loanDisbursements,
      newMembers: data.newMembers,
    }));

    console.log("✅ Branch manager trends generated", {
      period,
      dataPoints: trends.length,
      dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
    });

    return NextResponse.json({
      success: true,
      data: trends,
      period,
    });
  } catch (error) {
    console.error("âŒ Error fetching branch manager trends:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch trends",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
