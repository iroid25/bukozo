import { db } from "@/prisma/db";
import { TransactionStatus } from "@prisma/client";

// ============================================================================
// VIRTUAL ACCOUNT — replaces ChartOfAccount rows for report reading
// ============================================================================

export interface DirectAccount {
  id: string;
  accountCode: string;
  accountName: string;
  ledgerType: string;
  parentId: string | null;
  isGroup: boolean;
  balance: number;
  debit: number;
  credit: number;
  fullCode?: string;
  level?: number;
  category?: string;
}

// ── Canonical codes (must match lib/services/*-structure.ts) ──
const ASSET_ROOT = "100000";
const FIXED_ASSETS_PARENT = "101000";
const CURRENT_ASSETS_PARENT = "102000";
const CASH_AT_HAND = "101100";
const CASH_EQUIVALENTS = "102001";
const CASH_AT_BANK = "102002";
const MOBILE_MONEY_FLOAT = "102004";
const LOAN_PORTFOLIO = "107000";

const LIABILITY_ROOT = "200000";
const CURRENT_LIABILITIES = "201000";
const NON_CURRENT_LIABILITIES = "202000";
const LOAN_INSURANCE_CODE = "200600";
const DIVIDENDS_PAYABLE_CODE = "201005";
const ACCUM_DEPR_NONCURRENT = "202002";
const EXTERNAL_LOAN_CODE = "202003";
const FOUNDERS_ACCOUNT_CODE = "202004";

const EQUITY_ROOT = "300000";
const STATUTORY_RESERVES = "301000";
const GRANTS_DONATIONS = "302000";
const RETAINED_EARNINGS = "303000";
const SHARE_CAPITAL = "304000";

const INCOME_ROOT = "400000";
const EXPENSE_ROOT = "500000";

function vid(code: string) { return `__ds__${code}`; }

function group(code: string, name: string, ledgerType: string, parentId: string | null, level: number): DirectAccount {
  return { id: vid(code), accountCode: code, accountName: name, ledgerType, parentId, isGroup: true, balance: 0, debit: 0, credit: 0, fullCode: code, level, category: ledgerType };
}

function leaf(code: string, name: string, ledgerType: string, parentId: string, balance: number, level: number): DirectAccount {
  const isDebit = ledgerType === "ASSETS" || ledgerType === "EXPENDITURES";
  return {
    id: vid(code),
    accountCode: code,
    accountName: name,
    ledgerType,
    parentId,
    isGroup: false,
    balance,
    debit: isDebit ? Math.max(balance, 0) : 0,
    credit: isDebit ? 0 : Math.max(balance, 0),
    fullCode: code,
    level,
    category: ledgerType,
  };
}

// ============================================================================
// BRANCH FILTER HELPER
// ============================================================================

function bf(branchId?: string | null) {
  return branchId ? { branchId } : {};
}

function accountBf(branchId?: string | null) {
  return branchId ? { branch: { branchId } } : {};
}

// ============================================================================
// 1. BALANCE SHEET — ASSETS
// ============================================================================

