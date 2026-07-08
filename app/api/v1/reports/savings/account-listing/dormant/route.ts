import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { buildSavingsListingReport } from "@/lib/reports/savings-listing-report";

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
        productCode: searchParams.get("productCode") || "all",
        status: searchParams.get("status") || "DORMANT",
        minDaysInactive: Number(searchParams.get("threshold_days") || "365"),
        search: searchParams.get("search") || undefined,
        asAtDate: searchParams.get("asAtDate") || undefined,
      },
      session.user,
    );

    return NextResponse.json({
      success: true,
      data: {
        accounts: report.products.flatMap((product: any) => product.accounts).filter((account: any) => account.daysWithoutActivity >= Number(searchParams.get("threshold_days") || "365")),
        summary: {
          totalAccounts: report.products.reduce(
            (sum, product: any) => sum + product.accounts.filter((account: any) => account.daysWithoutActivity >= Number(searchParams.get("threshold_days") || "365")).length,
            0,
          ),
        },
      },
    });
  } catch (error) {
    console.error("Error generating dormant savings listing report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate dormant savings listing report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
