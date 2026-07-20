import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { buildSavingsListingReport, buildSavingsListingWorkbook } from "@/lib/reports/savings-listing-report";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

async function parseParams(request: NextRequest, method: "GET" | "POST") {
  if (method === "GET") {
    const { searchParams } = new URL(request.url);
    return Object.fromEntries(searchParams.entries());
  }

  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

async function handleReport(request: NextRequest, method: "GET" | "POST") {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await parseParams(request, method);
    const branchId = resolveBranchScope(session.user as any, params.branchId || undefined);
    const report = await buildSavingsListingReport(
      {
        branchId,
        productCode: params.productCode,
        status: params.status,
        minDaysInactive: params.minDaysInactive !== undefined ? Number(params.minDaysInactive) : undefined,
        search: params.search,
        asAtDate: params.asAtDate,
      },
      session.user,
    );

    if ((params.format || "").toString().toLowerCase() === "xlsx") {
      const buffer = await buildSavingsListingWorkbook(report);
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=savings_accounts_listing_${report.as_at_date}.xlsx`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error generating savings account listing:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate savings account listing",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleReport(request, "GET");
}

export async function POST(request: NextRequest) {
  return handleReport(request, "POST");
}
