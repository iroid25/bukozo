import { format, parseISO, startOfYear, subDays } from "date-fns";
import { AccountLedgerType, TransactionStatus } from "@prisma/client";

import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { calculateAccountBalance } from "@/lib/accounting-rules";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import { db } from "@/prisma/db";
import type {
  IncomeExpenseAccount,
  IncomeExpenseDrilldown,
  IncomeExpenseGroup,
  IncomeExpenseReport,
  IncomeExpenseSection,
} from "./income-expense-types";

type SectionType = "INCOME" | "EXPENDITURES";

type GroupDefinition = {
  code: string;
  name: string;
  section: SectionType;
  standalone?: boolean;
  prefixes: string[];
};

const GROUPS: GroupDefinition[] = [
  { code: "400100", name: "INTEREST ON LOANS", section: "INCOME", standalone: true, prefixes: ["400100"] },
  { code: "400200", name: "ACCOUNT OPENING FEES", section: "INCOME", standalone: true, prefixes: ["400200"] },
  { code: "400300", name: "STATIONERY SALES", section: "INCOME", prefixes: ["40030"] },
  { code: "400400", name: "COMMISSION RECEIVED", section: "INCOME", prefixes: ["40040"] },
  { code: "400500", name: "LOAN APPLICATION FEES", section: "INCOME", standalone: true, prefixes: ["400500"] },
  { code: "400600", name: "SUBSCRIPTIONS INCOMES", section: "INCOME", standalone: true, prefixes: ["400600"] },
  { code: "400700", name: "MEMBERSHIP FEES", section: "INCOME", standalone: true, prefixes: ["400700"] },
  { code: "400800", name: "PROJECT INCOME", section: "INCOME", prefixes: ["40080"] },
  { code: "400950", name: "LOAN PROCESSING FEES", section: "INCOME", standalone: true, prefixes: ["400950", "401002"] },
  { code: "401000", name: "SOCIAL FUND", section: "INCOME", standalone: true, prefixes: ["401000"] },
  { code: "401200", name: "SALE OF OLD ASSETS", section: "INCOME", standalone: true, prefixes: ["401200"] },
  { code: "401300", name: "PENALTY", section: "INCOME", prefixes: ["40130"] },
  { code: "401400", name: "LEDGER FEES", section: "INCOME", prefixes: ["40140"] },
  { code: "405000", name: "FEE INCOME", section: "INCOME", standalone: true, prefixes: ["4050"] },
  { code: "401500", name: "INTEREST ON BANK DEPOSITS", section: "INCOME", standalone: true, prefixes: ["401500"] },
  { code: "401600", name: "FUNDRAISING INCOMES", section: "INCOME", standalone: true, prefixes: ["401600"] },
  { code: "401700", name: "INTERVIEW FEE", section: "INCOME", standalone: true, prefixes: ["401700"] },
  { code: "401800", name: "WRITTEN OFF LOANS CR", section: "INCOME", standalone: true, prefixes: ["401800"] },
  { code: "401900", name: "LAND INCOME", section: "INCOME", standalone: true, prefixes: ["401900"] },
  { code: "401960", name: "INSURANCE CONTRIBUTION", section: "INCOME", standalone: true, prefixes: ["401960"] },
  { code: "500000", name: "STAFF & PERSONNEL COSTS", section: "EXPENDITURES", prefixes: ["5000"] },
  { code: "501000", name: "ADMINISTRATIVE COSTS", section: "EXPENDITURES", prefixes: ["5010"] },
  { code: "502000", name: "TRAVEL & SUBSISTENCE", section: "EXPENDITURES", prefixes: ["5020"] },
  { code: "503000", name: "GOVERNANCE COSTS", section: "EXPENDITURES", prefixes: ["5030"] },
  { code: "504000", name: "OPERATIONAL & MAINTENANCE", section: "EXPENDITURES", prefixes: ["5040"] },
  { code: "505000", name: "MISCELLANEOUS EXPENSES", section: "EXPENDITURES", prefixes: ["5050"] },
  { code: "506000", name: "SUNDRY COSTS", section: "EXPENDITURES", prefixes: ["5060"] },
];

const SECTION_LABELS: Record<SectionType, string> = {
  INCOME: "Income",
  EXPENDITURES: "Expenses",
};

