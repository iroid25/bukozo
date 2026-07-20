import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { getAuthUser } from "@/config/useAuth";
import { getTransactionTellerOptions } from "@/lib/reports/transaction-journal-reports";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

function normalizeBranchId(branchId: string | null | undefined) {
  const value = branchId?.trim();
  if (!value || value.toLowerCase() === "all") return undefined;
  return value;
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
      UserRole.TELLER,
      UserRole.AGENT,
    ];
    if (!allowedRoles.includes(user.role as UserRole)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = resolveBranchScope(
      { role: user.role, branchId: user.branchId },
      normalizeBranchId(searchParams.get("branchId")),
    );
    const tellers = await getTransactionTellerOptions(user, branchId);

    return NextResponse.json({ success: true, data: tellers });
  } catch (error) {
    console.error("Cashier teller options error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load teller options",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
