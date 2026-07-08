import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { calculateAccountBalance } from "@/lib/accounting-rules";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/financial/performance?start=YYYY-MM-DD&end=YYYY-MM-DD
// GET /api/v1/reports/financial/performance?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(request: NextRequest) {
  return generatePerformance(request, 'GET');
}

// POST /api/v1/reports/financial/performance
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

    // Get income and expense totals from COA
    const [incomeAccounts, expenseAccounts] = await Promise.all([
      db.chartOfAccount.findMany({
        where: { ledgerType: "INCOME", isActive: true },
        select: { creditBalance: true, debitBalance: true },
      }),
      db.chartOfAccount.findMany({
        where: { ledgerType: "EXPENDITURES", isActive: true },
        select: { debitBalance: true, creditBalance: true },
      }),
    ]);

    const totalIncome = incomeAccounts.reduce(
      (sum, a) => sum + calculateAccountBalance("INCOME", a.debitBalance, a.creditBalance),
      0
    );
    const totalExpenses = expenseAccounts.reduce(
      (sum, a) => sum + calculateAccountBalance("EXPENDITURES", a.debitBalance, a.creditBalance),
      0
    );

    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const returnOnAssets = 0; // Would need asset data
    const returnOnEquity = 0; // Would need equity data

    // Get member and loan counts for additional metrics
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
