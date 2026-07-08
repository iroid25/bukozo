import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import {
  buildShareAccountStatementReport,
  buildShareAccountStatementWorkbook,
} from "@/lib/reports/share-account-statement-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const report = await buildShareAccountStatementReport({
      user: session.user,
      accountNumber: searchParams.get("accountNumber") || searchParams.get("account_number") || undefined,
      search: searchParams.get("search") || undefined,
      productCode: searchParams.get("productCode") || searchParams.get("product_code") || undefined,
      branchId: searchParams.get("branchId") || undefined,
      dateFrom: searchParams.get("dateFrom") || searchParams.get("date_from") || undefined,
      dateTo: searchParams.get("dateTo") || searchParams.get("date_to") || undefined,
    });

    const buffer = await buildShareAccountStatementWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="share-account-statement-${report.member.accountNumber}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting share account statement:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export share account statement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
