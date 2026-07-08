import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { buildSavingsMemberDetail } from "@/lib/reports/savings-listing-report";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountNumber: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountNumber } = await params;
    const { searchParams } = new URL(request.url);
    const detail = await buildSavingsMemberDetail(accountNumber, session.user, searchParams.get("asAtDate") || undefined);

    if (!detail) {
      return NextResponse.json({ success: false, error: "Member account not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    console.error("Error fetching savings member detail:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch savings member detail",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
