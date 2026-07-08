import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import {
  buildCashFlowReviewReport,
  buildCashFlowReviewWorkbook,
} from "@/lib/reports/cash-flow-review-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const report = await buildCashFlowReviewReport(
      {
        user: session.user as any,
        branchId: searchParams.get("branchId") || undefined,
        period1Start: searchParams.get("period1Start") || searchParams.get("period1_start") || undefined,
        period1End: searchParams.get("period1End") || searchParams.get("period1_end") || undefined,
        period2Start: searchParams.get("period2Start") || searchParams.get("period2_start") || undefined,
        period2End: searchParams.get("period2End") || searchParams.get("period2_end") || undefined,
      },
      "profit-loss",
    );

    const buffer = await buildCashFlowReviewWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="cash-flow-review-profit-loss-${report.generatedDate.replaceAll("/", "-")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Cash flow review profit/loss export error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export cash flow review profit and loss",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
