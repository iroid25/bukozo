import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { getAuthUser } from "@/config/useAuth";
import { buildDaySheetReport, FilterMode } from "@/lib/reports/transaction-journal-reports";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

function parseFilterMode(value: string | null): FilterMode {
  return value === "session_date" ? "session_date" : "trx_date";
}

function parseDateParam(value: string | null | undefined, fallback: string) {
  return value || fallback;
}

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
    const filterMode = parseFilterMode(searchParams.get("filterMode") || searchParams.get("filter_mode"));
    const fromDate = parseDateParam(searchParams.get("fromDate") || searchParams.get("startDate"), new Date().toISOString().slice(0, 10));
    const toDate = parseDateParam(searchParams.get("toDate") || searchParams.get("endDate"), fromDate);
    const branchId = normalizeBranchId(resolveBranchScope(user, searchParams.get("branchId")) || undefined);
    const userName = searchParams.get("userName") || searchParams.get("user_name") || undefined;
    const glAccount = searchParams.get("glAccount") || searchParams.get("gl_account") || undefined;
    const trxCode = searchParams.get("trxCode") || searchParams.get("trx_code") || undefined;
    const voucherNo = searchParams.get("voucherNo") || searchParams.get("voucher_no") || undefined;

    const report = await buildDaySheetReport({
      user,
      fromDate,
      toDate,
      filterMode,
      branchId,
      userName: userName || undefined,
      glAccount: glAccount || undefined,
      trxCode: trxCode || undefined,
      voucherNo: voucherNo || undefined,
    });

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Day sheet report error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate day sheet report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
