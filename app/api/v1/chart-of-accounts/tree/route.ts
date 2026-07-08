import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getCOATree } from "@/lib/services/coa-tree";
import { ensureCoreChartOfAccountsStructure } from "@/lib/services/chart-of-accounts-bootstrap";
import { ensureEquityStructure } from "@/lib/services/equity-structure";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await ensureCoreChartOfAccountsStructure();
    await ensureEquityStructure();

    const branchId = resolveBranchScope(
      session.user as { role: string; branchId?: string | null },
      request.nextUrl.searchParams.get("branchId"),
    );

    const tree = await getCOATree(branchId);

    return NextResponse.json({
      success: true,
      data: tree,
    });
  } catch (error) {
    console.error("Error fetching COA tree:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch Chart of Accounts tree", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
