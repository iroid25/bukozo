import ExcelJS from "exceljs";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
  role?: string | null;
};

type FixedDepositRecord = {
  id: string;
  accountNumber: string;
  memberName: string;
  branchName: string;
  branchLocation: string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  startDate: Date;
  maturityDate: Date;
  maturityAmount: number;
  status: string;
    isWithdrawn: boolean;
    withdrawnDate: Date | null;
    withdrawnAmount: number | null;
    isReversed: boolean;
    reversedDate: Date | null;
    autoRenew: boolean;
    totalInterestRealized: number;
    createdAt: Date;
    updatedAt: Date;
    institutionName: string | null;
  };

type ConcentrationBand = {
  id: string;
  label: string;
  minAmount: number;
  maxAmount: number | null;
  sortOrder: number;
};

const PRODUCT_CODE = "201001";
const PRODUCT_NAME = "FIXED DEPOSIT SAVINGS";
const DEFAULT_REPORT_DATE = new Date();

const DEFAULT_BANDS: Array<Pick<ConcentrationBand, "label" | "minAmount" | "maxAmount" | "sortOrder">> = [
  { label: "0 - 100,000", minAmount: 0, maxAmount: 100000, sortOrder: 1 },
  { label: "100,001 - 500,000", minAmount: 100001, maxAmount: 500000, sortOrder: 2 },
  { label: "500,001 - 120,000,000", minAmount: 500001, maxAmount: 120000000, sortOrder: 3 },
  { label: ">= 120,000,001", minAmount: 120000001, maxAmount: null, sortOrder: 4 },
];

const DEFAULT_MATURITY_ACTIONS = [
  { code: 1, description: "Withdrawal Manually", sortOrder: 1 },
  { code: 2, description: "Transfer to savings account", sortOrder: 2 },
  { code: 3, description: "Transfer interest to savings account & renew principal", sortOrder: 3 },
  { code: 4, description: "Renew principal & interest", sortOrder: 4 },
];

function money(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "dd/MM/yyyy");
}

function fmtIso(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "yyyy-MM-dd");
}

function toEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function fmtDateTime(value: Date) {
  return format(value, "dd/MM/yyyy HH:mm:ss");
}

function pct(value: number) {
  return `${value.toFixed(2)}%`;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));
}

function getMemberName(record: any) {
  return (
    record.member?.user?.name?.trim() ||
    [record.member?.user?.firstName, record.member?.user?.lastName].filter(Boolean).join(" ").trim() ||
    record.institution?.institutionName ||
    record.accountNumber
  );
}

function deriveActionCode(record: FixedDepositRecord) {
  if (record.isWithdrawn) return 1;
  if (record.autoRenew && record.totalInterestRealized > 0) return 4;
  if (record.autoRenew) return 3;
  return 2;
}

