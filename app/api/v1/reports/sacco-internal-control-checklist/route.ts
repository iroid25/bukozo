import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import {
  getSaccoInternalControlChecklistReport,
  saveSaccoInternalControlChecklistReport,
} from "@/lib/reports/sacco-internal-control-checklist-report";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeBranchId(branchId: string | null | undefined) {
  const value = branchId?.trim();
  return value && value.toLowerCase() !== "all" ? value : undefined;
}
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = normalizeBranchId(searchParams.get("branchId"));
    const periodKey = searchParams.get("periodKey") || undefined;

    const report = await getSaccoInternalControlChecklistReport({
      user: {
        role: (session.user as any).role || "MEMBER",
        branchId: (session.user as any).branchId || undefined,
      },
      branchId,
      periodKey,
    });

    return NextResponse.json({
      data: report.records,
      summary: report.summary,
      meta: {
        branchId: report.branchId,
        periodKey: report.periodKey,
      },
    });
  } catch (error) {
    console.error("Error fetching checklist report:", error);
    return NextResponse.json(
      { error: "Failed to fetch checklist report" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const report = await saveSaccoInternalControlChecklistReport({
      user: {
        role: (session.user as any).role || "MEMBER",
        branchId: (session.user as any).branchId || undefined,
        id: (session.user as any).id || undefined,
        name: (session.user as any).name || undefined,
      },
      branchId: normalizeBranchId(body.branchId),
      periodKey: body.periodKey || undefined,
      items: Array.isArray(body.items) ? body.items : [],
    });

    return NextResponse.json({
      data: report.records,
      summary: report.summary,
      meta: {
        branchId: report.branchId,
        periodKey: report.periodKey,
      },
    });
  } catch (error) {
    console.error("Error saving checklist report:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save checklist report" },
      { status: 500 },
    );
  }
}

