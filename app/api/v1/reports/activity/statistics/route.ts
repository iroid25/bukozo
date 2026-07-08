import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
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

    const sessionRole = (session.user as any).role as string | undefined;
    const sessionBranchId = (session.user as any).branchId as string | undefined;
    const requestedBranchId = request.nextUrl.searchParams.get("branchId") || undefined;
    const branchId =
      sessionRole === "ADMIN"
        ? requestedBranchId && requestedBranchId !== "all" && requestedBranchId !== "ALL"
          ? requestedBranchId
          : undefined
        : sessionBranchId || undefined;
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
