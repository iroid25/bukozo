import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import {
  buildTopBottomSaversReport,
  buildTopBottomSaversWorkbook,
} from "@/lib/reports/top-bottom-savers-report";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const params = await request.json();
    const user = session.user as any;
    const branchId = resolveBranchScope(user, params.branchId);
    const report = await buildTopBottomSaversReport({
      user: session.user,
      branchId,
      accountCategory: "savings",
      startDate: params.startDate || params.start_date || params.reportDate || params.report_date || new Date().toISOString().slice(0, 10),
      endDate: params.endDate || params.end_date || params.reportDate || params.report_date || new Date().toISOString().slice(0, 10),
      mode: params.mode || "top",
      n: params.n === "all" ? null : Number(params.n || params.limit || 40),
      productId: params.productId || params.product_id || undefined,
      excludeZero: !!(params.excludeZero || params.exclude_zero),
      areaCode: params.areaCode || params.area_code || undefined,
      memberType: params.memberType || params.member_type || undefined,
      includeClosed: !!(params.includeClosed || params.include_closed),
    });

    if ((params.format || "").toString().toLowerCase() === "xlsx") {
      const buffer = await buildTopBottomSaversWorkbook(report);
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="top_bottom_savers_${Date.now()}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error generating top/bottom savers report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate top/bottom savers report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

