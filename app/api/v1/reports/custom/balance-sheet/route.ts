import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { calculateAccountBalance } from "@/lib/accounting-rules";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PeriodRange = {
  startDate: Date;
  endDate: Date;
};

type BalanceSummaryAccount = {
  code: string;
  name: string;
  parentCategory: string | null;
  balance: number;
};

type BalanceSummarySection = {
  accounts: BalanceSummaryAccount[];
  total: number;
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

  if (!user.branchId) {
    return null;
  }

  return [user.branchId];
}

function matchesCategoryFilters(
  account: { accountName: string; category: string | null; parent?: { accountName: string | null } | null },
  includedCategories: string[],
  excludedCategories: string[],
) {
  const haystack = [account.category, account.parent?.accountName, account.accountName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (includedCategories.length > 0) {
    const hasIncluded = includedCategories.some((category) => haystack.includes(category.toLowerCase()));
    if (!hasIncluded) {
      return false;
    }
  }

  if (excludedCategories.length > 0) {
    const hasExcluded = excludedCategories.some((category) => haystack.includes(category.toLowerCase()));
    if (hasExcluded) {
      return false;
    }
  }

  return true;
}

function buildBranchWhere(branchIds: string[]) {
  if (branchIds.length === 0) {
    return {};
  }

  return {
    OR: [
      {
        transaction: {
          branchId: {
            in: branchIds,
          },
        },
      },
      {
        transactionId: null,
        branchId: {
          in: branchIds,
        },
      },
    ],
  };
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

    const accounts = await db.chartOfAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        ledgerType: true,
        category: true,
        parent: {
          select: {
            accountName: true,
          },
        },
      },
      orderBy: {
        accountCode: "asc",
      },
    });

    const filteredAccounts = accounts.filter((account) => matchesCategoryFilters(account, included, excluded));
    const accountIds = filteredAccounts.map((account) => account.id);

    const balancesByAccountId = new Map<string, { debit: number; credit: number }>();

    if (accountIds.length > 0) {
      const groupedEntries = await db.journalEntry.groupBy({
        by: ["accountId"],
        where: {
          accountId: {
            in: accountIds,
          },
          entryDate: {
            lte: asOf,
          },
          ...buildBranchWhere(resolvedBranchIds),
        },
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
      });

      for (const entry of groupedEntries) {
        balancesByAccountId.set(entry.accountId, {
          debit: Number(entry._sum.debitAmount || 0),
          credit: Number(entry._sum.creditAmount || 0),
        });
      }
    }

    const mapAccounts = (accountsToMap: typeof filteredAccounts) =>
      accountsToMap.map((account) => {
        const balances = balancesByAccountId.get(account.id);
        const debit = balances?.debit ?? 0;
        const credit = balances?.credit ?? 0;
        return {
          code: account.accountCode,
          name: account.accountName,
          parentCategory: account.parent?.accountName || null,
          balance: calculateAccountBalance(account.ledgerType, debit, credit),
        };
      });

    const assets = filteredAccounts.filter((account) => account.ledgerType === "ASSETS");
    const liabilities = filteredAccounts.filter((account) => account.ledgerType === "LIABILITIES");
    const equity = filteredAccounts.filter((account) => account.ledgerType === "EQUITY");

    const mappedAssets = mapAccounts(assets);
    const mappedLiabilities = mapAccounts(liabilities);
    const mappedEquity = mapAccounts(equity);

    const totalAssets = mappedAssets.reduce((sum, account) => sum + account.balance, 0);
    const totalLiabilities = mappedLiabilities.reduce((sum, account) => sum + account.balance, 0);
    const totalEquity = mappedEquity.reduce((sum, account) => sum + account.balance, 0);

    const difference = totalAssets - (totalLiabilities + totalEquity);
    const isBalanced = Math.abs(difference) < 0.01;

    return NextResponse.json({
      data: {
        reportType: "Custom Balance Sheet",
        asOfDate: asOf.toISOString().split("T")[0],
        assets: {
          accounts: mappedAssets,
          total: totalAssets,
        },
        liabilities: {
          accounts: mappedLiabilities,
          total: totalLiabilities,
        },
        equity: {
          accounts: mappedEquity,
          total: totalEquity,
        },
        isBalanced,
        difference,
        filters: {
          includedCategories: included,
          excludedCategories: excluded,
          branchIds: resolvedBranchIds,
        },
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
