import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import {
  buildShareBatchTotalsWorkbook,
  getShareBatchTotalsReport,
} from "@/lib/reports/share-portfolio-reports";

export const dynamic = "force-dynamic";

async function handleRequest(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await request.json();
  const report = await getShareBatchTotalsReport({
    user: session.user,
    reportDate: params.reportDate || params.report_date || undefined,
    productId: params.productId || params.product_id || undefined,
    batchNumber: params.batchNumber || params.batch_number || undefined,
    memberSearch: params.memberSearch || params.search || undefined,
    minBalance: params.minBalance || params.min_balance || undefined,
    branchId: params.branchId || undefined,
  });

  if ((params.format || "").toString().toLowerCase() !== "json") {
    const buffer = await buildShareBatchTotalsWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="shares-batch-totals-${report.report_date}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: report });
}

export async function POST(request: NextRequest) {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("Error generating shares batch totals report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate shares batch totals report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
