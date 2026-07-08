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
        productCode: searchParams.get("productCode") || "201004",
        asAtDate: searchParams.get("asAtDate") || undefined,
      },
      session.user,
    );

    const product = report.products[0];
    const savingsTotal = product?.productTotal || 0;
    const trialBalanceAmount = product?.liabilityAccountBalance || 0;
    const difference = savingsTotal - trialBalanceAmount;

    return NextResponse.json({
      success: true,
      data: {
        product_code: product?.code || null,
        member_count: product?.memberCount || 0,
        savings_total: savingsTotal,
        trial_balance_amount: trialBalanceAmount,
        difference,
        is_reconciled: Math.abs(difference) < 0.01,
      },
    });
  } catch (error) {
    console.error("Error generating savings reconcile report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reconcile savings listing",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
