import { db } from "@/prisma/db";
import { UserRole, TransactionStatus, CategoryKind, TransactionType } from "@prisma/client";
import { calculateAccountBalance } from "@/lib/accounting-rules";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export async function getBranchFilterForService(user: any, requestedBranchId?: string) {
  if (user.role === UserRole.ADMIN) {
    if (requestedBranchId && requestedBranchId !== "all" && requestedBranchId !== "ALL") {
      return { branchId: requestedBranchId };
    }
    return {};
  }

  // For restricted roles, always return their branch
  if (!user.branchId) return { branchId: "no-branch" };
  return { branchId: user.branchId };
}

export type BalanceSheetFilters = {
  section?: "assets" | "liabilities" | "equity" | "all";
  subSection?:
    | "all"
    | "current-assets"
    | "non-current-assets"
    | "current-liabilities"
    | "long-term-liabilities"
    | "equity";
  includeZeroBalances?: boolean;
  search?: string;
};

// ============================================================================
// 1. PROFIT AND LOSS STATEMENT
// ============================================================================
export async function getProfitAndLossStatementService(
  startDate: Date,
  endDate: Date,
  branchId: string | undefined,
  user: any
) {
  const branchFilter = await getBranchFilterForService(user, branchId);
  const whereClause: any = {
    recordDate: { gte: startDate, lte: endDate },
    status: TransactionStatus.COMPLETED,
    ...branchFilter,
  };

  const [activeCategories, incomeRecords, expenditureRecords, loanFeeTransactions] = await Promise.all([
    db.budgetCategory.findMany({
      where: {
        isActive: true,
        kind: {
          in: [CategoryKind.INCOME, CategoryKind.EXPENSE],
        },
      },
      orderBy: [{ kind: "asc" }, { parentId: "asc" }, { name: "asc" }],
    }),
    db.incomeRecord.findMany({
      where: whereClause,
      include: {
        budgetCategory: true,
        branch: { select: { name: true } },
      },
    }),
    db.expenditureRecord.findMany({
      where: whereClause,
      include: {
        budgetCategory: true,
        branch: { select: { name: true } },
      },
    }),
    db.transaction.findMany({
      where: {
        transactionDate: { gte: startDate, lte: endDate },
        status: TransactionStatus.COMPLETED,
        type: TransactionType.FEE,
        description: { contains: "loan", mode: "insensitive" },
        ...(branchId
          ? {
              OR: [
                { branchId },
                { branchId: null },
              ],
            }
          : {}),
      },
      select: {
        transactionRef: true,
        amount: true,
        description: true,
        transactionDate: true,
        branchId: true,
      },
    }),
  ]);

  const categoriesById = new Map(activeCategories.map((category) => [category.id, category]));

  const buildCategoryPath = (categoryId?: string | null) => {
    const path: any[] = [];
    const seen = new Set<string>();
    let currentId = categoryId || undefined;

    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const category = categoriesById.get(currentId);
      if (!category) break;
      path.unshift(category);
      currentId = category.parentId || undefined;
    }

    return path;
  };

  const seedGroups = (kind: CategoryKind) => {
    const grouped = new Map<string, any>();

    activeCategories
      .filter((category) => category.kind === kind)
      .forEach((category) => {
        grouped.set(category.id, {
          name: category.name,
          code: category.code,
          amount: 0,
          items: [],
        });
      });

    return grouped;
  };

  const incomeByCategory = seedGroups(CategoryKind.INCOME);
  const expensesByCategory = seedGroups(CategoryKind.EXPENSE);

  const loanApplicationFeeCategory = activeCategories.find(
    (category) =>
      category.kind === CategoryKind.INCOME &&
      (
        /loan\s+(application|processing)\s+fees?/i.test(category.name) ||
        category.code === "400500" ||
        category.code === "401002"
      ),
  );

  const applyRecordToGroups = (record: any, targetMap: Map<string, any>) => {
    const recordCategory = record.budgetCategoryId ? categoriesById.get(record.budgetCategoryId) : record.budgetCategory;
    if (!recordCategory) return;

    const categoryPath = buildCategoryPath(recordCategory.id);
    const itemName = recordCategory.name;

    categoryPath.forEach((category) => {
      if (category.kind !== recordCategory.kind) return;

      if (!targetMap.has(category.id)) {
        targetMap.set(category.id, {
          name: category.name,
          code: category.code,
          amount: 0,
          items: [],
        });
      }

      const categoryGroup = targetMap.get(category.id);
      categoryGroup.amount += Number(record.amount || 0);
      // Only push the line item to the leaf (the actual record category),
      // not to ancestor groups — otherwise one record appears once per ancestor.
      if (category.id === recordCategory.id) {
        categoryGroup.items.push({
          itemName,
          amount: Number(record.amount || 0),
          date: record.recordDate,
          description: record.description,
        });
      }
    });
  };

  const incomeRecordRefs = new Set(
    incomeRecords
      .map((record: any) => record.referenceNumber || record.externalRef || record.receiptNumber || record.receiptNo)
      .filter(Boolean),
  );

  const syntheticLoanFeeRecords = loanFeeTransactions
    .filter((txn) => {
      const ref = txn.transactionRef || "";
      const normalized = (txn.description || "").toLowerCase();
      return (
        /loan\s+(application|processing)\s+fee/i.test(normalized) ||
        /^LPF-APP-/i.test(ref) ||
        /loan\s+application/i.test(ref)
      ) && !incomeRecordRefs.has(ref);
    })
    .map((txn) => ({
      amount: Number(txn.amount || 0),
      description: txn.description || "Loan processing fee",
      recordDate: txn.transactionDate,
      budgetCategoryId: loanApplicationFeeCategory?.id || null,
      budgetCategory: loanApplicationFeeCategory || null,
      branchId: txn.branchId || branchId || null,
      referenceNumber: txn.transactionRef || null,
    }));

  incomeRecords
    .concat(syntheticLoanFeeRecords as any[])
    .forEach((record: any) => applyRecordToGroups(record, incomeByCategory));
  expenditureRecords.forEach((record: any) => applyRecordToGroups(record, expensesByCategory));

  const totalIncome = incomeRecords.reduce((sum: number, r: any) => sum + r.amount, 0);
  const totalExpenses = expenditureRecords.reduce((sum: number, r: any) => sum + r.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  return {
    reportType: "Profit and Loss Statement",
    period: { startDate, endDate },
    income: {
      categories: Array.from(incomeByCategory.values()),
      total: totalIncome,
    },
    expenses: {
      categories: Array.from(expensesByCategory.values()),
      total: totalExpenses,
    },
    netProfit,
    profitMargin: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
    generatedAt: new Date(),
  };
}

