import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import { getDirectBalanceSheetAccounts, getSourceDrilldown } from "@/lib/reports/direct-source";

export type ComprehensiveBalanceSheetAccount = {
  code: string;
  name: string;
  compare_balance: number;
  movement: number;
  closing_balance: number;
  journal_count: number;
};

export type ComprehensiveBalanceSheetGroup = {
  code: string;
  name: string;
  accounts: ComprehensiveBalanceSheetAccount[];
  group_total: {
    compare_balance: number;
    movement: number;
    closing_balance: number;
  };
};

export type ComprehensiveBalanceSheetSection = {
  section: "ASSET" | "LIABILITY" | "EQUITY";
  label: string;
  groups: ComprehensiveBalanceSheetGroup[];
  section_total: number;
  section_total_compare: number;
  section_total_movement: number;
};

export type ComprehensiveBalanceSheetReport = {
  sacco_name: string;
  location: string;
  report_title: string;
  report_date: string;
  branch: {
    id: string | "all";
    name: string;
  };
  current_period: {
    label: string;
    start: string;
    end: string;
  };
  compare_period: {
    label: string;
    start: string;
    end: string;
  };
  sections: ComprehensiveBalanceSheetSection[];
  grand_total: {
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    net_balance: number;
    account_count: number;
  };
  generated_at: string;
};

export type ComprehensiveBalanceSheetDrilldown = {
  account: {
    code: string;
    name: string;
    section: string;
    group: string;
  };
  period: {
    start: string;
    end: string;
    label: string;
  };
  branch: {
    id: string | "all";
    name: string;
  };
  entries: Array<{
    date: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    narration: string;
  }>;
  totals: {
    debit: number;
    credit: number;
    balance: number;
  };
};

type GroupDefinition = {
  code: string;
  name: string;
  section: "ASSET" | "LIABILITY" | "EQUITY";
  prefixes: string[];
};

const GROUPS: GroupDefinition[] = [
  { code: "101000", name: "FIXED ASSETS", section: "ASSET", prefixes: ["101"] },
  { code: "102000", name: "CURRENT ASSETS", section: "ASSET", prefixes: ["100911", "102"] },
  { code: "103000", name: "INVESTMENTS", section: "ASSET", prefixes: ["103"] },
  { code: "104000", name: "OFFICE EQUIPMENT", section: "ASSET", prefixes: ["104"] },
  { code: "105000", name: "ADVANCES", section: "ASSET", prefixes: ["105"] },
  { code: "106000", name: "STOCK", section: "ASSET", prefixes: ["106"] },
  { code: "107000", name: "LOANS", section: "ASSET", prefixes: ["107"] },
  { code: "108000", name: "DATA MIGRATION A/C", section: "ASSET", prefixes: ["108000"] },
  { code: "109000", name: "INTANGIBLE ASSETS", section: "ASSET", prefixes: ["109"] },
  { code: "200000", name: "MEMBER LIABILITIES", section: "LIABILITY", prefixes: ["201001", "201002", "201003", "201004", "200600"] },
  { code: "200700", name: "ACCUMULATED DEPRECIATION", section: "LIABILITY", prefixes: ["200700"] },
  { code: "200800", name: "EXTERNAL LOANS", section: "LIABILITY", prefixes: ["200800", "200810"] },
  { code: "200900", name: "FOUNDER ACCOUNT", section: "LIABILITY", prefixes: ["200900"] },
  { code: "300100", name: "STATUTORY RESERVES", section: "EQUITY", prefixes: ["300101", "300102", "300103", "300104", "300105"] },
  { code: "300300", name: "GRANTS & DONATIONS", section: "EQUITY", prefixes: ["300300"] },
  { code: "300400", name: "RETAINED EARNINGS", section: "EQUITY", prefixes: ["300400"] },
  { code: "300500", name: "SHARE CAPITAL", section: "EQUITY", prefixes: ["300501", "300502", "300503", "300504", "304"] },
];

const SECTION_LABELS: Record<ComprehensiveBalanceSheetSection["section"], string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
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

function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getDefaultCurrentPeriod(endDate: Date) {
  const start = startOfMonth(endDate);
  return { start, end: endDate };
}

function getDefaultComparePeriod(currentStart: Date) {
  const compareEnd = subMonths(currentStart, 1);
  return {
    start: startOfMonth(compareEnd),
    end: endOfMonth(compareEnd),
  };
}

function resolveGroup(accountCode: string, section: "ASSET" | "LIABILITY" | "EQUITY") {
  if (section === "ASSET" && accountCode === "101100") {
    return { code: "102000", name: "CURRENT ASSETS", section, prefixes: ["101100"] };
  }
  const definition = GROUPS.find((group) =>
    group.section === section && group.prefixes.some((prefix) => accountCode.startsWith(prefix)),
  );

  if (definition) return definition;

  if (section === "ASSET") {
    return { code: "109999", name: "OTHER ASSETS", section, prefixes: [] };
  }
  if (section === "LIABILITY") {
    return { code: "209999", name: "OTHER LIABILITIES", section, prefixes: [] };
  }
  return { code: "309999", name: "OTHER EQUITY", section, prefixes: [] };
}

