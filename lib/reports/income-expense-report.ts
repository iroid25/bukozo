import { format, parseISO, startOfYear, subDays } from "date-fns";
import { AccountLedgerType, TransactionStatus } from "@prisma/client";

import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { calculateAccountBalance } from "@/lib/accounting-rules";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import { db } from "@/prisma/db";
import { getSourceDrilldown } from "@/lib/reports/direct-source";
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
  { code: "401005", name: "PENALTY", section: "INCOME", standalone: true, prefixes: ["401005"] },
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

async function loadBranchName(branchId?: string | null) {
  if (!branchId) return "All Branches";
  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: { name: true },
  });
  return branch?.name || branchId;
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


export async function listAccountsForIncomeExpense(user: any) {
  const branchFilter = await getBranchFilterForService(user, user.branchId || undefined);

  // Read from BudgetCategory instead of COA — BudgetCategory now has matching COA codes
  const categories = await db.budgetCategory.findMany({
    where: { isActive: true, kind: { in: ["INCOME", "EXPENSE"] }, children: { none: {} } },
    select: { id: true, name: true, code: true, kind: true },
    orderBy: { name: "asc" },
  });

  return {
    branch: {
      id: branchFilter.branchId || "all",
      name: await loadBranchName(branchFilter.branchId || null),
    },
    accounts: categories.map((cat) => ({
      code: cat.code || "",
      name: cat.name,
      ledgerType: cat.kind === "INCOME" ? AccountLedgerType.INCOME : AccountLedgerType.EXPENDITURES,
      section: cat.kind === "INCOME" ? "INCOME" : "EXPENDITURES",
      group: resolveGroup(cat.code || "", cat.kind === "INCOME" ? "INCOME" : "EXPENDITURES").name,
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

  // Read BudgetCategory for account structure
  const categories = await db.budgetCategory.findMany({
    where: { isActive: true, kind: { in: ["INCOME", "EXPENSE"] }, children: { none: {} } },
    select: { id: true, name: true, code: true, kind: true },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  // Direct source: read from IncomeRecord and ExpenditureRecord
  const [currentIncomeRecords, compareIncomeRecords, currentExpRecords, compareExpRecords] = await Promise.all([
    db.incomeRecord.groupBy({
      by: ["budgetCategoryId"],
      where: {
        recordDate: { gte: startDate, lte: endDate },
        status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.incomeRecord.groupBy({
      by: ["budgetCategoryId"],
      where: {
        recordDate: { gte: compareStartDate, lte: compareEndDate },
        status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.expenditureRecord.groupBy({
      by: ["budgetCategoryId"],
      where: {
        recordDate: { gte: startDate, lte: endDate },
        status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.expenditureRecord.groupBy({
      by: ["budgetCategoryId"],
      where: {
        recordDate: { gte: compareStartDate, lte: compareEndDate },
        status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  // Build maps: budgetCategoryId -> amount/count
  const currentIncMap = new Map(currentIncomeRecords.map((r) => [r.budgetCategoryId, { amount: Number(r._sum.amount || 0), count: r._count.id }]));
  const compareIncMap = new Map(compareIncomeRecords.map((r) => [r.budgetCategoryId, { amount: Number(r._sum.amount || 0), count: r._count.id }]));
  const currentExpMap = new Map(currentExpRecords.map((r) => [r.budgetCategoryId, { amount: Number(r._sum.amount || 0), count: r._count.id }]));
  const compareExpMap = new Map(compareExpRecords.map((r) => [r.budgetCategoryId, { amount: Number(r._sum.amount || 0), count: r._count.id }]));

  // Build account rows from BudgetCategory + source records
  const sectionRecords: Record<SectionType, IncomeExpenseAccount[]> = {
    INCOME: [],
    EXPENDITURES: [],
  };

  for (const cat of categories) {
    const section: SectionType = cat.kind === "INCOME" ? "INCOME" : "EXPENDITURES";
    const catMap = section === "INCOME" ? { current: currentIncMap, compare: compareIncMap } : { current: currentExpMap, compare: compareExpMap };
    const current = catMap.current.get(cat.id) || { amount: 0, count: 0 };
    const compare = catMap.compare.get(cat.id) || { amount: 0, count: 0 };

    const group = resolveGroup(cat.code || "", section);
    sectionRecords[section].push({
      code: cat.code || "",
      name: cat.name,
      current_period: current.amount,
      prior_ytd: compare.amount,
      closing: compare.amount + current.amount,
      journal_count: current.count,
      section,
      group_code: group.code,
      group_name: group.name,
    });
  }

  const dedupedSectionRecords = {
    INCOME: dedupeIncomeExpenseAccounts(sectionRecords.INCOME),
    EXPENDITURES: dedupeIncomeExpenseAccounts(sectionRecords.EXPENDITURES),
  };

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

  const result = await getSourceDrilldown(input.accountCode, startDate, endDate, branchId || undefined);

  const isIncome = result.ledgerType === "INCOME";
  const section: SectionType = isIncome ? "INCOME" : "EXPENDITURES";
  const group = resolveGroup(result.accountCode, section);
  const branchName = await loadBranchName(branchId || null);

  let runningDebit = 0;
  let runningCredit = 0;
  const formattedEntries = result.entries.map((entry) => {
    runningDebit += entry.debit;
    runningCredit += entry.credit;
    return {
      ...entry,
      balance: calculateAccountBalance(result.ledgerType, runningDebit, runningCredit),
    };
  });

  return {
    account: {
      code: result.accountCode,
      name: result.accountName,
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
      debit: result.totals.debit,
      credit: result.totals.credit,
      balance: calculateAccountBalance(result.ledgerType, result.totals.debit, result.totals.credit),
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
