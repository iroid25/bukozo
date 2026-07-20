import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import {
  buildPerformanceMonitoringReport,
  buildPerformanceMonitoringWorkbook,
} from "@/lib/reports/performance-monitoring-report";

export const dynamic = "force-dynamic";

function resolveBranchId(user: { role?: string | null; branchId?: string | null }, branchId: string | null | undefined) {
  return resolveBranchScope(
    { role: user.role || "", branchId: user.branchId },
    branchId?.trim() && branchId.trim().toLowerCase() !== "all" ? branchId.trim() : undefined,
  );
}

function parseQuery(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    return {
      fromDate: searchParams.get("fromDate") || searchParams.get("from_date") || undefined,
      toDate: searchParams.get("toDate") || searchParams.get("to_date") || undefined,
      branchId: searchParams.get("branchId") || undefined,
      format: searchParams.get("format") || undefined,
    };
  }

async function handleRequest(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = parseQuery(request);
  const branchId = resolveBranchId(user as any, params.branchId);
  const toDate = params.toDate || new Date().toISOString().slice(0, 10);
  const fromDate = params.fromDate || new Date(new Date(toDate).getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const report = await buildPerformanceMonitoringReport(fromDate, toDate, branchId);

  if ((params.format || "").toLowerCase() === "xlsx") {
    const buffer = await buildPerformanceMonitoringWorkbook(report);
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="performance-monitoring-${report.report_meta.to_date.replaceAll("/", "-")}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: report });
}

export async function GET(request: NextRequest) {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("Error generating performance monitoring report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate performance monitoring report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const toDate = body.toDate || body.to_date || new Date().toISOString().slice(0, 10);
    const fromDate = body.fromDate || body.from_date || new Date(new Date(toDate).getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const branchId = resolveBranchId(user as any, body.branchId);
    const report = await buildPerformanceMonitoringReport(fromDate, toDate, branchId);

    if ((body.format || "").toString().toLowerCase() === "xlsx") {
      const buffer = await buildPerformanceMonitoringWorkbook(report);
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="performance-monitoring-${report.report_meta.to_date.replaceAll("/", "-")}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("Error generating performance monitoring report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate performance monitoring report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
