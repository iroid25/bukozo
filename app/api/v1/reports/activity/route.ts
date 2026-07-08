import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import { getActivityReports } from "@/lib/reports/activity-report";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/activity?limit=100&orderBy=timestamp&orderDirection=desc
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const orderBy = (searchParams.get("orderBy") || "createdAt") as "createdAt" | "action";
    const orderDirection = (searchParams.get("orderDirection") || "desc") as "asc" | "desc";
    const requestedBranchId = searchParams.get("branchId") || undefined;
    const effectiveRequestedBranchId = requestedBranchId && requestedBranchId !== "all" ? requestedBranchId : undefined;

    const branchId =
      user.role === UserRole.ADMIN
        ? effectiveRequestedBranchId
        : user.branchId || undefined;

    if (user.role !== UserRole.ADMIN && !branchId) {
      return NextResponse.json(
        { error: "Branch access is required for this user" },
        { status: 403 },
      );
    }

    const activities = await getActivityReports({
      limit,
      orderBy,
      orderDirection,
      branchId,
    });

    return NextResponse.json({
      success: true,
      data: activities,
      pagination: {
        limit,
        total: activities.length,
      },
    });
  } catch (error) {
    console.error("Error fetching activity reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity reports" },
      { status: 500 },
    );
  }
}
