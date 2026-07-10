import { format, parseISO, subDays } from "date-fns";
import { AccountLedgerType, TransactionStatus } from "@prisma/client";

import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { getBranchFilterForService, getCashAtHandPrincipalTotal, getOperationalBalances } from "@/lib/services/financial-reports";
import { calculateAccountBalance } from "@/lib/accounting-rules";
import { db } from "@/prisma/db";

export type TrialBalanceAccount = {
  code: string;
  name: string;
  section: "ASSETS" | "LIABILITIES" | "EQUITY" | "INCOME" | "EXPENDITURES";
  group_code: string;
  group_name: string;
  prior_closing: number;
  current_movement: number;
  current_closing: number;
  closing_debit: number;
  closing_credit: number;
  journal_count: number;
};

export type TrialBalanceGroup = {
  code: string;
  name: string;
  accounts: TrialBalanceAccount[];
  total: {
    prior_closing: number;
    current_movement: number;
    current_closing: number;
    closing_debit: number;
    closing_credit: number;
  };
};

export type TrialBalanceSection = {
  section: TrialBalanceAccount["section"];
  label: string;
  groups: TrialBalanceGroup[];
  total: {
    prior_closing: number;
    current_movement: number;
    current_closing: number;
    closing_debit: number;
    closing_credit: number;
  };
};

export type TrialBalanceReport = {
  sacco_name: string;
  location: string;
  report_title: string;
  report_date: string;
  generated_time: string;
  branch: {
    id: string | "all";
    name: string;
  };
  current_period: {
    label: string;
    start: string;
    end: string;
  };
  prior_period: {
    label: string;
    start: string;
    end: string;
  };
  sections: TrialBalanceSection[];
  proof: {
    debits_total: number;
    credits_total: number;
    difference: number;
    is_balanced: boolean;
  };
  totals: {
    accounts: number;
    sections: number;
    groups: number;
  };
};

type GroupDefinition = {
  code: string;
  name: string;
  section: TrialBalanceAccount["section"];
  prefixes: string[];
  standalone?: boolean;
};

const GROUPS: GroupDefinition[] = [
  { code: "100911", name: "EMPLOYEED", section: "ASSETS", standalone: true, prefixes: ["100911"] },
  { code: "101000", name: "FIXED ASSETS", section: "ASSETS", prefixes: ["101"] },
  { code: "102000", name: "CURRENT ASSETS", section: "ASSETS", prefixes: ["102"] },
  { code: "103000", name: "INVESTMENTS", section: "ASSETS", prefixes: ["103"] },
  { code: "104000", name: "OFFICE EQUIPMENT", section: "ASSETS", prefixes: ["104"] },
  { code: "105000", name: "ADVANCES", section: "ASSETS", prefixes: ["105"] },
  { code: "106000", name: "STOCK", section: "ASSETS", prefixes: ["106"] },
  { code: "107000", name: "LOANS", section: "ASSETS", prefixes: ["107"] },
  { code: "108000", name: "DATA MIGRATION A/C", section: "ASSETS", standalone: true, prefixes: ["108000"] },
  { code: "109009", name: "AMORTIZATION FOR SOFTWARE", section: "ASSETS", standalone: true, prefixes: ["109009"] },
  { code: "200000", name: "MEMBER DEPOSITS", section: "LIABILITIES", prefixes: ["201001", "201002", "201003", "201004", "200600"] },
  { code: "200800", name: "EXTERNAL LOANS", section: "LIABILITIES", prefixes: ["200800", "200810"] },
  { code: "200900", name: "FOUNDER ACCOUNT", section: "LIABILITIES", prefixes: ["200900"] },
  { code: "200700", name: "ACCUMULATED DEPRECIATION", section: "LIABILITIES", prefixes: ["200700"] },
  { code: "300100", name: "STATUTORY RESERVES", section: "EQUITY", prefixes: ["300101", "300102", "300103", "300104", "300105"] },
  { code: "300300", name: "GRANTS & DONATIONS", section: "EQUITY", standalone: true, prefixes: ["300300"] },
  { code: "300400", name: "RETAINED EARNINGS", section: "EQUITY", standalone: true, prefixes: ["300400"] },
  { code: "300500", name: "SHARE CAPITAL", section: "EQUITY", prefixes: ["300501", "300502", "300503", "300504", "304"] },
  { code: "400100", name: "INCOME", section: "INCOME", prefixes: ["400"] },
  { code: "500000", name: "EXPENSES", section: "EXPENDITURES", prefixes: ["500", "501", "502", "503", "504", "505", "506"] },
];

