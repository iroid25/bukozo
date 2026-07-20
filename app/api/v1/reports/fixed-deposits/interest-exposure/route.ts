import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import {
  buildInterestExposureReport,
  buildInterestExposureWorkbook,
} from "@/lib/reports/interest-exposure-report";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

function normalizeBranchId(branchId: string | null | undefined) {
  const value = branchId?.trim();
  return value && value.toLowerCase() !== "all" ? value : undefined;
}

function parseQuery(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return {
    reportDate: searchParams.get("reportDate") || searchParams.get("report_date") || undefined,
    productId: searchParams.get("productId") || searchParams.get("product_id") || undefined,
    memberSearch: searchParams.get("memberSearch") || searchParams.get("search") || undefined,
    depositPeriod: searchParams.get("depositPeriod") || searchParams.get("deposit_period") || undefined,
    maturityFrom: searchParams.get("maturityFrom") || searchParams.get("maturity_from") || undefined,
    maturityTo: searchParams.get("maturityTo") || searchParams.get("maturity_to") || undefined,
    branchId: normalizeBranchId(searchParams.get("branchId")),
    format: searchParams.get("format") || undefined,
  };
}

async function handleRequest(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = parseQuery(request);
  const branchId = resolveBranchScope(user, params.branchId);
  const report = await buildInterestExposureReport({
    user,
    reportDate: params.reportDate,
    productId: params.productId,
    memberSearch: params.memberSearch,
    depositPeriod: params.depositPeriod,
    maturityFrom: params.maturityFrom,
    maturityTo: params.maturityTo,
    branchId,
  });

  if ((params.format || "").toLowerCase() === "xlsx") {
    const buffer = await buildInterestExposureWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="interest-exposure-${report.report_meta.report_date.replaceAll("/", "-")}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: report });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("Error generating interest exposure report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate interest exposure report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const branchId = resolveBranchScope(user, body.branchId);
    const report = await buildInterestExposureReport({
      user,
      reportDate: body.reportDate || body.report_date,
      productId: body.productId || body.product_id,
      memberSearch: body.memberSearch || body.search,
      depositPeriod: body.depositPeriod || body.deposit_period,
      maturityFrom: body.maturityFrom || body.maturity_from,
      maturityTo: body.maturityTo || body.maturity_to,
      branchId,
    });

    if ((body.format || "").toString().toLowerCase() === "xlsx") {
      const buffer = await buildInterestExposureWorkbook(report);
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="interest-exposure-${report.report_meta.report_date.replaceAll("/", "-")}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error generating interest exposure report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate interest exposure report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
