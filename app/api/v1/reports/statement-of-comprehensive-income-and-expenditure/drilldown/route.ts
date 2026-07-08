import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";
import { buildIncomeExpenseDrilldown } from "@/lib/reports/income-expense-report";

export const dynamic = "force-dynamic";

function normalizeBranchId(branchId: string | null | undefined) {
  if (!branchId || branchId === "all" || branchId === "ALL") return undefined;
  return branchId;
}

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

    const data = await buildIncomeExpenseDrilldown({
      user,
      accountCode,
      branchId: normalizeBranchId(searchParams.get("branchId") || undefined),
      startDate: searchParams.get("start_date") || searchParams.get("startDate") || undefined,
      endDate: searchParams.get("end_date") || searchParams.get("endDate") || undefined,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Income & Expenses drilldown error:", error);
    return NextResponse.json({ error: "Failed to load drilldown" }, { status: 500 });
  }
}
