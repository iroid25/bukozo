import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import { searchShareAccounts } from "@/lib/reports/share-account-statement-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const results = await searchShareAccounts({
      user: session.user,
      search: searchParams.get("search") || undefined,
      productCode: searchParams.get("productCode") || searchParams.get("product_code") || undefined,
      branchId: searchParams.get("branchId") || undefined,
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Error searching share accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to search share accounts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
