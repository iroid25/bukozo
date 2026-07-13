import { format, parseISO } from "date-fns";
import { TransactionStatus, UserRole } from "@prisma/client";

import { db } from "@/prisma/db";
import { buildTree, sortTreeByCodeOrName } from "@/lib/category-tree";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import { getDirectBalanceSheetAccounts } from "@/lib/reports/direct-source";

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
  role?: UserRole | string | null;
};

export type FinancialYearOption = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

export type FinancialYearBalanceSheetAccount = {
  id: string;
  accountCode: string;
  accountName: string;
  code: string;
  name: string;
  parentId: string | null;
  isGroup: boolean;
  ledgerType: "ASSETS" | "LIABILITIES" | "EQUITY";
  periodNet: number;
  ytdBalance: number;
  displayPeriodNet: number;
  displayYtdBalance: number;
  children: FinancialYearBalanceSheetAccount[];
};

export type FinancialYearBalanceSheetSection = {
  section: "ASSETS" | "LIABILITIES" | "EQUITY";
  label: string;
  accounts: FinancialYearBalanceSheetAccount[];
  totalPeriodNet: number;
  totalYtdBalance: number;
};

export type FinancialYearBalanceSheetReport = {
  saccoName: string;
  location: string;
  reportTitle: string;
  generatedDate: string;
  generatedTime: string;
  generatedAt: string;
  branch: {
    id: string | "all";
    name: string;
  };
  financialYear: FinancialYearOption | null;
  reportingPeriod: {
    from: string;
    to: string;
    fyStart: string;
  };
  sections: FinancialYearBalanceSheetSection[];
  grandTotal: {
    totalAccounts: number;
    totalPeriodNet: number;
    totalYtdBalance: number;
    difference: number;
    balanced: boolean;
  };
  balances: {
    assets: number;
    liabilities: number;
    equity: number;
    net: number;
  };
};

type BuildInput = {
  user: AuthUserLike;
  branchId?: string;
  financialYearId?: string;
  year?: number;
  fromDate?: string;
  toDate?: string;
  fyStart?: string;
};

const SACCO_NAME = "BUKONZO UNITED TEACHERS SACCO";
const LOCATION = "KISINGA, Kasese District";

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function formatTime(date: Date) {
  return format(date, "HH:mm:ss");
}

function displaySide(_section: "ASSETS" | "LIABILITIES" | "EQUITY", value: number) {
  return value;
}

async function resolveFinancialYear(input: BuildInput) {
  if (input.financialYearId) {
    const found = await db.financialPeriod.findUnique({
      where: { id: input.financialYearId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isClosed: true,
      },
    });
    if (found) {
      return {
        id: found.id,
        label: found.name,
        startDate: format(found.startDate, "yyyy-MM-dd"),
        endDate: format(found.endDate, "yyyy-MM-dd"),
        isCurrent: !found.isClosed,
      };
    }
  }

  if (input.year) {
    const found = await db.financialPeriod.findFirst({
      where: {
        name: { contains: input.year.toString() },
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isClosed: true,
      },
    });
    if (found) {
      return {
        id: found.id,
        label: found.name,
        startDate: format(found.startDate, "yyyy-MM-dd"),
        endDate: format(found.endDate, "yyyy-MM-dd"),
        isCurrent: !found.isClosed,
      };
    }
  }

  return null;
}

async function loadBalanceSummaries(accountIds: string[], fromDate: Date, toDate: Date, branchId?: string) {
  // DEPRECATED: This function used to query JournalEntry. Kept for compatibility
  // but the main report now uses direct source reads instead.
  return {
    period: new Map<string, { debit: number; credit: number }>(),
    ytd: new Map<string, { debit: number; credit: number }>(),
  };
}

export async function listFinancialYears() {
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

  if (periods.length > 0) {
    return periods.map((period) => ({
      id: period.id,
      label: period.name,
      startDate: format(period.startDate, "yyyy-MM-dd"),
      endDate: format(period.endDate, "yyyy-MM-dd"),
      isCurrent: !period.isClosed,
    })) satisfies FinancialYearOption[];
  }

  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => {
    const year = currentYear - index;
    return {
      id: `fallback-${year}`,
      label: `${year}`,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      isCurrent: index === 0,
    };
  }) satisfies FinancialYearOption[];
}