const WITHDRAWAL_FEE_ACCOUNT_CODE = "405001";
const LOAN_PROCESSING_FEE_ACCOUNT_CODE = "401002";

type AccountRecord = {
  id: string;
  accountCode: string;
  accountName: string;
  ledgerType: AccountLedgerType;
};

type Aggregates = Map<string, { debit: number; credit: number; count: number }>;

function normalizeDate(value?: string | Date | null) {
  if (!value) return null;
  const date = typeof value === "string" ? parseISO(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

function toEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatMoney(value: number) {
  const negative = value < 0;
  const amount = new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value || 0));
  return `${negative ? "(" : ""}${amount}${negative ? ")" : ""}`;
}

function resolveGroup(accountCode: string, section: SectionType) {
  const definition = GROUPS.find(
    (group) => group.section === section && group.prefixes.some((prefix) => accountCode.startsWith(prefix)),
  );

  if (definition) return definition;

  if (section === "INCOME") {
    return { code: "409999", name: "OTHER INCOME", section, prefixes: [] };
  }

  return { code: "509999", name: "OTHER EXPENSES", section, prefixes: [] };
}

function getDefaultCurrentPeriod(endDate: Date) {
  const start = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  return { start, end: endDate };
}

function getDefaultComparePeriod(currentStart: Date) {
  const compareEnd = subDays(currentStart, 1);
  return {
    start: startOfYear(currentStart),
    end: compareEnd,
  };
}

function buildGroupMap(records: AccountRecord[]) {
  const groups = new Map<string, { definition: GroupDefinition; records: AccountRecord[] }>();

  records.forEach((record) => {
    const section = record.ledgerType === AccountLedgerType.INCOME ? "INCOME" : "EXPENDITURES";
    const definition = resolveGroup(record.accountCode, section);
    const current = groups.get(definition.code) || { definition, records: [] };
    current.records.push(record);
    groups.set(definition.code, current);
  });

  return Array.from(groups.values()).sort((a, b) => a.definition.code.localeCompare(b.definition.code));
}

async function loadBranchName(branchId?: string | null) {
  if (!branchId) return "All Branches";
  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: { name: true },
  });
  return branch?.name || branchId;
}

async function aggregateEntries(
  accountIds: string[],
  startDate: Date,
  endDate: Date,
  branchId?: string,
) {
  if (accountIds.length === 0) return new Map<string, { debit: number; credit: number; count: number }>();

  const entries = await db.journalEntry.findMany({
    where: {
      accountId: { in: accountIds },
      entryDate: { gte: startDate, lte: endDate },
      ...(branchId
        ? {
            OR: [
              { transaction: { branchId } },
              { transactionId: null, branchId },
            ],
          }
        : {}),
    },
    select: {
      accountId: true,
      debitAmount: true,
      creditAmount: true,
    },
  });

  const aggregates: Aggregates = new Map();
  for (const entry of entries) {
    const current = aggregates.get(entry.accountId) || { debit: 0, credit: 0, count: 0 };
    current.debit += Number(entry.debitAmount || 0);
    current.credit += Number(entry.creditAmount || 0);
    current.count += 1;
    aggregates.set(entry.accountId, current);
  }

  return aggregates;
}

function buildAccountRow(record: AccountRecord, current: { debit: number; credit: number; count: number } | undefined, compare: { debit: number; credit: number; count: number } | undefined): IncomeExpenseAccount {
  const section: SectionType = record.ledgerType === AccountLedgerType.INCOME ? "INCOME" : "EXPENDITURES";
  const currentValue = calculateAccountBalance(record.ledgerType, current?.debit || 0, current?.credit || 0);
  const compareValue = calculateAccountBalance(record.ledgerType, compare?.debit || 0, compare?.credit || 0);

  return {
    code: record.accountCode,
    name: record.accountName,
    current_period: currentValue,
    prior_ytd: compareValue,
    closing: compareValue + currentValue,
    journal_count: current?.count || 0,
    section,
    group_code: resolveGroup(record.accountCode, section).code,
    group_name: resolveGroup(record.accountCode, section).name,
  };
}

