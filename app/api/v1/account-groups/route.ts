import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { listComprehensiveBalanceSheetGroups } from "@/lib/reports/statement-of-comprehensive-balance-sheet";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: listComprehensiveBalanceSheetGroups(),
    });
  } catch (error) {
    console.error("Account groups lookup error:", error);
    return NextResponse.json({ error: "Failed to load account groups" }, { status: 500 });
  }
}
