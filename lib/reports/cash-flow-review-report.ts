import { format, parseISO } from "date-fns";
import { AccountLedgerType, UserRole } from "@prisma/client";
import ExcelJS from "exceljs";

import { db } from "@/prisma/db";
import { buildTree, sortTreeByCodeOrName } from "@/lib/category-tree";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import { getDirectBalanceSheetAccounts, getDirectIncomeExpenseAccounts } from "@/lib/reports/direct-source";

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

  // Direct source: read from real tables instead of COA + JournalEntry
  const [directP1, directP2] = kind === "balance-sheet"
    ? await Promise.all([
        getDirectBalanceSheetAccounts(period1End, branchId),
        getDirectBalanceSheetAccounts(period2End, branchId),
      ])
    : await Promise.all([
        getDirectIncomeExpenseAccounts(period1Start, period1End, branchId),
        getDirectIncomeExpenseAccounts(period2Start, period2End, branchId),
      ]);

  const directP1ByCode = new Map(directP1.filter((a) => !a.isGroup).map((a) => [a.accountCode, a]));
  const directP2ByCode = new Map(directP2.filter((a) => !a.isGroup).map((a) => [a.accountCode, a]));

  // Use direct source accounts as the tree skeleton — they already have parentId, isGroup, ledgerType
  // For profit-loss, merge P1 + P2 so accounts active only in P1 still appear
  const directAccounts = kind === "balance-sheet"
    ? directP2
    : [...directP2, ...directP1.filter((a) => !a.isGroup && !directP2ByCode.has(a.accountCode))];

  const mapped = directAccounts
    .filter((a) => a.ledgerType && ledgerTypes.includes(a.ledgerType as AccountLedgerType))
    .map((account) => {
      const direct1 = directP1ByCode.get(account.accountCode);
      const direct2 = directP2ByCode.get(account.accountCode);
      const period1Signed = direct1?.balance || 0;
      const period2Signed = direct2?.balance || 0;
      const displayPeriod1 = displayBalance(account.ledgerType as AccountLedgerType, period1Signed, kind);
      const displayPeriod2 = displayBalance(account.ledgerType as AccountLedgerType, period2Signed, kind);
      const displayNetChange = displayPeriod2 - displayPeriod1;

      return {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        code: account.accountCode,
        name: account.accountName,
        parentId: account.parentId,
        ledgerType: account.ledgerType as AccountLedgerType,
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
    // No operational override needed — tree totals already include all income/expenditure
    // including InsuranceContribution (via getDirectIncomeExpenseAccounts → getDirectIncome)
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