async function getDirectAssets(asOfDate: Date, branchId?: string): Promise<DirectAccount[]> {
  const dateFilter = { lte: asOfDate };

  const [fixedAssets, loanAgg, vaultAgg, floatAgg] = await Promise.all([
    db.fixedAsset.findMany({
      where: { status: "ACTIVE", purchaseDate: dateFilter, ...bf(branchId) },
      select: { category: true, currentValue: true, accumulatedDepreciation: true },
    }),
    db.loan.aggregate({
      where: { status: { in: ["DISBURSED", "OVERDUE"] }, disbursementDate: dateFilter, ...bf(branchId) },
      _sum: { outstandingBalance: true },
    }),
    db.vault.aggregate({
      where: { isActive: true, ...bf(branchId) },
      _sum: { balance: true },
    }),
    db.userFloat.aggregate({
      _sum: { balance: true },
    }),
  ]);

  const cashAtHand = Number(vaultAgg._sum.balance || 0) + Number(floatAgg._sum.balance || 0);

  const loanPortfolio = Number(loanAgg._sum.outstandingBalance || 0);

  const fixedAssetByCategory = new Map<string, number>();
  let totalAccumDepr = 0;
  for (const asset of fixedAssets) {
    const cat = (asset.category || "").toLowerCase();
    let code = "101003";
    if (cat.includes("land")) code = "101001";
    else if (cat.includes("motor") || cat.includes("vehicle")) code = "101002";
    fixedAssetByCategory.set(code, (fixedAssetByCategory.get(code) || 0) + Number(asset.currentValue || 0));
    totalAccumDepr += Number(asset.accumulatedDepreciation || 0);
  }

  const assets: DirectAccount[] = [
    group(ASSET_ROOT, "Assets", "ASSETS", null, 1),
    group(FIXED_ASSETS_PARENT, "Fixed Assets", "ASSETS", vid(ASSET_ROOT), 2),
    leaf("101001", "Land", "ASSETS", vid(FIXED_ASSETS_PARENT), fixedAssetByCategory.get("101001") || 0, 3),
    leaf("101002", "Motor Vehicle", "ASSETS", vid(FIXED_ASSETS_PARENT), fixedAssetByCategory.get("101002") || 0, 3),
    leaf("101003", "Furniture and Fittings", "ASSETS", vid(FIXED_ASSETS_PARENT), fixedAssetByCategory.get("101003") || 0, 3),
    group(CURRENT_ASSETS_PARENT, "Current Assets", "ASSETS", vid(ASSET_ROOT), 2),
    leaf(CASH_AT_HAND, "Cash at Hand", "ASSETS", vid(CURRENT_ASSETS_PARENT), cashAtHand, 3),
    leaf(CASH_EQUIVALENTS, "Cash Equivalents", "ASSETS", vid(CURRENT_ASSETS_PARENT), 0, 3),
    leaf(CASH_AT_BANK, "Cash at Bank", "ASSETS", vid(CURRENT_ASSETS_PARENT), 0, 3),
    leaf(MOBILE_MONEY_FLOAT, "Mobile Money Float", "ASSETS", vid(CURRENT_ASSETS_PARENT), 0, 3),
    leaf(LOAN_PORTFOLIO, "Loans and Receivables", "ASSETS", vid(ASSET_ROOT), loanPortfolio, 2),
    leaf("200700", "Accumulated Depreciation", "ASSETS", vid(ASSET_ROOT), -totalAccumDepr, 2),
  ];

  return assets;
}

// ============================================================================
// 2. BALANCE SHEET — LIABILITIES
// ============================================================================

async function getDirectLiabilities(asOfDate: Date, branchId?: string): Promise<DirectAccount[]> {
  const [savingsAgg, insuranceAgg, savingsTypes, fixedDepositAgg] = await Promise.all([
    db.account.groupBy({
      by: ["accountTypeId"],
      where: {
        status: { not: "CLOSED" },
        openedAt: { lte: asOfDate },
        accountType: { isShareAccount: false, hasFixedPeriod: false },
        ...bf(branchId),
      },
      _sum: { balance: true },
    }),
    db.insuranceContribution.aggregate({
      where: {
        type: "CONTRIBUTION",
        createdAt: { lte: asOfDate },
        ...accountBf(branchId),
      },
      _sum: { amount: true },
    }),
    db.accountType.findMany({
      where: { isShareAccount: false, hasFixedPeriod: false },
      select: { id: true, name: true },
    }),
    db.fixedDeposit.aggregate({
      where: {
        status: { in: ["ACTIVE", "MATURED"] },
        startDate: { lte: asOfDate },
        ...bf(branchId),
      },
      _sum: { principalAmount: true },
    }),
  ]);

  const typeMap = new Map(savingsTypes.map((t) => [t.id, t.name]));
  const savingsByType = new Map(savingsAgg.map((r) => [r.accountTypeId, Number(r._sum.balance || 0)]));

  const totalSavings = savingsAgg.reduce((sum, r) => sum + Number(r._sum.balance || 0), 0);
  const totalFixedDeposits = Number(fixedDepositAgg._sum.principalAmount || 0);
  const totalInsurance = Number(insuranceAgg._sum.amount || 0);

  const liabs: DirectAccount[] = [
    group(LIABILITY_ROOT, "Liabilities", "LIABILITIES", null, 1),
    group(CURRENT_LIABILITIES, "Current Liabilities", "LIABILITIES", vid(LIABILITY_ROOT), 2),
  ];

  for (const [typeId, balance] of savingsByType) {
    const name = typeMap.get(typeId) || "Savings";
    const code = `201${liabs.length.toString().padStart(3, "0")}`;
    liabs.push(leaf(code, name, "LIABILITIES", vid(CURRENT_LIABILITIES), balance, 3));
  }

  if (totalSavings === 0 && savingsByType.size === 0) {
    liabs.push(leaf("201100", "Member Savings", "LIABILITIES", vid(CURRENT_LIABILITIES), 0, 3));
  }

  liabs.push(leaf(LOAN_INSURANCE_CODE, "Loan Insurance", "LIABILITIES", vid(CURRENT_LIABILITIES), totalInsurance, 3));
  liabs.push(leaf(DIVIDENDS_PAYABLE_CODE, "Dividends Payable", "LIABILITIES", vid(CURRENT_LIABILITIES), 0, 3));
  if (totalFixedDeposits > 0) {
    liabs.push(leaf("201300", "Fixed Deposits", "LIABILITIES", vid(CURRENT_LIABILITIES), totalFixedDeposits, 3));
  }

  liabs.push(group(NON_CURRENT_LIABILITIES, "Non-Current Liabilities", "LIABILITIES", vid(LIABILITY_ROOT), 2));
  liabs.push(leaf(ACCUM_DEPR_NONCURRENT, "Accumulated Depreciation", "LIABILITIES", vid(NON_CURRENT_LIABILITIES), 0, 3));
  liabs.push(leaf(EXTERNAL_LOAN_CODE, "External Loan", "LIABILITIES", vid(NON_CURRENT_LIABILITIES), 0, 3));
  liabs.push(leaf(FOUNDERS_ACCOUNT_CODE, "Founders Account", "LIABILITIES", vid(NON_CURRENT_LIABILITIES), 0, 3));

  return liabs;
}

