import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";

import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import { getConcentrationBands } from "@/lib/reports/fixed-deposits-report";

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
  role?: string | null;
};

type Band = {
  label: string;
  minAmount: number;
  maxAmount: number | null;
};

type ShareRecord = {
  accountNumber: string;
  memberName: string;
  productCode: string;
  productName: string;
  balance: number;
  openedDate: Date;
  branchName: string;
};

type LoanDeductionSummaryRow = {
  product_code: string;
  product_name: string;
  count: number;
  total_amount: number;
};

const PRODUCT_ORDER = ["300501", "300502", "300503"] as const;
const PRODUCT_NAMES: Record<string, string> = {
  "300501": "AFFILIATE MEMBERS",
  "300502": "ORDINARY MEMBERS",
  "300503": "ASSOCIATE MEMBERS",
};

const DEFAULT_BANDS: Band[] = [
  { label: "0 - 100,000", minAmount: 0, maxAmount: 100000 },
  { label: "100,001 - 500,000", minAmount: 100001, maxAmount: 500000 },
  { label: "500,001 - 120,000,000", minAmount: 500001, maxAmount: 120000000 },
  { label: ">= 120,000,001", minAmount: 120000001, maxAmount: null },
];

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "dd/MM/yyyy");
}

function fmtDateTime(value: Date) {
  return format(value, "dd/MM/yyyy HH:mm:ss");
}

function currency(value: number) {
  return new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));
}

function pct(value: number) {
  return `${value.toFixed(2)}%`;
}

async function resolveBranchScope(user: AuthUserLike, requestedBranchId?: string) {
  const branchFilter = await getBranchFilterForService(user as any, requestedBranchId);
  return branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : null;
}

async function resolveBranchLabel(branchId: string | null, rows: Array<{ branch?: { name?: string | null; location?: string | null } | null }>) {
  if (!branchId) {
    return {
      branchLabel: "All Branches",
      branchLocation: "Kisinga, Kasese District",
    };
  }

  const firstBranch = rows.find((row) => row.branch?.name)?.branch;
  if (firstBranch?.name) {
    return {
      branchLabel: firstBranch.name,
      branchLocation: firstBranch.location || "Kisinga, Kasese District",
    };
  }

  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: { name: true, location: true },
  });

  return {
    branchLabel: branch?.name || "Assigned Branch",
    branchLocation: branch?.location || "Kisinga, Kasese District",
  };
}

function normalizeBalance(value: number) {
  return Number.isFinite(value) ? value : 0;
}

const ACCOUNT_NAME_TO_PRODUCT: Record<string, string> = {
  "affiliate shares": "300501",
  "ordinary shares": "300502",
  "associate shares": "300503",
};

function resolveProductCode(typeName: string): string {
  const key = typeName.toLowerCase().trim();
  return ACCOUNT_NAME_TO_PRODUCT[key] || "";
}

function getProductCode(record: any) {
  const typeName = String(record.accountType?.name || "").trim();
  return resolveProductCode(typeName) || typeName;
}

function getProductName(record: any, code: string) {
  return (
    PRODUCT_NAMES[code] ||
    record.accountType?.name ||
    code
  );
}

function getMemberName(record: any) {
  return (
    record.member?.user?.name?.trim() ||
    [record.member?.surname, record.member?.otherNames].filter(Boolean).join(" ").trim() ||
    record.institution?.institutionName?.trim() ||
    record.accountNumber
  );
}

function bandForBalance(bands: Band[], balance: number) {
  return bands.find((band) => balance >= band.minAmount && (band.maxAmount == null || balance <= band.maxAmount)) || bands[bands.length - 1];
}

function buildBandRows(records: ShareRecord[], bands: Band[]) {
  const totalAccounts = records.length;
  const totalBalance = records.reduce((sum, record) => sum + record.balance, 0);

  return bands.map((band) => {
    const bandRecords = records.filter((record) => bandForBalance(bands, record.balance) === band);
    const accountCount = bandRecords.length;
    const totalBandBalance = bandRecords.reduce((sum, record) => sum + record.balance, 0);

    return {
      band_label: band.label,
      account_count: accountCount,
      account_pct: totalAccounts ? (accountCount / totalAccounts) * 100 : 0,
      total_balance: totalBandBalance,
      balance_pct: totalBalance ? (totalBandBalance / totalBalance) * 100 : 0,
      avg_balance: accountCount ? totalBandBalance / accountCount : 0,
    };
  });
}

function buildTotal(bands: ReturnType<typeof buildBandRows>) {
  const accountCount = bands.reduce((sum, band) => sum + band.account_count, 0);
  const totalBalance = bands.reduce((sum, band) => sum + band.total_balance, 0);
  return {
    account_count: accountCount,
    total_balance: totalBalance,
    avg_balance: accountCount ? totalBalance / accountCount : 0,
  };
}

