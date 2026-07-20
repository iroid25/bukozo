import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { getCustomerInternalAccountingSummary } from "@/lib/reports/customer-internal-accounting-report";

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

    const summary = await getCustomerInternalAccountingSummary({
      user: { role: user.role, branchId: user.branchId },
      branchId,
      status: searchParams.get("status") || undefined,
    });

    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error("Error fetching customer accounting statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer accounting statistics" },
      { status: 500 },
    );
  }
}
