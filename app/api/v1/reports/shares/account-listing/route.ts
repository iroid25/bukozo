import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import {
  buildShareAccountsListingWorkbook,
  getShareAccountsListingReport,
} from "@/lib/reports/share-portfolio-reports";

export const dynamic = "force-dynamic";

async function handleRequest(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await request.json();
  const report = await getShareAccountsListingReport({
    user: session.user,
    reportDate: params.reportDate || params.report_date || undefined,
    productId: params.productId || params.product_id || undefined,
    status: params.status || undefined,
    minDaysInactive: params.minDaysInactive || params.min_days_inactive || undefined,
    search: params.search || undefined,
    branchId: params.branchId || undefined,
  });

  if ((params.format || "").toString().toLowerCase() !== "json") {
    const buffer = await buildShareAccountsListingWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="shares-accounts-listing-${report.report_date}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: report });
}

export async function POST(request: NextRequest) {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("Error generating shares accounts listing report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate shares accounts listing report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
