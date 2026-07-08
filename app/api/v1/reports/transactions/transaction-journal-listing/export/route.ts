import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { getAuthUser } from "@/config/useAuth";
import {
  buildTransactionJournalListingReport,
  buildTransactionJournalListingWorkbook,
} from "@/lib/reports/transaction-journal-reports";

export const dynamic = "force-dynamic";

function pickParam(searchParams: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value) return value;
  }
  return undefined;
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
    const fromDate = pickParam(searchParams, "fromDate", "startDate") || new Date().toISOString().slice(0, 10);
    const toDate = pickParam(searchParams, "toDate", "endDate") || fromDate;

    const report = await buildTransactionJournalListingReport({
      user,
      fromDate,
      toDate,
      branchId: normalizeBranchId(pickParam(searchParams, "branchId")),
      userName: pickParam(searchParams, "userName", "user_name"),
      glAccount: pickParam(searchParams, "glAccount", "gl_account"),
      trxCode: pickParam(searchParams, "trxCode", "trx_code"),
      voucherNo: pickParam(searchParams, "voucherNo", "voucher_no"),
      memberSearch: pickParam(searchParams, "memberSearch", "member_search"),
      textSearch: pickParam(searchParams, "textSearch", "text_search"),
    });

    const buffer = await buildTransactionJournalListingWorkbook(report);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="transaction-journal-listing.xlsx"',
      },
    });
  } catch (error) {
    console.error("Transaction journal listing export error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export transaction journal listing",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
