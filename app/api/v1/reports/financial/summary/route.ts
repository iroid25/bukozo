import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getDirectBalanceSheetAccounts, getDirectIncomeExpenseAccounts } from "@/lib/reports/direct-source";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/financial/summary - Financial summary (live from journal entries)
export async function GET(request: NextRequest) {
  return generateSummary(request);
}

export async function POST(request: NextRequest) {
  return generateSummary(request);
}

async function generateSummary(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = session.user as any;
    const requestedBranchId = request.nextUrl.searchParams.get("branchId") ||
      (request.method === "POST" ? (await request.json().catch(() => ({})))?.branchId : undefined);
    const branchId = resolveBranchScope(user, requestedBranchId);

    if (!branchId && user.role !== "ADMIN") {
      return NextResponse.json({ data: { totalIncome: 0, totalExpenses: 0, totalAssets: 0, totalLiabilities: 0, totalEquity: 0, netProfit: 0, profitMargin: 0 } });
    }

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [balanceSheetAccounts, incomeExpenseAccounts] = await Promise.all([
      getDirectBalanceSheetAccounts(now, branchId),
      getDirectIncomeExpenseAccounts(startOfYear, now, branchId),
    ]);

    // Calculate totals by ledger type
    const summary = {
      totalIncome: 0,
      totalExpenses: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      netProfit: 0,
      profitMargin: 0,
    };

    [...balanceSheetAccounts, ...incomeExpenseAccounts].forEach((account) => {
      switch (account.ledgerType) {
        case "INCOME":
          summary.totalIncome += account.balance;
          break;
        case "EXPENDITURES":
          summary.totalExpenses += account.balance;
          break;
        case "ASSETS":
          summary.totalAssets += account.balance;
          break;
        case "LIABILITIES":
          summary.totalLiabilities += account.balance;
          break;
        case "EQUITY":
          summary.totalEquity += account.balance;
          break;
      }
    });

    // Calculate net profit and margin
    summary.netProfit = summary.totalIncome - summary.totalExpenses;
    summary.profitMargin = summary.totalIncome > 0 
      ? (summary.netProfit / summary.totalIncome) * 100 
      : 0;

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error generating financial summary:", error);
    return NextResponse.json(
      { error: "Failed to generate financial summary" },
      { status: 500 }
    );
  }
}
