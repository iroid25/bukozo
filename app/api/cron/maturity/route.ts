import { NextRequest, NextResponse } from "next/server";
import { processMaturedFixedDeposits } from "@/lib/cron/fixedDepositMaturity";

/**
 * Cron endpoint for processing matured fixed deposits
 * This should be called daily by a cron service (e.g., Vercel Cron, GitHub Actions, or external cron job)
 * 
 * To set up:
 * 1. For Vercel: Add to vercel.json:
 *    {
 *      "crons": [{
 *        "path": "/api/cron/maturity",
 *        "schedule": "0 0 * * *"
 *      }]
 *    }
 * 
 * 2. For manual trigger: POST to /api/cron/maturity with authorization header
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization (use a secret token for security)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "your-secret-token-here";

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting maturity processing cron job...");
    const results = await processMaturedFixedDeposits();

    return NextResponse.json({
      success: true,
      message: "Maturity processing completed",
      results,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Allow GET for testing/manual trigger
export async function GET(request: NextRequest) {
  return POST(request);
}
