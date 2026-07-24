import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import {
  fetchAssetsSummary,
  fetchLiabilitiesSummary,
  fetchEquitySummary,
  fetchIncomeSummary,
  fetchExpenditureSummary,
} from "@/lib/services/accounting";

export const dynamic = "force-dynamic";

// GET /api/v1/chart-of-accounts/unified
// Aggregates data from all 5 ledger types using the SAME query path
// each type-specific page uses. This guarantees the pillar totals and
// account lists match exactly what the Assets, Liabilities, Equity,
// Income, and Expenditure pages show individually.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = session.user as any;
    const searchParams = request.nextUrl.searchParams;
    const branchId = resolveBranchScope(user, searchParams.get("branchId"));

    // Fetch all 5 pillars in parallel from their dedicated data sources
    const [assetsResult, liabilitiesResult, equityResult, incomeResult, expenditureResult] =
      await Promise.all([
        fetchAssetsSummary(branchId),
        fetchLiabilitiesSummary(branchId),
        fetchEquitySummary(branchId),
        fetchIncomeSummary(branchId),
        fetchExpenditureSummary(branchId),
      ]);

    // Build byLedgerType map
    const byLedgerType: Record<string, any> = {
      ASSETS: {
        debits: assetsResult.debits,
        credits: assetsResult.credits,
        balance: assetsResult.totalAssets,
        breakdown: assetsResult,
      },
      LIABILITIES: {
        debits: liabilitiesResult.debits,
        credits: liabilitiesResult.credits,
        balance: liabilitiesResult.totalLiabilities,
        breakdown: liabilitiesResult,
      },
      EQUITY: {
        debits: equityResult.debits,
        credits: equityResult.credits,
        balance: equityResult.totalEquity,
        breakdown: equityResult,
      },
      INCOME: {
        debits: incomeResult.debits,
        credits: incomeResult.credits,
        balance: incomeResult.totalIncome,
        breakdown: incomeResult,
      },
      EXPENDITURES: {
        debits: expenditureResult.debits,
        credits: expenditureResult.credits,
        balance: expenditureResult.totalExpenditure,
        breakdown: expenditureResult,
      },
    };

    const totals: Record<string, { debits: number; credits: number; balance: number }> = {};
    let totalDebits = 0;
    let totalCredits = 0;

    for (const [type, data] of Object.entries(byLedgerType)) {
      totals[type] = {
        debits: data.debits,
        credits: data.credits,
        balance: data.balance,
      };
      totalDebits += data.debits;
      totalCredits += data.credits;
    }

    return NextResponse.json({
      success: true,
      data: {
        byLedgerType,
        totals,
        summary: {
          totalDebits,
          totalCredits,
          isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
          difference: totalDebits - totalCredits,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching unified chart of accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch unified chart of accounts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
