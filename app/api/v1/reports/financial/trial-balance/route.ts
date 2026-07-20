import { NextRequest, NextResponse } from "next/server";
import { getTrialBalanceService } from "@/lib/services/financial-reports";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeBranchId(branchId: string | null | undefined) {
  const value = branchId?.trim();
  return value && value.toLowerCase() !== "all" ? value : undefined;
}


export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.AUDITOR];
    if (!allowedRoles.includes(user.role as UserRole)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("startDate") || searchParams.get("start") || undefined;
    const endStr = searchParams.get("endDate") || searchParams.get("end") || undefined;
    const branchId = resolveBranchScope(
      { role: user.role, branchId: user.branchId },
      normalizeBranchId(searchParams.get("branchId")),
    );

    const startDate = startStr ? new Date(startStr) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = endStr ? new Date(endStr) : new Date();

    const data = await getTrialBalanceService(startDate, endDate, branchId, user);
    
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in Trial Balance API:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.AUDITOR];
    if (!allowedRoles.includes(user.role as UserRole)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const startStr = body.startDate || body.start || undefined;
    const endStr = body.endDate || body.end || undefined;
    const branchId = resolveBranchScope(
      { role: user.role, branchId: user.branchId },
      normalizeBranchId(body.branchId),
    );

    const startDate = startStr ? new Date(startStr) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = endStr ? new Date(endStr) : new Date();

    const data = await getTrialBalanceService(startDate, endDate, branchId, user);
    
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in Trial Balance API:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
