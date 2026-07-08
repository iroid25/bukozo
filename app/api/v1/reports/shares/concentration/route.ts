import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { buildShareConcentrationWorkbook, getShareConcentrationReport } from "@/lib/reports/share-concentration-report";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const params = await request.json();
    const report = await getShareConcentrationReport({
      user,
      reportDate: params.reportDate || params.report_date || undefined,
      branchId: params.branchId || undefined,
      excludeNonFinancial:
        params.excludeNonFinancial ?? params.exclude_non_financial ?? true,
    });

    if (params.format && params.format !== "JSON") {
      const buffer = await buildShareConcentrationWorkbook(report);
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="shares-concentration-${report.reportDate}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error generating share concentration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
