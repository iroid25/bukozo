import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { getMembersForStatementGeneration } from "@/lib/services/statements";

/**
 * GET /api/v1/statements/members
 * Get active members for statement generation
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const members = await getMembersForStatementGeneration(user);

    return NextResponse.json({ 
      success: true, 
      data: members 
    });
  } catch (error: any) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch members" },
      { status: 500 }
    );
  }
}
