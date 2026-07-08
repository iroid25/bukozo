import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import {
  buildShareZeroBalanceWorkbook,
  getShareZeroBalanceReport,
} from "@/lib/reports/share-movement-reports";

export const dynamic = "force-dynamic";

async function handleRequest(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await request.json();
  const report = await getShareZeroBalanceReport({
    user: session.user,
    reportDate: params.reportDate || params.report_date || undefined,
    productId: params.productId || params.product_id || undefined,
    gender: params.gender || undefined,
    areaCode: params.areaCode || params.area_code || undefined,
    idCardType: params.idCardType || params.id_card_type || undefined,
    memberSearch: params.memberSearch || params.member_search || undefined,
    branchId: params.branchId || undefined,
  });

  if ((params.format || "").toString().toLowerCase() !== "json") {
    const buffer = await buildShareZeroBalanceWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="shares-zero-balance-${report.report_date}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: report });
}

export async function POST(request: NextRequest) {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("Error generating shares zero balance report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate shares zero balance report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
