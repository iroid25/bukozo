import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import { buildShareAccountStatementReport } from "@/lib/reports/share-account-statement-report";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountNumber: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolved = await params;
    const { searchParams } = new URL(request.url);
    const report = await buildShareAccountStatementReport({
      user: session.user,
      accountNumber: resolved.accountNumber,
      search: searchParams.get("search") || undefined,
      productCode: searchParams.get("productCode") || searchParams.get("product_code") || undefined,
      branchId: searchParams.get("branchId") || undefined,
      dateFrom: searchParams.get("dateFrom") || searchParams.get("date_from") || undefined,
      dateTo: searchParams.get("dateTo") || searchParams.get("date_to") || undefined,
    });

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error loading share account statement member detail:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load share account statement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
