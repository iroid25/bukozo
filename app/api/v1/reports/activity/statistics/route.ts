import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { getActivityStats } from "@/lib/reports/activity-report";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/activity/statistics - Activity statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = session.user as any;
    const rawBranchId = request.nextUrl.searchParams.get("branchId") || undefined;
    const branchId = resolveBranchScope(
      { role: user.role, branchId: user.branchId },
      rawBranchId && rawBranchId !== "all" && rawBranchId !== "ALL" ? rawBranchId : undefined,
    );
    const stats = await getActivityStats({ branchId });

    return NextResponse.json({
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching activity statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity statistics" },
      { status: 500 }
    );
  }
}
