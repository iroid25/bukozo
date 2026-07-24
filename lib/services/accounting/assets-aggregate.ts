import { db } from "@/prisma/db";
import { ensureAssetStructure } from "@/lib/services/asset-structure";

export type AssetNodeSource =
  | "FIXED_ASSET_CATEGORY"
  | "CURRENT_ASSET_CATEGORY"
  | "LOAN_ASSET_BUCKET";

export type AssetCategoryNode = {
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

export async function fetchAssetsSummary(branchId?: string) {
  await ensureAssetStructure();

  const fixedAssetGroups = await db.fixedAsset.groupBy({
    by: ["category"],
    where: {
      assetType: "FIXED",
      status: { not: "DISPOSED" },
      ...(branchId ? { branchId } : {}),
    },
    _sum: { currentValue: true },
    _count: { _all: true },
  });

  const currentAssetGroups = await db.fixedAsset.groupBy({
    by: ["category"],
    where: {
      assetType: "CURRENT",
      status: { not: "DISPOSED" },
      ...(branchId ? { branchId } : {}),
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
      ...(branchId ? { branchId } : {}),
    },
  });

  const institutionLoanAgg = await db.institutionLoan.aggregate({
    _sum: { outstandingBalance: true },
    _count: { _all: true },
    where: {
      outstandingBalance: { gt: 0 },
      status: { not: "WRITTEN_OFF" },
      ...(branchId
        ? { institution: { user: { branchId } } }
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

  const repaymentWhere = branchId
    ? { loan: { branchId } }
    : {};

  const repaymentAgg = await db.loanRepayment.aggregate({
    where: repaymentWhere,
    _sum: { principalPaid: true },
    _count: { _all: true },
  });

  const institutionRepaymentAgg = await db.institutionLoanRepayment.aggregate({
    _sum: { principalPaid: true },
    _count: { _all: true },
    where: branchId
      ? { institution: { user: { branchId } } }
      : {},
  });

  const cashAtHand = {
    amount: Number(repaymentAgg._sum.principalPaid || 0) + Number(institutionRepaymentAgg._sum.principalPaid || 0),
    count: Number(repaymentAgg._count._all || 0) + Number(institutionRepaymentAgg._count._all || 0),
    label: "Cash at Hand (modeled from loan repayments)",
    isModeled: true as const,
  };

  const vaultAgg = await db.vault.aggregate({
    where: { isActive: true, ...(branchId ? { branchId } : {}) },
    _sum: { balance: true },
  });
  const vaultBalance = {
    amount: Number(vaultAgg._sum.balance || 0),
    label: "Cash in Vault",
  };

  const floatAgg = await db.userFloat.aggregate({
    where: {
      isActiveForDay: true,
      ...(branchId ? { user: { branchId } } : {}),
    },
    _sum: { balance: true },
  });
  const floatBalance = {
    amount: Number(floatAgg._sum.balance || 0),
    label: "Teller Float",
  };

  const totalAssets =
    fixedAssetsTotal + currentAssetsTotal + loansNode.amount + cashAtHand.amount + vaultBalance.amount + floatBalance.amount;

  return {
    fixedAssets: { total: fixedAssetsTotal, categories: fixedAssetCategories },
    currentAssets: { total: currentAssetsTotal, categories: currentAssetCategories },
    loans: loansNode,
    cashAtHand,
    vault: vaultBalance,
    float: floatBalance,
    totalAssets,
    debits: totalAssets,
    credits: 0,
  };
}
