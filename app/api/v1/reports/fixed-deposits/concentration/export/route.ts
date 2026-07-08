import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { getAuthUser } from "@/config/useAuth";
import { buildFixedDepositConcentrationWorkbook, getFixedDepositConcentrationReport } from "@/lib/reports/fixed-deposits-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const report = await getFixedDepositConcentrationReport({
      user,
      reportDate: searchParams.get("reportDate") || searchParams.get("asOfDate") || undefined,
      branchId: searchParams.get("branchId") || undefined,
    });

    const buffer = await buildFixedDepositConcentrationWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="fixed-deposits-concentration-${format(new Date(report.reportDate), "yyyyMMdd")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting fixed deposit concentration report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export fixed deposit concentration report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
