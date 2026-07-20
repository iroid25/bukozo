import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import {
  buildFixedDepositMaturingWorkbook,
  getUpcomingMaturingFixedDepositsReport,
} from "@/lib/reports/fixed-deposits-report";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

function normalizeBranchId(branchId: string | null | undefined) {
  if (!branchId || branchId === "all" || branchId === "ALL") return undefined;
  return branchId;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = resolveBranchScope(user, searchParams.get("branchId") || undefined);
    const report = await getUpcomingMaturingFixedDepositsReport({
      user,
      fromDate: searchParams.get("fromDate") || searchParams.get("from_date") || undefined,
      toDate: searchParams.get("toDate") || searchParams.get("to_date") || undefined,
      branchId: normalizeBranchId(branchId || undefined),
      memberId: searchParams.get("memberId") || undefined,
      memberSearch: searchParams.get("memberSearch") || searchParams.get("search") || undefined,
      productId: searchParams.get("productId") || searchParams.get("product_id") || undefined,
      atMaturityCode: searchParams.get("atMaturityCode") || searchParams.get("at_maturity_code") || undefined,
      daysToMaturity: searchParams.get("daysToMaturity") || searchParams.get("days_to_maturity") || undefined,
    });

    const buffer = await buildFixedDepositMaturingWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="upcoming-maturing-fixed-deposits-${report.dateRange.to}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting fixed deposit maturing report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export fixed deposit maturing report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
