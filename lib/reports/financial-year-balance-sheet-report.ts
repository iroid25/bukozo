import { format, parseISO } from "date-fns";
import { UserRole } from "@prisma/client";

import { db } from "@/prisma/db";
import { calculateAccountBalance } from "@/lib/accounting-rules";
import { buildTree, sortTreeByCodeOrName } from "@/lib/category-tree";
import { getBranchFilterForService, getCashAtHandPrincipalTotal, getOperationalBalances } from "@/lib/services/financial-reports";

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
  if (!accountIds.length) {
    return {
      period: new Map<string, { debit: number; credit: number }>(),
      ytd: new Map<string, { debit: number; credit: number }>(),
    };
  }

  const branchWhere = (branchId: string) => ({
    OR: [
      { transaction: { branchId } },
      { transactionId: null as string | null, branchId },
    ],
  });

  const [periodRows, ytdRows] = await Promise.all([
    db.journalEntry.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entryDate: { gte: fromDate, lte: toDate },
        ...(branchId ? branchWhere(branchId) : {}),
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    }),
    db.journalEntry.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        entryDate: { lte: toDate },
        ...(branchId ? branchWhere(branchId) : {}),
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    }),
  ]);

  return {
    period: new Map(
      periodRows.map((entry) => [
        entry.accountId,
        {
          debit: entry._sum.debitAmount || 0,
          credit: entry._sum.creditAmount || 0,
        },
      ]),
    ),
    ytd: new Map(
      ytdRows.map((entry) => [
        entry.accountId,
        {
          debit: entry._sum.debitAmount || 0,
          credit: entry._sum.creditAmount || 0,
        },
      ]),
    ),
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

  const accounts = await db.chartOfAccount.findMany({
    where: {
      isActive: true,
      ledgerType: { in: ["ASSETS", "LIABILITIES", "EQUITY"] },
    },
    orderBy: [{ ledgerType: "asc" }, { accountCode: "asc" }],
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      parentId: true,
      ledgerType: true,
      children: {
        select: {
          id: true,
        },
      },
    },
  });

  const accountIds = accounts.map((account) => account.id);
  const balances = await loadBalanceSummaries(accountIds, fromDate, toDate, branchId || undefined);

  const mapped = accounts.map((account) => {
    const section = account.ledgerType as FinancialYearBalanceSheetAccount["ledgerType"];
    const periodSummary = balances.period.get(account.id) || { debit: 0, credit: 0 };
    const ytdSummary = balances.ytd.get(account.id) || { debit: 0, credit: 0 };
    const periodNet = calculateAccountBalance(section, periodSummary.debit, periodSummary.credit);
    const ytdBalance = calculateAccountBalance(section, ytdSummary.debit, ytdSummary.credit);
    return {
      id: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      code: account.accountCode,
      name: account.accountName,
      parentId: account.parentId,
      isGroup: account.children.length > 0,
      ledgerType: section,
      periodNet,
      ytdBalance,
      displayPeriodNet: displaySide(section, periodNet),
      displayYtdBalance: displaySide(section, ytdBalance),
      children: [] as FinancialYearBalanceSheetAccount[],
    };
  });

  const cashAtHandFyStart = await getCashAtHandPrincipalTotal(fyStart, branchId || undefined);
  const cashAtHandToDate = await getCashAtHandPrincipalTotal(toDate, branchId || undefined);
  for (const row of mapped) {
    if (row.accountCode === "101100") {
      row.ytdBalance = cashAtHandToDate;
      row.periodNet = cashAtHandToDate - cashAtHandFyStart;
      row.displayYtdBalance = displaySide(row.ledgerType, row.ytdBalance);
      row.displayPeriodNet = displaySide(row.ledgerType, row.periodNet);
    }
  }

  const [opFyStart, opToDate] = await Promise.all([
    getOperationalBalances(fyStart, { branchId: branchId || undefined }),
    getOperationalBalances(toDate, { branchId: branchId || undefined }),
  ]);

  {

    // Prefix-based overrides for loans and depreciation (NOT fixed assets — handled separately below)
    const fyOverrides: Array<{ prefixes: string[]; getOp: (o: typeof opFyStart) => number }> = [
      { prefixes: ["107"], getOp: (o) => o.loanPortfolio },
      { prefixes: ["200700"], getOp: (o) => o.accumulatedDepreciation },
    ];
    for (const ov of fyOverrides) {
      const grp = mapped.filter((r) => ov.prefixes.some((p) => r.accountCode.startsWith(p)));
      if (grp.length === 0) continue;
      const ytdSum = grp.reduce((s, r) => s + r.ytdBalance, 0);
      const targetStart = ov.getOp(opFyStart);
      const targetEnd = ov.getOp(opToDate);
      if (Math.abs(ytdSum) < 0.001 && Math.abs(targetEnd) < 0.001) continue;
      for (const row of grp) {
        const ratio = ytdSum !== 0 ? Math.abs(row.ytdBalance / ytdSum) : 1 / grp.length;
        const rawPeriod = Math.round((targetEnd - targetStart) * ratio * 100) / 100;
        const rawYtd = Math.round(targetEnd * ratio * 100) / 100;
        row.periodNet = rawPeriod;
        row.ytdBalance = rawYtd;
        row.displayPeriodNet = displaySide(row.ledgerType, rawPeriod);
        row.displayYtdBalance = displaySide(row.ledgerType, rawYtd);
      }
    }

    // Fetch fixed assets, savings types, share types, and FTD types in parallel
    const [fixedAssets, savingsTypes, shareTypes, ftdTypes] = await Promise.all([
      db.fixedAsset.findMany({
        where: { status: "ACTIVE", accountId: { not: null }, purchaseDate: { lte: toDate }, ...(branchId ? { branchId } : {}) },
        select: { accountId: true, currentValue: true },
      }),
      db.accountType.findMany({
        where: { isShareAccount: false, hasFixedPeriod: false, ledgerAccountId: { not: null } },
        select: { id: true, ledgerAccountId: true },
      }),
      db.accountType.findMany({
        where: { isShareAccount: true, ledgerAccountId: { not: null } },
        select: { id: true, ledgerAccountId: true },
      }),
      db.accountType.findMany({
        where: { hasFixedPeriod: true, ledgerAccountId: { not: null } },
        select: { id: true, ledgerAccountId: true },
      }),
    ]);

    // Fixed assets: use each asset's actual currentValue mapped to its individual COA accountId.
    for (const asset of fixedAssets) {
      if (!asset.accountId) continue;
      const row = mapped.find((r) => r.id === asset.accountId);
      if (!row) continue;
      const endBal = Number(asset.currentValue ?? 0);
      const glPeriod = balances.period.get(asset.accountId) ?? { debit: 0, credit: 0 };
      const periodNet = calculateAccountBalance(row.ledgerType, glPeriod.debit, glPeriod.credit);
      row.ytdBalance = endBal;
      row.periodNet = periodNet || endBal;
      row.displayYtdBalance = displaySide(row.ledgerType, endBal);
      row.displayPeriodNet = displaySide(row.ledgerType, row.periodNet);
    }

    // Run savings and share follow-up aggregates in parallel
    const needsSavings = savingsTypes.length > 0 && opToDate.memberSavingsDeposits > 0;
    const needsShares = shareTypes.length > 0;
    const [savingsRows, shareRows] = await Promise.all([
      needsSavings
        ? db.account.groupBy({
            by: ["accountTypeId"],
            where: { accountTypeId: { in: savingsTypes.map((t) => t.id) }, status: { not: "CLOSED" }, ...(branchId ? { branchId } : {}) },
            _sum: { balance: true },
          })
        : Promise.resolve([] as { accountTypeId: string; _sum: { balance: number | null } }[]),
      needsShares
        ? db.shareAccount.groupBy({
            by: ["accountTypeId"],
            where: {
              accountTypeId: { in: shareTypes.map((t) => t.id) },
              status: { in: ["ACTIVE", "DORMANT", "ON_HOLD", "FROZEN"] },
              openedDate: { lte: toDate },
              ...(branchId ? { branchId } : {}),
            },
            _sum: { totalValue: true },
          })
        : Promise.resolve([] as { accountTypeId: string; _sum: { totalValue: number | null } }[]),
    ]);

    // Member savings: override each savings product's ledger account with actual Account.balance per type
    if (needsSavings) {
      const endMap = new Map(savingsRows.map((r) => [r.accountTypeId, Number(r._sum.balance ?? 0)]));
      for (const st of savingsTypes) {
        const row = mapped.find((r) => r.id === st.ledgerAccountId);
        if (!row) continue;
        const endBal = endMap.get(st.id) ?? 0;
        const glPeriod = balances.period.get(st.ledgerAccountId!) ?? { debit: 0, credit: 0 };
        const periodNet = calculateAccountBalance(row.ledgerType, glPeriod.debit, glPeriod.credit);
        row.ytdBalance = endBal;
        row.periodNet = periodNet;
        row.displayYtdBalance = displaySide(row.ledgerType, endBal);
        row.displayPeriodNet = displaySide(row.ledgerType, periodNet);
      }
    }

    // Share capital: override accounts linked to share account types
    if (needsShares) {
      const endMap = new Map(shareRows.map((r) => [r.accountTypeId, Number(r._sum.totalValue ?? 0)]));
      for (const st of shareTypes) {
        const row = mapped.find((r) => r.id === st.ledgerAccountId);
        if (!row) continue;
        const endBal = endMap.get(st.id) ?? 0;
        const glPeriod = balances.period.get(st.ledgerAccountId!) ?? { debit: 0, credit: 0 };
        const periodNet = calculateAccountBalance(row.ledgerType, glPeriod.debit, glPeriod.credit);
        row.ytdBalance = endBal;
        row.periodNet = periodNet;
        row.displayYtdBalance = displaySide(row.ledgerType, endBal);
        row.displayPeriodNet = displaySide(row.ledgerType, periodNet);
      }
    }

    // Fixed-term deposits: override GL accounts linked to FTD account types.
    if (ftdTypes.length > 0 && opToDate.fixedTermDeposits > 0) {
      const ledgerAccIds = [...new Set(ftdTypes.map((t) => t.ledgerAccountId!))];
      const ftdRows = mapped.filter((r) => ledgerAccIds.includes(r.id));
      if (ftdRows.length > 0) {
        const total = opToDate.fixedTermDeposits;
        const glSum = ftdRows.reduce((s, r) => s + Math.abs(r.ytdBalance), 0);
        for (const row of ftdRows) {
          const ratio = glSum > 0.001 ? Math.abs(row.ytdBalance) / glSum : 1 / ftdRows.length;
          const endBal = Math.round(total * ratio * 100) / 100;
          const glPeriod = balances.period.get(row.id) ?? { debit: 0, credit: 0 };
          const periodNet = calculateAccountBalance(row.ledgerType, glPeriod.debit, glPeriod.credit);
          row.ytdBalance = endBal;
          row.periodNet = periodNet;
          row.displayYtdBalance = displaySide(row.ledgerType, endBal);
          row.displayPeriodNet = displaySide(row.ledgerType, periodNet);
        }
      }
    }
  }

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
  // Net profit = cumulative income minus cumulative expenditure to the reporting date.
  // This is the same figure shown by the P&L statement and makes the balance sheet balance.
  const netProfitForPeriod = opToDate.incomeTotal - opToDate.expenditureTotal;
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

  const totalAccounts = accounts.length;
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