async function fetchShareAccounts(branchId: string | null, reportDate: Date) {
  // Member share accounts from ShareAccount model
  const memberAccounts = await db.shareAccount.findMany({
    where: {
      status: "ACTIVE",
      openedDate: { lte: reportDate },
      ...(branchId ? { branchId } : {}),
    },
    include: {
      member: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      accountType: true,
      branch: {
        select: {
          name: true,
          location: true,
        },
      },
    },
    orderBy: [{ accountNumber: "asc" }],
  });

  // Institution share accounts from Account model (ShareAccount requires memberId)
  const institutionAccounts = await db.account.findMany({
    where: {
      accountType: { isShareAccount: true },
      institutionId: { not: null },
      status: "ACTIVE",
      openedAt: { lte: reportDate },
      ...(branchId ? { branchId } : {}),
    },
    include: {
      institution: {
        select: {
          institutionName: true,
          institutionPhone: true,
        },
      },
      accountType: true,
      branch: {
        select: {
          name: true,
          location: true,
        },
      },
    },
    orderBy: [{ accountNumber: "asc" }],
  });

  // Normalize institution accounts to match ShareAccount shape
  const normalizedInstitution = institutionAccounts.map((acc) => ({
    ...acc,
    totalValue: acc.balance,
    openedDate: acc.openedAt,
    member: null,
  }));

  return [...memberAccounts, ...normalizedInstitution];
}

function mapShareRecords(accounts: any[], reportDate: Date, excludeNonFinancial: boolean) {
  return accounts
    .map((account) => {
      const productCode = getProductCode(account);
      const balance = normalizeBalance(Number(account.totalValue ?? account.balance ?? 0));
      return {
        accountNumber: account.accountNumber,
        memberName: getMemberName(account),
        productCode,
        productName: getProductName(account, productCode),
        balance,
        openedDate: new Date(account.openedDate || reportDate),
        branchName: account.branch?.name || "All Branches",
      } as ShareRecord;
    })
    .filter((record) => (!excludeNonFinancial ? true : record.balance > 0));
}

