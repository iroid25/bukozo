import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

import { buildSavingsTransactionsReport } from "@/lib/reports/savings-transactions-report";

export const dynamic = "force-dynamic";

function normalizeBranchId(branchId: string | null | undefined) {
  const value = branchId?.trim();
  return value && value.toLowerCase() !== "all" ? value : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const report = await buildSavingsTransactionsReport({
      user: session.user,
      branchId: normalizeBranchId(searchParams.get("branchId")),
      productCode: searchParams.get("productCode") || searchParams.get("product_code") || undefined,
      dateFrom: searchParams.get("dateFrom") || searchParams.get("date_from") || undefined,
      dateTo: searchParams.get("dateTo") || searchParams.get("date_to") || undefined,
      teller: searchParams.get("teller") || undefined,
      type: (() => {
        const value = (searchParams.get("type") || "").toLowerCase();
        return value === "deposit" || value === "withdrawal" || value === "all" ? value : undefined;
      })(),
      threshold: searchParams.get("threshold") ? Number(searchParams.get("threshold")) : undefined,
    });

    return NextResponse.json({
      success: true,
      data: report.summary,
      footer: report.footer,
      tellerSummary: report.tellerSummary,
    });
  } catch (error) {
    console.error("Error generating savings transactions summary:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate savings transactions summary",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
