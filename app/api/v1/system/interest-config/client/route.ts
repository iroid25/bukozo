import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getInterestConfiguration } from "@/services/interest-config.service";

/**
 * GET /api/v1/system/interest-config/client
 * Fetch interest configuration for client-side use (no auth required for reading defaults)
 */
export async function GET(request: NextRequest) {
  try {
    const config = await getInterestConfiguration();
    
    return NextResponse.json(config, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching interest configuration:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch interest configuration" },
      { status: 500 }
    );
  }
}
