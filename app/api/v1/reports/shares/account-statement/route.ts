import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import {
  buildShareAccountStatementReport,
  buildShareAccountStatementWorkbook,
} from "@/lib/reports/share-account-statement-report";

export const dynamic = "force-dynamic";

function parseParams(request: NextRequest, method: "GET" | "POST") {
  if (method === "GET") {
    const { searchParams } = new URL(request.url);
    return {
      accountNumber: searchParams.get("accountNumber") || searchParams.get("account_number") || undefined,
      search: searchParams.get("search") || undefined,
      productCode: searchParams.get("productCode") || searchParams.get("product_code") || undefined,
      branchId: searchParams.get("branchId") || undefined,
      dateFrom: searchParams.get("dateFrom") || searchParams.get("date_from") || undefined,
      dateTo: searchParams.get("dateTo") || searchParams.get("date_to") || undefined,
      format: searchParams.get("format") || undefined,
    };
  }

  return request.json().catch(() => ({}));
}

async function handleRequest(request: NextRequest, method: "GET" | "POST") {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await parseParams(request, method);
  const report = await buildShareAccountStatementReport({
    user: session.user,
    accountNumber: params.accountNumber,
    search: params.search,
    productCode: params.productCode,
    branchId: params.branchId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  if ((params.format || "").toString().toLowerCase() === "xlsx") {
    const buffer = await buildShareAccountStatementWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="share-account-statement-${report.member.accountNumber}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: report });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRequest(request, "GET");
  } catch (error) {
    console.error("Error generating share account statement:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate share account statement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleRequest(request, "POST");
  } catch (error) {
    console.error("Error generating share account statement:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate share account statement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
