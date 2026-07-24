import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getChartOfAccounts } from "@/lib/services/chartOfAccounts";
import { ensureAssetStructure } from "@/lib/services/asset-structure";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { fetchAssetsSummary } from "@/lib/services/accounting/assets-aggregate";

export const dynamic = "force-dynamic";

// GET /api/v1/accounts/assets - Assets dashboard summary.
//
// Uses the shared fetchAssetsSummary() service for real data aggregation.
// Also returns legacy COA data for backward-compatible classification pickers.
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
    const scopedBranchId = resolveBranchScope(user, branchId);

    await ensureAssetStructure();

    // Legacy COA query for classification pickers
    const result = await getChartOfAccounts({
      page,
      limit,
      ledgerType: "ASSETS",
      parentId: parentId === "null" ? null : parentId,
      level,
      search,
      isActive,
      branchId: scopedBranchId,
    });

    // Real source-of-truth aggregation via shared service
    const summary = await fetchAssetsSummary(scopedBranchId);

    const balanceByCode = new Map<string, number>([
      ["100000", summary.totalAssets],
      ["101000", summary.fixedAssets.total],
      ["102000", summary.currentAssets.total],
      ["101100", summary.cashAtHand.amount],
      ["107000", summary.loans.amount],
      ["102004", summary.float.amount],
      ["102005", summary.vault.amount],
    ]);

    const overrideSourceBalance = (account: any): any => {
      const override = balanceByCode.get(account.accountCode);
      const nextChildren = Array.isArray(account.children)
        ? account.children.map(overrideSourceBalance)
        : account.children;

      return {
        ...account,
        balance: override ?? account.balance,
        children: nextChildren,
      };
    };

    const sourceAlignedData = Array.isArray(result.data)
      ? result.data.map(overrideSourceBalance)
      : result.data;

    return NextResponse.json({
      ...result,
      data: sourceAlignedData,
      fixedAssets: summary.fixedAssets,
      currentAssets: summary.currentAssets,
      loans: summary.loans,
      cashAtHand: summary.cashAtHand,
      vault: summary.vault,
      float: summary.float,
      classifications: {
        fixed: summary.fixedAssets.categories.map((c) => c.key).sort(),
        current: summary.currentAssets.categories.map((c) => c.key).sort(),
      },
      totalAssets: summary.totalAssets,
    });
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