export async function buildFinancialYearBalanceSheetReport(input: BuildInput): Promise<FinancialYearBalanceSheetReport> {
  const generatedAt = new Date();
  const branchFilter = await getBranchFilterForService(input.user as any, input.branchId);
  const branchId = branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : null;
  const financialYear = await resolveFinancialYear(input);

  const fyStart: Date =
    parseDate(input.fyStart) || parseDate(financialYear?.startDate) || parseDate(`${input.year || new Date().getFullYear()}-01-01`) || new Date();
  const toDate: Date = parseDate(input.toDate) || parseDate(financialYear?.endDate) || new Date();
  const fromDate: Date = parseDate(input.fromDate) || fyStart;

  // Direct source: read from real tables at two dates to derive period/YTD
  const [directFyStart, directToDate] = await Promise.all([
    getDirectBalanceSheetAccounts(fyStart, branchId || undefined),
    getDirectBalanceSheetAccounts(toDate, branchId || undefined),
  ]);

  // Use direct source accounts directly — they already contain parentId, isGroup, and financial data
  const directStartByCode = new Map(directFyStart.map((a) => [a.accountCode, a]));

  const mapped = directToDate
    .filter((a) => a.ledgerType === "ASSETS" || a.ledgerType === "LIABILITIES" || a.ledgerType === "EQUITY")
    .map((account) => {
      const section = account.ledgerType as FinancialYearBalanceSheetAccount["ledgerType"];
      const directStart = directStartByCode.get(account.accountCode);
      const ytdBalance = account.balance || 0;
      const startBalance = directStart?.balance || 0;
      const periodNet = ytdBalance - startBalance;
      return {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        code: account.accountCode,
        name: account.accountName,
        parentId: account.parentId,
        isGroup: account.isGroup,
        ledgerType: section,
        periodNet,
        ytdBalance,
        displayPeriodNet: displaySide(section, periodNet),
        displayYtdBalance: displaySide(section, ytdBalance),
        children: [] as FinancialYearBalanceSheetAccount[],
      };
    });

  const nodes = buildTree(mapped);
  const sortedNodes = sortTreeByCodeOrName(nodes);

  const bySection = {
    ASSETS: sortedNodes.filter((node) => node.ledgerType === "ASSETS") as FinancialYearBalanceSheetAccount[],
    LIABILITIES: sortedNodes.filter((node) => node.ledgerType === "LIABILITIES") as FinancialYearBalanceSheetAccount[],
    EQUITY: sortedNodes.filter((node) => node.ledgerType === "EQUITY") as FinancialYearBalanceSheetAccount[],
  } satisfies Record<FinancialYearBalanceSheetSection["section"], FinancialYearBalanceSheetAccount[]>;

  const summariseSection = (section: FinancialYearBalanceSheetSection["section"], label: string): FinancialYearBalanceSheetSection => {
    const sectionAccounts = bySection[section];
    const totalPeriodNet = (() => {
      let total = 0;
      const walk = (node: FinancialYearBalanceSheetAccount) => {
        total += node.displayPeriodNet;
        node.children.forEach(walk);
      };
      sectionAccounts.forEach(walk);
      return total;
    })();
    const totalYtdBalance = (() => {
      let total = 0;
      const walk = (node: FinancialYearBalanceSheetAccount) => {
        total += node.displayYtdBalance;
        node.children.forEach(walk);
      };
      sectionAccounts.forEach(walk);
      return total;
    })();

    return {
      section,
      label,
      accounts: sectionAccounts,
      totalPeriodNet,
      totalYtdBalance,
    };
  };

  const sections = [
    summariseSection("ASSETS", "Assets"),
    summariseSection("LIABILITIES", "Liabilities"),
    summariseSection("EQUITY", "Equity"),
  ];

  // Inject Surplus / (Deficit) for the Period into equity.
  // Compute from IncomeRecord + ExpenditureRecord + InsuranceContribution, scoped to the reporting period.
  const periodWhere = {
    recordDate: { gte: fromDate, lte: toDate },
    status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] as TransactionStatus[] },
    ...(branchId ? { member: { user: { branchId } } } : {}),
  };
  const [incomeAgg, expenditureAgg, insuranceAgg] = await Promise.all([
    db.incomeRecord.aggregate({
      where: periodWhere,
      _sum: { amount: true },
    }),
    db.expenditureRecord.aggregate({
      where: {
        recordDate: { gte: fromDate, lte: toDate },
        status: TransactionStatus.COMPLETED,
        ...(branchId ? { branchId } : {}),
      },
      _sum: { amount: true },
    }),
    db.insuranceContribution.aggregate({
      where: {
        type: "CONTRIBUTION",
        createdAt: { gte: fromDate, lte: toDate },
        ...(branchId ? { account: { branchId } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);
  const totalIncome = (incomeAgg._sum?.amount || 0) + (insuranceAgg._sum?.amount || 0);
  const netProfitForPeriod = totalIncome - (expenditureAgg._sum?.amount || 0);
  const surplusLabel = netProfitForPeriod >= 0 ? "Surplus for the Period" : "Deficit for the Period";
  if (Math.abs(netProfitForPeriod) > 0.009) {
    const syntheticRow: FinancialYearBalanceSheetAccount = {
      id: "__surplus__",
      accountCode: "",
      accountName: surplusLabel,
      code: "",
      name: surplusLabel,
      parentId: null,
      isGroup: false,
      ledgerType: "EQUITY",
      periodNet: netProfitForPeriod,
      ytdBalance: netProfitForPeriod,
      displayPeriodNet: netProfitForPeriod,
      displayYtdBalance: netProfitForPeriod,
      children: [],
    };
    const equitySection = sections[2];
    // Replace existing surplus row if present, otherwise append
    const existingIdx = equitySection.accounts.findIndex(
      (a) => a.accountName === "Surplus for the Period" || a.accountName === "Deficit for the Period",
    );
    if (existingIdx >= 0) {
      equitySection.accounts[existingIdx] = syntheticRow;
    } else {
      equitySection.accounts.push(syntheticRow);
    }
    equitySection.totalYtdBalance += netProfitForPeriod;
    equitySection.totalPeriodNet += netProfitForPeriod;
  }

  const totalAccounts = mapped.length;
  const totalPeriodNet = sections.reduce((sum, section) => sum + section.totalPeriodNet, 0);
  const totalYtdBalance = sections.reduce((sum, section) => sum + section.totalYtdBalance, 0);
  const difference = sections[0].totalYtdBalance - sections[1].totalYtdBalance - sections[2].totalYtdBalance;
  const balanced = Math.abs(difference) < 0.01;

  const branchName = branchId
    ? (await db.branch.findUnique({ where: { id: branchId }, select: { name: true } }))?.name || "Selected Branch"
    : "All Branches";

  return {
    saccoName: SACCO_NAME,
    location: LOCATION,
    reportTitle: "Balance Sheet (Financial Year)",
    generatedDate: format(generatedAt, "dd/MM/yyyy"),
    generatedTime: formatTime(generatedAt),
    generatedAt: generatedAt.toISOString(),
    branch: {
      id: branchId || "all",
      name: branchName,
    },
    financialYear,
    reportingPeriod: {
      from: format(fromDate, "yyyy-MM-dd"),
      to: format(toDate, "yyyy-MM-dd"),
      fyStart: format(fyStart, "yyyy-MM-dd"),
    },
    sections,
    grandTotal: {
      totalAccounts,
      totalPeriodNet,
      totalYtdBalance,
      difference,
      balanced,
    },
    balances: {
      assets: sections[0].totalYtdBalance,
      liabilities: sections[1].totalYtdBalance,
      equity: sections[2].totalYtdBalance,
      net: difference,
    },
  };
}
