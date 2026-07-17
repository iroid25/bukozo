import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import {
  getSharesTransactionReport,
  buildSharesTransactionsReportWorkbook,
} from "@/lib/reports/shares-transactions-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom") || searchParams.get("date_from") || undefined;
    const dateTo = searchParams.get("dateTo") || searchParams.get("date_to") || undefined;

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: "dateFrom and dateTo are required" }, { status: 400 });
    }

    const report = await getSharesTransactionReport({
      user: session.user as any,
      dateFrom,
      dateTo,
      branchId: searchParams.get("branchId") || undefined,
      accountTypeId: searchParams.get("accountTypeId") || undefined,
      memberId: searchParams.get("memberId") || undefined,
      tellerId: searchParams.get("tellerId") || undefined,
      includeReversed: searchParams.get("includeReversed") === "true",
    });

    const buffer = await buildSharesTransactionsReportWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="shares-transactions-${report.dateFrom}_to_${report.dateTo}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting shares transactions report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export shares transactions report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
