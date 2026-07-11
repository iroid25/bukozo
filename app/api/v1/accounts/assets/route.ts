import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getChartOfAccounts } from "@/lib/services/chartOfAccounts";
import { ensureAssetStructure } from "@/lib/services/asset-structure";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

// Shared NodeRef convention (see app/api/v1/accounts/liabilities/route.ts and
// app/api/v1/equity/route.ts for the sibling implementations of this pattern).
type AssetNodeSource =
  | "FIXED_ASSET_CATEGORY"
  | "CURRENT_ASSET_CATEGORY"
  | "LOAN_ASSET_BUCKET";

type AssetCategoryNode = {
  source: AssetNodeSource;
  key: string;
  id: string;
  isManualLedger: false;
  label: string;
  amount: number;
  count: number;
};

function buildCategoryNode(
  source: "FIXED_ASSET_CATEGORY" | "CURRENT_ASSET_CATEGORY",
  key: string,
  amount: number,
  count: number,
): AssetCategoryNode {
  return {
    source,
    key,
    id: `${source}:${key}`,
    isManualLedger: false,
    label: key,
    amount,
    count,
  };
}

// GET /api/v1/accounts/assets - Assets dashboard summary.
//
// Response shape:
// {
//   data, pagination            // legacy ChartOfAccount rows (ledgerType=ASSETS).
//                                // Kept ONLY for backward compatibility: the
//                                // AssetCreateForm / CurrentAssetTransferForm /
//                                // AssetDisposalForm "classification" pickers
//                                // still call this same endpoint to choose a
//                                // COA leaf for new asset postings, and must
//                                // keep working unchanged.
//   fixedAssets: { total, categories: AssetCategoryNode[] }   // real FixedAsset(assetType=FIXED) groupBy
//   currentAssets: { total, categories: AssetCategoryNode[] } // real FixedAsset(assetType=CURRENT) groupBy
//   loans: AssetCategoryNode    // Loan.outstandingBalance bucket
//   cashAtHand: { amount, count, label, isModeled: true }     // modeled from LoanRepayment.principalPaid
//   totalAssets: number
// }
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

    // COA structure-seeding must keep running unchanged: other code (journal
    // posting, reports, the classification pickers below) depends on these
    // ChartOfAccount rows existing.
    await ensureAssetStructure();

    const result = await getChartOfAccounts({
      page,
      limit,
      ledgerType: "ASSETS", // Force Assets
      parentId: parentId === "null" ? null : parentId,
      level,
      search,
      isActive,
      branchId: scopedBranchId,
    });

    // --- Real source-of-truth aggregation for the Assets dashboard page ---

    const fixedAssetGroups = await db.fixedAsset.groupBy({
      by: ["category"],
      where: {
        assetType: "FIXED",
        status: { not: "DISPOSED" },
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
      },
      _sum: { currentValue: true },
      _count: { _all: true },
    });

    const currentAssetGroups = await db.fixedAsset.groupBy({
      by: ["category"],
      where: {
        assetType: "CURRENT",
        status: { not: "DISPOSED" },
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
      },
      _sum: { currentValue: true },
      _count: { _all: true },
    });

    // NOTE: category is free text on FixedAsset. We group strictly by whatever
    // value actually exists in the data (no filtering to the canonical seed
    // names "Land"/"Motor Vehicle"/"Furniture and fittings") so any ad-hoc
    // category a user typed still shows up rather than being silently dropped.
    const fixedAssetCategories: AssetCategoryNode[] = fixedAssetGroups
      .map((row) =>
        buildCategoryNode(
          "FIXED_ASSET_CATEGORY",
          row.category,
          Number(row._sum.currentValue || 0),
          Number(row._count._all || 0),
        ),
      )
      .sort((a, b) => b.amount - a.amount);

    const currentAssetCategories: AssetCategoryNode[] = currentAssetGroups
      .map((row) =>
        buildCategoryNode(
          "CURRENT_ASSET_CATEGORY",
          row.category,
          Number(row._sum.currentValue || 0),
          Number(row._count._all || 0),
        ),
      )
      .sort((a, b) => b.amount - a.amount);

    const fixedAssetsTotal = fixedAssetCategories.reduce(
      (sum, node) => sum + node.amount,
      0,
    );
    const currentAssetsTotal = currentAssetCategories.reduce(
      (sum, node) => sum + node.amount,
      0,
    );

    // Loans bucket: Loan.outstandingBalance for loans that still carry a real
    // balance. outstandingBalance > 0 is the practical "still an asset" filter;
    // WRITTEN_OFF loans are excluded even if a stale balance lingers on them.
    const loanAgg = await db.loan.aggregate({
      _sum: { outstandingBalance: true },
      _count: { _all: true },
      where: {
        outstandingBalance: { gt: 0 },
        status: { not: "WRITTEN_OFF" },
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
      },
    });

    const loansNode: AssetCategoryNode = {
      source: "LOAN_ASSET_BUCKET",
      key: "loans",
      id: "LOAN_ASSET_BUCKET:loans",
      isManualLedger: false,
      label: "Loans",
      amount: Number(loanAgg._sum.outstandingBalance || 0),
      count: Number(loanAgg._count._all || 0),
    };

    // Cash at hand: historically (and still) modeled from loan-repayment
    // principal collected, NOT literal till cash. Mirrors the same
    // branch-scoped query used by app/api/v1/loans/repayments/statistics.
    const repaymentWhere = scopedBranchId
      ? { loan: { branchId: scopedBranchId } }
      : {};

    const repaymentAgg = await db.loanRepayment.aggregate({
      where: repaymentWhere,
      _sum: { principalPaid: true },
      _count: { _all: true },
    });

    const cashAtHand = {
      amount: Number(repaymentAgg._sum.principalPaid || 0),
      count: Number(repaymentAgg._count._all || 0),
      label: "Cash at Hand (modeled from loan repayments)",
      isModeled: true as const,
    };

    const totalAssets =
      fixedAssetsTotal + currentAssetsTotal + loansNode.amount + cashAtHand.amount;

    return NextResponse.json({
      ...result,
      fixedAssets: { total: fixedAssetsTotal, categories: fixedAssetCategories },
      currentAssets: { total: currentAssetsTotal, categories: currentAssetCategories },
      loans: loansNode,
      cashAtHand,
      totalAssets,
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
