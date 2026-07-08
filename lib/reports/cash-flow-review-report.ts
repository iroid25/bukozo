import { format, parseISO } from "date-fns";
import { AccountLedgerType, TransactionStatus, UserRole } from "@prisma/client";
import ExcelJS from "exceljs";

import { db } from "@/prisma/db";
import { buildTree, sortTreeByCodeOrName } from "@/lib/category-tree";
import { calculateAccountBalance } from "@/lib/accounting-rules";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { getBranchFilterForService, getOperationalBalances } from "@/lib/services/financial-reports";

type AuthUserLike = {
  id?: string | null;
  branchId?: string | null;
  role?: UserRole | string | null;
};

export type CashFlowReviewKind = "balance-sheet" | "profit-loss";
export type CashFlowReviewSectionKey = "ASSETS" | "LIABILITIES" | "EQUITY" | "INCOME" | "EXPENDITURES";

export type CashFlowReviewAccount = {
  id: string;
  accountCode: string;
  accountName: string;
  code: string;
  name: string;
  parentId: string | null;
  ledgerType: AccountLedgerType;
  period1Balance: number;
  period2Balance: number;
  netChange: number;
  growthPercent: number;
  displayPeriod1: number;
  displayPeriod2: number;
  displayNetChange: number;
  period1Signed: number;
  period2Signed: number;
  children: CashFlowReviewAccount[];
};

export type CashFlowReviewSection = {
  section: CashFlowReviewSectionKey;
  label: string;
  accounts: CashFlowReviewAccount[];
  count: number;
  totalPeriod1: number;
  totalPeriod2: number;
  totalNetChange: number;
  growthPercent: number;
  rawPeriod1: number;
  rawPeriod2: number;
};

export type CashFlowReviewReport = {
  saccoName: string;
  location: string;
  reportTitle: string;
  generatedDate: string;
  generatedTime: string;
  generatedAt: string;
  branch: { id: string | "all"; name: string };
  period1: { from: string; to: string; label: string };
  period2: { from: string; to: string; label: string };
  sections: CashFlowReviewSection[];
  grandTotal: {
    totalAccounts: number;
    totalPeriod1: number;
    totalPeriod2: number;
    totalNetChange: number;
    growthPercent: number;
  };
  profitLoss?: {
    profitLoss: number;
    label: string;
  };
};

type BuildInput = {
  user: AuthUserLike;
  branchId?: string;
  period1Start?: string;
  period1End?: string;
  period2Start?: string;
  period2End?: string;
};

const DEBIT_NORMAL = new Set<AccountLedgerType>(["ASSETS", "EXPENDITURES"]);

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function displayBalance(ledgerType: AccountLedgerType, value: number, kind: CashFlowReviewKind = "profit-loss") {
  // For balance-sheet, every section (assets, liabilities, equity) shows its
  // natural signed balance — positive means the account has a normal balance.
  // The profit-loss view negates credit-normal accounts so income reads as positive.
  if (kind === "balance-sheet") return value;
  return DEBIT_NORMAL.has(ledgerType) ? value : -value;
}

function growthPercent(base: number, compare: number) {
  if (Math.abs(compare) < 0.01) {
    return Math.abs(base) < 0.01 ? 0 : 100;
  }
  return ((base - compare) / Math.abs(compare)) * 100;
}

async function loadBranchName(branchId: string | null) {
  if (!branchId) return "All Branches";
  return (await db.branch.findUnique({ where: { id: branchId }, select: { name: true } }))?.name || branchId;
}

function sectionLabel(kind: CashFlowReviewKind, section: CashFlowReviewSectionKey) {
  if (kind === "balance-sheet") {
    return {
      ASSETS: "Assets",
      LIABILITIES: "Liabilities",
      EQUITY: "Equity",
    }[section as "ASSETS" | "LIABILITIES" | "EQUITY"];
  }
  return {
    INCOME: "Income",
    EXPENDITURES: "Expenses",
  }[section as "INCOME" | "EXPENDITURES"];
}

function normalizeSections(kind: CashFlowReviewKind) {
  return kind === "balance-sheet"
    ? (["ASSETS", "LIABILITIES", "EQUITY"] as const)
    : (["INCOME", "EXPENDITURES"] as const);
}

