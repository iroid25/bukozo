import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import {
  buildPersonalLedgerReport,
  buildPersonalLedgerWorkbook,
} from "@/lib/reports/personal-ledger-report";

export const dynamic = "force-dynamic";

function parseParams(request: NextRequest, method: "GET" | "POST") {
  if (method === "GET") {
    const { searchParams } = new URL(request.url);
    return {
      memberId: searchParams.get("memberId") || searchParams.get("member_id") || undefined,
      memberName: searchParams.get("memberName") || searchParams.get("member_name") || searchParams.get("search") || undefined,
      institutionId: searchParams.get("institutionId") || searchParams.get("institution_id") || undefined,
      institutionName: searchParams.get("institutionName") || searchParams.get("institution_name") || undefined,
      accountNo: searchParams.get("accountNo") || searchParams.get("account_no") || undefined,
      branchId: searchParams.get("branchId") || searchParams.get("branch_id") || undefined,
      fromDate: searchParams.get("fromDate") || searchParams.get("from_date") || undefined,
      toDate: searchParams.get("toDate") || searchParams.get("to_date") || undefined,
      accountType: searchParams.get("accountType") || undefined,
      includeClosed: searchParams.get("includeClosed") === "true" || searchParams.get("include_closed") === "true",
      format: searchParams.get("format") || undefined,
    };
  }

  return request.json().catch(() => ({}));
}

async function handleRequest(request: NextRequest, method: "GET" | "POST") {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await parseParams(request, method);
  const branchFilter = await getBranchFilterForService(session.user, params.branchId);
  const report = await buildPersonalLedgerReport({
    memberId: params.memberId,
    memberName: params.memberName,
    institutionId: params.institutionId,
    institutionName: params.institutionName,
    accountNo: params.accountNo,
    fromDate: params.fromDate,
    toDate: params.toDate,
    accountType: params.accountType,
    includeClosed: params.includeClosed,
    branchId: branchFilter.branchId === "all" ? undefined : branchFilter.branchId,
  });

  if ((params.format || "").toString().toLowerCase() === "xlsx") {
    const buffer = await buildPersonalLedgerWorkbook(report);
    const identifier =
      report.member?.member_id ||
      report.institution?.institution_id ||
      "ledger";
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="personal-ledger-${identifier}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: report });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRequest(request, "GET");
  } catch (error) {
    console.error("Error generating personal ledger report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate personal ledger report",
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
    console.error("Error generating personal ledger report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate personal ledger report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
