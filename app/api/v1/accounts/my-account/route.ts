// app/api/v1/accounts/my-account/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

/**
 * GET /api/v1/accounts/my-accounts
 * Get all accounts for the logged-in member
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

    // Get all member's accounts
    const accounts = await db.account.findMany({
      where: {
        memberId: member.id,
      },
      include: {
        accountType: {
          select: {
            id: true,
            name: true,
            interestRate: true,
            interestPeriod: true,
            minBalance: true,
            isLoanEligible: true,
            canWithdraw: true,
            earnsDividends: true,
            hasFixedPeriod: true,
            fixedPeriodMonths: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        transactions: {
          orderBy: {
            transactionDate: "desc",
          },
          take: 1,
          select: {
            transactionDate: true,
          },
        },
      },
      orderBy: {
        openedAt: "desc",
      },
    });

    // Calculate maturity date for fixed deposits
    const enrichedAccounts = accounts.map((account) => {
      let maturityDate = null;

      if (
        account.accountType.hasFixedPeriod &&
        account.accountType.fixedPeriodMonths
      ) {
        const openDate = new Date(account.openedAt);
        maturityDate = new Date(
          openDate.setMonth(
            openDate.getMonth() + account.accountType.fixedPeriodMonths
          )
        );
      }

      return {
        id: account.id,
        accountNumber: account.accountNumber,
        accountType: account.accountType.name,
        accountTypeDetails: account.accountType,
        balance: account.balance,
        status: account.status,
        openDate: account.openedAt,
        closedDate: account.closedAt,
        maturityDate,
        interestRate: account.accountType.interestRate,
        lastTransaction:
          account.transactions.length > 0
            ? account.transactions[0].transactionDate
            : account.openedAt,
        branch: account.branch,
      };
    });

    // Calculate total balance
    const totalBalance = accounts.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    // Calculate account distribution for pie chart
    const accountDistribution = accounts.reduce((acc: any[], account) => {
      const existing = acc.find(
        (item) => item.name === account.accountType.name
      );

      if (existing) {
        existing.value += account.balance;
        existing.count += 1;
      } else {
        // Assign colors based on account type
        const colorMap: Record<string, string> = {
          Savings: "#3b82f6",
          "Fixed Deposit": "#10b981",
          Current: "#f59e0b",
          Youth: "#8b5cf6",
          Women: "#ec4899",
        };

        acc.push({
          name: account.accountType.name,
          value: account.balance,
          count: 1,
          color: colorMap[account.accountType.name] || "#6b7280",
        });
      }

      return acc;
    }, []);

    return NextResponse.json({
      success: true,
      data: {
        accounts: enrichedAccounts,
        totalBalance,
        accountDistribution,
      },
    });
  } catch (error) {
    console.error("Error fetching member accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch accounts",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