// ============================================================================
// 2. BALANCE SHEET
// ============================================================================
type BalanceSheetMappedAccount = {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number;
  debit: number;
  credit: number;
  ledgerType: string;
  category: string;
  fullCode: string | null;
  level: number;
};

type StructuredBalanceSheetItem = {
  label: string;
  amount: number;
  accounts: Array<{
    code: string;
    name: string;
    balance: number;
  }>;
};

function normalizeName(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function makeStructuredItems(
  accounts: BalanceSheetMappedAccount[],
  resolver: (account: BalanceSheetMappedAccount) => string,
  options?: { invertAmount?: boolean },
) {
  const grouped = new Map<string, StructuredBalanceSheetItem>();

  accounts.forEach((account) => {
    const label = resolver(account);
    const current = grouped.get(label) || {
      label,
      amount: 0,
      accounts: [],
    };

    const signedAmount = options?.invertAmount ? account.balance * -1 : account.balance;
    current.amount += signedAmount;
    current.accounts.push({
      code: account.accountCode,
      name: account.accountName,
      balance: signedAmount,
    });
    grouped.set(label, current);
  });

  return Array.from(grouped.values()).filter((item) => Math.abs(item.amount) > 0.009);
}

export async function getOperationalBalances(
  asOfDate: Date,
  branchFilter: { branchId?: string },
) {
  const bf = branchFilter.branchId;

  // Account is the master balance source for savings (TXN-001).
  // SavingsAccount.balance was always 0 and is retired — Account aggregate covers it.
  const settled = await Promise.allSettled([
    db.vault.aggregate({
      where: { isActive: true, ...(bf ? { branchId: bf } : {}) },
      _sum: { balance: true },
    }),
    db.loan.aggregate({
      where: {
        status: { in: ["DISBURSED", "OVERDUE"] },
        disbursementDate: { lte: asOfDate },
        ...(bf ? { branchId: bf } : {}),
      },
      _sum: { outstandingBalance: true },
    }),
    db.account.aggregate({
      where: {
        status: { not: "CLOSED" },
        openedAt: { lte: asOfDate },
        accountType: { isShareAccount: false, hasFixedPeriod: false },
        ...(bf ? { branchId: bf } : {}),
      },
      _sum: { balance: true },
    }),
    db.shareAccount.aggregate({
      where: {
        status: { in: ["ACTIVE", "DORMANT", "ON_HOLD", "FROZEN"] },
        openedDate: { lte: asOfDate },
        ...(bf ? { branchId: bf } : {}),
      },
      _sum: { totalValue: true },
    }),
    db.fixedDeposit.aggregate({
      where: {
        status: { in: ["ACTIVE", "MATURED"] },
        startDate: { lte: asOfDate },
        ...(bf ? { branchId: bf } : {}),
      },
      _sum: { principalAmount: true },
    }),
    db.fixedAsset.aggregate({
      where: {
        status: "ACTIVE",
        purchaseDate: { lte: asOfDate },
        ...(bf ? { branchId: bf } : {}),
      },
      _sum: { currentValue: true, accumulatedDepreciation: true },
    }),
    db.incomeRecord.aggregate({
      where: {
        status: TransactionStatus.COMPLETED,
        recordDate: { lte: asOfDate },
        ...(bf ? { branchId: bf } : {}),
      },
      _sum: { amount: true },
    }),
    db.expenditureRecord.aggregate({
      where: {
        status: TransactionStatus.COMPLETED,
        recordDate: { lte: asOfDate },
        ...(bf ? { branchId: bf } : {}),
      },
      _sum: { amount: true },
    }),
    db.insuranceContribution.aggregate({
      where: {
        type: "CONTRIBUTION",
        createdAt: { lte: asOfDate },
        ...(bf ? { account: { branchId: bf } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  const val = <T,>(idx: number, pick: (r: any) => T, fallback: T): T => {
    const r = settled[idx];
    return r.status === "fulfilled" ? (pick(r.value) ?? fallback) : fallback;
  };

  return {
    cashInVault: val(0, (r) => r._sum.balance, 0),
    loanPortfolio: val(1, (r) => r._sum.outstandingBalance, 0),
    memberSavingsDeposits: val(2, (r) => r._sum.balance, 0),
    shareCapital: val(3, (r) => r._sum.totalValue, 0),
    fixedTermDeposits: val(4, (r) => r._sum.principalAmount, 0),
    fixedAssetsNet: val(5, (r) => r._sum.currentValue, 0),
    accumulatedDepreciation: val(5, (r) => r._sum.accumulatedDepreciation, 0),
    incomeTotal: val(6, (r) => r._sum.amount, 0) + val(8, (r) => r._sum.amount, 0),
    expenditureTotal: val(7, (r) => r._sum.amount, 0),
  };
}

function injectOperationalItem(
  items: StructuredBalanceSheetItem[],
  label: string,
  amount: number,
): StructuredBalanceSheetItem[] {
  if (Math.abs(amount) <= 0.009) return items;
  const existingIdx = items.findIndex((i) => i.label === label);
  if (existingIdx >= 0) {
    if (Math.abs(amount) > Math.abs(items[existingIdx].amount)) {
      return items.map((item, idx) =>
        idx === existingIdx ? { ...item, amount } : item,
      );
    }
    return items;
  }
  return [
    ...items,
    { label, amount, accounts: [{ code: "", name: "Operational Data", balance: amount }] },
  ];
}

function resolveAssetSection(account: BalanceSheetMappedAccount) {
  const name = normalizeName(account.accountName);
  const code = account.accountCode;

  if (
    name.includes("accumulated depreciation") ||
    name.includes("accumulated depn")
  ) {
    return {
      section: "nonCurrent" as const,
      lineItem: "Less: Accumulated Depreciation",
    };
  }

  if (
    name.includes("land") ||
    name.includes("building") ||
    name.includes("property") ||
    name.includes("plant") ||
    name.includes("equipment") ||
    name.includes("motor") ||
    name.includes("vehicle") ||
    name.includes("furniture") ||
    name.includes("computer") ||
    name.includes("office eqpt") ||
    code.startsWith("15") ||
    code.startsWith("16")
  ) {
    return {
      section: "nonCurrent" as const,
      lineItem: "Property, Plant and Equipment",
    };
  }

  if (
    name.includes("cash") ||
    name.includes("vault") ||
    name.includes("bank")
  ) {
    return {
      section: "current" as const,
      lineItem: "Cash and Cash Equivalents",
    };
  }

  if (
    name.includes("receivable") ||
    name.includes("loans") ||
    name.includes("loan receivable") ||
    code.startsWith("107")
  ) {
    return {
      section: "current" as const,
      lineItem: "Accounts and Loans Receivable",
    };
  }

  return {
    section: "current" as const,
    lineItem: "Other Current Assets",
  };
}

function resolveLiabilitySection(account: BalanceSheetMappedAccount) {
  const name = normalizeName(account.accountName);
  const code = account.accountCode;

  if (
    code.startsWith("202") ||
    name.includes("long term") ||
    name.includes("external loan") ||
    name.includes("borrowing")
  ) {
    return {
      section: "nonCurrent" as const,
      lineItem: "Long-Term Liabilities",
    };
  }

  if (name.includes("accounts payable") || name.includes("payable")) {
    return {
      section: "current" as const,
      lineItem: "Accounts Payable",
    };
  }

  if (name.includes("tax")) {
    return {
      section: "current" as const,
      lineItem: "Tax Payable",
    };
  }

  if (
    name.includes("member savings") ||
    name.includes("savings") ||
    name.includes("deposits") ||
    name.includes("customer credit")
  ) {
    return {
      section: "current" as const,
      lineItem: "Member Deposits and Customer Credit",
    };
  }

  if (name.includes("insurance")) {
    return {
      section: "current" as const,
      lineItem: "Loan Insurance and Related Liabilities",
    };
  }

  return {
    section: "current" as const,
    lineItem: "Other Current Liabilities",
  };
}

function resolveEquityLine(account: BalanceSheetMappedAccount) {
  const name = normalizeName(account.accountName);
  const code = account.accountCode;

  if (code.startsWith("304")) {
    return "Share Capital";
  }

  if (code.startsWith("303") || name.includes("retained earnings")) {
    return "Retained Earnings";
  }

  if (code.startsWith("301") || name.includes("reserve")) {
    return "Reserves";
  }

  if (code.startsWith("302") || name.includes("grant") || name.includes("donation")) {
    return "Grants and Donations";
  }

  return "Other Equity";
}

export async function getBalanceSheetService(
  asOfDate: Date,
  branchId: string | undefined,
  user: any,
  filters: BalanceSheetFilters = {},
) {
  // Clamp to end-of-day so a plain date string "2026-06-29" (which parses to
  // midnight UTC) doesn't exclude entries created later that same day.
  const asOf = new Date(asOfDate);
  asOf.setHours(23, 59, 59, 999);

  const branchFilter = await getBranchFilterForService(user, branchId);
  const searchTerm = filters.search?.trim().toLowerCase() || "";
  const includeZeroBalances = filters.includeZeroBalances ?? false;
  const sectionFilter = filters.section || "all";
  const subSectionFilter = filters.subSection || "all";

  const accounts = await db.chartOfAccount.findMany({
    where: { isActive: true },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      fullCode: true,
      ledgerType: true,
      level: true,
      category: true,
      parent: {
        select: {
          accountCode: true,
          accountName: true,
        },
      },
      balance: true,
      debitBalance: true,
      creditBalance: true,
    },
    orderBy: { accountCode: "asc" },
  });

  const balancesByAccountId = new Map<
    string,
    { debit: number; credit: number; balance: number }
  >();

  if (accounts.length > 0) {
    const jeWhere: any = {
      accountId: { in: accounts.map((account) => account.id) },
      entryDate: { lte: asOf },
    };
    if (branchFilter.branchId) {
      jeWhere.OR = [
        { transaction: { branchId: branchFilter.branchId } },
        { transactionId: null, branchId: branchFilter.branchId },
      ];
    }
    const grouped = await db.journalEntry.groupBy({
      by: ["accountId"],
      where: jeWhere,
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    grouped.forEach((entry) => {
      const account = accounts.find((item) => item.id === entry.accountId);
      if (!account) return;

      const debit = entry._sum.debitAmount || 0;
      const credit = entry._sum.creditAmount || 0;
      const balance = calculateAccountBalance(account.ledgerType, debit, credit);

      balancesByAccountId.set(entry.accountId, { debit, credit, balance });
    });
  }

  const mappedAccounts = accounts.map((account) => {
    const jeBalance = balancesByAccountId.get(account.id);

    return {
      accountId: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      balance: jeBalance ? jeBalance.balance : 0,
      debit: jeBalance ? jeBalance.debit : 0,
      credit: jeBalance ? jeBalance.credit : 0,
      ledgerType: account.ledgerType,
      category: account.parent?.accountName || account.category || account.ledgerType,
      fullCode: account.fullCode,
      level: account.level,
    };
  });

  const visibleAccounts = mappedAccounts.filter((account) => {
    if (!includeZeroBalances && Math.abs(account.balance) <= 0.009) return false;
    if (!searchTerm) return true;

    return [
      account.accountCode,
      account.accountName,
      account.category,
      account.fullCode || "",
    ].some((value) => value.toLowerCase().includes(searchTerm));
  });

  const assetsAccounts = visibleAccounts.filter((account) => account.ledgerType === "ASSETS");
  const liabilitiesAccounts = visibleAccounts.filter((account) => account.ledgerType === "LIABILITIES");
  const equityAccounts = visibleAccounts.filter((account) => account.ledgerType === "EQUITY");

  const currentAssetAccounts = assetsAccounts.filter(
    (account) => resolveAssetSection(account).section === "current",
  );
  const nonCurrentAssetAccounts = assetsAccounts.filter(
    (account) => resolveAssetSection(account).section === "nonCurrent",
  );
  const currentLiabilityAccounts = liabilitiesAccounts.filter(
    (account) => resolveLiabilitySection(account).section === "current",
  );
  const nonCurrentLiabilityAccounts = liabilitiesAccounts.filter(
    (account) => resolveLiabilitySection(account).section === "nonCurrent",
  );

  const currentAssetItems = makeStructuredItems(
    currentAssetAccounts,
    (account) => resolveAssetSection(account).lineItem,
  );
  const nonCurrentAssetItems = makeStructuredItems(
    nonCurrentAssetAccounts,
    (account) => resolveAssetSection(account).lineItem,
  );
  let currentLiabilityItems = makeStructuredItems(
    currentLiabilityAccounts,
    (account) => resolveLiabilitySection(account).lineItem,
  );
  const nonCurrentLiabilityItems = makeStructuredItems(
    nonCurrentLiabilityAccounts,
    (account) => resolveLiabilitySection(account).lineItem,
  );
  const equityItems = makeStructuredItems(
    equityAccounts,
    (account) => resolveEquityLine(account),
  );

  // Member savings live in Account.balance, not in GL journal entries.
  // The GL liability accounts sum to a small/negative value because savings deposits
  // never created JournalEntry records. Replacing GL current liabilities entirely with
  // the operational total makes this page consistent with /accounts/liabilities.
  const ops = await getOperationalBalances(asOf, branchFilter);
  if (ops.memberSavingsDeposits > 0) {
    currentLiabilityItems = [
      {
        label: "Member Deposits",
        amount: ops.memberSavingsDeposits,
        accounts: [{ code: "", name: "Member Savings Accounts", balance: ops.memberSavingsDeposits }],
      },
    ];
  }

  // Inject Surplus / (Deficit) for the Period from P&L into equity.
  // Net profit = total income - total expenditure recorded operationally.
  // This is the figure that would otherwise appear as the red "difference" line,
  // so placing it in equity makes Assets = Liabilities + Equity balance correctly.
  const netProfitForPeriod = ops.incomeTotal - ops.expenditureTotal;
  const surplusLabel = netProfitForPeriod >= 0 ? "Surplus for the Period" : "Deficit for the Period";
  const surplusItemIdx = equityItems.findIndex(
    (i) => i.label === surplusLabel || i.label === "Surplus for the Period" || i.label === "Deficit for the Period",
  );
  if (Math.abs(netProfitForPeriod) > 0.009) {
    const surplusItem = {
      label: surplusLabel,
      amount: netProfitForPeriod,
      accounts: [{ code: "", name: "Net Income / (Loss) from P&L", balance: netProfitForPeriod }],
    };
    if (surplusItemIdx >= 0) {
      equityItems[surplusItemIdx] = surplusItem;
    } else {
      equityItems.push(surplusItem);
    }
  }

  const totalCurrentAssets = currentAssetItems.reduce((sum, item) => sum + item.amount, 0);
  const totalNonCurrentAssets = nonCurrentAssetItems.reduce((sum, item) => sum + item.amount, 0);
  const totalCurrentLiabilities = currentLiabilityItems.reduce((sum, item) => sum + item.amount, 0);
  const totalNonCurrentLiabilities = nonCurrentLiabilityItems.reduce((sum, item) => sum + item.amount, 0);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
  const totalEquity = equityItems.reduce((sum, item) => sum + item.amount, 0);
  const difference = totalAssets - (totalLiabilities + totalEquity);
  const balanced = Math.abs(difference) < 0.01;
  const shareCapitalAmount =
    equityItems.find((item) => item.label === "Share Capital")?.amount || 0;
  const retainedEarningsAmount =
    equityItems.find((item) => item.label === "Retained Earnings")?.amount || 0;
  const loanInsuranceLiabilityAmount =
    currentLiabilityItems.find((item) => item.label === "Loan Insurance and Related Liabilities")?.amount || 0;
  const workingCapital = totalCurrentAssets - totalCurrentLiabilities;
  const currentRatio = totalCurrentLiabilities === 0 ? null : totalCurrentAssets / totalCurrentLiabilities;
  const debtRatio = totalAssets === 0 ? null : totalLiabilities / totalAssets;
  const equityRatio = totalAssets === 0 ? null : totalEquity / totalAssets;

  const structuredStatement = {
    assets: {
      current: {
        items: currentAssetItems,
        total: totalCurrentAssets,
      },
      nonCurrent: {
        items: nonCurrentAssetItems,
        total: totalNonCurrentAssets,
      },
      total: totalAssets,
    },
    liabilities: {
      current: {
        items: currentLiabilityItems,
        total: totalCurrentLiabilities,
      },
      nonCurrent: {
        items: nonCurrentLiabilityItems,
        total: totalNonCurrentLiabilities,
      },
      total: totalLiabilities,
    },
    equity: {
      items: equityItems,
      total: totalEquity,
    },
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    difference,
    balanced,
    surplusDeficitForPeriod: netProfitForPeriod,
  };

  const filteredStatement = {
    assets: {
      current: {
        items:
          sectionFilter === "liabilities" || sectionFilter === "equity" || subSectionFilter === "non-current-assets"
            ? []
            : structuredStatement.assets.current.items,
        total:
          sectionFilter === "liabilities" || sectionFilter === "equity" || subSectionFilter === "non-current-assets"
            ? 0
            : structuredStatement.assets.current.total,
      },
      nonCurrent: {
        items:
          sectionFilter === "liabilities" || sectionFilter === "equity" || subSectionFilter === "current-assets"
            ? []
            : structuredStatement.assets.nonCurrent.items,
        total:
          sectionFilter === "liabilities" || sectionFilter === "equity" || subSectionFilter === "current-assets"
            ? 0
            : structuredStatement.assets.nonCurrent.total,
      },
      total: 0,
    },
    liabilities: {
      current: {
        items:
          sectionFilter === "assets" || sectionFilter === "equity" || subSectionFilter === "long-term-liabilities"
            ? []
            : structuredStatement.liabilities.current.items,
        total:
          sectionFilter === "assets" || sectionFilter === "equity" || subSectionFilter === "long-term-liabilities"
            ? 0
            : structuredStatement.liabilities.current.total,
      },
      nonCurrent: {
        items:
          sectionFilter === "assets" || sectionFilter === "equity" || subSectionFilter === "current-liabilities"
            ? []
            : structuredStatement.liabilities.nonCurrent.items,
        total:
          sectionFilter === "assets" || sectionFilter === "equity" || subSectionFilter === "current-liabilities"
            ? 0
            : structuredStatement.liabilities.nonCurrent.total,
      },
      total: 0,
    },
    equity: {
      items:
        sectionFilter === "assets" || sectionFilter === "liabilities" || !["all", "equity"].includes(subSectionFilter)
          ? []
          : structuredStatement.equity.items,
      total:
        sectionFilter === "assets" || sectionFilter === "liabilities" || !["all", "equity"].includes(subSectionFilter)
          ? 0
          : structuredStatement.equity.total,
    },
    totalLiabilitiesAndEquity: 0,
    difference,
    balanced,
  };

  filteredStatement.assets.total =
    filteredStatement.assets.current.total + filteredStatement.assets.nonCurrent.total;
  filteredStatement.liabilities.total =
    filteredStatement.liabilities.current.total + filteredStatement.liabilities.nonCurrent.total;
  filteredStatement.totalLiabilitiesAndEquity =
    filteredStatement.liabilities.total + filteredStatement.equity.total;

  const flattenedData = [
    ...assetsAccounts.map((account) => ({ ...account, type: "Asset" })),
    ...liabilitiesAccounts.map((account) => ({ ...account, type: "Liability" })),
    ...equityAccounts.map((account) => ({ ...account, type: "Equity" })),
  ];

  return {
    reportType: "Balance Sheet",
    asOfDate: asOf,
    assets: {
      accounts: assetsAccounts.map((account) => ({
        code: account.accountCode,
        name: account.accountName,
        parentCategory: account.category,
        balance: account.balance,
      })),
      total: totalAssets,
    },
    liabilities: {
      accounts: liabilitiesAccounts.map((account) => ({
        code: account.accountCode,
        name: account.accountName,
        parentCategory: account.category,
        balance: account.balance,
      })),
      total: totalLiabilities,
    },
    equity: {
      accounts: equityAccounts.map((account) => ({
        code: account.accountCode,
        name: account.accountName,
        parentCategory: account.category,
        balance: account.balance,
      })),
      total: totalEquity,
    },
    totalLiabilitiesAndEquity: filteredStatement.totalLiabilitiesAndEquity,
    difference,
    balanced,
    statement: filteredStatement,
    analytics: {
      workingCapital,
      currentRatio,
      debtRatio,
      equityRatio,
      shareCapital: shareCapitalAmount,
      retainedEarnings: retainedEarningsAmount,
      loanInsuranceLiability: loanInsuranceLiabilityAmount,
      accountsShown: visibleAccounts.length,
      branchApplied: branchFilter.branchId || "all",
      sectionApplied: sectionFilter,
      subSectionApplied: subSectionFilter,
      searchApplied: filters.search || "",
      includeZeroBalances,
    },
    operationalData: null,
    generatedAt: new Date(),
    data: flattenedData,
    summary: {
      totalAssets: filteredStatement.assets.total,
      totalLiabilities: filteredStatement.liabilities.total,
      totalEquity: filteredStatement.equity.total,
      totalLiabilitiesAndEquity: filteredStatement.totalLiabilitiesAndEquity,
      difference: filteredStatement.assets.total - filteredStatement.totalLiabilitiesAndEquity,
      balanced: Math.abs(filteredStatement.assets.total - filteredStatement.totalLiabilitiesAndEquity) < 0.01,
    },
  };
}

// ============================================================================
// 3. TRIAL BALANCE
// ============================================================================
export type TBEntry = {
  accountCode: string;
  accountName: string;
  ledgerType: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
};

export async function getTrialBalanceService(
  startDate: Date,
  endDate: Date,
  branchId: string | undefined,
  user: any,
) {
  const branchFilter = await getBranchFilterForService(user, branchId);

  // All active GL accounts ordered by code
  const accounts = await db.chartOfAccount.findMany({
    where: { isActive: true },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      ledgerType: true,
      debitBalance: true,
      creditBalance: true,
    },
    orderBy: { accountCode: "asc" },
  }).catch(() => [] as any[]);

  const accountIds = accounts.map((a: any) => a.id);

  // Branch filter: include both transaction-linked and standalone GL entries
  const txFilter = branchFilter.branchId
    ? {
        OR: [
          { transaction: { branchId: branchFilter.branchId } },
          { transactionId: null as string | null, branchId: branchFilter.branchId },
        ],
      }
    : {};

  // Two aggregate queries: opening (before period) and period movements
  const [openingResult, periodResult] = await Promise.allSettled([
    accountIds.length > 0
      ? db.journalEntry.groupBy({
          by: ["accountId"],
          where: {
            accountId: { in: accountIds },
            entryDate: { lt: startDate },
            ...txFilter,
          },
          _sum: { debitAmount: true, creditAmount: true },
        })
      : Promise.resolve([] as any[]),
    accountIds.length > 0
      ? db.journalEntry.groupBy({
          by: ["accountId"],
          where: {
            accountId: { in: accountIds },
            entryDate: { gte: startDate, lte: endDate },
            ...txFilter,
          },
          _sum: { debitAmount: true, creditAmount: true },
        })
      : Promise.resolve([] as any[]),
  ]);

  const openingMap = new Map<string, { debit: number; credit: number }>();
  if (openingResult.status === "fulfilled") {
    for (const row of openingResult.value as any[]) {
      openingMap.set(row.accountId, {
        debit: row._sum.debitAmount ?? 0,
        credit: row._sum.creditAmount ?? 0,
      });
    }
  }

  const periodMap = new Map<string, { debit: number; credit: number }>();
  if (periodResult.status === "fulfilled") {
    for (const row of periodResult.value as any[]) {
      periodMap.set(row.accountId, {
        debit: row._sum.debitAmount ?? 0,
        credit: row._sum.creditAmount ?? 0,
      });
    }
  }

  // When no journal entries exist at all, fall back to stored cumulative balances
  const hasJournalData = openingMap.size > 0 || periodMap.size > 0;

  const entries: TBEntry[] = [];

  for (const account of accounts as any[]) {
    let openDr: number, openCr: number, periodDr: number, periodCr: number;

    if (hasJournalData) {
      const op = openingMap.get(account.id) ?? { debit: 0, credit: 0 };
      const pr = periodMap.get(account.id) ?? { debit: 0, credit: 0 };
      openDr = op.debit;
      openCr = op.credit;
      periodDr = pr.debit;
      periodCr = pr.credit;
    } else {
      // Fallback: treat stored balance as opening, no period movements
      openDr = account.debitBalance ?? 0;
      openCr = account.creditBalance ?? 0;
      periodDr = 0;
      periodCr = 0;
    }

    const totalDr = openDr + periodDr;
    const totalCr = openCr + periodCr;
    if (totalDr === 0 && totalCr === 0) continue;

    // Net closing balance, placed on normal balance side
    const isDebitNormal = account.ledgerType === "ASSETS" || account.ledgerType === "EXPENDITURES";
    const net = isDebitNormal ? totalDr - totalCr : totalCr - totalDr;
    const closingDebit = isDebitNormal ? Math.max(net, 0) : net < 0 ? Math.abs(net) : 0;
    const closingCredit = !isDebitNormal ? Math.max(net, 0) : net < 0 ? Math.abs(net) : 0;

    entries.push({
      accountCode: account.accountCode,
      accountName: account.accountName,
      ledgerType: account.ledgerType,
      openingDebit: openDr,
      openingCredit: openCr,
      periodDebit: periodDr,
      periodCredit: periodCr,
      closingDebit,
      closingCredit,
    });
  }

  // Group by ledger type in standard order
  const LEDGER_ORDER = ["ASSETS", "LIABILITIES", "EQUITY", "INCOME", "EXPENDITURES"] as const;
  const groups: Record<string, TBEntry[]> = {};
  for (const lt of LEDGER_ORDER) {
    groups[lt] = entries.filter((e) => e.ledgerType === lt);
  }

  const totalDebit = entries.reduce((s, e) => s + e.closingDebit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.closingCredit, 0);
  const difference = Math.abs(totalDebit - totalCredit);

  return {
    reportType: "Trial Balance",
    period: { startDate, endDate },
    groups,
    entries,
    totals: {
      debit: totalDebit,
      credit: totalCredit,
      // legacy keys for any existing consumers
      debits: totalDebit,
      credits: totalCredit,
      difference,
      balanced: difference < 0.01,
    },
    generatedAt: new Date(),
  };
}

// ============================================================================
// 6. CHART OF ACCOUNTS
// ============================================================================
export async function getChartOfAccountsService(branchId: string | undefined, user: any) {
  const branchFilter = await getBranchFilterForService(user, branchId);

  const [categories, incomeRecords, expenditureRecords] = await Promise.all([
    db.budgetCategory.findMany({
      where: { isActive: true },
      include: {
        parent: true,
        children: true,
      },
      orderBy: [{ kind: "asc" }, { parentId: "asc" }, { name: "asc" }],
    }),
    db.incomeRecord.findMany({
      where: { 
        status: TransactionStatus.COMPLETED,
        ...branchFilter 
      }
    }),
    db.expenditureRecord.findMany({
      where: { 
        status: TransactionStatus.COMPLETED,
        ...branchFilter 
      }
    })
  ]);

  const categoryBalances = new Map<string, number>();
  incomeRecords.forEach((record: any) => {
    const catId = record.budgetCategoryId;
    if (catId) categoryBalances.set(catId, (categoryBalances.get(catId) || 0) + record.amount);
  });
  expenditureRecords.forEach((record: any) => {
    const catId = record.budgetCategoryId;
    if (catId) categoryBalances.set(catId, (categoryBalances.get(catId) || 0) + record.amount);
  });

  const chartOfAccounts = {
    assets: [] as any[],
    liabilities: [] as any[],
    equity: [] as any[],
    income: [] as any[],
    expenses: [] as any[],
  };

  const mapCategory = (cat: any) => ({
    code: cat.code || `${cat.kind.substring(0, 3).toUpperCase()}-${cat.id.substring(0, 8)}`,
    name: cat.name,
    description: cat.description,
    parentId: cat.parentId,
    hasChildren: cat.children.length > 0,
    balance: categoryBalances.get(cat.id) || 0,
  });

  categories.forEach((cat: any) => {
    const mapped = mapCategory(cat);
    switch (cat.kind) {
      case CategoryKind.ASSET: chartOfAccounts.assets.push(mapped); break;
      case CategoryKind.LIABILITY: chartOfAccounts.liabilities.push(mapped); break;
      case CategoryKind.EQUITY: chartOfAccounts.equity.push(mapped); break;
      case CategoryKind.INCOME: chartOfAccounts.income.push(mapped); break;
      case CategoryKind.EXPENSE: chartOfAccounts.expenses.push(mapped); break;
    }
  });

  return {
    reportType: "Chart of Accounts",
    chartOfAccounts,
    summary: {
      totalIncomeAccounts: chartOfAccounts.income.length,
      totalExpenseAccounts: chartOfAccounts.expenses.length,
      totalAssetAccounts: chartOfAccounts.assets.length,
      totalLiabilityAccounts: chartOfAccounts.liabilities.length,
      totalEquityAccounts: chartOfAccounts.equity.length,
    },
    generatedAt: new Date(),
  };
}
