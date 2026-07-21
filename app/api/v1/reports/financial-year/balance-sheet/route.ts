import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import { buildFinancialYearBalanceSheetReport } from "@/lib/reports/financial-year-balance-sheet-report";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalizeBranchId(branchId: string | null | undefined) {
  if (!branchId || branchId === "all" || branchId === "ALL") return undefined;
  return branchId;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const report = await buildFinancialYearBalanceSheetReport({
      user: session.user,
      branchId: resolveBranchScope(
        { role: (session.user as any).role, branchId: (session.user as any).branchId },
        normalizeBranchId(searchParams.get("branchId") || undefined),
      ),
      financialYearId: searchParams.get("financialYearId") || searchParams.get("financial_year_id") || undefined,
      year: searchParams.get("year") ? Number(searchParams.get("year")) : undefined,
      fromDate: searchParams.get("fromDate") || searchParams.get("from_date") || undefined,
      toDate: searchParams.get("toDate") || searchParams.get("to_date") || undefined,
      fyStart: searchParams.get("fyStart") || searchParams.get("fy_start") || undefined,
    });

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error generating FY balance sheet:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate financial year balance sheet",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
