import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";
import { buildTrialBalanceReport } from "@/lib/reports/trial-balance-report";

export const dynamic = "force-dynamic";

function parseDate(value: string | null | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeBranchId(branchId: string | null | undefined) {
  if (!branchId || branchId === "all" || branchId === "ALL") return undefined;
  return branchId;
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
  const data = await buildTrialBalanceReport({
    user,
    branchId: normalizeBranchId(searchParams.get("branchId") || undefined),
    startDate: parseDate(searchParams.get("start_date") || searchParams.get("startDate") || undefined),
    endDate: parseDate(searchParams.get("end_date") || searchParams.get("endDate") || undefined),
  });

  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest) {
  try {
    return await handler(request);
  } catch (error) {
    console.error("Comprehensive trial balance GET error:", error);
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

    const data = await buildTrialBalanceReport({
      user,
      branchId: normalizeBranchId(body.branchId || undefined),
      startDate: body.startDate || body.start_date || undefined,
      endDate: body.endDate || body.end_date || undefined,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Comprehensive trial balance POST error:", error);
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
  }
}