export async function getShareConcentrationReport(params: {
  user: AuthUserLike;
  reportDate?: string;
  branchId?: string;
  excludeNonFinancial?: boolean | string;
}) {
  const branchId = await resolveBranchScope(params.user, params.branchId);
  const reportDate = params.reportDate ? parseISO(params.reportDate) : new Date();
  const excludeNonFinancial = params.excludeNonFinancial === undefined
    ? true
    : String(params.excludeNonFinancial).toLowerCase() !== "false";

  const bandsData = await getConcentrationBands();
  const bands = (bandsData.length > 0 ? bandsData : DEFAULT_BANDS).map((band) => ({
    label: band.label,
    minAmount: Number((band as any).minAmount),
    maxAmount: (band as any).maxAmount == null ? null : Number((band as any).maxAmount),
  }));

  const accounts = await fetchShareAccounts(branchId, reportDate);
  const shareRecords = mapShareRecords(accounts, reportDate, excludeNonFinancial);
  const branchMeta = await resolveBranchLabel(branchId, accounts as any[]);

  const loanDeductionTransactions = await db.shareTransaction.findMany({
    where: {
      isReversed: false,
      reference: {
        startsWith: "LN-SHARE-",
      },
      transactionDate: { lte: reportDate },
      account: {
        ...(branchId ? { branchId } : {}),
      },
    },
    include: {
      account: {
        include: {
          accountType: true,
        },
      },
    },
  });

  const recordsByProduct: Array<{ product_code: string; product_name: string; bands: ReturnType<typeof buildBandRows>; total: ReturnType<typeof buildTotal> }> = PRODUCT_ORDER.map((productCode) => {
    const productRecords = shareRecords.filter((record) => record.productCode === productCode);
    const bandRows = buildBandRows(productRecords, bands);
    return {
      product_code: productCode,
      product_name: PRODUCT_NAMES[productCode],
      bands: bandRows,
      total: buildTotal(bandRows),
    };
  });

  const otherRecords = shareRecords.filter((record) => !(PRODUCT_ORDER as readonly string[]).includes(record.productCode));
  if (otherRecords.length > 0) {
    const otherBands = buildBandRows(otherRecords, bands);
    recordsByProduct.push({
      product_code: "OTHER",
      product_name: "Other Share Accounts",
      bands: otherBands,
      total: buildTotal(otherBands),
    });
  }

  const aggregateBands = bands.map((band) => {
    const combined = recordsByProduct.reduce(
      (acc, product) => {
        const row = product.bands.find((item) => item.band_label === band.label);
        if (!row) return acc;
        acc.account_count += row.account_count;
        acc.total_balance += row.total_balance;
        return acc;
      },
      { account_count: 0, total_balance: 0 },
    );
    return {
      band_label: band.label,
      account_count: combined.account_count,
      account_pct: 0,
      total_balance: combined.total_balance,
      balance_pct: 0,
      avg_balance: combined.account_count ? combined.total_balance / combined.account_count : 0,
    };
  });

  const aggregateTotalAccounts = aggregateBands.reduce((sum, band) => sum + band.account_count, 0);
  const aggregateTotalBalance = aggregateBands.reduce((sum, band) => sum + band.total_balance, 0);
  aggregateBands.forEach((band) => {
    band.account_pct = aggregateTotalAccounts ? (band.account_count / aggregateTotalAccounts) * 100 : 0;
    band.balance_pct = aggregateTotalBalance ? (band.total_balance / aggregateTotalBalance) * 100 : 0;
  });

  const loanDeductionSummary: LoanDeductionSummaryRow[] = PRODUCT_ORDER.map((productCode) => {
    const productTx = loanDeductionTransactions.filter((tx) => {
      const txCode = getProductCode(tx.account);
      return txCode === productCode;
    });
    return {
      product_code: productCode,
      product_name: PRODUCT_NAMES[productCode],
      count: productTx.length,
      total_amount: productTx.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    } satisfies LoanDeductionSummaryRow;
  });

  const otherTx = loanDeductionTransactions.filter((tx) => {
    const txCode = getProductCode(tx.account);
    return !(PRODUCT_ORDER as readonly string[]).includes(txCode);
  });
  if (otherTx.length > 0) {
    loanDeductionSummary.push({
      product_code: "OTHER",
      product_name: "Other Share Accounts",
      count: otherTx.length,
      total_amount: otherTx.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    });
  }

  return {
    saccoName: REPORT_HEADER_DETAILS.institutionName,
    branch: branchMeta.branchLabel,
    branchLocation: branchMeta.branchLocation,
    reportTitle: "Shares Concentration Report",
    reportDate: fmtDate(reportDate),
    generatedAt: new Date().toISOString(),
    exclude_non_financial: excludeNonFinancial,
    products: recordsByProduct,
    aggregate: {
      bands: aggregateBands,
      total: {
        account_count: aggregateTotalAccounts,
        total_balance: aggregateTotalBalance,
        avg_balance: aggregateTotalAccounts ? aggregateTotalBalance / aggregateTotalAccounts : 0,
      },
    },
    loan_deduction_summary: {
      total_count: loanDeductionTransactions.length,
      total_amount: loanDeductionTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
      by_product: loanDeductionSummary,
    },
  };
}

function styleHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

function writeShareHeader(sheet: ExcelJS.Worksheet, report: any) {
  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = report.saccoName;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.getCell("F2").value = fmtDateTime(new Date(report.generatedAt || new Date()));
  sheet.getCell("F2").alignment = { horizontal: "right" };

  sheet.mergeCells("A5:E5");
  sheet.getCell("A5").value = report.branch || "";
  sheet.getCell("A5").alignment = { horizontal: "left" };
  sheet.getCell("F5").value = fmtDateTime(new Date(report.generatedAt || new Date()));
  sheet.getCell("F5").alignment = { horizontal: "right" };

  sheet.mergeCells("A8:F8");
  sheet.getCell("A8").value = "Shares Concentration Report";
  sheet.getCell("A8").font = { bold: true, size: 14 };
  sheet.getCell("A8").alignment = { horizontal: "center" };

  sheet.mergeCells("A10:F10");
  sheet.getCell("A10").value = `Reporting Date: ${report.reportDate}`;
  sheet.getCell("A10").alignment = { horizontal: "center" };

  sheet.mergeCells("A12:F12");
  sheet.getCell("A12").value = `Exclude Non-Financial Accounts: ${report.exclude_non_financial ? "Yes" : "No"}`;
  sheet.getCell("A12").alignment = { horizontal: "center" };

  sheet.mergeCells("A14:A17");
  sheet.getCell("A14").value = "Size of Account";
  sheet.getCell("A14").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  sheet.getCell("A14").font = { bold: true };
  sheet.getCell("A14").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

  sheet.mergeCells("B14:C14");
  sheet.getCell("B14").value = "ACCOUNT";
  sheet.getCell("B14").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("B14").font = { bold: true };
  sheet.getCell("B14").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

  sheet.mergeCells("D14:E14");
  sheet.getCell("D14").value = "BALANCE";
  sheet.getCell("D14").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("D14").font = { bold: true };
  sheet.getCell("D14").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

  sheet.mergeCells("F14:F17");
  sheet.getCell("F14").value = "Average Balance";
  sheet.getCell("F14").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  sheet.getCell("F14").font = { bold: true };
  sheet.getCell("F14").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

  sheet.getCell("B17").value = "Account";
  sheet.getCell("C17").value = "Percentage";
  sheet.getCell("D17").value = "Amount";
  sheet.getCell("E17").value = "Percentage";
  ["B17", "C17", "D17", "E17"].forEach((address) => styleHeader(sheet.getCell(address)));
}

