import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

import { buildSavingsTransactionsMemberReport } from "@/lib/reports/savings-transactions-report";

export const dynamic = "force-dynamic";

function normalizeBranchId(branchId: string | null | undefined) {
  const value = branchId?.trim();
  return value && value.toLowerCase() !== "all" ? value : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountNumber: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { accountNumber } = await params;
    const report = await buildSavingsTransactionsMemberReport(accountNumber, {
      user: session.user,
      branchId: normalizeBranchId(searchParams.get("branchId")),
      productCode: searchParams.get("productCode") || searchParams.get("product_code") || undefined,
      dateFrom: searchParams.get("dateFrom") || searchParams.get("date_from") || undefined,
      dateTo: searchParams.get("dateTo") || searchParams.get("date_to") || undefined,
      memberName: searchParams.get("memberName") || searchParams.get("member_name") || undefined,
      teller: searchParams.get("teller") || undefined,
      type: (() => {
        const value = (searchParams.get("type") || "").toLowerCase();
        return value === "deposit" || value === "withdrawal" || value === "all" ? value : undefined;
      })(),
      minAmount: searchParams.get("minAmount") ? Number(searchParams.get("minAmount")) : searchParams.get("min_amount") ? Number(searchParams.get("min_amount")) : undefined,
      maxAmount: searchParams.get("maxAmount") ? Number(searchParams.get("maxAmount")) : searchParams.get("max_amount") ? Number(searchParams.get("max_amount")) : undefined,
      threshold: searchParams.get("threshold") ? Number(searchParams.get("threshold")) : undefined,
      includeReversed: searchParams.get("includeReversed") === "true" || searchParams.get("include_reversed") === "true",
    });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error generating member savings transactions report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate member savings transactions report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
