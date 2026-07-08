import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import { searchPersonalLedgerMembers } from "@/lib/reports/personal-ledger-report";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const data = await searchPersonalLedgerMembers(q);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error searching personal ledger members:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to search personal ledger members",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