function deriveDepositPeriod(record: FixedDepositRecord) {
  const months = Math.max(1, record.termMonths || 0);
  return `${months} Month${months === 1 ? "" : "s"}`;
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

async function ensureFixedDepositConfig() {
  try {
    await db.$executeRawUnsafe(`
      INSERT INTO "ConcentrationBand" ("id", "label", "minAmount", "maxAmount", "sortOrder", "isActive")
      VALUES
        ${DEFAULT_BANDS.map((band) => `('${crypto.randomUUID()}', '${band.label.replaceAll("'", "''")}', ${band.minAmount}, ${band.maxAmount === null ? "NULL" : band.maxAmount}, ${band.sortOrder}, TRUE)`).join(",\n        ")}
      ON CONFLICT ("label") DO NOTHING
    `);

    await db.$executeRawUnsafe(`
      INSERT INTO "MaturityAction" ("code", "description", "sortOrder", "isActive")
      VALUES
        ${DEFAULT_MATURITY_ACTIONS.map((action) => `(${action.code}, '${action.description.replaceAll("'", "''")}', ${action.sortOrder}, TRUE)`).join(",\n        ")}
      ON CONFLICT ("code") DO NOTHING
    `);
  } catch {
    // If the tables are not present yet or the dev server is still catching up,
    // fall back to the in-memory defaults below.
  }
}

export async function getConcentrationBands() {
  await ensureFixedDepositConfig();
  try {
    const bands = await db.$queryRawUnsafe<Array<{
      id: string;
      label: string;
      minAmount: number;
      maxAmount: number | null;
      sortOrder: number;
    }>>(`
      SELECT "id", "label", "minAmount", "maxAmount", "sortOrder"
      FROM "ConcentrationBand"
      WHERE "isActive" = TRUE
      ORDER BY "sortOrder" ASC, "minAmount" ASC
    `);

    return bands.length > 0
      ? bands
      : DEFAULT_BANDS.map((band, index) => ({ id: String(index), ...band }));
  } catch {
    return DEFAULT_BANDS.map((band, index) => ({ id: String(index), ...band }));
  }
}

async function getMaturityActions() {
  await ensureFixedDepositConfig();
  try {
    const actions = await db.$queryRawUnsafe<Array<{
      code: number;
      description: string;
      sortOrder: number;
    }>>(`
      SELECT "code", "description", "sortOrder"
      FROM "MaturityAction"
      WHERE "isActive" = TRUE
      ORDER BY "sortOrder" ASC
    `);

    return new Map(actions.map((action) => [action.code, action.description] as const));
  } catch {
    return new Map(DEFAULT_MATURITY_ACTIONS.map((action) => [action.code, action.description] as const));
  }
}

async function fetchDeposits(branchId: string | null, where: any) {
  return db.fixedDeposit.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      isReversed: false,
      ...where,
    },
    include: {
      member: {
        include: {
          user: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
              phone: true,
              nationalId: true,
              address: true,
            },
          },
        },
      },
      institution: {
        select: {
          institutionName: true,
        },
      },
      branch: {
        select: {
          name: true,
          location: true,
        },
      },
    },
    orderBy: [{ startDate: "asc" }, { accountNumber: "asc" }],
  });
}

function shapeRecord(record: any): FixedDepositRecord {
  return {
    id: record.id,
    accountNumber: record.accountNumber,
    memberName: getMemberName(record),
    branchName: record.branch?.name || "All Branches",
    branchLocation: record.branch?.location || "Kisinga, Kasese District",
    principalAmount: money(record.principalAmount),
    interestRate: money(record.interestRate),
    termMonths: Number(record.termMonths || 0),
    startDate: new Date(record.startDate),
    maturityDate: new Date(record.maturityDate),
    maturityAmount: money(record.maturityAmount),
    status: String(record.status || ""),
    isWithdrawn: Boolean(record.isWithdrawn),
    withdrawnDate: record.withdrawnDate ? new Date(record.withdrawnDate) : null,
    withdrawnAmount: record.withdrawnAmount == null ? null : money(record.withdrawnAmount),
    isReversed: Boolean(record.isReversed),
    reversedDate: record.reversedDate ? new Date(record.reversedDate) : null,
    autoRenew: Boolean(record.autoRenew),
    totalInterestRealized: money(record.totalInterestRealized),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    institutionName: record.institution?.institutionName || null,
  };
}

function bandForBalance(bands: Array<{ label: string; minAmount: number; maxAmount: number | null }>, balance: number) {
  return bands.find((band) => balance >= band.minAmount && (band.maxAmount == null || balance <= band.maxAmount)) || bands[bands.length - 1];
}

function buildConcentrationSections(records: FixedDepositRecord[], bands: Array<{ label: string; minAmount: number; maxAmount: number | null }>) {
  const sectionRecords = records.map((record) => ({
    ...record,
    balance: record.principalAmount,
  }));

  const totalAccounts = sectionRecords.length;
  const totalBalance = sectionRecords.reduce((sum, record) => sum + record.balance, 0);

  const bandRows = bands.map((band) => {
    const rows = sectionRecords.filter((record) => bandForBalance(bands, record.balance) === band);
    const accountCount = rows.length;
    const bandBalance = rows.reduce((sum, record) => sum + record.balance, 0);
    return {
      label: band.label,
      minAmount: band.minAmount,
      maxAmount: band.maxAmount,
      accountCount,
      accountPct: totalAccounts ? (accountCount / totalAccounts) * 100 : 0,
      totalBalance: bandBalance,
      balancePct: totalBalance ? (bandBalance / totalBalance) * 100 : 0,
      averageBalance: accountCount ? bandBalance / accountCount : 0,
    };
  });

  const sectionTotal = {
    accountCount: totalAccounts,
    accountPct: 100,
    totalBalance,
    balancePct: 100,
    averageBalance: totalAccounts ? totalBalance / totalAccounts : 0,
  };

  return {
    productCode: PRODUCT_CODE,
    productName: PRODUCT_NAME,
    bands: bandRows,
    total: sectionTotal,
  };
}

function buildListingSections(records: FixedDepositRecord[], actionMap: Map<number, string>) {
  const totalRecords = records.length;
  const totalDeposit = records.reduce((sum, record) => sum + record.principalAmount, 0);
  const totalInterest = records.reduce((sum, record) => sum + (record.maturityAmount - record.principalAmount), 0);
  const totalMaturity = records.reduce((sum, record) => sum + record.maturityAmount, 0);

  const rows = records.map((record) => {
    const actionCode = deriveActionCode(record);
    return {
      id: record.id,
      accountNumber: record.accountNumber,
      memberName: record.memberName,
      sessionDate: fmtIso(record.createdAt),
      trxDate: fmtIso(record.startDate),
      fdNumber: record.accountNumber.replace(/\D/g, "").slice(-6).padStart(6, "0") || record.id.slice(-6),
      depositAmount: record.principalAmount,
      interestAmount: record.maturityAmount - record.principalAmount,
      maturityValue: record.maturityAmount,
      maturityDate: fmtIso(record.maturityDate),
      annualRate: record.interestRate,
      depositPeriod: deriveDepositPeriod(record),
      atMaturityCode: actionCode,
      atMaturityLabel: actionMap.get(actionCode) || "Transfer to savings account",
      branchName: record.branchName,
    };
  });

  return {
    productCode: PRODUCT_CODE,
    productName: PRODUCT_NAME,
    records: rows,
    subtotal: {
      count: totalRecords,
      depositAmount: totalDeposit,
      interestAmount: totalInterest,
      maturityValue: totalMaturity,
    },
  };
}

function buildWithdrawnSections(records: FixedDepositRecord[]) {
  const totalRecords = records.length;
  const totalDeposit = records.reduce((sum, record) => sum + record.principalAmount, 0);
  const totalInterestPaid = records.reduce((sum, record) => sum + Math.max(0, (record.withdrawnAmount ?? record.maturityAmount) - record.principalAmount), 0);
  const totalPaid = records.reduce((sum, record) => sum + (record.withdrawnAmount ?? record.maturityAmount), 0);

  const rows = records.map((record) => {
    const payout = record.withdrawnAmount ?? record.maturityAmount;
    const interestPaid = Math.max(0, payout - record.principalAmount);
    const withdrawalDate = record.withdrawnDate || record.updatedAt;
    const early = withdrawalDate.getTime() < record.maturityDate.getTime();

    return {
      id: record.id,
      accountNumber: record.accountNumber,
      memberName: record.memberName,
      sessionDate: fmtIso(record.updatedAt),
      trxDate: fmtIso(withdrawalDate),
      fdNumber: record.accountNumber.replace(/\D/g, "").slice(-6).padStart(6, "0") || record.id.slice(-6),
      depositAmount: record.principalAmount,
      interestPaid,
      totalPaid: payout,
      maturityDate: fmtIso(record.maturityDate),
      annualRate: record.interestRate,
      depositPeriod: deriveDepositPeriod(record),
      isEarlyWithdrawal: early,
      branchName: record.branchName,
    };
  });

  return {
    productCode: PRODUCT_CODE,
    productName: PRODUCT_NAME,
    records: rows,
    subtotal: {
      count: totalRecords,
      depositAmount: totalDeposit,
      interestPaid: totalInterestPaid,
      totalPaid,
    },
  };
}

function buildMaturingSections(
  records: FixedDepositRecord[],
  actionMap: Map<number, string>,
  referenceDate: Date,
) {
  const rows = records
    .slice()
    .sort((a, b) => a.maturityDate.getTime() - b.maturityDate.getTime() || a.accountNumber.localeCompare(b.accountNumber))
    .map((record) => {
      const actionCode = deriveActionCode(record);
      const daysToMaturity = differenceInCalendarDays(record.maturityDate, referenceDate);
      const urgency = daysToMaturity <= 7 ? "red" : daysToMaturity <= 30 ? "amber" : "green";
      const totalInterest = record.maturityAmount - record.principalAmount;

      return {
        id: record.id,
        accountNumber: record.accountNumber,
        memberName: record.memberName,
        sessionDate: fmtIso(record.createdAt),
        trxDate: fmtIso(record.startDate),
        fdNumber: record.accountNumber.replace(/\D/g, "").slice(-6).padStart(6, "0") || record.id.slice(-6),
        depositAmount: record.principalAmount,
        totalInterest,
        maturityValue: record.maturityAmount,
        maturityDate: fmtIso(record.maturityDate),
        annualRate: record.interestRate,
        depositPeriod: deriveDepositPeriod(record),
        atMaturityCode: actionCode,
        atMaturityLabel: actionMap.get(actionCode) || "Transfer to savings account",
        daysToMaturity,
        urgency,
        branchName: record.branchName,
      };
    });

  const depositAmount = rows.reduce((sum, row) => sum + row.depositAmount, 0);
  const totalInterest = rows.reduce((sum, row) => sum + row.totalInterest, 0);
  const maturityValue = rows.reduce((sum, row) => sum + row.maturityValue, 0);

  return {
    productCode: PRODUCT_CODE,
    productName: PRODUCT_NAME,
    records: rows,
    subtotal: {
      count: rows.length,
      depositAmount,
      totalInterest,
      maturityValue,
    },
  };
}

export async function getFixedDepositConcentrationReport(params: {
  user: AuthUserLike;
  reportDate?: string;
  branchId?: string;
}) {
  const branchId = await resolveBranchScope(params.user, params.branchId);
  const reportDate = params.reportDate ? parseISO(params.reportDate) : DEFAULT_REPORT_DATE;
  const bands = await getConcentrationBands();

  const rows = await fetchDeposits(branchId, {
    status: "ACTIVE",
    startDate: { lte: reportDate },
  });

  const deposits = rows.map(shapeRecord).filter((record) => record.principalAmount >= 0);
  const section = buildConcentrationSections(deposits, bands);
  const branchMeta = await resolveBranchLabel(branchId, rows);

  return {
    saccoName: REPORT_HEADER_DETAILS.institutionName,
    branch: branchMeta.branchLabel,
    branchLocation: branchMeta.branchLocation,
    reportTitle: "Fixed Deposits Concentration Report",
    reportDate: fmtIso(reportDate),
    generatedAt: new Date().toISOString(),
    sections: [section],
    grandTotal: section.total,
  };
}

export async function getFixedDepositListingReport(params: {
  user: AuthUserLike;
  fromDate?: string;
  toDate?: string;
  branchId?: string;
  memberId?: string;
  memberSearch?: string;
  status?: string;
}) {
  const branchId = await resolveBranchScope(params.user, params.branchId);
  const fromDate = params.fromDate ? parseISO(params.fromDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const toDate = toEndOfDay(params.toDate ? parseISO(params.toDate) : new Date());
  const actionMap = await getMaturityActions();

  const rows = await fetchDeposits(branchId, {
    status: params.status || "ACTIVE",
    startDate: { gte: fromDate, lte: toDate },
    ...(params.memberId ? { memberId: params.memberId } : {}),
  });

  const searchTerm = params.memberSearch?.trim().toLowerCase() || "";
  const deposits = rows
    .map(shapeRecord)
    .filter((record) => {
      if (!searchTerm) return true;
      return [
        record.accountNumber,
        record.memberName,
      ].some((value) => value.toLowerCase().includes(searchTerm));
    });
  const section = buildListingSections(deposits, actionMap);
  const grandTotal = section.subtotal;
  const branchMeta = await resolveBranchLabel(branchId, rows);

  return {
    saccoName: REPORT_HEADER_DETAILS.institutionName,
    branch: branchMeta.branchLabel,
    branchLocation: branchMeta.branchLocation,
    reportTitle: "Fixed Deposit Listings",
    reportDate: fmtIso(toDate),
    generatedAt: new Date().toISOString(),
    dateRange: { from: fmtIso(fromDate), to: fmtIso(toDate) },
    sections: [section],
    grandTotal,
    legend: DEFAULT_MATURITY_ACTIONS.map((action) => `${action.code} - ${action.description}`),
  };
}

export async function getFixedDepositWithdrawnReport(params: {
  user: AuthUserLike;
  fromDate?: string;
  toDate?: string;
  branchId?: string;
  memberId?: string;
  memberSearch?: string;
}) {
  const branchId = await resolveBranchScope(params.user, params.branchId);
  const fromDate = params.fromDate ? parseISO(params.fromDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const toDate = toEndOfDay(params.toDate ? parseISO(params.toDate) : new Date());

  const rows = await fetchDeposits(branchId, {
    status: { in: ["WITHDRAWN", "MATURED"] },
    withdrawnDate: { gte: fromDate, lte: toDate },
    ...(params.memberId ? { memberId: params.memberId } : {}),
  });

  const searchTerm = params.memberSearch?.trim().toLowerCase() || "";
  const deposits = rows
    .map(shapeRecord)
    .filter((record) => {
      if (!searchTerm) return true;
      return [
        record.accountNumber,
        record.memberName,
      ].some((value) => value.toLowerCase().includes(searchTerm));
    });
  const section = buildWithdrawnSections(deposits);
  const branchMeta = await resolveBranchLabel(branchId, rows);

  return {
    saccoName: REPORT_HEADER_DETAILS.institutionName,
    branch: branchMeta.branchLabel,
    branchLocation: branchMeta.branchLocation,
    reportTitle: "Fixed Deposits Withdrawn Report",
    reportDate: fmtIso(toDate),
    generatedAt: new Date().toISOString(),
    dateRange: { from: fmtIso(fromDate), to: fmtIso(toDate) },
    sections: [section],
    grandTotal: section.subtotal,
  };
}

export async function getUpcomingMaturingFixedDepositsReport(params: {
  user: AuthUserLike;
  fromDate?: string;
  toDate?: string;
  branchId?: string;
  memberId?: string;
  memberSearch?: string;
  productId?: string;
  atMaturityCode?: string | number;
  daysToMaturity?: string | number;
}) {
  const branchId = await resolveBranchScope(params.user, params.branchId);
  const today = new Date();
  const defaultTo = new Date(today);
  defaultTo.setDate(defaultTo.getDate() + 30);

  const fromDate = params.fromDate ? parseISO(params.fromDate) : today;
  const toDate = toEndOfDay(
    params.toDate
      ? parseISO(params.toDate)
      : params.daysToMaturity != null
        ? new Date(today.getTime() + Number(params.daysToMaturity || 30) * 24 * 60 * 60 * 1000)
        : defaultTo,
  );

  const actionMap = await getMaturityActions();
  const rows = await fetchDeposits(branchId, {
    status: "ACTIVE",
    maturityDate: { gte: fromDate, lte: toDate },
    ...(params.memberId ? { memberId: params.memberId } : {}),
  });

  const searchTerm = params.memberSearch?.trim().toLowerCase() || "";
  const desiredProductId = params.productId?.trim() || "";
  const desiredActionCode = params.atMaturityCode != null && params.atMaturityCode !== ""
    ? Number(params.atMaturityCode)
    : null;

  const deposits = rows
    .map(shapeRecord)
    .filter((record) => {
      if (desiredProductId && desiredProductId !== PRODUCT_CODE) return false;
      if (desiredActionCode != null && deriveActionCode(record) !== desiredActionCode) return false;
      if (!searchTerm) return true;
      return [record.accountNumber, record.memberName].some((value) => value.toLowerCase().includes(searchTerm));
    });

  const section = buildMaturingSections(deposits, actionMap, today);
  const summaryByAction = deposits.reduce((acc, record) => {
    const code = deriveActionCode(record);
    if (!acc[code]) {
      acc[code] = {
        code,
        label: actionMap.get(code) || "Transfer to savings account",
        count: 0,
        depositAmount: 0,
        totalInterest: 0,
        maturityValue: 0,
      };
    }

    acc[code].count += 1;
    acc[code].depositAmount += record.principalAmount;
    acc[code].totalInterest += record.maturityAmount - record.principalAmount;
    acc[code].maturityValue += record.maturityAmount;
    return acc;
  }, {} as Record<number, { code: number; label: string; count: number; depositAmount: number; totalInterest: number; maturityValue: number }>);

  const branchMeta = await resolveBranchLabel(branchId, rows);

  return {
    saccoName: REPORT_HEADER_DETAILS.institutionName,
    branch: branchMeta.branchLabel,
    branchLocation: branchMeta.branchLocation,
    reportTitle: "Upcoming Maturing Fixed Deposits",
    reportDate: fmtIso(toDate),
    generatedAt: new Date().toISOString(),
    dateRange: { from: fmtIso(fromDate), to: fmtIso(toDate) },
    summary: {
      total_count: section.subtotal.count,
      total_deposit: section.subtotal.depositAmount,
      total_interest: section.subtotal.totalInterest,
      total_maturity_value: section.subtotal.maturityValue,
      by_action_code: summaryByAction,
    },
    products: [section],
    grand_total: {
      count: section.subtotal.count,
      deposit: section.subtotal.depositAmount,
      interest: section.subtotal.totalInterest,
      maturity_value: section.subtotal.maturityValue,
    },
    legend: DEFAULT_MATURITY_ACTIONS.map((action) => `${action.code} - ${action.description}`),
  };
}

function writeHeader(sheet: ExcelJS.Worksheet, title: string, branch: string, reportDate: string, periodLabel: string) {
  sheet.mergeCells("A1:L1");
  sheet.getCell("A1").value = REPORT_HEADER_DETAILS.institutionName;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.mergeCells("A2:L2");
  sheet.getCell("A2").value = branch;
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.getCell("L3").value = reportDate;
  sheet.getCell("L3").alignment = { horizontal: "right" };

  sheet.mergeCells("A4:L4");
  sheet.getCell("A4").value = title;
  sheet.getCell("A4").font = { bold: true, size: 14 };
  sheet.getCell("A4").alignment = { horizontal: "center" };

  sheet.mergeCells("A5:L5");
  sheet.getCell("A5").value = periodLabel;
  sheet.getCell("A5").alignment = { horizontal: "center" };
}

function styleBandHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF8" } };
}

export async function buildFixedDepositConcentrationWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = REPORT_HEADER_DETAILS.institutionName;
  const sheet = workbook.addWorksheet("Fixed Concentration");
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions®",
  };
  sheet.columns = [
    { width: 28 },
    { width: 14 },
    { width: 12 },
    { width: 16 },
    { width: 12 },
    { width: 16 },
  ];

  writeHeader(
    sheet,
    "Fixed Deposits Concentration Report",
    report.branchLocation ? `${report.branch} - ${report.branchLocation}` : report.branch,
    fmtDateTime(new Date(report.generatedAt || new Date())),
    `Reporting Date: ${fmtDate(report.reportDate)}`
  );

  sheet.addRow(["Size of Account", "Account (count)", "Account %", "Balance Amount", "Balance %", "Average Balance"]);
  styleBandHeader(sheet.lastRow as ExcelJS.Row);

  const section = report.sections?.[0];
  section?.bands?.forEach((band: any) => {
    const row = sheet.addRow([
      band.label,
      band.accountCount,
      band.accountPct / 100,
      band.totalBalance,
      band.balancePct / 100,
      band.averageBalance,
    ]);
    row.getCell(2).numFmt = "#,##0";
    row.getCell(3).numFmt = "0.00%";
    row.getCell(4).numFmt = "#,##0";
    row.getCell(5).numFmt = "0.00%";
    row.getCell(6).numFmt = "#,##0.00";
  });

  const totalRow = sheet.addRow([
    "TOTAL",
    section?.total?.accountCount || 0,
    1,
    section?.total?.totalBalance || 0,
    1,
    section?.total?.averageBalance || 0,
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(2).numFmt = "#,##0";
  totalRow.getCell(3).numFmt = "0.00%";
  totalRow.getCell(4).numFmt = "#,##0";
  totalRow.getCell(5).numFmt = "0.00%";
  totalRow.getCell(6).numFmt = "#,##0.00";

  return workbook.xlsx.writeBuffer();
}

export async function buildFixedDepositListingWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = REPORT_HEADER_DETAILS.institutionName;
  const sheet = workbook.addWorksheet("Fixed Deposit Listings");
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions®",
  };
  sheet.columns = [
    { width: 16 },
    { width: 24 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
    { width: 18 },
  ];

  writeHeader(
    sheet,
    "Fixed Deposit Listings",
    report.branchLocation ? `${report.branch} - ${report.branchLocation}` : report.branch,
    fmtDateTime(new Date(report.generatedAt || new Date())),
    `Reporting Date From: ${fmtDate(report.dateRange?.from)} To: ${fmtDate(report.dateRange?.to)}`
  );

  sheet.addRow([
    "A/C No.",
    "Name",
    "Session Date",
    "Trx Date",
    "Fixed Deposit No.",
    "Deposit Amount",
    "Interest Amount",
    "Maturity Value",
    "Maturity Date",
    "Annual Int. Rate (%)",
    "Deposit Period",
    "Transaction at Maturity",
  ]);
  styleBandHeader(sheet.lastRow as ExcelJS.Row);

  const section = report.sections?.[0];
  section?.records?.forEach((record: any) => {
    const row = sheet.addRow([
      record.accountNumber,
      record.memberName,
      record.sessionDate,
      record.trxDate,
      record.fdNumber,
      record.depositAmount,
      record.interestAmount,
      record.maturityValue,
      record.maturityDate,
      record.annualRate,
      record.depositPeriod,
      record.atMaturityCode,
    ]);
    row.getCell(6).numFmt = "#,##0";
    row.getCell(7).numFmt = "#,##0";
    row.getCell(8).numFmt = "#,##0";
    row.getCell(10).numFmt = "0.00";
  });

  const subtotal = sheet.addRow([
    "TOTAL",
    `${section?.subtotal?.count || 0} records`,
    "",
    "",
    "",
    section?.subtotal?.depositAmount || 0,
    section?.subtotal?.interestAmount || 0,
    section?.subtotal?.maturityValue || 0,
  ]);
  subtotal.font = { bold: true };
  subtotal.getCell(6).numFmt = "#,##0";
  subtotal.getCell(7).numFmt = "#,##0";
  subtotal.getCell(8).numFmt = "#,##0";

  sheet.addRow([]);
  sheet.addRow(["Transaction at maturity: 1 - Withdrawal Manually, 2 - Transfer to savings account, 3 - Transfer interest to savings account & renew principal, 4 - Renew principal & interest"]);
  sheet.lastRow!.alignment = { wrapText: true };

  return workbook.xlsx.writeBuffer();
}

export async function buildFixedDepositWithdrawnWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = REPORT_HEADER_DETAILS.institutionName;
  const sheet = workbook.addWorksheet("Fixed Deposits Withdrawn");
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions®",
  };
  sheet.columns = [
    { width: 16 },
    { width: 24 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
  ];

  writeHeader(
    sheet,
    "Fixed Deposits Withdrawn Report",
    report.branchLocation ? `${report.branch} - ${report.branchLocation}` : report.branch,
    fmtDateTime(new Date(report.generatedAt || new Date())),
    `Reporting Date From: ${fmtDate(report.dateRange?.from)} To: ${fmtDate(report.dateRange?.to)}`
  );

  sheet.addRow([
    "A/C No.",
    "Name",
    "Session Date",
    "Trx Date",
    "Fixed Deposit No.",
    "Deposit Amount",
    "Interest Paid",
    "Total Paid",
    "Maturity Date",
    "Annual Int. Rate %",
    "Deposit Period",
  ]);
  styleBandHeader(sheet.lastRow as ExcelJS.Row);

  const section = report.sections?.[0];
  section?.records?.forEach((record: any) => {
    const row = sheet.addRow([
      record.accountNumber,
      record.memberName,
      record.sessionDate,
      record.trxDate,
      record.fdNumber,
      record.depositAmount,
      record.interestPaid,
      record.totalPaid,
      record.maturityDate,
      record.annualRate,
      record.depositPeriod,
    ]);
    row.getCell(6).numFmt = "#,##0";
    row.getCell(7).numFmt = "#,##0";
    row.getCell(8).numFmt = "#,##0";
    row.getCell(10).numFmt = "0.00";
  });

  const subtotal = sheet.addRow([
    "TOTAL",
    `${section?.subtotal?.count || 0} records`,
    "",
    "",
    "",
    section?.subtotal?.depositAmount || 0,
    section?.subtotal?.interestPaid || 0,
    section?.subtotal?.totalPaid || 0,
  ]);
  subtotal.font = { bold: true };
  subtotal.getCell(6).numFmt = "#,##0";
  subtotal.getCell(7).numFmt = "#,##0";
  subtotal.getCell(8).numFmt = "#,##0";

  return workbook.xlsx.writeBuffer();
}

function styleMaturingHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

export async function buildFixedDepositMaturingWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = REPORT_HEADER_DETAILS.institutionName;
  const sheet = workbook.addWorksheet("FD Maturing");
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions®",
  };
  sheet.columns = [
    { width: 16 },
    { width: 24 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
  ];

  sheet.mergeCells("A1:L1");
  sheet.getCell("A1").value = REPORT_HEADER_DETAILS.institutionName;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.mergeCells("A2:L2");
  sheet.getCell("A2").value = report.branch || "";
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.getCell("L3").value = fmtDateTime(new Date(report.generatedAt || new Date()));
  sheet.getCell("L3").alignment = { horizontal: "right" };

  sheet.mergeCells("A5:L5");
  sheet.getCell("A5").value = report.branchLocation || "KISINGA Kasese District";
  sheet.getCell("A5").alignment = { horizontal: "center" };

  sheet.mergeCells("A8:L8");
  sheet.getCell("A8").value = "Upcoming Maturing Fixed Deposits";
  sheet.getCell("A8").font = { bold: true, size: 14 };
  sheet.getCell("A8").alignment = { horizontal: "center" };

  sheet.mergeCells("A10:L10");
  sheet.getCell("A10").value = `Reporting Date From: ${fmtDate(report.dateRange?.from)} To: ${fmtDate(report.dateRange?.to)}`;
  sheet.getCell("A10").alignment = { horizontal: "center" };

  sheet.addRow([
    "A/C No.",
    "Name",
    "Session Date",
    "Trx Date",
    "Fixed Deposit No.",
    "Deposit Amount",
    "Total Interest",
    "Maturity Value",
    "Maturity Date",
    "Annual Int. Rate (%)",
    "Deposit Period",
    "Transaction at Maturity",
  ]);
  sheet.lastRow!.eachCell((cell) => styleMaturingHeader(cell));

  const section = report.products?.[0];
  if (section) {
    const sectionRow = sheet.addRow([`${section.productCode} - ${section.productName}`]);
    sectionRow.font = { bold: true };
    sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    sheet.mergeCells(`A${sectionRow.number}:L${sectionRow.number}`);

    section.records.forEach((record: any) => {
      const row = sheet.addRow([
        record.accountNumber,
        record.memberName,
        record.sessionDate,
        record.trxDate,
        record.fdNumber,
        record.depositAmount,
        record.totalInterest,
        record.maturityValue,
        record.maturityDate,
        record.annualRate,
        record.depositPeriod,
        record.atMaturityCode,
      ]);
      row.getCell(1).alignment = { wrapText: true };
      row.getCell(2).alignment = { wrapText: true };
      row.getCell(6).numFmt = "#,##0";
      row.getCell(7).numFmt = "#,##0";
      row.getCell(8).numFmt = "#,##0";
      row.getCell(10).numFmt = "0.0";
    });

    const totalRow = sheet.addRow([
      "TOTAL",
      `${section.subtotal.count || 0} records`,
      "",
      "",
      "",
      section.subtotal.depositAmount || 0,
      section.subtotal.totalInterest || 0,
      section.subtotal.maturityValue || 0,
    ]);
    totalRow.font = { bold: true };
    totalRow.getCell(6).numFmt = "#,##0";
    totalRow.getCell(7).numFmt = "#,##0";
    totalRow.getCell(8).numFmt = "#,##0";
  }

  sheet.addRow([]);
  sheet.addRow([
    "Transaction at maturity: 1 - Withdrawal Manually, 2 - Transfer to savings account, 3 - Transfer interest to savings account & renew principal, 4 - Renew principal & interest",
  ]);
  sheet.lastRow!.alignment = { wrapText: true };

  return workbook.xlsx.writeBuffer();
}
