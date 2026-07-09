import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getChartOfAccounts } from "@/lib/services/chartOfAccounts";
import { ensureAssetStructure } from "@/lib/services/asset-structure";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

// GET /api/v1/accounts/assets - Fetch all ASSET accounts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const parentId = searchParams.get("parentId") || undefined;
    const level = searchParams.get("level") ? parseInt(searchParams.get("level")!) : undefined;
    const search = searchParams.get("search") || undefined;
    const isActiveStr = searchParams.get("isActive");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : undefined;
    const branchId = searchParams.get("branchId");
    const user = session.user as { role: string; branchId?: string | null };

    await ensureAssetStructure();

    const result = await getChartOfAccounts({
      page,
      limit,
      ledgerType: "ASSETS", // Force Assets
      parentId: parentId === "null" ? null : parentId,
      level,
      search,
      isActive,
      branchId: resolveBranchScope(user, branchId),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch assets", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
