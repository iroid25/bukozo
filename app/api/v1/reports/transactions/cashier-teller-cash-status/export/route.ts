import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { getAuthUser } from "@/config/useAuth";
import {
  buildCashierCashStatusReport,
  buildCashierCashStatusWorkbook,
  getTransactionTellerOptions,
} from "@/lib/reports/transaction-journal-reports";

export const dynamic = "force-dynamic";

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
    const sessionDate = parseDateParam(searchParams.get("sessionDate") || searchParams.get("startDate"), new Date().toISOString().slice(0, 10));
    const tellerId = searchParams.get("tellerId") || searchParams.get("teller_id") || undefined;
    const branchId = normalizeBranchId(searchParams.get("branchId"));
    const trxCode = searchParams.get("trxCode") || searchParams.get("trx_code") || undefined;

    const report = await buildCashierCashStatusReport({
      user,
      sessionDate,
      tellerId: tellerId || undefined,
      branchId,
      trxCode: trxCode || undefined,
    });

    const buffer = await buildCashierCashStatusWorkbook(report);
    const filename = `cashier-teller-cash-status-${report.report_meta.session_date}.xlsx`;

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Cashier status export error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export cashier/teller cash status report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
