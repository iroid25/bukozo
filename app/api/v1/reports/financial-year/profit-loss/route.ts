import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { getAuthUser } from "@/config/useAuth";
import { buildFinancialYearProfitLossReport } from "@/lib/reports/profit-loss-report";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

function normalizeBranchId(branchId: string | null | undefined) {
  if (!branchId || branchId === "all" || branchId === "ALL") return undefined;
  return branchId;
}

async function handleRequest(request: NextRequest) {
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
  const branchId = resolveBranchScope(
    { role: user.role, branchId: user.branchId },
    normalizeBranchId(searchParams.get("branchId") || undefined),
  );

  const report = await buildFinancialYearProfitLossReport({
    user,
    branchId,
    financialYearId,
    fyStart,
    fromDate,
    toDate,
    year: yearParam ? Number.parseInt(yearParam, 10) : undefined,
  });

  return NextResponse.json({
    success: true,
    data: report,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("Error generating FY profit & loss:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate financial year profit & loss",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
