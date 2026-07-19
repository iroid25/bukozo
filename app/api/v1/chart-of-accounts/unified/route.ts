import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { ensureCoreChartOfAccountsStructure } from "@/lib/services/chart-of-accounts-bootstrap";
import { ensureEquityStructure } from "@/lib/services/equity-structure";
import { ensureIncomeStructure } from "@/lib/services/income-structure";
import { getChartOfAccounts } from "@/lib/services/chartOfAccounts";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { HIDDEN_COA_CODES } from "@/lib/accounting/coa-identity";

export const dynamic = "force-dynamic";

// GET /api/v1/chart-of-accounts/unified
// Aggregates data from all 5 ledger types using the same query path each type-specific page uses.
// This guarantees the pillar totals and account lists match exactly what the Assets, Liabilities,
// Equity, Income, and Expenditure pages show individually.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = session.user as any;
    await ensureCoreChartOfAccountsStructure();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || undefined;
    const isActiveStr = searchParams.get("isActive");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : undefined;
    const branchId = resolveBranchScope(user, searchParams.get("branchId"));

    // --- ASSETS & LIABILITIES ---
    // These pages use getChartOfAccounts() with journal balance hydration
    const [assetsResult, liabilitiesResult] = await Promise.all([
      getChartOfAccounts({ page: 1, limit: 10000, ledgerType: "ASSETS", search, isActive, branchId }),
      getChartOfAccounts({ page: 1, limit: 10000, ledgerType: "LIABILITIES", search, isActive, branchId }),
    ]);

    // --- EQUITY ---
    // The equity page uses a direct DB query (not getChartOfAccounts), no journal hydration.
    // It also fetches share capital from account types and share accounts.
    await ensureEquityStructure();
    const [equityAccounts, shareAccountTypes] = await Promise.all([
      db.chartOfAccount.findMany({
        where: {
          OR: [
            { accountCode: { startsWith: '3' } },
            { ledgerType: 'EQUITY' }
          ],
          isActive: true,
          NOT: {
            accountCode: { in: Array.from(HIDDEN_COA_CODES) },
          },
        },
        include: {
          parent: {
            select: { id: true, accountCode: true, accountName: true, fullCode: true },
          },
          _count: {
            select: { children: true, journalEntries: true },
          },
        },
        orderBy: { accountCode: 'asc' }
      }),
      db.accountType.findMany({
        where: {
          OR: [
            { isShareAccount: true },
            { shareAccounts: { some: { status: "ACTIVE" } } },
          ],
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const shareAccountTypeIds = shareAccountTypes.map((t) => t.id);
    const [shareBalanceRows, institutionShareBalanceRows] = shareAccountTypeIds.length > 0
      ? await Promise.all([
          db.shareAccount.groupBy({
            by: ["accountTypeId"],
            where: {
              accountTypeId: { in: shareAccountTypeIds },
              status: "ACTIVE",
              ...(branchId ? { branchId } : {}),
            },
            _sum: { totalValue: true, numberOfShares: true },
            _count: { _all: true },
          }),
          db.account.groupBy({
            by: ["accountTypeId"],
            where: {
              institutionId: { not: null },
              accountTypeId: { in: shareAccountTypeIds },
              accountType: { isShareAccount: true },
              status: "ACTIVE",
              ...(branchId ? { branchId } : {}),
            },
            _sum: { balance: true },
            _count: { _all: true },
          }),
        ])
      : [[], []];

    const shareBalanceMap = new Map(
      shareBalanceRows.map((row) => [
        row.accountTypeId,
        {
          amount: Number(row._sum.totalValue || 0),
          shares: Number(row._sum.numberOfShares || 0),
          count: Number(row._count._all || 0),
        },
      ]),
    );

    for (const instRow of institutionShareBalanceRows) {
      const existing = shareBalanceMap.get(instRow.accountTypeId);
      if (existing) {
        existing.amount += Number(instRow._sum.balance || 0);
        existing.count += Number(instRow._count._all || 0);
      } else {
        shareBalanceMap.set(instRow.accountTypeId, {
          amount: Number(instRow._sum.balance || 0),
          shares: 0,
          count: Number(instRow._count._all || 0),
        });
      }
    }

    const shareCapitalItems = shareAccountTypes.map((accountType) => {
      const agg = shareBalanceMap.get(accountType.id) || { amount: 0, shares: 0, count: 0 };
      const normalized = accountType.name.toLowerCase();
      let accountCode = "304004";
      if (normalized.includes("affiliate")) accountCode = "304001";
      else if (normalized.includes("ordinary")) accountCode = "304002";
      else if (normalized.includes("associate")) accountCode = "304003";
      return {
        id: accountType.id,
        sourceType: "SHARE_ACCOUNT_TYPE",
        accountTypeId: accountType.id,
        accountCode,
        name: accountType.name,
        rawName: accountType.name,
        amount: agg.amount,
        accountCount: agg.count,
        numberOfShares: agg.shares,
        shareValue: Number(accountType.sharePrice || 0),
      };
    });

    // --- INCOME (budget categories, matching /api/v1/income/categories) ---
    await ensureIncomeStructure();
    const incomeCategories = await db.budgetCategory.findMany({
      where: {
        kind: "INCOME",
        isActive: true,
        NOT: { code: { in: Array.from(HIDDEN_COA_CODES) } },
      },
      include: {
        parent: true,
        children: true,
        _count: { select: { incomeRecords: true, expenditureRecords: true, children: true } },
      },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });

    // --- EXPENDITURES (budget categories, matching /api/v1/expenditure/categories) ---
    const expenditureCategories = await db.budgetCategory.findMany({
      where: {
        kind: "EXPENSE",
        isActive: true,
      },
      include: {
        parent: true,
        children: true,
        _count: { select: { expenditureRecords: true, incomeRecords: true, children: true } },
      },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });

    // --- Build grouped response ---
    const byLedgerType: Record<string, any[]> = {
      ASSETS: assetsResult.data,
      LIABILITIES: liabilitiesResult.data,
      EQUITY: equityAccounts,
      INCOME: incomeCategories,
      EXPENDITURES: expenditureCategories,
    };

    const allAccounts = [
      ...assetsResult.data,
      ...liabilitiesResult.data,
      ...equityAccounts,
      ...incomeCategories,
      ...expenditureCategories,
    ];

    // --- Calculate totals ---
    // For ASSETS & LIABILITIES: use journal-balance-hydrated totals from getChartOfAccounts()
    // For EQUITY: use raw balance from direct DB query (matching the equity page)
    // For INCOME & EXPENDITURES: use getChartOfAccounts() for COA-based financial totals
    const coaIncomeResult = await getChartOfAccounts({
      page: 1, limit: 10000, ledgerType: "INCOME", search, isActive, branchId
    });
    const coaExpenditureResult = await getChartOfAccounts({
      page: 1, limit: 10000, ledgerType: "EXPENDITURES", search, isActive, branchId
    });

    const computeTotals = (type: string, accounts: any[]) => {
      let debits = 0;
      let credits = 0;
      if (type === "ASSETS" || type === "LIABILITIES") {
        // Hydrated from journal entries
        debits = accounts.reduce((s: number, a: any) => s + Number(a.debitBalance || 0), 0);
        credits = accounts.reduce((s: number, a: any) => s + Number(a.creditBalance || 0), 0);
      } else if (type === "EQUITY") {
        // Raw balance from direct DB (matching equity page behavior)
        debits = accounts.reduce((s: number, a: any) => s + Number(a.debitBalance || 0), 0);
        credits = accounts.reduce((s: number, a: any) => s + Number(a.creditBalance || 0), 0);
      } else {
        // INCOME / EXPENDITURES — use COA-journal-hydrated balances for financial totals
        const coaResult = type === "INCOME" ? coaIncomeResult : coaExpenditureResult;
        debits = coaResult.data.reduce((s: number, a: any) => s + Number(a.debitBalance || 0), 0);
        credits = coaResult.data.reduce((s: number, a: any) => s + Number(a.creditBalance || 0), 0);
      }
      const isDebitNormal = type === "ASSETS" || type === "EXPENDITURES";
      return {
        debits,
        credits,
        balance: isDebitNormal ? debits - credits : credits - debits,
      };
    };

    const types = ["ASSETS", "LIABILITIES", "EQUITY", "INCOME", "EXPENDITURES"] as const;
    const totals: Record<string, { debits: number; credits: number; balance: number }> = {};
    let totalDebits = 0;
    let totalCredits = 0;

    for (const type of types) {
      const t = computeTotals(type, byLedgerType[type]);
      totals[type] = t;
      totalDebits += t.debits;
      totalCredits += t.credits;
    }

    return NextResponse.json({
      success: true,
      data: {
        accounts: allAccounts,
        byLedgerType,
        extras: {
          shareCapital: {
            items: shareCapitalItems,
            total: shareCapitalItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
          },
        },
        totals,
        summary: {
          totalDebits,
          totalCredits,
          isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
          difference: totalDebits - totalCredits,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching unified chart of accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch unified chart of accounts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
