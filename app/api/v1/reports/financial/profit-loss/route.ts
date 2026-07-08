import { NextRequest, NextResponse } from "next/server";
import { getProfitAndLossStatementService } from "@/lib/services/financial-reports";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : new Date();
    const requestedBranchId = searchParams.get("branchId") || undefined;
    const branchId = requestedBranchId && requestedBranchId !== "all" && requestedBranchId !== "ALL"
      ? requestedBranchId
      : undefined;

    const data = await getProfitAndLossStatementService(startDate, endDate, branchId, user);
    
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in Profit & Loss API:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.ACCOUNTANT,
      UserRole.BRANCHMANAGER,
      UserRole.AUDITOR,
    ];
    if (!allowedRoles.includes(user.role as UserRole)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const startDate = body.startDate ? new Date(body.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = body.endDate ? new Date(body.endDate) : new Date();
    const requestedBranchId = body.branchId || undefined;
    const branchId = requestedBranchId && requestedBranchId !== "all" && requestedBranchId !== "ALL"
      ? requestedBranchId
      : undefined;

    const data = await getProfitAndLossStatementService(startDate, endDate, branchId, user);
    
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in Profit & Loss API:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