// ============================================================================
// 3. BALANCE SHEET — EQUITY
// ============================================================================

async function getDirectEquity(asOfDate: Date, branchId?: string): Promise<DirectAccount[]> {
  const [reserveAgg, grantAgg, shareAgg] = await Promise.all([
    db.equityManualEntry.aggregate({
      where: { type: "STATUTORY_RESERVE", date: { lte: asOfDate }, ...bf(branchId) },
      _sum: { amount: true },
    }),
    db.equityManualEntry.aggregate({
      where: { type: "GRANT_DONATION", date: { lte: asOfDate }, ...bf(branchId) },
      _sum: { amount: true },
    }),
    db.shareAccount.aggregate({
      where: {
        status: { in: ["ACTIVE", "DORMANT", "ON_HOLD", "FROZEN"] },
        openedDate: { lte: asOfDate },
        ...bf(branchId),
      },
      _sum: { totalValue: true },
    }),
  ]);

  const { getRetainedEarnings } = await import("@/lib/accounting/getRetainedEarnings");
  const re = await getRetainedEarnings();

  const reserves = Number(reserveAgg._sum?.amount || 0);
  const grants = Number(grantAgg._sum?.amount || 0);
  const shares = Number(shareAgg._sum?.totalValue || 0);

  return [
    group(EQUITY_ROOT, "Equity", "EQUITY", null, 1),
    leaf(STATUTORY_RESERVES, "Statutory Reserves", "EQUITY", vid(EQUITY_ROOT), reserves, 2),
    leaf(GRANTS_DONATIONS, "Grants and Donations", "EQUITY", vid(EQUITY_ROOT), grants, 2),
    leaf(RETAINED_EARNINGS, "Retained Earnings", "EQUITY", vid(EQUITY_ROOT), re.retainedEarnings, 2),
    leaf(SHARE_CAPITAL, "Share Capital", "EQUITY", vid(EQUITY_ROOT), shares, 2),
  ];
}

// ============================================================================
// 4. INCOME ACCOUNTS
// ============================================================================

