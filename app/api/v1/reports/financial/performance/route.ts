import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { getDirectIncomeExpenseAccounts } from "@/lib/reports/direct-source";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/financial/performance?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(request: NextRequest) {
  return generatePerformance(request, 'GET');
}

export async function POST(request: NextRequest) {
  return generatePerformance(request, 'POST');
}

async function generatePerformance(request: NextRequest, method: 'GET' | 'POST') {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let startDate: string | null = null;
    let endDate: string | null = null;

    if (method === 'GET') {
      const { searchParams } = new URL(request.url);
      startDate = searchParams.get("start");
      endDate = searchParams.get("end");
    } else {
      const body = await request.json();
      startDate = body.startDate || body.start;
      endDate = body.endDate || body.end;
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 }
      );
    }

    // Get income and expense totals — direct source from budget categories + records
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const directAccounts = await getDirectIncomeExpenseAccounts(start, end);
    const totalIncome = directAccounts
      .filter((a) => a.ledgerType === "INCOME")
      .reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = directAccounts
      .filter((a) => a.ledgerType === "EXPENDITURES")
      .reduce((sum, a) => sum + a.balance, 0);

    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const returnOnAssets = 0;
    const returnOnEquity = 0;

    const [memberCount, loanCount, activeLoans] = await Promise.all([
      db.member.count({ where: { isApproved: true } }),
      db.loan.count(),
      db.loan.count({ where: { status: { in: ["DISBURSED", "OVERDUE"] } } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        reportType: "Performance Metrics",
        period: { startDate, endDate },
        financial: {
          totalIncome,
          totalExpenses,
          netProfit,
          profitMargin,
          returnOnAssets,
          returnOnEquity,
        },
        operational: {
          totalMembers: memberCount,
          totalLoans: loanCount,
          activeLoans,
          loanUtilization: loanCount > 0 ? (activeLoans / loanCount) * 100 : 0,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating performance metrics:", error);
    return NextResponse.json(
      { error: "Failed to generate performance metrics" },
      { status: 500 }
    );
  }
}