const SECTION_LABELS: Record<TrialBalanceAccount["section"], string> = {
  ASSETS: "Assets",
  LIABILITIES: "Liabilities",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENDITURES: "Expenses",
};

function normalizeDate(value?: string | Date | null) {
  if (!value) return null;
  const date = typeof value === "string" ? parseISO(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveGroup(accountCode: string, section: TrialBalanceAccount["section"]) {
  if (section === "ASSETS" && accountCode === "101100") {
    return { code: "102000", name: "CURRENT ASSETS", section, prefixes: ["101100"] };
  }
  const match = GROUPS.find((group) => group.section === section && group.prefixes.some((prefix) => accountCode.startsWith(prefix)));
  return match || {
    code: section === "ASSETS" ? "109999" : section === "LIABILITIES" ? "209999" : section === "EQUITY" ? "309999" : section === "INCOME" ? "409999" : "509999",
    name: `OTHER ${SECTION_LABELS[section].toUpperCase()}`,
    section,
    prefixes: [],
  };
}

function normalizeBalance(ledgerType: AccountLedgerType, debit: number, credit: number) {
  return calculateAccountBalance(ledgerType, debit, credit);
}

function toSignedMovement(ledgerType: AccountLedgerType, debit: number, credit: number) {
  return calculateAccountBalance(ledgerType, debit, credit);
}

function toClosingColumns(ledgerType: AccountLedgerType, signedBalance: number) {
  const isDebitNormal = ledgerType === AccountLedgerType.ASSETS || ledgerType === AccountLedgerType.EXPENDITURES;
  if (isDebitNormal) {
    return signedBalance >= 0
      ? { debit: signedBalance, credit: 0 }
      : { debit: 0, credit: Math.abs(signedBalance) };
  }
  return signedBalance >= 0
    ? { debit: 0, credit: signedBalance }
    : { debit: Math.abs(signedBalance), credit: 0 };
}

function getPreviousPeriodLabel(startDate: Date) {
  const priorDate = subDays(startDate, 1);
  return format(priorDate, "MMMM-yyyy");
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
  if (accountIds.length === 0) {
    return new Map<string, { debit: number; credit: number; count: number }>();
  }

  const rows = await db.journalEntry.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: accountIds },
      entryDate: { gte: startDate, lte: endDate },
      ...(branchId
        ? {
            OR: [
              { transaction: { branchId } },
              { transactionId: null as string | null, branchId },
            ],
          }
        : {}),
    },
    _sum: {
      debitAmount: true,
      creditAmount: true,
    },
    _count: {
      id: true,
    },
  });

  return new Map(
    rows.map((row) => [
      row.accountId,
      {
        debit: row._sum.debitAmount || 0,
        credit: row._sum.creditAmount || 0,
        count: row._count.id || 0,
      },
    ]),
  );
}

function toEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function buildTrialBalanceReport(input: {
  user: any;
  branchId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}) {
  const requestedStart = normalizeDate(input.startDate) || new Date(new Date().getFullYear(), 0, 1);
  const requestedEnd = toEndOfDay(normalizeDate(input.endDate) || new Date());

  const branchFilter = await getBranchFilterForService(input.user, input.branchId || undefined);
  const branchId = branchFilter.branchId;

  const accounts = await db.chartOfAccount.findMany({
    where: { isActive: true, ledgerType: { in: ["ASSETS", "LIABILITIES", "EQUITY", "INCOME", "EXPENDITURES"] } },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      ledgerType: true,
    },
    orderBy: [{ ledgerType: "asc" }, { accountCode: "asc" }],
  });

  const accountIds = accounts.map((account) => account.id);
  const priorEnd = subDays(requestedStart, 1);
  const [openingAgg, movementAgg, priorOperational, currentOperational] = await Promise.all([
    aggregateEntries(accountIds, new Date("1900-01-01T00:00:00.000Z"), priorEnd, branchId),
    aggregateEntries(accountIds, requestedStart, requestedEnd, branchId),
    getOperationalBalances(priorEnd, { branchId }),
    getOperationalBalances(requestedEnd, { branchId }),
  ]);

  const rows = accounts.map((account) => {
    const opening = openingAgg.get(account.id) || { debit: 0, credit: 0, count: 0 };
    const movement = movementAgg.get(account.id) || { debit: 0, credit: 0, count: 0 };
    const openingSigned = normalizeBalance(account.ledgerType, opening.debit, opening.credit);
    const movementSigned = toSignedMovement(account.ledgerType, movement.debit, movement.credit);
    const closingSigned = openingSigned + movementSigned;
    const closingColumns = toClosingColumns(account.ledgerType, closingSigned);
    const section = account.ledgerType as TrialBalanceAccount["section"];
    const group = resolveGroup(account.accountCode, section);

    return {
      code: account.accountCode,
      name: account.accountName,
      section,
      group_code: group.code,
      group_name: group.name,
      prior_closing: openingSigned,
      current_movement: movementSigned,
      current_closing: closingSigned,
      closing_debit: closingColumns.debit,
      closing_credit: closingColumns.credit,
      journal_count: (opening.count || 0) + (movement.count || 0),
    } satisfies TrialBalanceAccount;
  });

  const cashAtHandPrior = await getCashAtHandPrincipalTotal(priorEnd, branchId);
  const cashAtHandCurrent = await getCashAtHandPrincipalTotal(requestedEnd, branchId);
  for (const row of rows) {
    if (row.code === "101100") {
      row.prior_closing = cashAtHandPrior;
      row.current_closing = cashAtHandCurrent;
      row.current_movement = cashAtHandCurrent - cashAtHandPrior;
      const cols = toClosingColumns(
        AccountLedgerType.ASSETS,
        row.current_closing,
      );
      row.closing_debit = cols.debit;
      row.closing_credit = cols.credit;
    }
  }

  const operationalOverrides: Record<string, { prior: number; current: number }> = {
    "107000": {
      prior: priorOperational.loanPortfolio,
      current: currentOperational.loanPortfolio,
    },
    "200000": {
      prior: priorOperational.memberSavingsDeposits + priorOperational.fixedTermDeposits,
      current: currentOperational.memberSavingsDeposits + currentOperational.fixedTermDeposits,
    },
    "300500": {
      prior: priorOperational.shareCapital,
      current: currentOperational.shareCapital,
    },
    "101000": {
      prior: priorOperational.fixedAssetsNet,
      current: currentOperational.fixedAssetsNet,
    },
    "200700": {
      prior: priorOperational.accumulatedDepreciation,
      current: currentOperational.accumulatedDepreciation,
    },
  };
  for (const [groupCode, target] of Object.entries(operationalOverrides)) {
    const groupRows = rows.filter((r) => r.group_code === groupCode);
    if (groupRows.length === 0) continue;
    const groupPriorSum = groupRows.reduce((s, r) => s + r.prior_closing, 0);
    const groupCurrentSum = groupRows.reduce((s, r) => s + r.current_closing, 0);
    if (Math.abs(groupCurrentSum) < 0.001 && Math.abs(target.current) < 0.001) continue;
    for (const row of groupRows) {
      const ratio = groupCurrentSum !== 0 ? Math.abs(row.current_closing / groupCurrentSum) : 1 / groupRows.length;
      row.prior_closing = Math.round(target.prior * ratio * 100) / 100;
      row.current_closing = Math.round(target.current * ratio * 100) / 100;
      row.current_movement = Math.round((target.current - target.prior) * ratio * 100) / 100;
      const cols = toClosingColumns(
        (row.section === "ASSETS" ? AccountLedgerType.ASSETS : row.section === "LIABILITIES" ? AccountLedgerType.LIABILITIES : AccountLedgerType.EQUITY) as AccountLedgerType,
        row.current_closing,
      );
      row.closing_debit = cols.debit;
      row.closing_credit = cols.credit;
    }
  }

  {
    const incomeRows = rows.filter((r) => r.section === "INCOME");
    if (incomeRows.length > 0) {
      const priorIncome = priorOperational.incomeTotal;
      const currentIncome = currentOperational.incomeTotal;
      const incomeAbsSum = incomeRows.reduce((s, r) => s + Math.abs(r.current_closing), 0);
      const incomeSignedSum = incomeRows.reduce((s, r) => s + r.current_closing, 0);
      // Only redistribute when JE data exists AND at least one operational period is non-zero
      if (incomeAbsSum >= 0.001 && (Math.abs(currentIncome) >= 0.001 || Math.abs(priorIncome) >= 0.001)) {
        // Use signed sum as denominator so ratios sum to 1 and contra-accounts stay negative
        const denom = Math.abs(incomeSignedSum) >= 0.001 ? incomeSignedSum : incomeAbsSum;
        for (const row of incomeRows) {
          const ratio = denom !== 0 ? row.current_closing / denom : 1 / incomeRows.length;
          row.prior_closing = Math.round(priorIncome * ratio * 100) / 100;
          row.current_closing = Math.round(currentIncome * ratio * 100) / 100;
          row.current_movement = Math.round((currentIncome - priorIncome) * ratio * 100) / 100;
          const cols = toClosingColumns(AccountLedgerType.INCOME, row.current_closing);
          row.closing_debit = cols.debit;
          row.closing_credit = cols.credit;
        }
      }
    }

    const expenditureRows = rows.filter((r) => r.section === "EXPENDITURES");
    if (expenditureRows.length > 0) {
      const priorExp = priorOperational.expenditureTotal;
      const currentExp = currentOperational.expenditureTotal;
      const expAbsSum = expenditureRows.reduce((s, r) => s + Math.abs(r.current_closing), 0);
      const expSignedSum = expenditureRows.reduce((s, r) => s + r.current_closing, 0);
      // Only redistribute when JE data exists AND at least one operational period is non-zero
      if (expAbsSum >= 0.001 && (Math.abs(currentExp) >= 0.001 || Math.abs(priorExp) >= 0.001)) {
        const denom = Math.abs(expSignedSum) >= 0.001 ? expSignedSum : expAbsSum;
        for (const row of expenditureRows) {
          const ratio = denom !== 0 ? row.current_closing / denom : 1 / expenditureRows.length;
          row.prior_closing = Math.round(priorExp * ratio * 100) / 100;
          row.current_closing = Math.round(currentExp * ratio * 100) / 100;
          row.current_movement = Math.round((currentExp - priorExp) * ratio * 100) / 100;
          const cols = toClosingColumns(AccountLedgerType.EXPENDITURES, row.current_closing);
          row.closing_debit = cols.debit;
          row.closing_credit = cols.credit;
        }
      }
    }
  }

  const groupedSections = (["ASSETS", "LIABILITIES", "EQUITY", "INCOME", "EXPENDITURES"] as const).map((section) => {
    const sectionRows = rows.filter((row) => row.section === section);
    const groups = new Map<string, TrialBalanceGroup>();

    sectionRows.forEach((row) => {
      const current = groups.get(row.group_code) || {
        code: row.group_code,
        name: row.group_name,
        accounts: [],
        total: { prior_closing: 0, current_movement: 0, current_closing: 0, closing_debit: 0, closing_credit: 0 },
      };
      current.accounts.push(row);
      current.total.prior_closing += row.prior_closing;
      current.total.current_movement += row.current_movement;
      current.total.current_closing += row.current_closing;
      current.total.closing_debit += row.closing_debit;
      current.total.closing_credit += row.closing_credit;
      groups.set(row.group_code, current);
    });

    const orderedGroups = Array.from(groups.values()).sort((a, b) => a.code.localeCompare(b.code)).map((group) => ({
      ...group,
      accounts: group.accounts.sort((a, b) => a.code.localeCompare(b.code)),
    }));

    const total = orderedGroups.reduce(
      (acc, group) => {
        acc.prior_closing += group.total.prior_closing;
        acc.current_movement += group.total.current_movement;
        acc.current_closing += group.total.current_closing;
        acc.closing_debit += group.total.closing_debit;
        acc.closing_credit += group.total.closing_credit;
        return acc;
      },
      { prior_closing: 0, current_movement: 0, current_closing: 0, closing_debit: 0, closing_credit: 0 },
    );

    return {
      section,
      label: SECTION_LABELS[section],
      groups: orderedGroups,
      total,
    } satisfies TrialBalanceSection;
  });

  const debitsTotal = groupedSections.reduce((sum, section) => sum + section.total.closing_debit, 0);
  const creditsTotal = groupedSections.reduce((sum, section) => sum + section.total.closing_credit, 0);
  const difference = debitsTotal - creditsTotal;

  const branchName = await loadBranchName(branchId || null);

  return {
    sacco_name: REPORT_HEADER_DETAILS.institutionName,
    location: REPORT_HEADER_DETAILS.postalAddress.join(", "),
    report_title: "Statement of Comprehensive Trial Balance",
    report_date: format(requestedEnd, "dd/MM/yyyy"),
    generated_time: format(new Date(), "HH:mm:ss"),
    branch: {
      id: branchId || "all",
      name: branchName,
    },
    current_period: {
      label: `${format(requestedStart, "dd/MM/yyyy")} to ${format(requestedEnd, "dd/MM/yyyy")}`,
      start: format(requestedStart, "yyyy-MM-dd"),
      end: format(requestedEnd, "yyyy-MM-dd"),
    },
    prior_period: {
      label: getPreviousPeriodLabel(requestedStart),
      start: format(new Date("1900-01-01T00:00:00.000Z"), "yyyy-MM-dd"),
      end: format(priorEnd, "yyyy-MM-dd"),
    },
    sections: groupedSections,
    proof: {
      debits_total: debitsTotal,
      credits_total: creditsTotal,
      difference,
      is_balanced: Math.abs(difference) < 0.01,
    },
    totals: {
      accounts: rows.length,
      sections: groupedSections.length,
      groups: groupedSections.reduce((sum, section) => sum + section.groups.length, 0),
    },
  } satisfies TrialBalanceReport;
}