async function getDirectIncome(startDate: Date, endDate: Date, branchId?: string): Promise<DirectAccount[]> {
  const categories = await db.budgetCategory.findMany({
    where: { kind: "INCOME", isActive: true },
    select: { id: true, name: true, code: true },
  });

  const [records, insuranceAgg] = await Promise.all([
    db.incomeRecord.groupBy({
      by: ["budgetCategoryId"],
      where: {
        recordDate: { gte: startDate, lte: endDate },
        status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        ...bf(branchId),
      },
      _sum: { amount: true },
    }),
    db.insuranceContribution.aggregate({
      where: {
        type: "CONTRIBUTION",
        createdAt: { gte: startDate, lte: endDate },
        ...(branchId ? { account: { branchId } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const amtMap = new Map(records.map((r) => [r.budgetCategoryId, Number(r._sum.amount || 0)]));

  const insuranceAmount = Number(insuranceAgg._sum?.amount || 0);
  const insuranceCat = categories.find((c) => c.code?.startsWith("401960"));

  const accounts: DirectAccount[] = [group(INCOME_ROOT, "Income", "INCOME", null, 1)];

  for (const cat of categories) {
    let amount = amtMap.get(cat.id) || 0;
    if (insuranceCat && cat.id === insuranceCat.id) {
      amount = insuranceAmount;
    }
    accounts.push(leaf(cat.code || `4${categories.indexOf(cat).toString().padStart(4, "0")}`, cat.name, "INCOME", vid(INCOME_ROOT), amount, 2));
  }

  if (!insuranceCat && insuranceAmount > 0) {
    accounts.push(leaf("401960", "INSURANCE CONTRIBUTION", "INCOME", vid(INCOME_ROOT), insuranceAmount, 2));
  }

  return accounts;
}

// ============================================================================
// 5. EXPENDITURE ACCOUNTS
// ============================================================================

async function getDirectExpenditure(startDate: Date, endDate: Date, branchId?: string): Promise<DirectAccount[]> {
  const categories = await db.budgetCategory.findMany({
    where: { kind: "EXPENSE", isActive: true },
    select: { id: true, name: true, code: true },
  });

  const records = await db.expenditureRecord.groupBy({
    by: ["budgetCategoryId"],
    where: {
      recordDate: { gte: startDate, lte: endDate },
      status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
      ...bf(branchId),
    },
    _sum: { amount: true },
  });

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const amtMap = new Map(records.map((r) => [r.budgetCategoryId, Number(r._sum.amount || 0)]));

  const accounts: DirectAccount[] = [group(EXPENSE_ROOT, "Expenses", "EXPENDITURES", null, 1)];

  for (const cat of categories) {
    const amount = amtMap.get(cat.id) || 0;
    accounts.push(leaf(cat.code || `5${categories.indexOf(cat).toString().padStart(4, "0")}`, cat.name, "EXPENDITURES", vid(EXPENSE_ROOT), amount, 2));
  }

  return accounts;
}

// ============================================================================
// PUBLIC API — BALANCE SHEET
// ============================================================================

export async function getDirectBalanceSheetAccounts(
  asOfDate: Date,
  branchId?: string,
): Promise<DirectAccount[]> {
  const [assets, liabilities, equity] = await Promise.all([
    getDirectAssets(asOfDate, branchId),
    getDirectLiabilities(asOfDate, branchId),
    getDirectEquity(asOfDate, branchId),
  ]);
  return [...assets, ...liabilities, ...equity];
}

// ============================================================================
// PUBLIC API — PROFIT & LOSS
// ============================================================================

export async function getDirectIncomeExpenseAccounts(
  startDate: Date,
  endDate: Date,
  branchId?: string,
): Promise<DirectAccount[]> {
  const [income, expenditure] = await Promise.all([
    getDirectIncome(startDate, endDate, branchId),
    getDirectExpenditure(startDate, endDate, branchId),
  ]);
  return [...income, ...expenditure];
}

// ============================================================================
// PUBLIC API — TRIAL BALANCE (all 5 ledger types)
// ============================================================================

export async function getDirectTrialBalanceAccounts(
  startDate: Date,
  endDate: Date,
  branchId?: string,
): Promise<DirectAccount[]> {
  const asOfEnd = new Date(endDate);
  asOfEnd.setHours(23, 59, 59, 999);

  const [assets, liabilities, equity, income, expenditure] = await Promise.all([
    getDirectAssets(asOfEnd, branchId),
    getDirectLiabilities(asOfEnd, branchId),
    getDirectEquity(asOfEnd, branchId),
    getDirectIncome(startDate, endDate, branchId),
    getDirectExpenditure(startDate, endDate, branchId),
  ]);

  return [...assets, ...liabilities, ...equity, ...income, ...expenditure];
}

// ============================================================================
// PUBLIC API — ALL ACCOUNTS (replaces COA findMany for listing)
// ============================================================================

export async function getAllDirectAccounts(
  startDate: Date,
  endDate: Date,
  branchId?: string,
): Promise<DirectAccount[]> {
  return getDirectTrialBalanceAccounts(startDate, endDate, branchId);
}

// ============================================================================
// PUBLIC API — ACCOUNTS BY CATEGORY (replaces COA findMany for GL perf)
// ============================================================================

export async function getDirectAccountsByCategory(
  ledgerType: string,
  startDate: Date,
  endDate: Date,
  branchId?: string,
): Promise<DirectAccount[]> {
  const all = await getDirectTrialBalanceAccounts(startDate, endDate, branchId);
  return all.filter((a) => a.ledgerType === ledgerType);
}

// ============================================================================
// PUBLIC API — FY BALANCE SHEET (period + ytd balances)
// ============================================================================

export interface DirectPeriodBalances {
  period: Map<string, { debit: number; credit: number }>;
  ytd: Map<string, { debit: number; credit: number }>;
}

export async function getDirectFYBalances(
  fyStart: Date,
  toDate: Date,
  branchId?: string,
): Promise<DirectPeriodBalances> {
  const accounts = await getDirectBalanceSheetAccounts(toDate, branchId);

  const period = new Map<string, { debit: number; credit: number }>();
  const ytd = new Map<string, { debit: number; credit: number }>();

  for (const account of accounts) {
    const isDebit = account.ledgerType === "ASSETS" || account.ledgerType === "EXPENDITURES";
    const bal = account.balance;
    const entry = isDebit
      ? { debit: Math.max(bal, 0), credit: Math.max(-bal, 0) }
      : { debit: Math.max(-bal, 0), credit: Math.max(bal, 0) };
    ytd.set(account.id, entry);
    period.set(account.id, { debit: 0, credit: 0 });
  }

  return { period, ytd };
}

// ============================================================================
// PUBLIC API — OPERATIONAL BALANCES (extended from financial-reports.ts)
// ============================================================================

export async function getDirectOperationalBalances(
  asOfDate: Date,
  branchFilter: { branchId?: string },
) {
  const bf_ = branchFilter.branchId;

  const settled = await Promise.allSettled([
    db.vault.aggregate({
      where: { isActive: true, ...(bf_ ? { branchId: bf_ } : {}) },
      _sum: { balance: true },
    }),
    db.loan.aggregate({
      where: {
        status: { in: ["DISBURSED", "OVERDUE"] },
        disbursementDate: { lte: asOfDate },
        ...(bf_ ? { branchId: bf_ } : {}),
      },
      _sum: { outstandingBalance: true },
    }),
    db.account.aggregate({
      where: {
        status: { not: "CLOSED" },
        openedAt: { lte: asOfDate },
        accountType: { isShareAccount: false, hasFixedPeriod: false },
        ...(bf_ ? { branchId: bf_ } : {}),
      },
      _sum: { balance: true },
    }),
    db.shareAccount.aggregate({
      where: {
        status: { in: ["ACTIVE", "DORMANT", "ON_HOLD", "FROZEN"] },
        openedDate: { lte: asOfDate },
        ...(bf_ ? { branchId: bf_ } : {}),
      },
      _sum: { totalValue: true },
    }),
    db.fixedDeposit.aggregate({
      where: {
        status: { in: ["ACTIVE", "MATURED"] },
        startDate: { lte: asOfDate },
        ...(bf_ ? { branchId: bf_ } : {}),
      },
      _sum: { principalAmount: true },
    }),
    db.fixedAsset.aggregate({
      where: {
        status: "ACTIVE",
        purchaseDate: { lte: asOfDate },
        ...(bf_ ? { branchId: bf_ } : {}),
      },
      _sum: { currentValue: true, accumulatedDepreciation: true },
    }),
    db.incomeRecord.aggregate({
      where: {
        status: TransactionStatus.COMPLETED,
        recordDate: { lte: asOfDate },
        ...(bf_ ? { branchId: bf_ } : {}),
      },
      _sum: { amount: true },
    }),
    db.expenditureRecord.aggregate({
      where: {
        status: TransactionStatus.COMPLETED,
        recordDate: { lte: asOfDate },
        ...(bf_ ? { branchId: bf_ } : {}),
      },
      _sum: { amount: true },
    }),
    db.insuranceContribution.aggregate({
      where: {
        type: "CONTRIBUTION",
        createdAt: { lte: asOfDate },
        ...(bf_ ? { account: { branchId: bf_ } } : {}),
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

// ============================================================================
// SOURCE-TABLE DRILLDOWN — replaces COA → JournalEntry lookups
// ============================================================================

export type DrilldownEntry = {
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
};

export type DrilldownResult = {
  accountCode: string;
  accountName: string;
  ledgerType: string;
  entries: DrilldownEntry[];
  totals: { debit: number; credit: number };
};

const INCOME_CODE_TO_NAME: Record<string, string> = {
  "400100": "Interest on Loans",
  "400200": "Account Opening Fees",
  "400300": "Stationery Sales",
  "400400": "Commission Received",
  "400500": "Loan Application Fees",
  "400600": "Subscriptions Incomes",
  "400700": "Membership Fees",
  "400800": "Project Income",
  "400950": "Loan Processing Fees",
  "401000": "Social Fund",
  "401002": "Loan Processing Fees",
  "401005": "Penalty",
  "401200": "Sale of Old Assets",
  "401400": "Ledger Fees",
  "401500": "Interest on Bank Deposits",
  "401600": "Fundraising Incomes",
  "401700": "Interview Fee",
  "401800": "Written Off Loans CR",
  "401900": "Land Income",
  "401960": "Insurance Contribution",
  "405000": "Fee Income",
};

const EXPENSE_CODE_TO_NAME: Record<string, string> = {
  "500000": "Staff & Personnel Costs",
  "501000": "Administrative Costs",
  "502000": "Travel & Subsistence",
  "503000": "Governance Costs",
  "504000": "Operational & Maintenance",
  "505000": "Miscellaneous Expenses",
  "506000": "Sundry Costs",
};

const BS_CODE_NAMES: Record<string, string> = {
  "101001": "Land",
  "101002": "Motor Vehicle",
  "101003": "Furniture and Fittings",
  "101100": "Cash at Hand",
  "102001": "Cash Equivalents",
  "102002": "Cash at Bank",
  "102004": "Mobile Money Float",
  "107000": "Loans and Receivables",
  "200600": "Loan Insurance",
  "200700": "Accumulated Depreciation",
  "201005": "Dividends Payable",
  "202002": "Accumulated Depreciation",
  "202003": "External Loan",
  "202004": "Founders Account",
  "301000": "Statutory Reserves",
  "302000": "Grants and Donations",
  "303000": "Retained Earnings",
  "304000": "Share Capital",
};

function bsName(code: string): string {
  return BS_CODE_NAMES[code] || `Account ${code}`;
}

function incomeName(code: string): string {
  return INCOME_CODE_TO_NAME[code] || `Income ${code}`;
}

function expenseName(code: string): string {
  return EXPENSE_CODE_TO_NAME[code] || `Expense ${code}`;
}

function fmt(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Fetch drilldown entries from source tables for an income or expense account code.
 * Replaces the COA → JournalEntry pattern with direct IncomeRecord/ExpenditureRecord queries.
 */
export async function getSourceDrilldown(
  accountCode: string,
  startDate: Date,
  endDate: Date,
  branchId?: string,
): Promise<DrilldownResult> {
  const code = accountCode.trim();

  // ── Income accounts (400xxx) ──
  if (code.startsWith("4")) {
    const category = await db.budgetCategory.findFirst({
      where: { code, isActive: true },
      select: { id: true, name: true },
    });

    if (!category) {
      // Insurance contribution is special — it's in InsuranceContribution table
      if (code === "401960") {
        return getSourceInsuranceDrilldown(startDate, endDate, branchId);
      }
      return { accountCode: code, accountName: incomeName(code), ledgerType: "INCOME", entries: [], totals: { debit: 0, credit: 0 } };
    }

    const records = await db.incomeRecord.findMany({
      where: {
        budgetCategoryId: category.id,
        recordDate: { gte: startDate, lte: endDate },
        status: { in: ["COMPLETED", "APPROVED"] },
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { recordDate: "asc" },
      select: {
        recordDate: true,
        amount: true,
        description: true,
        receiptNumber: true,
        referenceNumber: true,
        notes: true,
      },
    });

    const entries: DrilldownEntry[] = records.map((r) => ({
      date: fmt(r.recordDate),
      reference: r.receiptNumber || r.referenceNumber || "",
      description: r.description || r.notes || category.name,
      debit: 0,
      credit: Number(r.amount || 0),
    }));

    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    return { accountCode: code, accountName: category.name || incomeName(code), ledgerType: "INCOME", entries, totals: { debit: 0, credit: totalCredit } };
  }

  // ── Expenditure accounts (500xxx) ──
  if (code.startsWith("5")) {
    const category = await db.budgetCategory.findFirst({
      where: { code, isActive: true },
      select: { id: true, name: true },
    });

    if (!category) {
      return { accountCode: code, accountName: expenseName(code), ledgerType: "EXPENDITURES", entries: [], totals: { debit: 0, credit: 0 } };
    }

    const records = await db.expenditureRecord.findMany({
      where: {
        budgetCategoryId: category.id,
        recordDate: { gte: startDate, lte: endDate },
        status: { in: ["COMPLETED", "APPROVED"] },
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { recordDate: "asc" },
      select: {
        recordDate: true,
        amount: true,
        description: true,
        receiptNumber: true,
        referenceNumber: true,
        notes: true,
        payee: true,
      },
    });

    const entries: DrilldownEntry[] = records.map((r) => ({
      date: fmt(r.recordDate),
      reference: r.receiptNumber || r.referenceNumber || "",
      description: r.description || r.payee || r.notes || category.name,
      debit: Number(r.amount || 0),
      credit: 0,
    }));

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    return { accountCode: code, accountName: category.name || expenseName(code), ledgerType: "EXPENDITURES", entries, totals: { debit: totalDebit, credit: 0 } };
  }

  // ── Balance sheet accounts ──
  return getSourceBSDrilldown(code, startDate, endDate, branchId);
}

async function getSourceInsuranceDrilldown(
  startDate: Date,
  endDate: Date,
  branchId?: string,
): Promise<DrilldownResult> {
  const records = await db.insuranceContribution.findMany({
    where: {
      type: "CONTRIBUTION",
      createdAt: { gte: startDate, lte: endDate },
      ...(branchId ? { account: { branchId } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      amount: true,
      description: true,
      account: { select: { accountType: { select: { name: true } } } },
    },
  });

  const entries: DrilldownEntry[] = records.map((r) => ({
    date: fmt(r.createdAt),
    reference: "Insurance Contribution",
    description: r.description || r.account?.accountType?.name || "Insurance Contribution",
    debit: 0,
    credit: Number(r.amount || 0),
  }));

  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  return { accountCode: "401960", accountName: "Insurance Contribution", ledgerType: "INCOME", entries, totals: { debit: 0, credit: totalCredit } };
}

async function getSourceBSDrilldown(
  code: string,
  startDate: Date,
  endDate: Date,
  branchId?: string,
): Promise<DrilldownResult> {
  const name = bsName(code);
  let ledgerType = "ASSETS";
  if (code.startsWith("2")) ledgerType = "LIABILITIES";
  if (code.startsWith("3")) ledgerType = "EQUITY";

  // Fixed asset accounts (101xxx)
  if (code.startsWith("101") && code !== "101100") {
    const categoryMap: Record<string, string> = { "101001": "land", "101002": "motor", "101003": "furniture" };
    const catFilter = categoryMap[code];
    const where: any = { status: "ACTIVE", purchaseDate: { gte: startDate, lte: endDate } };
    if (branchId) where.branchId = branchId;
    if (catFilter) where.category = { contains: catFilter, mode: "insensitive" };

    const assets = await db.fixedAsset.findMany({ where, orderBy: { purchaseDate: "asc" }, select: {
      purchaseDate: true, currentValue: true, assetName: true, description: true, accumulatedDepreciation: true,
    }});

    const entries: DrilldownEntry[] = [];
    for (const a of assets) {
      entries.push({ date: fmt(a.purchaseDate), reference: a.assetName, description: a.description || `Purchase: ${a.assetName}`, debit: Number(a.currentValue || 0), credit: 0 });
    }
    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    return { accountCode: code, accountName: name, ledgerType, entries, totals: { debit: totalDebit, credit: 0 } };
  }

  // Cash at hand (101100)
  if (code === "101100") {
    const vaultAgg = await db.vault.aggregate({ where: { ...(branchId ? { branchId } : {}) }, _sum: { balance: true } });
    const floatAgg = await db.userFloat.aggregate({ where: {}, _sum: { balance: true } });
    const balance = Number(vaultAgg._sum.balance || 0) + Number(floatAgg._sum.balance || 0);
    return { accountCode: code, accountName: name, ledgerType, entries: [{ date: fmt(new Date()), reference: "Vault + Float", description: "Cash at Hand aggregate", debit: Math.max(balance, 0), credit: 0 }], totals: { debit: Math.max(balance, 0), credit: 0 } };
  }

  // Loans portfolio (107000)
  if (code === "107000") {
    const where: any = { status: { in: ["DISBURSED", "OVERDUE"] }, disbursementDate: { gte: startDate, lte: endDate } };
    if (branchId) where.branchId = branchId;
    const loans = await db.loan.findMany({ where, orderBy: { disbursementDate: "asc" }, select: {
      disbursementDate: true, amountGranted: true, outstandingBalance: true, id: true, member: { select: { user: { select: { name: true } } } },
    }});
    const entries: DrilldownEntry[] = loans.map((l) => ({
      date: fmt(l.disbursementDate || new Date()), reference: l.id, description: `Loan to ${l.member?.user?.name || "Member"}`, debit: Number(l.amountGranted || 0), credit: 0,
    }));
    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    return { accountCode: code, accountName: name, ledgerType, entries, totals: { debit: totalDebit, credit: 0 } };
  }

  // Member savings (201xxx)
  if (code.startsWith("201")) {
    const where: any = { status: { not: "CLOSED" }, accountType: { isShareAccount: false, hasFixedPeriod: false }, openedAt: { gte: startDate, lte: endDate } };
    if (branchId) where.branchId = branchId;
    const accounts = await db.account.findMany({ where, orderBy: { openedAt: "asc" }, select: {
      openedAt: true, balance: true, accountType: { select: { name: true } }, member: { select: { user: { select: { name: true } } } },
    }});
    const entries: DrilldownEntry[] = accounts.map((a) => ({
      date: fmt(a.openedAt), reference: a.accountType?.name || "Savings", description: `${a.member?.user?.name || "Member"} — ${a.accountType?.name || "Savings"}`, debit: 0, credit: Number(a.balance || 0),
    }));
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    return { accountCode: code, accountName: name, ledgerType, entries, totals: { debit: 0, credit: totalCredit } };
  }

  // Loan insurance (200600)
  if (code === "200600") {
    const where: any = { type: "CONTRIBUTION", createdAt: { gte: startDate, lte: endDate } };
    if (branchId) where.account = { branchId };
    const records = await db.insuranceContribution.findMany({ where, orderBy: { createdAt: "asc" }, select: {
      createdAt: true, amount: true, description: true, account: { select: { member: { select: { user: { select: { name: true } } } } } },
    }});
    const entries: DrilldownEntry[] = records.map((r) => ({
      date: fmt(r.createdAt), reference: "Insurance", description: r.description || `Insurance from ${r.account?.member?.user?.name || "Member"}`, debit: 0, credit: Number(r.amount || 0),
    }));
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    return { accountCode: code, accountName: name, ledgerType, entries, totals: { debit: 0, credit: totalCredit } };
  }

  // Statutory reserves (301000)
  if (code === "301000") {
    const where: any = { type: "STATUTORY_RESERVE", date: { gte: startDate, lte: endDate } };
    if (branchId) where.branchId = branchId;
    const records = await db.equityManualEntry.findMany({ where, orderBy: { date: "asc" }, select: {
      date: true, amount: true, description: true, reference: true,
    }});
    const entries: DrilldownEntry[] = records.map((r) => ({
      date: fmt(r.date), reference: r.reference || "", description: r.description || "Statutory Reserve", debit: 0, credit: Number(r.amount || 0),
    }));
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    return { accountCode: code, accountName: name, ledgerType, entries, totals: { debit: 0, credit: totalCredit } };
  }

  // Grants & Donations (302000)
  if (code === "302000") {
    const where: any = { type: "GRANT_DONATION", date: { gte: startDate, lte: endDate } };
    if (branchId) where.branchId = branchId;
    const records = await db.equityManualEntry.findMany({ where, orderBy: { date: "asc" }, select: {
      date: true, amount: true, description: true, reference: true,
    }});
    const entries: DrilldownEntry[] = records.map((r) => ({
      date: fmt(r.date), reference: r.reference || "", description: r.description || "Grant / Donation", debit: 0, credit: Number(r.amount || 0),
    }));
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    return { accountCode: code, accountName: name, ledgerType, entries, totals: { debit: 0, credit: totalCredit } };
  }

  // Share Capital (304000)
  if (code.startsWith("304")) {
    const where: any = { status: { in: ["ACTIVE", "DORMANT", "ON_HOLD"] }, openedDate: { gte: startDate, lte: endDate } };
    if (branchId) where.branchId = branchId;
    const shares = await db.shareAccount.findMany({ where, orderBy: { openedDate: "asc" }, select: {
      openedDate: true, totalValue: true, id: true, member: { select: { user: { select: { name: true } } } },
    }});
    const entries: DrilldownEntry[] = shares.map((s) => ({
      date: fmt(s.openedDate), reference: s.id, description: `Share Capital — ${s.member?.user?.name || "Member"}`, debit: 0, credit: Number(s.totalValue || 0),
    }));
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    return { accountCode: code, accountName: name, ledgerType, entries, totals: { debit: 0, credit: totalCredit } };
  }

  // Fixed deposits (201300)
  if (code === "201300") {
    const where: any = { status: { in: ["ACTIVE", "MATURED"] }, startDate: { gte: startDate, lte: endDate } };
    if (branchId) where.branchId = branchId;
    const fds = await db.fixedDeposit.findMany({ where, orderBy: { startDate: "asc" }, select: {
      startDate: true, principalAmount: true, id: true, member: { select: { user: { select: { name: true } } } },
    }});
    const entries: DrilldownEntry[] = fds.map((f) => ({
      date: fmt(f.startDate), reference: f.id, description: `Fixed Deposit — ${f.member?.user?.name || "Member"}`, debit: 0, credit: Number(f.principalAmount || 0),
    }));
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    return { accountCode: code, accountName: name, ledgerType, entries, totals: { debit: 0, credit: totalCredit } };
  }

  // Accumulated depreciation (200700, 202002)
  if (code === "200700" || code === "202002") {
    const where: any = { status: "ACTIVE" };
    if (branchId) where.branchId = branchId;
    const assets = await db.fixedAsset.findMany({ where, orderBy: { createdAt: "asc" }, select: {
      createdAt: true, accumulatedDepreciation: true, assetName: true, description: true,
    }});
    const entries: DrilldownEntry[] = assets.filter((a) => Number(a.accumulatedDepreciation || 0) > 0).map((a) => ({
      date: fmt(a.createdAt), reference: a.assetName, description: `Depreciation: ${a.description || a.assetName}`, debit: 0, credit: Number(a.accumulatedDepreciation || 0),
    }));
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    return { accountCode: code, accountName: name, ledgerType, entries, totals: { debit: 0, credit: totalCredit } };
  }

  // Fallback — no source entries for this code
  return { accountCode: code, accountName: name, ledgerType, entries: [], totals: { debit: 0, credit: 0 } };
}
