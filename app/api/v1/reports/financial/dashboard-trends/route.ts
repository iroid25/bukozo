import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getFinancialDashboardTrends } from "@/lib/services/financial-dashboard-reports";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get("branchId") || undefined;
    const branchId = requestedBranchId && requestedBranchId !== "all" && requestedBranchId !== "ALL"
      ? requestedBranchId
      : undefined;
    const months = Number.parseInt(searchParams.get("months") || "12", 10);

    const data = await getFinancialDashboardTrends(user, Number.isNaN(months) ? 12 : months, branchId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error generating financial dashboard trends:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate financial dashboard trends" },
      { status: 500 },
    );
  }
}