function appendProductSection(sheet: ExcelJS.Worksheet, product: any) {
  const sectionRow = sheet.addRow([`${product.product_code} - ${product.product_name}`]);
  sectionRow.font = { bold: true };
  sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  sheet.mergeCells(`A${sectionRow.number}:F${sectionRow.number}`);

  product.bands.forEach((band: any) => {
    const row = sheet.addRow([
      band.band_label,
      band.account_count,
      band.account_pct / 100,
      band.total_balance,
      band.balance_pct / 100,
      band.avg_balance,
    ]);
    row.getCell(2).numFmt = "#,##0";
    row.getCell(3).numFmt = "0.00%";
    row.getCell(4).numFmt = "#,##0";
    row.getCell(5).numFmt = "0.00%";
    row.getCell(6).numFmt = "#,##0.00";
  });

  const totalRow = sheet.addRow([
    "TOTAL",
    product.total.account_count,
    1,
    product.total.total_balance,
    1,
    product.total.avg_balance,
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(2).numFmt = "#,##0";
  totalRow.getCell(3).numFmt = "0.00%";
  totalRow.getCell(4).numFmt = "#,##0";
  totalRow.getCell(5).numFmt = "0.00%";
  totalRow.getCell(6).numFmt = "#,##0.00";
}

export async function buildShareConcentrationWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = REPORT_HEADER_DETAILS.institutionName;
  const sheet = workbook.addWorksheet("Shares Concentration");
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions® 08.45.u",
  };
  sheet.columns = [
    { width: 28 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 12 },
    { width: 16 },
  ];

  writeShareHeader(sheet, report);

  report.products.forEach((product: any) => {
    sheet.addRow([]);
    appendProductSection(sheet, product);
  });

  sheet.addRow([]);
  const aggregateLabelRow = sheet.addRow(["AGGREGATE"]);
  aggregateLabelRow.font = { bold: true };
  aggregateLabelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  sheet.mergeCells(`A${aggregateLabelRow.number}:F${aggregateLabelRow.number}`);

  report.aggregate.bands.forEach((band: any) => {
    const row = sheet.addRow([
      band.band_label,
      band.account_count,
      band.account_pct / 100,
      band.total_balance,
      band.balance_pct / 100,
      band.avg_balance,
    ]);
    row.getCell(2).numFmt = "#,##0";
    row.getCell(3).numFmt = "0.00%";
    row.getCell(4).numFmt = "#,##0";
    row.getCell(5).numFmt = "0.00%";
    row.getCell(6).numFmt = "#,##0.00";
  });

  const aggregateTotal = sheet.addRow([
    "TOTAL",
    report.aggregate.total.account_count,
    1,
    report.aggregate.total.total_balance,
    1,
    report.aggregate.total.avg_balance,
  ]);
  aggregateTotal.font = { bold: true };
  aggregateTotal.getCell(2).numFmt = "#,##0";
  aggregateTotal.getCell(3).numFmt = "0.00%";
  aggregateTotal.getCell(4).numFmt = "#,##0";
  aggregateTotal.getCell(5).numFmt = "0.00%";
  aggregateTotal.getCell(6).numFmt = "#,##0.00";

  if (report.loan_deduction_summary) {
    sheet.addRow([]);
    const loanHeader = sheet.addRow(["LOAN DEDUCTION SUMMARY"]);
    loanHeader.font = { bold: true };
    loanHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    sheet.mergeCells(`A${loanHeader.number}:F${loanHeader.number}`);

    const loanTotals = sheet.addRow([
      "TOTAL",
      report.loan_deduction_summary.total_count,
      "",
      report.loan_deduction_summary.total_amount,
      "",
      "",
    ]);
    loanTotals.font = { bold: true };
    loanTotals.getCell(2).numFmt = "#,##0";
    loanTotals.getCell(4).numFmt = "#,##0";

    report.loan_deduction_summary.by_product.forEach((row: any) => {
      const item = sheet.addRow([
        row.product_code,
        row.count,
        "",
        row.total_amount,
        "",
        row.product_name,
      ]);
      item.getCell(2).numFmt = "#,##0";
      item.getCell(4).numFmt = "#,##0";
    });
  }

  return workbook.xlsx.writeBuffer();
}
