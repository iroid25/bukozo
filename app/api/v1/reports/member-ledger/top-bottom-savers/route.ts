import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import {
  buildTopBottomSaversReport,
  buildTopBottomSaversWorkbook,
} from "@/lib/reports/top-bottom-savers-report";

export const dynamic = "force-dynamic";

function parseParams(request: NextRequest, method: "GET" | "POST") {
  if (method === "GET") {
    const { searchParams } = new URL(request.url);
    const accountCategory = searchParams.get("accountCategory") || searchParams.get("account_category") || "savings";
    const rawN = searchParams.get("n") || searchParams.get("limit");
    return {
      accountCategory,
      startDate: searchParams.get("startDate") || searchParams.get("start_date") || searchParams.get("reportDate") || searchParams.get("report_date") || undefined,
      endDate: searchParams.get("endDate") || searchParams.get("end_date") || searchParams.get("reportDate") || searchParams.get("report_date") || undefined,
      mode: (searchParams.get("mode") || "top") as "top" | "bottom",
      n:
        rawN == null || rawN === ""
          ? accountCategory === "shares"
            ? null
            : 40
          : rawN === "all"
            ? null
            : Number(rawN),
      productId: searchParams.get("productId") || searchParams.get("product_id") || undefined,
      excludeZero: searchParams.get("excludeZero") === "true" || searchParams.get("exclude_zero") === "true",
      areaCode: searchParams.get("areaCode") || searchParams.get("area_code") || undefined,
      memberType: searchParams.get("memberType") || searchParams.get("member_type") || undefined,
      includeClosed: searchParams.get("includeClosed") === "true" || searchParams.get("include_closed") === "true",
      format: searchParams.get("format") || undefined,
    };
  }

  return request.json().catch(() => ({}));
}

async function handleRequest(request: NextRequest, method: "GET" | "POST") {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await parseParams(request, method);
  const report = await buildTopBottomSaversReport({
    accountCategory: params.accountCategory === "shares" ? "shares" : "savings",
    startDate: params.startDate || new Date().toISOString().slice(0, 10),
    endDate: params.endDate || new Date().toISOString().slice(0, 10),
    mode: params.mode || "top",
    n: params.n === null || params.n === undefined || Number.isNaN(Number(params.n))
      ? params.accountCategory === "shares"
        ? null
        : 40
      : Number(params.n),
    productId: params.productId,
    excludeZero: !!params.excludeZero,
    areaCode: params.areaCode,
    memberType: params.memberType,
    includeClosed: !!params.includeClosed,
  });

  if ((params.format || "").toString().toLowerCase() === "xlsx") {
    const buffer = await buildTopBottomSaversWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${report.report_meta.account_category === "shares" ? "top-bottom-share-holders" : "top-bottom-savers"}-${report.report_meta.end_date}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: report });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRequest(request, "GET");
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

export async function POST(request: NextRequest) {
  try {
    return await handleRequest(request, "POST");
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
