import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

import {
  buildSavingsTransactionsReport,
  buildSavingsTransactionsWorkbook,
} from "@/lib/reports/savings-transactions-report";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

function normalizeBranchId(branchId: string | null | undefined) {
  const value = branchId?.trim();
  return value && value.toLowerCase() !== "all" ? value : undefined;
}

function parseNumber(value: string | null) {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeType(value: string | null) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "deposit" || normalized === "withdrawal" || normalized === "all") {
    return normalized;
  }
  return undefined;
}

function parseParams(request: NextRequest, method: "GET" | "POST") {
  if (method === "GET") {
    const { searchParams } = new URL(request.url);
    return {
      branchId: normalizeBranchId(searchParams.get("branchId")),
      productCode: searchParams.get("productCode") || searchParams.get("product_code") || undefined,
      dateFrom: searchParams.get("dateFrom") || searchParams.get("date_from") || undefined,
      dateTo: searchParams.get("dateTo") || searchParams.get("date_to") || undefined,
      accountNumber: searchParams.get("accountNumber") || searchParams.get("account_number") || undefined,
      memberName: searchParams.get("memberName") || searchParams.get("member_name") || undefined,
      teller: searchParams.get("teller") || undefined,
      type: normalizeType(searchParams.get("type")),
      minAmount: parseNumber(searchParams.get("minAmount") || searchParams.get("min_amount")),
      maxAmount: parseNumber(searchParams.get("maxAmount") || searchParams.get("max_amount")),
      threshold: parseNumber(searchParams.get("threshold")),
      includeReversed: searchParams.get("includeReversed") === "true" || searchParams.get("include_reversed") === "true",
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
  const branchId = resolveBranchScope(session.user as any, params.branchId || undefined);
  const report = await buildSavingsTransactionsReport({
    user: session.user,
    branchId: normalizeBranchId(branchId || undefined),
    productCode: params.productCode,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    accountNumber: params.accountNumber,
    memberName: params.memberName,
    teller: params.teller,
    type: params.type,
    minAmount: params.minAmount,
    maxAmount: params.maxAmount,
    threshold: params.threshold,
    includeReversed: params.includeReversed,
  });

  if ((params.format || "").toString().toLowerCase() === "xlsx") {
    const buffer = await buildSavingsTransactionsWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="savings-transactions-${report.dateRange.from}_to_${report.dateRange.to}.xlsx"`,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: report,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRequest(request, "GET");
  } catch (error) {
    console.error("Error generating savings transactions report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate savings transactions report",
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
    console.error("Error generating savings transactions report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate savings transactions report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
