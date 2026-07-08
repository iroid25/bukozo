// app/api/v1/members/me/analytics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

/**
 * GET /api/v1/members/me/analytics
 * Get member's financial analytics for dashboard
 * Auth: Required (MEMBER role)
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Check if user is a member
    if (user.role !== "MEMBER") {
      return NextResponse.json(
        { success: false, error: "Access denied - Member role required" },
        { status: 403 }
      );
    }

    // Get member
    const member = await db.member.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Member profile not found" },
        { status: 404 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get("months") || "6");

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - months);

    // Get all accounts
    const accounts = await db.account.findMany({
      where: {
        memberId: member.id,
      },
      include: {
        accountType: {
          select: {
            name: true,
          },
        },
      },
    });

    // Get transactions for the period
    const transactions = await db.transaction.findMany({
      where: {
        memberId: member.id,
        transactionDate: {
          gte: startDate,
        },
      },
      orderBy: {
        transactionDate: "asc",
      },
    });

    // Get deposits and withdrawals separately
    const deposits = await db.deposit.findMany({
      where: {
        memberId: member.id,
        depositDate: {
          gte: startDate,
        },
      },
      orderBy: {
        depositDate: "asc",
      },
    });

    const withdrawals = await db.withdrawal.findMany({
      where: {
        memberId: member.id,
        withdrawalDate: {
          gte: startDate,
        },
      },
      orderBy: {
        withdrawalDate: "asc",
      },
    });

    // Calculate monthly activity
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthlyActivity: any[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      // Calculate deposits for this month
      const monthDeposits = deposits.filter(
        (d) =>
          new Date(d.depositDate) >= monthStart &&
          new Date(d.depositDate) <= monthEnd
      );
      const monthDepositAmount = monthDeposits.reduce(
        (sum, d) => sum + d.amount,
        0
      );

      // Calculate withdrawals for this month
      const monthWithdrawals = withdrawals.filter(
        (w) =>
          new Date(w.withdrawalDate) >= monthStart &&
          new Date(w.withdrawalDate) <= monthEnd
      );
      const monthWithdrawalAmount = monthWithdrawals.reduce(
        (sum, w) => sum + w.amount,
        0
      );

      // Calculate balance at end of month (approximate)
      const balance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

      monthlyActivity.push({
        month: monthNames[date.getMonth()],
        deposits: monthDepositAmount,
        withdrawals: monthWithdrawalAmount,
        balance,
      });
    }

    // Calculate account distribution
    const accountDistribution = accounts.map((account) => {
      const colorMap: Record<string, string> = {
        Savings: "#3b82f6",
        "Fixed Deposit": "#10b981",
        Current: "#f59e0b",
        Youth: "#8b5cf6",
        Women: "#ec4899",
      };

      return {
        name: account.accountType.name,
        value: account.balance,
        color: colorMap[account.accountType.name] || "#6b7280",
      };
    });

    // Calculate savings goal (default target or from user preferences)
    const savingsAccount = accounts.find(
      (acc) => acc.accountType.name === "Savings"
    );
    const defaultTarget = 30000000; // UGX 30M default

    const savingsGoal = savingsAccount
      ? {
          target: defaultTarget,
          current: savingsAccount.balance,
          percentage:
            Math.round((savingsAccount.balance / defaultTarget) * 100 * 10) /
            10,
        }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        monthlyActivity,
        accountDistribution,
        savingsGoal,
      },
    });
  } catch (error) {
    console.error("Error fetching member analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch analytics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
