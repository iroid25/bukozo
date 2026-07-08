import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { buildFixedDepositListingWorkbook, getFixedDepositListingReport } from "@/lib/reports/fixed-deposits-report";

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
    const report = await getFixedDepositListingReport({
      user,
      fromDate: searchParams.get("fromDate") || searchParams.get("startDate") || undefined,
      toDate: searchParams.get("toDate") || searchParams.get("endDate") || undefined,
      branchId: normalizeBranchId(searchParams.get("branchId") || undefined),
      memberId: searchParams.get("memberId") || undefined,
      memberSearch: searchParams.get("memberSearch") || searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
    });

    const buffer = await buildFixedDepositListingWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="fixed-deposit-listings-${report.dateRange.to}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting fixed deposit listing report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export fixed deposit listing report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
