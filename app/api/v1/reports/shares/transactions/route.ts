import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import {
  buildShareTransactionsWorkbook,
  getShareTransactionsReport,
} from "@/lib/reports/share-movement-reports";

export const dynamic = "force-dynamic";

async function handleRequest(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await request.json();
  const report = await getShareTransactionsReport({
    user: session.user,
    fromDate: params.fromDate || params.from_date || undefined,
    toDate: params.toDate || params.to_date || undefined,
    productId: params.productId || params.product_id || undefined,
    userName: params.userName || params.user_name || undefined,
    accountNumber: params.accountNumber || params.account_number || undefined,
    memberSearch: params.memberSearch || params.member_search || undefined,
    direction: params.direction || undefined,
    minAmount: params.minAmount || params.min_amount || undefined,
    branchId: params.branchId || undefined,
  });

  if ((params.format || "").toString().toLowerCase() !== "json") {
    const buffer = await buildShareTransactionsWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="shares-transactions-${report.from_date}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: report });
}

export async function POST(request: NextRequest) {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("Error generating shares transactions report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate shares transactions report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