export async function buildTrialBalanceProof(input: {
  user: any;
  branchId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}) {
  const report = await buildTrialBalanceReport(input);
  return report.proof;
}

export function buildTrialBalanceWorkbookRows(report: TrialBalanceReport) {
  const rows: any[] = [];
  rows.push([]);
  rows.push([report.sacco_name]);
  rows.push([]);
  rows.push([]);
  rows.push([`Generated: ${report.report_date} ${report.generated_time}`]);
  rows.push(["KISINGA, Kasese District"]);
  rows.push([]);
  rows.push([report.report_title]);
  rows.push([]);
  rows.push([`Reporting Date From: ${report.current_period.start} To: ${report.current_period.end}`]);
  rows.push([]);
  rows.push(["A/C Name", report.prior_period.label, report.current_period.label, `${report.current_period.label} Closing`]);

  report.sections.forEach((section) => {
    rows.push([section.label]);
    section.groups.forEach((group) => {
      rows.push([`${group.code} ${group.name}`]);
      group.accounts.forEach((account) => {
        rows.push([`${account.code} ${account.name}`, account.prior_closing, account.current_movement, account.current_closing]);
      });
      rows.push([`${group.name} subtotal`, group.total.prior_closing, group.total.current_movement, group.total.current_closing]);
    });
    rows.push([`Total ${section.label}`, section.total.prior_closing, section.total.current_movement, section.total.current_closing]);
  });

  rows.push(["Total", report.proof.debits_total, report.proof.credits_total, report.proof.difference]);
  rows.push([`Total: ${report.totals.accounts}`]);
  rows.push([`Finance Solutions® 08.45.u`]);

  return rows;
}
