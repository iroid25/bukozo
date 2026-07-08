import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { getAuthUser } from "@/config/useAuth";
import {
  buildFinancialYearProfitLossReport,
  buildFinancialYearProfitLossWorkbook,
} from "@/lib/reports/profit-loss-report";

export const dynamic = "force-dynamic";

function normalizeBranchId(branchId: string | null | undefined) {
  if (!branchId || branchId === "all" || branchId === "ALL") return undefined;
  return branchId;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.ACCOUNTANT,
      UserRole.BRANCHMANAGER,
      UserRole.AUDITOR,
    ];
    if (!allowedRoles.includes(user.role as UserRole)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const financialYearId = searchParams.get("financialYearId") || undefined;
    const fyStart = searchParams.get("fyStart") || undefined;
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;
    const branchId = normalizeBranchId(searchParams.get("branchId") || undefined);

    const report = await buildFinancialYearProfitLossReport({
      user,
      branchId,
      financialYearId,
      fyStart,
      fromDate,
      toDate,
      year: yearParam ? Number.parseInt(yearParam, 10) : undefined,
    });

    const buffer = await buildFinancialYearProfitLossWorkbook(report);
    const filenameStart = report.financial_year_start || "report";
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="profit-loss-financial-year-${filenameStart}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Financial year profit/loss export error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export financial year profit and loss",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
