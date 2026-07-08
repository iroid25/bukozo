import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { buildSavingsListingReport, buildSavingsListingWorkbook } from "@/lib/reports/savings-listing-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const report = await buildSavingsListingReport(
      {
        branchId: searchParams.get("branchId") || undefined,
        productCode: searchParams.get("productCode") || undefined,
        status: searchParams.get("status") || undefined,
        minDaysInactive: searchParams.get("minDaysInactive") ? Number(searchParams.get("minDaysInactive")) : undefined,
        search: searchParams.get("search") || undefined,
        asAtDate: searchParams.get("asAtDate") || undefined,
      },
      session.user,
    );

    const buffer = await buildSavingsListingWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=savings_accounts_listing_${report.as_at_date}.xlsx`,
      },
    });
  } catch (error) {
    console.error("Error exporting savings account listing:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export savings account listing",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

