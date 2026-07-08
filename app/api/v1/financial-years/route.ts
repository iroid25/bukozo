import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import { listFinancialYears } from "@/lib/reports/financial-year-balance-sheet-report";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await listFinancialYears();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to load financial years:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load financial years",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