async function loadAccountBalances(
  accountIds: string[],
  fromDate: Date,
  toDate: Date,
  branchId: string | undefined,
) {
  if (!accountIds.length) {
    return new Map<string, { debit: number; credit: number }>();
  }

  const rows = await db.journalEntry.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: accountIds },
      entryDate: { gte: fromDate, lte: toDate },
      ...(branchId
        ? {
            OR: [
              { transaction: { branchId } },
              { transactionId: null, branchId },
            ],
          }
        : {}),
    },
    _sum: {
      debitAmount: true,
      creditAmount: true,
    },
  });

  return new Map(
    rows.map((entry) => [
      entry.accountId,
      {
        debit: Number(entry._sum.debitAmount || 0),
        credit: Number(entry._sum.creditAmount || 0),
      },
    ]),
  );
}

function queryOperationalIncome(
  fromDate: Date,
  toDate: Date,
  branchId: string | undefined,
) {
  return db.incomeRecord.aggregate({
    where: {
      status: TransactionStatus.COMPLETED,
      recordDate: { gte: fromDate, lte: toDate },
      ...(branchId ? { branchId } : {}),
    },
    _sum: { amount: true },
  });
}

function queryOperationalExpenditure(
  fromDate: Date,
  toDate: Date,
  branchId: string | undefined,
) {
  return db.expenditureRecord.aggregate({
    where: {
      status: TransactionStatus.COMPLETED,
      recordDate: { gte: fromDate, lte: toDate },
      ...(branchId ? { branchId } : {}),
    },
    _sum: { amount: true },
  });
}

