import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { buildComprehensiveBalanceSheetReport } from "@/lib/reports/statement-of-comprehensive-balance-sheet";
import { UserRole } from "@prisma/client";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

function normalizeBranchId(branchId: string | null | undefined) {
  const value = branchId?.trim();
  return value && value.toLowerCase() !== "all" ? value : undefined;
}

function parseDate(value: string | null | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function handler(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.BRANCHMANAGER,
    UserRole.AUDITOR,
  ];
  if (!allowedRoles.includes(user.role as UserRole)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = resolveBranchScope(
    { role: user.role, branchId: user.branchId },
    normalizeBranchId(searchParams.get("branchId")),
  );
  const startDate = parseDate(searchParams.get("start_date") || searchParams.get("startDate") || undefined);
  const endDate = parseDate(searchParams.get("end_date") || searchParams.get("endDate") || undefined);
  const compareStartDate = parseDate(searchParams.get("compare_start") || searchParams.get("compareStartDate") || undefined);
  const compareEndDate = parseDate(searchParams.get("compare_end") || searchParams.get("compareEndDate") || undefined);

  const data = await buildComprehensiveBalanceSheetReport({
    user,
    branchId,
    startDate,
    endDate,
    compareStartDate,
    compareEndDate,
  });

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handler(request);
  } catch (error) {
    console.error("Comprehensive balance sheet GET error:", error);
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.ACCOUNTANT,
      UserRole.BRANCHMANAGER,
      UserRole.AUDITOR,
    ];
    if (!allowedRoles.includes(user.role as UserRole)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const data = await buildComprehensiveBalanceSheetReport({
      user,
      branchId: resolveBranchScope(
        { role: user.role, branchId: user.branchId },
        normalizeBranchId(body.branchId),
      ),
      startDate: body.startDate || body.start_date || undefined,
      endDate: body.endDate || body.end_date || undefined,
      compareStartDate: body.compareStartDate || body.compare_start || undefined,
      compareEndDate: body.compareEndDate || body.compare_end || undefined,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Comprehensive balance sheet POST error:", error);
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
  }
}
