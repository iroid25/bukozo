import { db } from "@/prisma/db";
import { UserRole, TransactionStatus, CategoryKind, TransactionType } from "@prisma/client";
import { getDirectBalanceSheetAccounts, getDirectTrialBalanceAccounts } from "@/lib/reports/direct-source";

const CASH_AT_HAND_CODE = "101100";

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

  const syntheticLoanFeeTotal = syntheticLoanFeeRecords.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
  const totalIncome = incomeRecords.reduce((sum: number, r: any) => sum + r.amount, 0) + syntheticLoanFeeTotal;
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

function resolveAssetSection(account: BalanceSheetMappedAccount) {
  const name = normalizeName(account.accountName);
  const code = account.accountCode;

  if (code === CASH_AT_HAND_CODE) {
    return {
      section: "current" as const,
      lineItem: "Cash and Cash Equivalents",
    };
  }

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
    name.includes("bank") ||
    name.includes("float")
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

  // ── Direct source: read from real tables instead of COA + JournalEntry ──
  const directAccounts = await getDirectBalanceSheetAccounts(asOf, branchFilter.branchId || undefined);

  const mappedAccounts = directAccounts.map((account) => ({
    accountId: account.id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    balance: account.balance,
    debit: account.debit,
    credit: account.credit,
    ledgerType: account.ledgerType,
    category: account.category || account.ledgerType,
    fullCode: account.fullCode || account.accountCode,
    level: account.level || 1,
  }));

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
  const currentLiabilityItems = makeStructuredItems(
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

  // Inject Surplus / (Deficit) for the Period into equity
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
  const [incomeAgg, expenditureAgg, insuranceAgg] = await Promise.all([
    db.incomeRecord.aggregate({
      where: {
        recordDate: { gte: yearStart, lte: yearEnd },
        status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {}),
      },
      _sum: { amount: true },
    }),
    db.expenditureRecord.aggregate({
      where: {
        recordDate: { gte: yearStart, lte: yearEnd },
        status: TransactionStatus.COMPLETED,
        ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {}),
      },
      _sum: { amount: true },
    }),
    db.insuranceContribution.aggregate({
      where: {
        type: "CONTRIBUTION",
        createdAt: { gte: yearStart, lte: yearEnd },
        ...(branchFilter.branchId ? { account: { branchId: branchFilter.branchId } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);
  const totalIncome = (incomeAgg._sum?.amount || 0) + (insuranceAgg._sum?.amount || 0);
  const netProfitForPeriod = totalIncome - (expenditureAgg._sum?.amount || 0);
  if (Math.abs(netProfitForPeriod) > 0.009) {
    const surplusLabel = netProfitForPeriod >= 0 ? "Surplus for the Period" : "Deficit for the Period";
    equityItems.push({
      label: surplusLabel,
      amount: netProfitForPeriod,
      accounts: [{ code: "", name: surplusLabel, balance: netProfitForPeriod }],
    });
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

  // Direct source: query real tables at two dates to derive opening/closing
  const openingDate = new Date(startDate);
  openingDate.setDate(openingDate.getDate() - 1);
  openingDate.setHours(23, 59, 59, 999);

  const [openingAccounts, closingAccounts] = await Promise.all([
    getDirectTrialBalanceAccounts(openingDate, branchFilter.branchId || undefined),
    getDirectTrialBalanceAccounts(endDate, branchFilter.branchId || undefined),
  ]);

  // Index closing accounts by code for quick lookup
  const closingByCode = new Map(closingAccounts.map((a) => [a.accountCode, a]));

  const entries: TBEntry[] = [];

  for (const opening of openingAccounts) {
    const closing = closingByCode.get(opening.accountCode);
    if (!closing) continue;

    const isDebitNormal = opening.ledgerType === "ASSETS" || opening.ledgerType === "EXPENDITURES";

    // Opening balances: debit/credit sides
    const openDr = isDebitNormal ? Math.max(opening.balance, 0) : opening.balance < 0 ? Math.abs(opening.balance) : 0;
    const openCr = !isDebitNormal ? Math.max(opening.balance, 0) : opening.balance < 0 ? Math.abs(opening.balance) : 0;

    // Closing balances: debit/credit sides
    const closeDr = isDebitNormal ? Math.max(closing.balance, 0) : closing.balance < 0 ? Math.abs(closing.balance) : 0;
    const closeCr = !isDebitNormal ? Math.max(closing.balance, 0) : closing.balance < 0 ? Math.abs(closing.balance) : 0;

    // Period movements = closing - opening
    const periodDr = Math.max(closeDr - openDr, 0);
    const periodCr = Math.max(closeCr - openCr, 0);

    if (closeDr === 0 && closeCr === 0) continue;

    entries.push({
      accountCode: opening.accountCode,
      accountName: opening.accountName,
      ledgerType: opening.ledgerType,
      openingDebit: openDr,
      openingCredit: openCr,
      periodDebit: periodDr,
      periodCredit: periodCr,
      closingDebit: closeDr,
      closingCredit: closeCr,
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
