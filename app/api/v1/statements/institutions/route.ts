import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { getInstitutionsForStatementGeneration } from "@/lib/services/statements";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const institutions = await getInstitutionsForStatementGeneration(user);

    return NextResponse.json({
      success: true,
      data: institutions,
    });
  } catch (error: any) {
    console.error("Error fetching institutions for statements:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch institutions" },
      { status: 500 },
    );
  }
}
