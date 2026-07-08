import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";
import { buildTrialBalanceReport, buildTrialBalanceWorkbookRows } from "@/lib/reports/trial-balance-report";

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
    const report = await buildTrialBalanceReport({
      user,
      branchId: normalizeBranchId(searchParams.get("branchId") || undefined),
      startDate: parseDate(searchParams.get("start_date") || searchParams.get("startDate") || undefined),
      endDate: parseDate(searchParams.get("end_date") || searchParams.get("endDate") || undefined),
    });

    const workbook = XLSX.utils.book_new();
    const rows = buildTrialBalanceWorkbookRows(report);
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!merges"] = [
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 7, c: 0 }, e: { r: 7, c: 3 } },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, "Trial Balance");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="statement-of-comprehensive-trial-balance-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Comprehensive trial balance export error:", error);
    return NextResponse.json({ error: "Failed to export workbook" }, { status: 500 });
  }
}
