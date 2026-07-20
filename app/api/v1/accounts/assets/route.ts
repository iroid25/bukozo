import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getChartOfAccounts } from "@/lib/services/chartOfAccounts";
import { ensureAssetStructure } from "@/lib/services/asset-structure";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

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
//   data, pagination            // @deprecated legacy COA rows — only used by
//                                // AssetCreateForm / CurrentAssetTransferForm /
//                                // AssetDisposalForm classification pickers.
//                                // New code should use `classifications` below.
//   fixedAssets: { total, categories: AssetCategoryNode[] }
//   currentAssets: { total, categories: AssetCategoryNode[] }
//   loans: AssetCategoryNode
//   cashAtHand: { amount, count, label, isModeled: true }
//   classifications: { fixed: string[], current: string[] }   // unique FixedAsset.category values
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

    await ensureAssetStructure();

    // @deprecated — legacy COA query kept for backward-compatible classification pickers
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

    const loanAgg = await db.loan.aggregate({
      _sum: { outstandingBalance: true },
      _count: { _all: true },
      where: {
        outstandingBalance: { gt: 0 },
        status: { not: "WRITTEN_OFF" },
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
      },
    });

    const institutionLoanAgg = await db.institutionLoan.aggregate({
      _sum: { outstandingBalance: true },
      _count: { _all: true },
      where: {
        outstandingBalance: { gt: 0 },
        status: { not: "WRITTEN_OFF" },
        ...(scopedBranchId
          ? { institution: { user: { branchId: scopedBranchId } } }
          : {}),
      },
    });

    const loansNode: AssetCategoryNode = {
      source: "LOAN_ASSET_BUCKET",
      key: "loans",
      id: "LOAN_ASSET_BUCKET:loans",
      isManualLedger: false,
      label: "Loans",
      amount: Number(loanAgg._sum.outstandingBalance || 0) + Number(institutionLoanAgg._sum.outstandingBalance || 0),
      count: Number(loanAgg._count._all || 0) + Number(institutionLoanAgg._count._all || 0),
    };

    const repaymentWhere = scopedBranchId
      ? { loan: { branchId: scopedBranchId } }
      : {};

    const repaymentAgg = await db.loanRepayment.aggregate({
      where: repaymentWhere,
      _sum: { principalPaid: true },
      _count: { _all: true },
    });

    const institutionRepaymentAgg = await db.institutionLoanRepayment.aggregate({
      _sum: { principalPaid: true },
      _count: { _all: true },
      where: scopedBranchId
        ? { institution: { user: { branchId: scopedBranchId } } }
        : {},
    });

    const cashAtHand = {
      amount: Number(repaymentAgg._sum.principalPaid || 0) + Number(institutionRepaymentAgg._sum.principalPaid || 0),
      count: Number(repaymentAgg._count._all || 0) + Number(institutionRepaymentAgg._count._all || 0),
      label: "Cash at Hand (modeled from loan repayments)",
      isModeled: true as const,
    };

    const vaultAgg = await db.vault.aggregate({
      where: { isActive: true, ...(scopedBranchId ? { branchId: scopedBranchId } : {}) },
      _sum: { balance: true },
    });
    const vaultBalance = {
      amount: Number(vaultAgg._sum.balance || 0),
      label: "Cash in Vault",
    };

    const floatAgg = await db.userFloat.aggregate({
      where: {
        isActiveForDay: true,
        ...(scopedBranchId ? { user: { branchId: scopedBranchId } } : {}),
      },
      _sum: { balance: true },
    });
    const floatBalance = {
      amount: Number(floatAgg._sum.balance || 0),
      label: "Teller Float",
    };

    const totalAssets =
      fixedAssetsTotal + currentAssetsTotal + loansNode.amount + cashAtHand.amount + vaultBalance.amount + floatBalance.amount;

    const balanceByCode = new Map<string, number>([
      ["100000", totalAssets],
      ["101000", fixedAssetsTotal],
      ["102000", currentAssetsTotal],
      ["101100", cashAtHand.amount],
      ["107000", loansNode.amount],
      ["102004", floatBalance.amount],
      ["102005", vaultBalance.amount],
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

    // Unique classification categories from real FixedAsset data
    const fixedCategories = fixedAssetGroups.map((r) => r.category).sort();
    const currentCategories = currentAssetGroups.map((r) => r.category).sort();

    return NextResponse.json({
      ...result,
      data: sourceAlignedData,
      fixedAssets: { total: fixedAssetsTotal, categories: fixedAssetCategories },
      currentAssets: { total: currentAssetsTotal, categories: currentAssetCategories },
      loans: loansNode,
      cashAtHand,
      vault: vaultBalance,
      float: floatBalance,
      classifications: { fixed: fixedCategories, current: currentCategories },
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
