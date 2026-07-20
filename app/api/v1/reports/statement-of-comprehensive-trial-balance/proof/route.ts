import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";
import { buildTrialBalanceProof } from "@/lib/reports/trial-balance-report";
import { resolveBranchScope } from "@/lib/services/branch-scope";

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
    const proof = await buildTrialBalanceProof({
      user,
      branchId: resolveBranchScope(
        { role: user.role, branchId: user.branchId },
        normalizeBranchId(searchParams.get("branchId") || undefined),
      ),
      startDate: searchParams.get("start_date") || searchParams.get("startDate") || undefined,
      endDate: searchParams.get("end_date") || searchParams.get("endDate") || undefined,
    });

    return NextResponse.json({ success: true, data: proof });
  } catch (error) {
    console.error("Comprehensive trial balance proof error:", error);
    return NextResponse.json({ error: "Failed to load proof" }, { status: 500 });
  }
}
