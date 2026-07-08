import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { listReportPeriods } from "@/lib/reports/statement-of-comprehensive-balance-sheet";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await listReportPeriods();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Report periods lookup error:", error);
    return NextResponse.json({ error: "Failed to load report periods" }, { status: 500 });
  }
}