function normalizeAccountName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeIncomeExpenseAccounts(accounts: IncomeExpenseAccount[]) {
  const grouped = new Map<string, IncomeExpenseAccount>();

  for (const account of accounts) {
    const key = `${account.group_code}::${normalizeAccountName(account.name)}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...account });
      continue;
    }

    current.current_period += account.current_period;
    current.prior_ytd += account.prior_ytd;
    current.closing += account.closing;
    current.journal_count += account.journal_count;
  }

  return Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code));
}

function aggregateFeeIncomeRecords(records: Array<{ amount: number; description: string | null; budgetCategory?: { code?: string | null } | null }>) {
  return records.reduce(
    (acc, record) => {
      const description = record.description || "";
      const categoryCode = record.budgetCategory?.code || "";
      if (!/withdrawal\s+fee/i.test(description) && !/mobile\s+money\s+withdrawal\s+fee/i.test(description) && !/loan\s+application\s+fee/i.test(description) && !/loan\s+processing\s+fee/i.test(description)) {
        return acc;
      }

      if (categoryCode && categoryCode !== WITHDRAWAL_FEE_ACCOUNT_CODE && categoryCode !== LOAN_PROCESSING_FEE_ACCOUNT_CODE) {
        return acc;
      }

      acc.amount += Number(record.amount || 0);
      acc.count += 1;
      return acc;
    },
    { amount: 0, count: 0 },
  );
}

function aggregateLoanProcessingFeeRecords(records: Array<{ amount: number; description: string | null; budgetCategory?: { code?: string | null } | null }>) {
  return records.reduce(
    (acc, record) => {
      const description = record.description || "";
      const categoryCode = record.budgetCategory?.code || "";
      if (categoryCode === LOAN_PROCESSING_FEE_ACCOUNT_CODE || /loan\s+processing\s+fee/i.test(description)) {
        acc.amount += Number(record.amount || 0);
        acc.count += 1;
      }
      return acc;
    },
    { amount: 0, count: 0 },
  );
}


export async function listAccountsForIncomeExpense(user: any) {
  const branchFilter = await getBranchFilterForService(user, user.branchId || undefined);
  const accounts = await db.chartOfAccount.findMany({
    where: {
      isActive: true,
      ledgerType: { in: [AccountLedgerType.INCOME, AccountLedgerType.EXPENDITURES] },
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      ledgerType: true,
    },
    orderBy: [{ ledgerType: "asc" }, { accountCode: "asc" }],
  });

  return {
    branch: {
      id: branchFilter.branchId || "all",
      name: await loadBranchName(branchFilter.branchId || null),
    },
    accounts: accounts.map((account) => ({
      code: account.accountCode,
      name: account.accountName,
      ledgerType: account.ledgerType,
      section: account.ledgerType === AccountLedgerType.INCOME ? "INCOME" : "EXPENDITURES",
      group: resolveGroup(account.accountCode, account.ledgerType === AccountLedgerType.INCOME ? "INCOME" : "EXPENDITURES").name,
    })),
  };
}

export async function buildIncomeExpenseReport(input: {
  user: any;
  branchId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  compareStartDate?: Date | string;
  compareEndDate?: Date | string;
}) {
  const requestedStart = normalizeDate(input.startDate);
  const requestedEnd = normalizeDate(input.endDate);
  const currentPeriod = getDefaultCurrentPeriod(requestedEnd || new Date());
  const startDate = requestedStart || currentPeriod.start;
  const endDate = toEndOfDay(requestedEnd || currentPeriod.end);

  const requestedCompareStart = normalizeDate(input.compareStartDate);
  const requestedCompareEnd = normalizeDate(input.compareEndDate);
  const defaultCompare = getDefaultComparePeriod(startDate);
  const compareStartDate = requestedCompareStart || defaultCompare.start;
  const compareEndDate = toEndOfDay(requestedCompareEnd || defaultCompare.end);

  const branchFilter = await getBranchFilterForService(input.user, input.branchId || undefined);
  const branchId = branchFilter.branchId;

  const accounts = await db.chartOfAccount.findMany({
    where: {
      isActive: true,
      ledgerType: { in: [AccountLedgerType.INCOME, AccountLedgerType.EXPENDITURES] },
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      ledgerType: true,
    },
    orderBy: [{ ledgerType: "asc" }, { accountCode: "asc" }],
  });

  const accountIds = accounts.map((account) => account.id);
  const [currentAggregates, compareAggregates] = await Promise.all([
    aggregateEntries(accountIds, startDate, endDate, branchId),
    aggregateEntries(accountIds, compareStartDate, compareEndDate, branchId),
  ]);

  const [currentFeeRecords, compareFeeRecords, currentIncAgg, compareIncAgg, currentExpAgg, compareExpAgg] = await Promise.all([
    db.incomeRecord.findMany({
      where: {
        recordDate: { gte: startDate, lte: endDate },
        status: TransactionStatus.COMPLETED,
        ...(branchId ? { branchId } : {}),
      },
      select: {
        amount: true,
        description: true,
        budgetCategory: {
          select: {
            code: true,
          },
        },
      },
    }),
    db.incomeRecord.findMany({
      where: {
        recordDate: { gte: compareStartDate, lte: compareEndDate },
        status: TransactionStatus.COMPLETED,
        ...(branchId ? { branchId } : {}),
      },
      select: {
        amount: true,
        description: true,
        budgetCategory: {
          select: {
            code: true,
          },
        },
      },
    }),
    db.incomeRecord.aggregate({
      where: { recordDate: { gte: startDate, lte: endDate }, status: TransactionStatus.COMPLETED, ...(branchId ? { branchId } : {}) },
      _sum: { amount: true },
    }),
    db.incomeRecord.aggregate({
      where: { recordDate: { gte: compareStartDate, lte: compareEndDate }, status: TransactionStatus.COMPLETED, ...(branchId ? { branchId } : {}) },
      _sum: { amount: true },
    }),
    db.expenditureRecord.aggregate({
      where: { recordDate: { gte: startDate, lte: endDate }, status: TransactionStatus.COMPLETED, ...(branchId ? { branchId } : {}) },
      _sum: { amount: true },
    }),
    db.expenditureRecord.aggregate({
      where: { recordDate: { gte: compareStartDate, lte: compareEndDate }, status: TransactionStatus.COMPLETED, ...(branchId ? { branchId } : {}) },
      _sum: { amount: true },
    }),
  ]);

  const currentIncTotal = Number(currentIncAgg._sum.amount || 0);
  const compareIncTotal = Number(compareIncAgg._sum.amount || 0);
  const currentExpTotal = Number(currentExpAgg._sum.amount || 0);
  const compareExpTotal = Number(compareExpAgg._sum.amount || 0);

  const currentFeeFallback = aggregateFeeIncomeRecords(currentFeeRecords);
  const compareFeeFallback = aggregateFeeIncomeRecords(compareFeeRecords);
  const currentLoanProcessingFeeFallback = aggregateLoanProcessingFeeRecords(currentFeeRecords);
  const compareLoanProcessingFeeFallback = aggregateLoanProcessingFeeRecords(compareFeeRecords);

  const recordsByCode = new Map(accounts.map((account) => [account.accountCode, account] as const));

  const sectionRecords = {
    INCOME: accounts
      .filter((account) => account.ledgerType === AccountLedgerType.INCOME)
      .map((account) => {
        const current = currentAggregates.get(account.id);
        const compare = compareAggregates.get(account.id);
        const useCurrentFallback =
          account.accountCode === WITHDRAWAL_FEE_ACCOUNT_CODE &&
          (!current || current.count === 0) &&
          currentFeeFallback.amount > 0;
        const useCompareFallback =
          account.accountCode === WITHDRAWAL_FEE_ACCOUNT_CODE &&
          (!compare || compare.count === 0) &&
          compareFeeFallback.amount > 0;
        const useCurrentLoanProcessingFeeFallback =
          account.accountCode === LOAN_PROCESSING_FEE_ACCOUNT_CODE &&
          (!current || current.count === 0) &&
          currentLoanProcessingFeeFallback.amount > 0;
        const useCompareLoanProcessingFeeFallback =
          account.accountCode === LOAN_PROCESSING_FEE_ACCOUNT_CODE &&
          (!compare || compare.count === 0) &&
          compareLoanProcessingFeeFallback.amount > 0;

        return buildAccountRow(
          account,
          useCurrentLoanProcessingFeeFallback
            ? { debit: 0, credit: currentLoanProcessingFeeFallback.amount, count: currentLoanProcessingFeeFallback.count }
            : useCurrentFallback
            ? { debit: 0, credit: currentFeeFallback.amount, count: currentFeeFallback.count }
            : current,
          useCompareLoanProcessingFeeFallback
            ? { debit: 0, credit: compareLoanProcessingFeeFallback.amount, count: compareLoanProcessingFeeFallback.count }
            : useCompareFallback
            ? { debit: 0, credit: compareFeeFallback.amount, count: compareFeeFallback.count }
            : compare,
        );
      }),
    EXPENDITURES: accounts
      .filter((account) => account.ledgerType === AccountLedgerType.EXPENDITURES)
      .map((account) => buildAccountRow(
        account,
        currentAggregates.get(account.id),
        compareAggregates.get(account.id),
      )),
  };

  const dedupedSectionRecords = {
    INCOME: dedupeIncomeExpenseAccounts(sectionRecords.INCOME),
    EXPENDITURES: dedupeIncomeExpenseAccounts(sectionRecords.EXPENDITURES),
  };

  // Redistribute per-account values proportionally so the section totals match
  // the authoritative sources used by /dashboard/accounts/incomes (IncomeRecord)
  // and /dashboard/accounts/expenditures (ExpenditureRecord). GL journal entries
  // are used only to determine the relative weight of each account within the total.
  // Fee accounts (405001, 401002) are excluded from redistribution — their values
  // were already set by description-matching against IncomeRecord and must be preserved
  // exactly; redistributing them again would corrupt the accurate fallback amounts.
  {
    const incRows = dedupedSectionRecords.INCOME;
    if (incRows.length > 0) {
      const FEE_CODES = [WITHDRAWAL_FEE_ACCOUNT_CODE, LOAN_PROCESSING_FEE_ACCOUNT_CODE];
      const feeRows = incRows.filter((r) => FEE_CODES.includes(r.code));
      const nonFeeRows = incRows.filter((r) => !FEE_CODES.includes(r.code));

      // Subtract fee amounts from the totals so fee accounts don't absorb a double share
      const feeCurrentTotal = feeRows.reduce((s, r) => s + Math.max(r.current_period, 0), 0);
      const feeCompareTotal = feeRows.reduce((s, r) => s + Math.max(r.prior_ytd, 0), 0);
      const nonFeeCurrentTotal = Math.max(currentIncTotal - feeCurrentTotal, 0);
      const nonFeeCompareTotal = Math.max(compareIncTotal - feeCompareTotal, 0);

      if (nonFeeRows.length > 0) {
        const glSumCurrent = nonFeeRows.reduce((s, r) => s + Math.max(r.current_period, 0), 0);
        const glSumCompare = nonFeeRows.reduce((s, r) => s + Math.max(r.prior_ytd, 0), 0);
        for (const row of nonFeeRows) {
          const rCurrent = glSumCurrent > 0.001 ? Math.max(row.current_period, 0) / glSumCurrent : 1 / nonFeeRows.length;
          const rCompare = glSumCompare > 0.001 ? Math.max(row.prior_ytd, 0) / glSumCompare : 1 / nonFeeRows.length;
          (row as any).current_period = Math.round(nonFeeCurrentTotal * rCurrent * 100) / 100;
          (row as any).prior_ytd = Math.round(nonFeeCompareTotal * rCompare * 100) / 100;
          (row as any).closing = (row as any).prior_ytd + (row as any).current_period;
        }
      }
      // Fee rows keep their description-matched fallback values; just update closing
      for (const row of feeRows) {
        (row as any).closing = (row as any).prior_ytd + (row as any).current_period;
      }
    }
  }
  {
    const expRows = dedupedSectionRecords.EXPENDITURES;
    if (expRows.length > 0) {
      const glSumCurrent = expRows.reduce((s, r) => s + Math.max(r.current_period, 0), 0);
      const glSumCompare = expRows.reduce((s, r) => s + Math.max(r.prior_ytd, 0), 0);
      for (const row of expRows) {
        const rCurrent = glSumCurrent > 0.001 ? Math.max(row.current_period, 0) / glSumCurrent : 1 / expRows.length;
        const rCompare = glSumCompare > 0.001 ? Math.max(row.prior_ytd, 0) / glSumCompare : 1 / expRows.length;
        (row as any).current_period = Math.round(currentExpTotal * rCurrent * 100) / 100;
        (row as any).prior_ytd = Math.round(compareExpTotal * rCompare * 100) / 100;
        (row as any).closing = (row as any).prior_ytd + (row as any).current_period;
      }
    }
  }

  const groupedSections: IncomeExpenseSection[] = (["INCOME", "EXPENDITURES"] as SectionType[]).map((section) => {
    const sectionAccounts = dedupedSectionRecords[section];
    const grouped = new Map<string, IncomeExpenseGroup>();

    sectionAccounts.forEach((account) => {
      const groupDefinition = resolveGroup(account.code, section);
      const currentGroup = grouped.get(groupDefinition.code) || {
        code: groupDefinition.code,
        name: groupDefinition.name,
        is_standalone: Boolean(groupDefinition.standalone) || false,
        accounts: [],
        group_total: { current_period: 0, prior_ytd: 0, closing: 0 },
      };

      currentGroup.accounts.push(account);
      currentGroup.group_total.current_period += account.current_period;
      currentGroup.group_total.prior_ytd += account.prior_ytd;
      currentGroup.group_total.closing += account.closing;
      grouped.set(groupDefinition.code, currentGroup);
    });

    const groups = Array.from(grouped.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((group) => ({
        ...group,
        accounts: group.accounts.sort((a, b) => a.code.localeCompare(b.code)),
      }));

    const sectionTotal = groups.reduce(
      (acc, group) => {
        acc.current_period += group.group_total.current_period;
        acc.prior_ytd += group.group_total.prior_ytd;
        acc.closing += group.group_total.closing;
        return acc;
      },
      { current_period: 0, prior_ytd: 0, closing: 0 },
    );

    return {
      type: section,
      label: SECTION_LABELS[section],
      groups,
      section_total: sectionTotal,
    };
  });

  const incomeTotal = groupedSections.find((section) => section.type === "INCOME")?.section_total.current_period || 0;
  const expenseTotal = groupedSections.find((section) => section.type === "EXPENDITURES")?.section_total.current_period || 0;
  const compareIncomeTotal = groupedSections.find((section) => section.type === "INCOME")?.section_total.prior_ytd || 0;
  const compareExpenseTotal = groupedSections.find((section) => section.type === "EXPENDITURES")?.section_total.prior_ytd || 0;

  const compareLabel = requestedCompareStart && requestedCompareEnd
    ? `${format(compareStartDate, "dd/MM/yyyy")} to ${format(compareEndDate, "dd/MM/yyyy")}`
    : `${format(compareEndDate, "MMMM-yyyy")} (YTD)`;

  const branchName = await loadBranchName(branchId || null);

  return {
    sacco_name: REPORT_HEADER_DETAILS.institutionName,
    location: REPORT_HEADER_DETAILS.postalAddress.join(", "),
    report_title: "Statement of Comprehensive Income & Expenses",
    report_date: format(endDate, "dd/MM/yyyy"),
    generated_time: format(new Date(), "HH:mm:ss"),
    branch: {
      id: branchId || "all",
      name: branchName,
    },
    current_period: {
      label: `${format(startDate, "dd/MM/yyyy")} to ${format(endDate, "dd/MM/yyyy")}`,
      start: format(startDate, "yyyy-MM-dd"),
      end: format(endDate, "yyyy-MM-dd"),
    },
    compare_period: {
      label: compareLabel,
      start: format(compareStartDate, "yyyy-MM-dd"),
      end: format(compareEndDate, "yyyy-MM-dd"),
    },
    sections: groupedSections,
    net_result: {
      label: "Net Surplus / (Deficit)",
      current_period: incomeTotal - expenseTotal,
      prior_ytd: compareIncomeTotal - compareExpenseTotal,
      closing: (incomeTotal + compareIncomeTotal) - (expenseTotal + compareExpenseTotal),
      is_surplus: (incomeTotal + compareIncomeTotal) - (expenseTotal + compareExpenseTotal) >= 0,
    },
    account_count: dedupedSectionRecords.INCOME.length + dedupedSectionRecords.EXPENDITURES.length,
    expense_account_count: dedupedSectionRecords.EXPENDITURES.length,
  } satisfies IncomeExpenseReport;
}

export async function buildIncomeExpenseDrilldown(input: {
  user: any;
  accountCode: string;
  branchId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}) {
  const requestedStart = normalizeDate(input.startDate);
  const requestedEnd = normalizeDate(input.endDate);
  const endDate = toEndOfDay(requestedEnd || new Date());
  const startDate = requestedStart || new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  const branchFilter = await getBranchFilterForService(input.user, input.branchId || undefined);
  const branchId = branchFilter.branchId;

  const account = await db.chartOfAccount.findFirst({
    where: {
      accountCode: input.accountCode,
      isActive: true,
      ledgerType: { in: [AccountLedgerType.INCOME, AccountLedgerType.EXPENDITURES] },
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      ledgerType: true,
    },
  });

  if (!account) {
    throw new Error("Account not found");
  }

  const entries = await db.journalEntry.findMany({
    where: {
      accountId: account.id,
      entryDate: { gte: startDate, lte: endDate },
      ...(branchId
        ? {
            OR: [
              { transaction: { branchId } },
              { transactionId: null, branchId },
            ],
          }
        : {}),
    },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    select: {
      entryDate: true,
      reference: true,
      description: true,
      debitAmount: true,
      creditAmount: true,
    },
  });

  let runningDebit = 0;
  let runningCredit = 0;
  const formattedEntries = entries.map((entry) => {
    runningDebit += Number(entry.debitAmount || 0);
    runningCredit += Number(entry.creditAmount || 0);
    return {
      date: format(entry.entryDate, "dd/MM/yyyy"),
      reference: entry.reference || "",
      description: entry.description,
      debit: Number(entry.debitAmount || 0),
      credit: Number(entry.creditAmount || 0),
      balance: calculateAccountBalance(account.ledgerType, runningDebit, runningCredit),
    };
  });

  const totals = entries.reduce(
    (acc, entry) => {
      acc.debit += Number(entry.debitAmount || 0);
      acc.credit += Number(entry.creditAmount || 0);
      return acc;
    },
    { debit: 0, credit: 0 },
  );

  const section: SectionType = account.ledgerType === AccountLedgerType.INCOME ? "INCOME" : "EXPENDITURES";
  const group = resolveGroup(account.accountCode, section);
  const branchName = await loadBranchName(branchId || null);

  return {
    account: {
      code: account.accountCode,
      name: account.accountName,
      section,
      group: group.name,
    },
    period: {
      label: `${format(startDate, "dd/MM/yyyy")} to ${format(endDate, "dd/MM/yyyy")}`,
      start: format(startDate, "yyyy-MM-dd"),
      end: format(endDate, "yyyy-MM-dd"),
    },
    branch: {
      id: branchId || "all",
      name: branchName,
    },
    entries: formattedEntries,
    totals: {
      debit: totals.debit,
      credit: totals.credit,
      balance: calculateAccountBalance(account.ledgerType, totals.debit, totals.credit),
    },
  } satisfies IncomeExpenseDrilldown;
}

export function buildIncomeExpenseWorkbookRows(report: IncomeExpenseReport) {
  const rows: any[] = [];
  rows.push([]);
  rows.push([report.sacco_name]);
  rows.push([]);
  rows.push([]);
  rows.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", format(new Date(), "dd/MM/yyyy"), format(new Date(), "HH:mm:ss")]);
  rows.push(["KISINGA Kasese District"]);
  rows.push([]);
  rows.push([report.report_title]);
  rows.push([]);
  rows.push([`Reporting Date From: ${format(parseISO(report.current_period.start), "dd/MM/yyyy")} To: ${format(parseISO(report.current_period.end), "dd/MM/yyyy")}`]);
  rows.push([]);
  rows.push(["A/C Name", "Current Period", "Prior YTD", "Closing"]);

  report.sections.forEach((section) => {
    rows.push([section.label]);
    section.groups.forEach((group) => {
      rows.push([`${group.code} ${group.name}`]);
      group.accounts.forEach((account) => {
        rows.push([`${account.code} ${account.name}`, account.current_period, account.prior_ytd, account.closing]);
      });
      rows.push([`${group.name} Subtotal`, group.group_total.current_period, group.group_total.prior_ytd, group.group_total.closing]);
    });
    rows.push([`Total ${section.label}`, section.section_total.current_period, section.section_total.prior_ytd, section.section_total.closing]);
  });

  rows.push([report.net_result.label, report.net_result.current_period, report.net_result.prior_ytd, report.net_result.closing]);
  rows.push([`Total: ${report.account_count}`]);
  rows.push([`Total - Expenses: ${report.expense_account_count}`]);
  rows.push(["Finance Solutions® 08.45.u"]);

  return rows;
}