function applyBalanceSide(section: "ASSET" | "LIABILITY" | "EQUITY", rawBalance: number) {
  if (section === "ASSET") return rawBalance;
  // credit-normal accounts: invert debit-credit to get credit-debit (positive = normal credit balance)
  return -rawBalance;
}


export async function buildComprehensiveBalanceSheetReport(input: {
  user: any;
  startDate?: Date | string;
  endDate?: Date | string;
  compareStartDate?: Date | string;
  compareEndDate?: Date | string;
  branchId?: string;
}) {
  const user = input.user;
  const requestedBranchId = input.branchId || undefined;
  const branchFilter = await getBranchFilterForService(user, requestedBranchId);
  const branchId = branchFilter.branchId;
  const effectiveBranchId = branchId && branchId !== "all" ? branchId : undefined;

  const endDate = toEndOfDay(normalizeDate(input.endDate) || new Date());
  const current = normalizeDate(input.startDate)
    ? {
        start: normalizeDate(input.startDate)!,
        end: endDate,
      }
    : getDefaultCurrentPeriod(endDate);

  const compare = normalizeDate(input.compareStartDate) && normalizeDate(input.compareEndDate)
    ? {
        start: normalizeDate(input.compareStartDate)!,
        end: toEndOfDay(normalizeDate(input.compareEndDate)!),
      }
    : getDefaultComparePeriod(current.start);

  // Direct source: read from real tables instead of COA + JournalEntry
  const [compareDirectAccounts, currentDirectAccounts] = await Promise.all([
    getDirectBalanceSheetAccounts(compare.end, effectiveBranchId),
    getDirectBalanceSheetAccounts(current.end, effectiveBranchId),
  ]);

  const compareByCode = new Map(compareDirectAccounts.map((a) => [a.accountCode, a]));

  const accountRows = currentDirectAccounts
    .filter((account) => !account.isGroup)
    .map((account) => {
      const section = account.ledgerType === "ASSETS" ? "ASSET" : account.ledgerType === "LIABILITIES" ? "LIABILITY" : "EQUITY";
      const group = resolveGroup(account.accountCode, section);
      const currentBalance = account.balance;
      const compareBalance = compareByCode.get(account.accountCode)?.balance || 0;
      const movement = currentBalance - compareBalance;
      const closingBalance = currentBalance;

      const signedCompare = applyBalanceSide(section, compareBalance);
      const signedMovement = applyBalanceSide(section, movement);
      const signedClosing = applyBalanceSide(section, closingBalance);

      return {
        id: account.id,
        code: account.accountCode,
        name: account.accountName,
        section,
        groupCode: group.code,
        groupName: group.name,
        compare_balance: signedCompare,
        movement: signedMovement,
        closing_balance: signedClosing,
        journal_count: 0,
      };
    });

  const buildSection = (section: "ASSET" | "LIABILITY" | "EQUITY"): ComprehensiveBalanceSheetSection => {
    const rows = accountRows.filter((row) => row.section === section);
    const grouped = new Map<string, ComprehensiveBalanceSheetGroup>();

    rows.forEach((row) => {
      const currentGroup = grouped.get(row.groupCode) || {
        code: row.groupCode,
        name: row.groupName,
        accounts: [],
        group_total: { compare_balance: 0, movement: 0, closing_balance: 0 },
      };

      currentGroup.accounts.push({
        code: row.code,
        name: row.name,
        compare_balance: row.compare_balance,
        movement: row.movement,
        closing_balance: row.closing_balance,
        journal_count: row.journal_count,
      });
      currentGroup.group_total.compare_balance += row.compare_balance;
      currentGroup.group_total.movement += row.movement;
      currentGroup.group_total.closing_balance += row.closing_balance;
      grouped.set(row.groupCode, currentGroup);
    });

    const groups = Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code));
    const sectionTotal = groups.reduce((sum, group) => sum + group.group_total.closing_balance, 0);
    const sectionTotalCompare = groups.reduce((sum, group) => sum + group.group_total.compare_balance, 0);
    const sectionTotalMovement = groups.reduce((sum, group) => sum + group.group_total.movement, 0);

    return {
      section,
      label: SECTION_LABELS[section],
      groups,
      section_total: sectionTotal,
      section_total_compare: sectionTotalCompare,
      section_total_movement: sectionTotalMovement,
    };
  };

  const sections = [buildSection("ASSET"), buildSection("LIABILITY"), buildSection("EQUITY")];
  const totalAssets = sections.find((item) => item.section === "ASSET")?.section_total || 0;
  const totalLiabilities = sections.find((item) => item.section === "LIABILITY")?.section_total || 0;
  const totalEquity = sections.find((item) => item.section === "EQUITY")?.section_total || 0;
  // Assets = Liabilities + Equity; net_balance = 0 when balanced
  const netBalance = totalAssets - totalLiabilities - totalEquity;
  const accountCount = accountRows.length;

  return {
    sacco_name: "BUKONZO UNITED TEACHERS SACCO",
    location: "KISINGA, Kasese District",
    report_title: "Statement of Comprehensive Balance Sheet",
    report_date: format(new Date(), "dd/MM/yyyy"),
    branch: {
      id: effectiveBranchId || "all",
      name: effectiveBranchId ? (await db.branch.findUnique({ where: { id: effectiveBranchId }, select: { name: true } }))?.name || "Selected Branch" : "All Branches",
    },
    current_period: {
      label: format(current.start, "MMMM-yyyy"),
      start: toDateKey(current.start),
      end: toDateKey(current.end),
    },
    compare_period: {
      label: format(compare.start, "MMMM-yyyy"),
      start: toDateKey(compare.start),
      end: toDateKey(compare.end),
    },
    sections,
    grand_total: {
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity,
      net_balance: netBalance,
      account_count: accountCount,
    },
    generated_at: new Date().toISOString(),
    debug: {
      branchId: effectiveBranchId || "all",
      compare_label: `${format(compare.start, "MMM yyyy")} to ${format(compare.end, "dd MMM yyyy")}`,
    },
  };
}

