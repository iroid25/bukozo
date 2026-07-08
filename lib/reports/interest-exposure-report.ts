import ExcelJS from "exceljs";
import { addMonths, differenceInCalendarDays, parseISO } from "date-fns";

import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { db } from "@/prisma/db";
import {
  BRANCH_LABEL,
  SACCO_NAME,
  formatDate,
  formatDateTime,
  formatUGXPlain,
  inferProductCode,
  toNumber,
} from "@/lib/reports/member-ledger-utils";
import { getBranchFilterForService } from "@/lib/services/financial-reports";

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
  role?: string | null;
};

type FixedDepositRow = {
  id: string;
  accountNumber: string;
  memberName: string;
  memberId: string | null;
  trxDate: Date;
  fdNumber: string;
  depositAmount: number;
  accruedDays: number;
  accruedInterest: number;
  interestAtMaturity: number;
  maturityValue: number;
  maturityDate: Date;
  annualRate: number;
  depositPeriodMonths: number;
  depositPeriodLabel: string;
  daysToMaturity: number;
  isOverdue: boolean;
  currentLiabilityProgress: number;
  productCode: string;
};

type FixedDepositSection = {
  product_code: string;
  product_name: string;
  deposits: FixedDepositRow[];
  subtotal: {
    count: number;
    total_principal: number;
    total_accrued_interest: number;
    total_interest_at_maturity: number;
    total_maturity_value: number;
  };
};

export type InterestExposureReport = {
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    report_date: string;
    header_label: string;
  };
  products: FixedDepositSection[];
  grand_total: {
    count: number;
    total_principal: number;
    total_accrued_interest: number;
    total_interest_at_maturity: number;
    total_maturity_value: number;
  };
  exposure_summary: {
    current_liability: number;
    full_liability: number;
    unexpired_interest: number;
    liability_coverage_pct: number;
    overdue_count: number;
    overdue_principal: number;
    overdue_accrued_interest: number;
    total_principal_at_risk: number;
  };
};

export class InterestCalculationService {
  calculateAccruedDays(trxDate: Date | string, reportDate: Date | string) {
    const start = trxDate instanceof Date ? trxDate : parseISO(String(trxDate));
    const end = reportDate instanceof Date ? reportDate : parseISO(String(reportDate));
    return Math.max(differenceInCalendarDays(end, start) + 1, 0);
  }

  calculateAccruedInterest(principal: number, annualRate: number, accruedDays: number) {
    return Math.round(toNumber(principal) * (toNumber(annualRate) / 100) * (toNumber(accruedDays) / 360));
  }

  calculateInterestAtMaturity(principal: number, annualRate: number, periodMonths: number) {
    return Math.round(toNumber(principal) * (toNumber(annualRate) / 100) * (toNumber(periodMonths) / 12));
  }

  calculateMaturityValue(principal: number, interestAtMaturity: number) {
    return Math.round(toNumber(principal) + toNumber(interestAtMaturity));
  }

  calculateMaturityDate(trxDate: Date | string, periodMonths: number) {
    const date = trxDate instanceof Date ? trxDate : parseISO(String(trxDate));
    return addMonths(date, Math.max(0, Number(periodMonths) || 0));
  }
}

const fixedDepositInterest = new InterestCalculationService();

function cleanAccountNumber(value: string) {
  return String(value || "").replace(/\s+/g, "");
}

function depositPeriodLabel(months: number) {
  const safeMonths = Math.max(1, Number(months) || 0);
  return `${safeMonths} Month${safeMonths === 1 ? "" : "s"}`;
}

function deriveFdNumber(accountNumber: string, fallbackId: string) {
  const digits = cleanAccountNumber(accountNumber).replace(/\D/g, "");
  const lastSix = digits.slice(-6);
  if (lastSix.length >= 6) return lastSix.padStart(6, "0");
  return fallbackId.slice(-6).padStart(6, "0");
}

function formatMemberName(record: any) {
  return (
    record.member?.user?.name?.trim() ||
    [record.member?.user?.firstName, record.member?.user?.lastName].filter(Boolean).join(" ").trim() ||
    record.member?.memberNumber ||
    cleanAccountNumber(record.accountNumber)
  );
}

