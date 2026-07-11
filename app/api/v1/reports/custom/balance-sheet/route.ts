import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import { getDirectBalanceSheetAccounts } from "@/lib/reports/direct-source";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BalanceSummaryAccount = {
  code: string;
  name: string;
  parentCategory: string | null;
  balance: number;
};

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeBranchIds(user: { role: UserRole; branchId?: string | null }, requestedBranchIds: unknown) {
  if (user.role === UserRole.ADMIN) {
    return Array.isArray(requestedBranchIds)
      ? requestedBranchIds.filter((branchId): branchId is string => typeof branchId === "string" && branchId.length > 0)
      : [];
  }
  if (!user.branchId) return null;
  return [user.branchId];
}

function matchesCategoryFilters(
  account: { accountName: string; category: string | null; parentName: string | null },
  includedCategories: string[],
  excludedCategories: string[],
) {
  const haystack = [account.category, account.parentName, account.accountName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (includedCategories.length > 0) {
    const hasIncluded = includedCategories.some((category) => haystack.includes(category.toLowerCase()));
    if (!hasIncluded) return false;
  }
  if (excludedCategories.length > 0) {
    const hasExcluded = excludedCategories.some((category) => haystack.includes(category.toLowerCase()));
    if (hasExcluded) return false;
  }
  return true;
}

// POST /api/v1/reports/custom/balance-sheet - Custom balance sheet with filters
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { asOfDate, includedCategories, excludedCategories, branchIds } = body;
    const resolvedBranchIds = normalizeBranchIds(user, branchIds);
    if (resolvedBranchIds === null) {
      return NextResponse.json({ error: "Branch access is required for this user" }, { status: 403 });
    }

    const asOf = parseDate(asOfDate) ?? new Date();
    const included = Array.isArray(includedCategories) ? includedCategories : [];
    const excluded = Array.isArray(excludedCategories) ? excludedCategories : [];
    const branchId = resolvedBranchIds.length === 1 ? resolvedBranchIds[0] : undefined;

    const accounts = await getDirectBalanceSheetAccounts(asOf, branchId);

    // Build parent name map from the account tree
    const parentNameMap = new Map<string, string>();
    for (const a of accounts) {
      if (a.parentId && !a.isGroup) {
        const parent = accounts.find((p) => p.id === a.parentId);
        if (parent) parentNameMap.set(a.id, parent.accountName);
      }
    }

    const filteredAccounts = accounts
      .filter((a) => !a.isGroup)
      .map((account) => ({
        ...account,
        parentName: parentNameMap.get(account.id) || null,
      }))
      .filter((account) => matchesCategoryFilters({ ...account, category: account.category || null }, included, excluded));

    const mapAccounts = (accts: typeof filteredAccounts): BalanceSummaryAccount[] =>
      accts.map((account) => ({
        code: account.accountCode,
        name: account.accountName,
        parentCategory: parentNameMap.get(account.id) || null,
        balance: account.balance,
      }));

    const assets = filteredAccounts.filter((a) => a.ledgerType === "ASSETS");
    const liabilities = filteredAccounts.filter((a) => a.ledgerType === "LIABILITIES");
    const equity = filteredAccounts.filter((a) => a.ledgerType === "EQUITY");

    const mappedAssets = mapAccounts(assets);
    const mappedLiabilities = mapAccounts(liabilities);
    const mappedEquity = mapAccounts(equity);

    const totalAssets = mappedAssets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = mappedLiabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = mappedEquity.reduce((sum, a) => sum + a.balance, 0);

    const difference = totalAssets - (totalLiabilities + totalEquity);
    const isBalanced = Math.abs(difference) < 0.01;

    return NextResponse.json({
      data: {
        reportType: "Custom Balance Sheet",
        asOfDate: asOf.toISOString().split("T")[0],
        assets: { accounts: mappedAssets, total: totalAssets },
        liabilities: { accounts: mappedLiabilities, total: totalLiabilities },
        equity: { accounts: mappedEquity, total: totalEquity },
        isBalanced,
        difference,
        filters: { includedCategories: included, excludedCategories: excluded, branchIds: resolvedBranchIds },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating custom balance sheet:", error);
    return NextResponse.json(
      { error: "Failed to generate custom balance sheet" },
      { status: 500 },
    );
  }
}
