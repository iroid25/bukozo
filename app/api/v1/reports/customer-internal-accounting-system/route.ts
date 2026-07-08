import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getCustomerInternalAccountingReport } from "@/lib/reports/customer-internal-accounting-report";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get("branchId") || undefined;
    const branchId = requestedBranchId && requestedBranchId !== "all" && requestedBranchId !== "ALL"
      ? requestedBranchId
      : undefined;
    const status = searchParams.get("status") || undefined;

    const report = await getCustomerInternalAccountingReport({
      user: {
        role: (session.user as any).role || "MEMBER",
        branchId: (session.user as any).branchId || undefined,
      },
      branchId,
      status,
    });

    return NextResponse.json({
      data: report.records,
      summary: report.summary,
      meta: {
        branchId: report.branchId,
      },
    });
  } catch (error) {
    console.error("Error fetching customer internal accounting report:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer internal accounting report" },
      { status: 500 },
    );
  }
}