async function resolveBranchMeta(branchId: string | null, rows: any[]) {
  if (!branchId) {
    return {
      branch: BRANCH_LABEL,
    };
  }

  const branch = rows.find((row) => row.branch?.name)?.branch;
  if (branch?.name) {
    return {
      branch: branch.name,
    };
  }

  const branchRow = await db.branch.findUnique({
    where: { id: branchId },
    select: { name: true },
  });

  return {
    branch: branchRow?.name || BRANCH_LABEL,
  };
}

function buildExposureSummary(rows: FixedDepositRow[], grandTotal: InterestExposureReport["grand_total"]) {
  const currentLiability = rows.reduce((sum, row) => sum + row.accruedInterest, 0);
  const fullLiability = rows.reduce((sum, row) => sum + row.interestAtMaturity, 0);
  const overdueRows = rows.filter((row) => row.isOverdue);

  return {
    current_liability: currentLiability,
    full_liability: fullLiability,
    unexpired_interest: Math.max(fullLiability - currentLiability, 0),
    liability_coverage_pct: fullLiability > 0 ? (currentLiability / fullLiability) * 100 : 0,
    overdue_count: overdueRows.length,
    overdue_principal: overdueRows.reduce((sum, row) => sum + row.depositAmount, 0),
    overdue_accrued_interest: overdueRows.reduce((sum, row) => sum + row.accruedInterest, 0),
    total_principal_at_risk: grandTotal.total_principal,
  };
}

function buildRows(records: any[], reportDate: Date, productCode: string): FixedDepositRow[] {
  return records.map((record) => {
    const startDate = new Date(record.startDate);
    const maturityDate = new Date(record.maturityDate);
    const principal = toNumber(record.principalAmount);
    const annualRate = toNumber(record.interestRate);
    const termMonths = Number(record.termMonths || 0);
    const accruedDays = fixedDepositInterest.calculateAccruedDays(startDate, reportDate);
    const accruedInterest = fixedDepositInterest.calculateAccruedInterest(principal, annualRate, accruedDays);
    const interestAtMaturity = fixedDepositInterest.calculateInterestAtMaturity(principal, annualRate, termMonths);
    const maturityValue = fixedDepositInterest.calculateMaturityValue(principal, interestAtMaturity);
    const daysToMaturity = differenceInCalendarDays(maturityDate, reportDate);

    return {
      id: record.id,
      accountNumber: cleanAccountNumber(record.accountNumber),
      memberName: formatMemberName(record),
      memberId: record.memberId || null,
      trxDate: startDate,
      fdNumber: deriveFdNumber(record.accountNumber, record.id),
      depositAmount: principal,
      accruedDays,
      accruedInterest,
      interestAtMaturity,
      maturityValue,
      maturityDate,
      annualRate,
      depositPeriodMonths: termMonths,
      depositPeriodLabel: depositPeriodLabel(termMonths),
      daysToMaturity,
      isOverdue: maturityDate.getTime() < reportDate.getTime(),
      currentLiabilityProgress: interestAtMaturity > 0 ? Math.min(accruedInterest / interestAtMaturity, 1) : 0,
      productCode,
    };
  });
}