export async function buildComprehensiveBalanceSheetDrilldown(input: {
  user: any;
  accountCode: string;
  startDate?: Date | string;
  endDate?: Date | string;
  branchId?: string;
}) {
  const user = input.user;
  const branchFilter = await getBranchFilterForService(user, input.branchId || undefined);
  const branchId = branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : undefined;
  const startDate = normalizeDate(input.startDate) || startOfMonth(new Date());
  const endDate = toEndOfDay(normalizeDate(input.endDate) || new Date());

  const result = await getSourceDrilldown(input.accountCode, startDate, endDate, branchId);

  const section = result.ledgerType === "ASSETS" ? "ASSET" : result.ledgerType === "LIABILITIES" ? "LIABILITY" : "EQUITY";
  const group = resolveGroup(result.accountCode, section);
  const balance = applyBalanceSide(section, result.totals.debit - result.totals.credit);

  return {
    account: {
      code: result.accountCode,
      name: result.accountName,
      section,
      group: group.name,
    },
    period: {
      start: format(startDate, "yyyy-MM-dd"),
      end: format(endDate, "yyyy-MM-dd"),
      label: `${format(startDate, "dd MMM yyyy")} to ${format(endDate, "dd MMM yyyy")}`,
    },
    branch: {
      id: branchId || "all",
      name: branchId ? (await db.branch.findUnique({ where: { id: branchId }, select: { name: true } }))?.name || "Selected Branch" : "All Branches",
    },
    entries: result.entries.map((entry) => ({
      date: entry.date,
      reference: entry.reference,
      description: entry.description,
      debit: entry.debit,
      credit: entry.credit,
      narration: entry.description,
    })),
    totals: {
      debit: result.totals.debit,
      credit: result.totals.credit,
      balance,
    },
  } satisfies ComprehensiveBalanceSheetDrilldown;
}

export function listComprehensiveBalanceSheetGroups() {
  return GROUPS.map((group) => ({
    code: group.code,
    name: group.name,
    section: group.section,
  }));
}

export async function listReportPeriods() {
  const periods = await db.financialPeriod.findMany({
    orderBy: [{ startDate: "desc" }],
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      isClosed: true,
    },
  });

  return periods.map((period) => ({
    id: period.id,
    label: period.name,
    startDate: format(period.startDate, "yyyy-MM-dd"),
    endDate: format(period.endDate, "yyyy-MM-dd"),
    isClosed: period.isClosed,
  }));
}

export async function listAccountsForBalanceSheet(user: any) {
  const branchFilter = await getBranchFilterForService(user, user.branchId || undefined);
  const branchId = branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : undefined;
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const accounts = await getDirectBalanceSheetAccounts(now, branchId);

  return accounts.map((account) => {
    const section = account.ledgerType === "ASSETS" ? "ASSET" : account.ledgerType === "LIABILITIES" ? "LIABILITY" : "EQUITY";
    const group = resolveGroup(account.accountCode, section);
    return {
      id: account.id,
      code: account.accountCode,
      name: account.accountName,
      section,
      group_code: group.code,
      group_name: group.name,
      branch_id: branchId || "all",
      is_active: true,
      sort_order: account.accountCode,
    };
  });
}