export async function buildCashFlowReviewReport(input: BuildInput, kind: CashFlowReviewKind): Promise<CashFlowReviewReport> {
  const generatedAt = new Date();
  const branchFilter = await getBranchFilterForService(input.user, input.branchId);
  const branchId = branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : undefined;

  const period1Start = parseDate(input.period1Start) || startOfYear(new Date(generatedAt.getFullYear() - 1, 0, 1));
  const period1End = parseDate(input.period1End) || endOfYear(new Date(generatedAt.getFullYear() - 1, 11, 31));
  const period2Start = parseDate(input.period2Start) || startOfYear(generatedAt);
  const period2End = parseDate(input.period2End) || generatedAt;

  const ledgerTypes =
    kind === "balance-sheet"
      ? (["ASSETS", "LIABILITIES", "EQUITY"] as AccountLedgerType[])
      : (["INCOME", "EXPENDITURES"] as AccountLedgerType[]);

  const accounts = await db.chartOfAccount.findMany({
    where: {
      isActive: true,
      ledgerType: { in: ledgerTypes },
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      parentId: true,
      ledgerType: true,
      children: { select: { id: true } },
    },
    orderBy: [{ ledgerType: "asc" }, { accountCode: "asc" }],
  });

  const accountIds = accounts.map((account) => account.id);
  const period1Map = await loadAccountBalances(accountIds, period1Start, period1End, branchId);
  const period2Map = await loadAccountBalances(accountIds, period2Start, period2End, branchId);

  const mapped = accounts.map((account) => {
    const period1Raw = period1Map.get(account.id) || { debit: 0, credit: 0 };
    const period2Raw = period2Map.get(account.id) || { debit: 0, credit: 0 };
    const period1Signed = calculateAccountBalance(account.ledgerType, period1Raw.debit, period1Raw.credit);
    const period2Signed = calculateAccountBalance(account.ledgerType, period2Raw.debit, period2Raw.credit);
    const displayPeriod1 = displayBalance(account.ledgerType, period1Signed, kind);
    const displayPeriod2 = displayBalance(account.ledgerType, period2Signed, kind);
    const displayNetChange = displayPeriod2 - displayPeriod1;

    return {
      id: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      code: account.accountCode,
      name: account.accountName,
      parentId: account.parentId,
      ledgerType: account.ledgerType,
      period1Balance: displayPeriod1,
      period2Balance: displayPeriod2,
      netChange: displayNetChange,
      growthPercent: growthPercent(period2Signed, period1Signed),
      displayPeriod1,
      displayPeriod2,
      displayNetChange,
      period1Signed,
      period2Signed,
      children: [] as CashFlowReviewAccount[],
    } satisfies CashFlowReviewAccount;
  });

  if (kind === "balance-sheet") {
    const [opP1, opP2] = await Promise.all([
      getOperationalBalances(period1End, { branchId }),
      getOperationalBalances(period2End, { branchId }),
    ]);
    const bsOverrides: Array<{ prefixes: string[]; getVal: (op: typeof opP1) => number }> = [
      // Loan portfolio → accounts starting with 107
      { prefixes: ["107"], getVal: (op) => op.loanPortfolio },
      // Fixed assets net → accounts starting with 1010 (excludes 101100 Cash at hand which starts with 1011)
      { prefixes: ["1010"], getVal: (op) => op.fixedAssetsNet },
      // Share capital → accounts starting with 3005 or 304
      { prefixes: ["3005", "304"], getVal: (op) => op.shareCapital },
      // Member savings → accounts starting with 201 (matches actual savings liability accounts)
      // Uses memberSavingsDeposits only — fixedTermDeposits comes from FixedDeposit table
      // and is already captured in Account.balance for fixed-period account types
      { prefixes: ["201"], getVal: (op) => op.memberSavingsDeposits },
    ];
    for (const override of bsOverrides) {
      const groupRows = mapped.filter((r) => override.prefixes.some((p) => r.accountCode.startsWith(p)));
      if (groupRows.length === 0) continue;
      const p1Total = groupRows.reduce((s, r) => s + r.period1Signed, 0);
      const p2Total = groupRows.reduce((s, r) => s + r.period2Signed, 0);
      const targetP1 = override.getVal(opP1);
      const targetP2 = override.getVal(opP2);
      if (Math.abs(p2Total) < 0.001 && Math.abs(targetP2) < 0.001) continue;
      for (const row of groupRows) {
        const ratio = p2Total !== 0 ? Math.abs(row.period2Signed / p2Total) : 1 / groupRows.length;
        const rawP1 = Math.round(targetP1 * ratio * 100) / 100;
        const rawP2 = Math.round(targetP2 * ratio * 100) / 100;
        row.period1Signed = rawP1;
        row.period2Signed = rawP2;
        row.period1Balance = displayBalance(row.ledgerType, rawP1, kind);
        row.period2Balance = displayBalance(row.ledgerType, rawP2, kind);
        row.displayPeriod1 = row.period1Balance;
        row.displayPeriod2 = row.period2Balance;
        row.netChange = row.period2Balance - row.period1Balance;
        row.displayNetChange = row.netChange;
        row.growthPercent = growthPercent(rawP2, rawP1);
      }
    }
  }

  const nodes = sortTreeByCodeOrName(buildTree(mapped));
  const sections = normalizeSections(kind).map((section) => {
    const sectionAccounts = nodes.filter((node) => node.ledgerType === section) as CashFlowReviewAccount[];

    const totals = {
      period1: 0,
      period2: 0,
      netChange: 0,
      count: 0,
      rawPeriod1: 0,
      rawPeriod2: 0,
    };

    const walk = (node: CashFlowReviewAccount) => {
      totals.period1 += node.displayPeriod1;
      totals.period2 += node.displayPeriod2;
      totals.netChange += node.displayNetChange;
      totals.rawPeriod1 += node.period1Signed;
      totals.rawPeriod2 += node.period2Signed;
      totals.count += 1;
      node.children.forEach(walk);
    };

    sectionAccounts.forEach(walk);

    return {
      section,
      label: sectionLabel(kind, section),
      accounts: sectionAccounts,
      count: totals.count,
      totalPeriod1: totals.period1,
      totalPeriod2: totals.period2,
      totalNetChange: totals.netChange,
      growthPercent: growthPercent(totals.rawPeriod1, totals.rawPeriod2),
      rawPeriod1: totals.rawPeriod1,
      rawPeriod2: totals.rawPeriod2,
    } satisfies CashFlowReviewSection;
  });

  {
    if (kind === "profit-loss") {
      const [p1Inc, p1Exp, p2Inc, p2Exp, p1Ins, p2Ins] = await Promise.all([
        queryOperationalIncome(period1Start, period1End, branchId),
        queryOperationalExpenditure(period1Start, period1End, branchId),
        queryOperationalIncome(period2Start, period2End, branchId),
        queryOperationalExpenditure(period2Start, period2End, branchId),
        db.insuranceContribution.aggregate({
          where: { type: "CONTRIBUTION", createdAt: { gte: period1Start, lte: period1End }, ...(branchId ? { account: { branchId } } : {}) },
          _sum: { amount: true },
        }),
        db.insuranceContribution.aggregate({
          where: { type: "CONTRIBUTION", createdAt: { gte: period2Start, lte: period2End }, ...(branchId ? { account: { branchId } } : {}) },
          _sum: { amount: true },
        }),
      ]);
      const incomeOperationalP1 = Number(p1Inc._sum.amount || 0) + Number(p1Ins._sum.amount || 0);
      const incomeOperationalP2 = Number(p2Inc._sum.amount || 0) + Number(p2Ins._sum.amount || 0);
      const expenditureOperationalP1 = Number(p1Exp._sum.amount || 0);
      const expenditureOperationalP2 = Number(p2Exp._sum.amount || 0);
      for (const section of sections) {
        if (section.section === "INCOME") {
          section.totalPeriod1 = incomeOperationalP1;
          section.totalPeriod2 = incomeOperationalP2;
          section.rawPeriod1 = incomeOperationalP1;
          section.rawPeriod2 = incomeOperationalP2;
          section.totalNetChange = incomeOperationalP2 - incomeOperationalP1;
          section.growthPercent = growthPercent(incomeOperationalP2, incomeOperationalP1);
        }
        if (section.section === "EXPENDITURES") {
          section.totalPeriod1 = expenditureOperationalP1;
          section.totalPeriod2 = expenditureOperationalP2;
          section.rawPeriod1 = expenditureOperationalP1;
          section.rawPeriod2 = expenditureOperationalP2;
          section.totalNetChange = expenditureOperationalP2 - expenditureOperationalP1;
          section.growthPercent = growthPercent(expenditureOperationalP2, expenditureOperationalP1);
        }
      }
    }
  }

  const totalAccounts = sections.reduce((sum, section) => sum + section.count, 0);
  const totalPeriod1 = sections.reduce((sum, section) => sum + section.totalPeriod1, 0);
  const totalPeriod2 = sections.reduce((sum, section) => sum + section.totalPeriod2, 0);
  const totalNetChange = sections.reduce((sum, section) => sum + section.totalNetChange, 0);
  const rawGrandPeriod1 = sections.reduce((sum, section) => sum + section.rawPeriod1, 0);
  const rawGrandPeriod2 = sections.reduce((sum, section) => sum + section.rawPeriod2, 0);

  return {
    saccoName: REPORT_HEADER_DETAILS.institutionName,
    location: REPORT_HEADER_DETAILS.postalAddress.join(", "),
    reportTitle:
      kind === "balance-sheet" ? "Cash Flow Review Balance Sheet" : "Cash Flow Review Profit And Loss",
    generatedDate: format(generatedAt, "dd/MM/yyyy"),
    generatedTime: format(generatedAt, "HH:mm:ss"),
    generatedAt: generatedAt.toISOString(),
    branch: {
      id: branchId || "all",
      name: await loadBranchName(branchId || null),
    },
    period1: {
      from: format(period1Start, "yyyy-MM-dd"),
      to: format(period1End, "yyyy-MM-dd"),
      label: `${format(period1Start, "dd/MM/yyyy")} to ${format(period1End, "dd/MM/yyyy")}`,
    },
    period2: {
      from: format(period2Start, "yyyy-MM-dd"),
      to: format(period2End, "yyyy-MM-dd"),
      label: `${format(period2Start, "dd/MM/yyyy")} to ${format(period2End, "dd/MM/yyyy")}`,
    },
    sections,
    grandTotal: {
      totalAccounts,
      totalPeriod1,
      totalPeriod2,
      totalNetChange,
      growthPercent: growthPercent(rawGrandPeriod1, rawGrandPeriod2),
    },
    ...(kind === "profit-loss"
      ? {
          profitLoss: {
            profitLoss: totalNetChange,
            label: totalNetChange >= 0 ? "Profit" : "Loss",
          },
        }
      : {}),
  };
}

