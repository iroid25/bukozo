import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { getCustomerInternalAccountingReport } from "@/lib/reports/customer-internal-accounting-report";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const searchParams = request.nextUrl.searchParams;
    const rawBranchId = searchParams.get("branchId") || undefined;
    const branchId = resolveBranchScope(
      { role: user.role, branchId: user.branchId },
      rawBranchId && rawBranchId !== "all" && rawBranchId !== "ALL" ? rawBranchId : undefined,
    );

    const report = await getCustomerInternalAccountingReport({
      user: { role: user.role, branchId: user.branchId },
      branchId,
      status: searchParams.get("status") || undefined,
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
