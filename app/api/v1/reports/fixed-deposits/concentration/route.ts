import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { getFixedDepositConcentrationReport } from "@/lib/reports/fixed-deposits-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const data = await getFixedDepositConcentrationReport({
      user,
      reportDate: searchParams.get("reportDate") || searchParams.get("asOfDate") || undefined,
      branchId: searchParams.get("branchId") || undefined,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error generating fixed deposit concentration report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate fixed deposit concentration report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