export async function buildCashFlowReviewWorkbook(report: CashFlowReviewReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = REPORT_HEADER_DETAILS.institutionName;
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Cash Flow Review");
  sheet.views = [{ state: "frozen", ySplit: 10 }];
  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };

  const cols = [
    { header: "Account code and name", key: "account", width: 42 },
    { header: "Period 1 balance", key: "period1", width: 18 },
    { header: "Period 2 balance", key: "period2", width: 18 },
    { header: "Net Change", key: "netChange", width: 18 },
    { header: "% Growth", key: "growth", width: 14 },
  ];
  sheet.columns = cols as any;

  const titleRow = sheet.addRow([report.saccoName]);
  titleRow.font = { bold: true, size: 16 };
  titleRow.alignment = { horizontal: "center" };
  sheet.mergeCells(titleRow.number, 1, titleRow.number, cols.length);

  const locationRow = sheet.addRow([report.location]);
  locationRow.alignment = { horizontal: "center" };
  sheet.mergeCells(locationRow.number, 1, locationRow.number, cols.length);

  const reportRow = sheet.addRow([report.reportTitle]);
  reportRow.font = { bold: true, size: 13 };
  reportRow.alignment = { horizontal: "center" };
  sheet.mergeCells(reportRow.number, 1, reportRow.number, cols.length);

  const periodRow = sheet.addRow([`Period 1: ${report.period1.label}    |    Period 2: ${report.period2.label}`]);
  periodRow.alignment = { horizontal: "center" };
  sheet.mergeCells(periodRow.number, 1, periodRow.number, cols.length);

  const branchRow = sheet.addRow([`Branch: ${report.branch.name}`]);
  branchRow.alignment = { horizontal: "center" };
  sheet.mergeCells(branchRow.number, 1, branchRow.number, cols.length);

  const generatedRow = sheet.addRow([`Generated: ${report.generatedDate} ${report.generatedTime}`]);
  generatedRow.alignment = { horizontal: "right" };
  sheet.mergeCells(generatedRow.number, 1, generatedRow.number, cols.length);

  sheet.addRow([]);

  const headerRow = sheet.addRow([
    "Account code and name",
    "Period 1 balance",
    "Period 2 balance",
    "Net Change",
    "% Growth",
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  const addAccountRows = (accounts: CashFlowReviewAccount[], depth = 0) => {
    for (const account of accounts) {
      const isGroup = account.children.length > 0;
      const row = sheet.addRow([
        `${" ".repeat(depth * 4)}${account.accountCode} ${account.accountName}`,
        isGroup ? "-" : account.displayPeriod1,
        isGroup ? "-" : account.displayPeriod2,
        isGroup ? "-" : account.displayNetChange,
        isGroup ? "-" : `${account.growthPercent.toFixed(2)}%`,
      ]);
      row.getCell(2).numFmt = '#,##0;(#,##0)';
      row.getCell(3).numFmt = '#,##0;(#,##0)';
      row.getCell(4).numFmt = '#,##0;(#,##0)';
      row.alignment = { vertical: "middle" };
      row.getCell(1).alignment = { horizontal: "left", wrapText: true };
      row.getCell(2).alignment = { horizontal: "right" };
      row.getCell(3).alignment = { horizontal: "right" };
      row.getCell(4).alignment = { horizontal: "right" };
      row.getCell(5).alignment = { horizontal: "right" };
      if (isGroup) {
        row.font = { bold: true };
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
      addAccountRows(account.children || [], depth + 1);
    }
  };

  for (const section of report.sections) {
    const sectionRow = sheet.addRow([section.label]);
    sectionRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
    sectionRow.alignment = { horizontal: "left" };
    sheet.mergeCells(sectionRow.number, 1, sectionRow.number, cols.length);

    addAccountRows(section.accounts);

    const totalRow = sheet.addRow([
      `Total - ${section.label}: ${section.count}`,
      section.totalPeriod1,
      section.totalPeriod2,
      section.totalNetChange,
      `${section.growthPercent.toFixed(2)}%`,
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    totalRow.getCell(2).numFmt = '#,##0;(#,##0)';
    totalRow.getCell(3).numFmt = '#,##0;(#,##0)';
    totalRow.getCell(4).numFmt = '#,##0;(#,##0)';
    totalRow.eachCell((cell) => {
      cell.border = { top: { style: "thin" } };
    });
  }

  const grandTotalRow = sheet.addRow([
    "Grand Total",
    report.grandTotal.totalPeriod1,
    report.grandTotal.totalPeriod2,
    report.grandTotal.totalNetChange,
    `${report.grandTotal.growthPercent.toFixed(2)}%`,
  ]);
  grandTotalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  grandTotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  grandTotalRow.getCell(2).numFmt = '#,##0;(#,##0)';
  grandTotalRow.getCell(3).numFmt = '#,##0;(#,##0)';
  grandTotalRow.getCell(4).numFmt = '#,##0;(#,##0)';

  if (report.profitLoss) {
    const profitRow = sheet.addRow([
      report.profitLoss.label,
      "",
      "",
      report.profitLoss.profitLoss,
      "",
    ]);
    profitRow.font = { bold: true };
    profitRow.getCell(4).numFmt = '#,##0;(#,##0)';
    profitRow.getCell(4).alignment = { horizontal: "right" };
  }

  return workbook.xlsx.writeBuffer();
}