export async function buildInterestExposureReport(filters: {
  user: AuthUserLike;
  reportDate?: string;
  productId?: string;
  memberSearch?: string;
  depositPeriod?: string | number;
  maturityFrom?: string;
  maturityTo?: string;
  branchId?: string;
}) : Promise<InterestExposureReport> {
  const branchFilter = await getBranchFilterForService(filters.user, filters.branchId);
  const branchId = branchFilter.branchId && branchFilter.branchId !== "all" && branchFilter.branchId !== "no-branch"
    ? branchFilter.branchId
    : null;
  const reportDate = filters.reportDate ? parseISO(filters.reportDate) : new Date();
  reportDate.setHours(23, 59, 59, 999);

  const targetProduct = filters.productId || "201001";
  if (targetProduct !== "all" && targetProduct !== "201001") {
    const empty = {
      product_code: "201001",
      product_name: "FIXED DEPOSIT SAVINGS",
      deposits: [],
      subtotal: {
        count: 0,
        total_principal: 0,
        total_accrued_interest: 0,
        total_interest_at_maturity: 0,
        total_maturity_value: 0,
      },
    };
    return {
      report_meta: {
        sacco_name: SACCO_NAME,
        branch: BRANCH_LABEL,
        generated_at: new Date().toISOString(),
        report_date: formatDate(reportDate),
        header_label: `Reporting Date From: To: ${formatDate(reportDate)}`,
      },
      products: [empty],
      grand_total: {
        count: 0,
        total_principal: 0,
        total_accrued_interest: 0,
        total_interest_at_maturity: 0,
        total_maturity_value: 0,
      },
      exposure_summary: {
        current_liability: 0,
        full_liability: 0,
        unexpired_interest: 0,
        liability_coverage_pct: 0,
        overdue_count: 0,
        overdue_principal: 0,
        overdue_accrued_interest: 0,
        total_principal_at_risk: 0,
      },
    };
  }

  const maturityDateFilter =
    filters.maturityFrom || filters.maturityTo
      ? {
          ...(filters.maturityFrom ? { gte: parseISO(filters.maturityFrom) } : {}),
          ...(filters.maturityTo ? { lte: parseISO(filters.maturityTo) } : {}),
        }
      : undefined;

  const rows = await db.fixedDeposit.findMany({
    where: {
      status: "ACTIVE",
      startDate: { lte: reportDate },
      ...(branchId ? { branchId } : {}),
      ...(maturityDateFilter ? { maturityDate: maturityDateFilter } : {}),
      ...(filters.memberSearch
        ? {
            OR: [
              { accountNumber: { contains: filters.memberSearch, mode: "insensitive" } },
              { member: { memberNumber: { contains: filters.memberSearch, mode: "insensitive" } } },
              {
                member: {
                  user: {
                    name: { contains: filters.memberSearch, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      member: {
        include: {
          user: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      branch: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ startDate: "asc" }, { accountNumber: "asc" }],
  });

  const cleaned = rows
    .map((record) => ({
      ...record,
      accountNumber: cleanAccountNumber(record.accountNumber),
    }))
    .filter((record) => {
      if (!filters.depositPeriod) return true;
      return Number(record.termMonths) === Number(filters.depositPeriod);
    });

  const deposits = buildRows(cleaned, reportDate, inferProductCode(cleaned[0]?.accountNumber || "201001", "201001"));
  const section: FixedDepositSection = {
    product_code: "201001",
    product_name: "FIXED DEPOSIT SAVINGS",
    deposits,
    subtotal: {
      count: deposits.length,
      total_principal: deposits.reduce((sum, row) => sum + row.depositAmount, 0),
      total_accrued_interest: deposits.reduce((sum, row) => sum + row.accruedInterest, 0),
      total_interest_at_maturity: deposits.reduce((sum, row) => sum + row.interestAtMaturity, 0),
      total_maturity_value: deposits.reduce((sum, row) => sum + row.maturityValue, 0),
    },
  };

  const grandTotal = { ...section.subtotal };
  const exposureSummary = buildExposureSummary(deposits, grandTotal);
  const branchMeta = await resolveBranchMeta(branchId, rows);

  return {
    report_meta: {
      sacco_name: REPORT_HEADER_DETAILS.institutionName,
      branch: branchMeta.branch,
      generated_at: new Date().toISOString(),
      report_date: formatDate(reportDate),
      header_label: `Reporting Date From: To: ${formatDate(reportDate)}`,
    },
    products: [section],
    grand_total: grandTotal,
    exposure_summary: exposureSummary,
  };
}

export async function buildInterestExposureWorkbook(report: InterestExposureReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = SACCO_NAME;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Interest Exposure", {
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.45,
        bottom: 0.45,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  sheet.headerFooter.oddFooter = "Page No.: &P  |  Finance Solutions® 08.45.u";
  sheet.pageSetup.printTitlesRow = "11:11";
  sheet.columns = [
    { width: 15 },
    { width: 24 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 15 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];

  sheet.mergeCells("A1:L1");
  sheet.getCell("A1").value = report.report_meta.sacco_name;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.getCell("L2").value = `Date: ${formatDate(new Date())}`;
  sheet.getCell("L2").alignment = { horizontal: "right" };

  sheet.getCell("L3").value = `Time: ${formatDateTime(new Date()).split(" ").slice(1).join(" ")}`;
  sheet.getCell("L3").alignment = { horizontal: "right" };

  sheet.mergeCells("A5:L5");
  sheet.getCell("A5").value = report.report_meta.branch || BRANCH_LABEL;
  sheet.getCell("A5").alignment = { horizontal: "center" };

  sheet.mergeCells("A8:L8");
  sheet.getCell("A8").value = "Interest Exposure Report";
  sheet.getCell("A8").font = { bold: true, size: 14 };
  sheet.getCell("A8").alignment = { horizontal: "center" };

  sheet.mergeCells("A10:L10");
  sheet.getCell("A10").value = report.report_meta.header_label;
  sheet.getCell("A10").alignment = { horizontal: "center" };

  const headers = sheet.addRow([
    "A/C No.",
    "Name",
    "Trx Date",
    "Deposit No.",
    "Deposit Amount",
    "Accrued Days",
    "Accrued Interest",
    "Interest at Maturity",
    "Maturity Value",
    "Maturity Date",
    "Annual Int. Rate (%)",
    "Deposit Period",
  ]);
  headers.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
    };
  });

  for (const product of report.products) {
    const sectionRow = sheet.addRow([`Product: ${product.product_code} - ${product.product_name}`]);
    sheet.mergeCells(`A${sectionRow.number}:L${sectionRow.number}`);
    sectionRow.font = { bold: true };
    sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

    for (const row of product.deposits) {
      const dataRow = sheet.addRow([
        row.accountNumber,
        row.memberName,
        formatDate(row.trxDate),
        row.fdNumber,
        row.depositAmount,
        `${row.accruedDays} Days`,
        row.accruedInterest,
        row.interestAtMaturity,
        row.maturityValue,
        formatDate(row.maturityDate),
        row.annualRate,
        row.depositPeriodLabel,
      ]);

      dataRow.getCell(5).numFmt = "#,##0";
      dataRow.getCell(6).numFmt = "0";
      dataRow.getCell(7).numFmt = "#,##0";
      dataRow.getCell(8).numFmt = "#,##0";
      dataRow.getCell(9).numFmt = "#,##0";
      dataRow.getCell(11).numFmt = "0.0";
    }

    const subtotal = sheet.addRow([
      `Total: ${product.subtotal.count}`,
      "",
      "",
      "",
      product.subtotal.total_principal,
      "",
      product.subtotal.total_accrued_interest,
      product.subtotal.total_interest_at_maturity,
      product.subtotal.total_maturity_value,
      "",
      "",
      "",
    ]);
    subtotal.font = { bold: true };
    subtotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    subtotal.getCell(5).numFmt = "#,##0";
    subtotal.getCell(7).numFmt = "#,##0";
    subtotal.getCell(8).numFmt = "#,##0";
    subtotal.getCell(9).numFmt = "#,##0";

    const grand = sheet.addRow([
      `Total: ${report.grand_total.count}`,
      "",
      "",
      "",
      report.grand_total.total_principal,
      "",
      report.grand_total.total_accrued_interest,
      report.grand_total.total_interest_at_maturity,
      report.grand_total.total_maturity_value,
      "",
      "",
      "",
    ]);
    grand.font = { bold: true };
    grand.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
    grand.getCell(5).numFmt = "#,##0";
    grand.getCell(7).numFmt = "#,##0";
    grand.getCell(8).numFmt = "#,##0";
    grand.getCell(9).numFmt = "#,##0";

    sheet.addRow([]);
  }

  return workbook.xlsx.writeBuffer();
}
