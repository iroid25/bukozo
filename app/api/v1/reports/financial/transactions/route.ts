import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { getFinancialTransactionsByDateRange } from "@/lib/services/financial-dashboard-reports";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const branchId = searchParams.get("branchId");

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { success: false, error: "Start date and end date are required" },
        { status: 400 },
      );
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid date range" },
        { status: 400 },
      );
    }

    const data = await getFinancialTransactionsByDateRange(
      user,
      startDate,
      endDate,
      branchId,
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error generating financial transactions report:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate financial transactions report" },
      { status: 500 },
    );
  }
}
