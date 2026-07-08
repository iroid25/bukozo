// app/api/v1/agent/fees/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getFeeConfig } from "@/actions/settings/fees";
import { 
  AGENT_DEPOSIT_FEES, 
  AGENT_WITHDRAWAL_FEES, 
  SCHOOL_FEES_COMMISSION 
} from "@/config/fees";

/**
 * GET /api/v1/agent/fees
 * Fetches the actual (effective) commission fees for agents.
 * This includes database overrides and falls back to static configurations.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch dynamic configs from database
    const [depositResult, withdrawalResult, schoolFeesResult] = await Promise.all([
      getFeeConfig("AGENT_DEPOSIT_FEES"),
      getFeeConfig("AGENT_WITHDRAWAL_FEES"),
      getFeeConfig("SCHOOL_FEES_COMMISSION")
    ]);

    // Consolidate effective fees
    const effectiveFees = {
      depositFees: (depositResult.success && depositResult.data) ? depositResult.data : AGENT_DEPOSIT_FEES,
      withdrawalFees: (withdrawalResult.success && withdrawalResult.data) ? withdrawalResult.data : AGENT_WITHDRAWAL_FEES,
      schoolFees: (schoolFeesResult.success && schoolFeesResult.data) ? schoolFeesResult.data : SCHOOL_FEES_COMMISSION,
    };

    return NextResponse.json({
      success: true,
      data: effectiveFees,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error fetching agent fees:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch agent fees" },
      { status: 500 }
    );
  }
}
