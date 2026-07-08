import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { buildComprehensiveBalanceSheetDrilldown } from "@/lib/reports/statement-of-comprehensive-balance-sheet";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
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
    const accountCode = searchParams.get("accountCode");
    if (!accountCode) {
      return NextResponse.json({ error: "accountCode is required" }, { status: 400 });
    }

    const data = await buildComprehensiveBalanceSheetDrilldown({
      user,
      accountCode,
      branchId: searchParams.get("branchId") || undefined,
      startDate: searchParams.get("start_date") || searchParams.get("startDate") || undefined,
      endDate: searchParams.get("end_date") || searchParams.get("endDate") || undefined,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Comprehensive balance sheet drilldown error:", error);
    return NextResponse.json({ error: "Failed to load drilldown" }, { status: 500 });
  }
}
