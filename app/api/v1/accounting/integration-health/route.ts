import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { getAccountingIntegrationHealth } from "@/lib/services/accounting-health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthUser();

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!["ADMIN", "ACCOUNTANT", "BRANCHMANAGER"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const data = await getAccountingIntegrationHealth();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching accounting integration health:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch accounting integration health",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
