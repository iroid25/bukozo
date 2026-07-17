import ExcelJS from "exceljs";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
  role?: string | null;
};

type DormancyThresholds = {
  recentlyActiveDays: number;
  moderatelyIdleDays: number;
  inactiveDays: number;
  dormantDays: number;
};

type ShareAccountRow = {
  accountId: string;
  accountNumber: string;
  memberName: string;
  bvnTin: string | null;
  refNo: number | null;
  lastTrxDate: Date;
  daysWithoutActivity: number;
  dateOpened: Date;
  currentBalance: number;
  status: string;
  phone: string;
  batchNumber: number | null;
  productCode: string;
  productName: string;
  branchName: string;
};

const PRODUCT_ORDER = ["300501", "300502", "300503"] as const;
const PRODUCT_NAMES: Record<string, string> = {
  "300501": "AFFILIATE MEMBERS",
  "300502": "ORDINARY MEMBERS",
  "300503": "ASSOCIATE MEMBERS",
};

const DEFAULT_DORMANCY: DormancyThresholds = {
  recentlyActiveDays: 90,
  moderatelyIdleDays: 365,
  inactiveDays: 999,
  dormantDays: 1000,
};

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

function normalizePhone(value: string | null | undefined) {
  const text = (value || "").trim();
  if (!text) return "Unknown";
  if (text.toLowerCase() === "unknown") return "Unknown";
  return text;
}

function normalizeStatus(value: string | null | undefined) {
  const text = (value || "").trim();
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
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

function asNumericRef(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

async function resolveBranchScope(user: AuthUserLike, requestedBranchId?: string) {
  const branchFilter = await getBranchFilterForService(user as any, requestedBranchId);
  return branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : null;
}

async function resolveBranchLabel(
  branchId: string | null,
  rows: Array<{ branch?: { name?: string | null; location?: string | null } | null }>,
) {
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

async function getDormancyThresholds() {
  try {
    const row = await db.$queryRawUnsafe<Array<DormancyThresholds>>(`
      SELECT
        "recentlyActiveDays" as "recentlyActiveDays",
        "moderatelyIdleDays" as "moderatelyIdleDays",
        "inactiveDays" as "inactiveDays",
        "dormantDays" as "dormantDays"
      FROM "ShareDormancyThreshold"
      WHERE "isActive" = TRUE
      ORDER BY "createdAt" ASC
      LIMIT 1
    `);

    if (row.length > 0) return row[0];
  } catch {
    // fall back to defaults
  }

  return DEFAULT_DORMANCY;
}

function dormancyTone(days: number, thresholds: DormancyThresholds) {
  if (days >= thresholds.dormantDays) return "bg-red-50 text-red-700";
  if (days >= thresholds.inactiveDays) return "bg-amber-50 text-amber-700";
  if (days > thresholds.recentlyActiveDays) return "bg-yellow-50 text-yellow-800";
  return "";
}

async function fetchShareAccounts(branchId: string | null, reportDate: Date) {
  const memberAccounts = await db.shareAccount.findMany({
    where: {
      openedDate: { lte: reportDate },
      ...(branchId ? { branchId } : {}),
    },
    include: {
      member: {
        include: {
          user: {
            select: {
              name: true,
              phone: true,
              nationalId: true,
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

  // Institution share accounts (from Account model, since ShareAccount requires memberId)
  const institutionAccounts = await db.account.findMany({
    where: {
      openedAt: { lte: reportDate },
      institutionId: { not: null },
      accountType: { isShareAccount: true },
      ...(branchId ? { branchId } : {}),
    },
    include: {
      institution: {
        select: {
          institutionName: true,
          institutionNumber: true,
          user: { select: { name: true, phone: true, nationalId: true } },
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

  // Normalize institution accounts to match ShareAccount shape for downstream code
  const normalizedInstitution = institutionAccounts.map((a) => ({
    id: a.id,
    accountNumber: a.accountNumber,
    memberId: "",
    accountTypeId: a.accountTypeId,
    branchId: a.branchId,
    numberOfShares: a.sharesCount || 0,
    shareValue: a.accountType?.sharePrice || 0,
    totalValue: a.balance,
    status: a.status,
    openedDate: a.openedAt,
    closedDate: a.closedAt,
    lastTransactionDate: null,
    createdAt: a.openedAt,
    updatedAt: a.openedAt,
    batchNumber: null,
    member: null,
    institution: a.institution,
    accountType: a.accountType,
    branch: a.branch,
  }));

  return [...memberAccounts, ...normalizedInstitution] as any[];
}

async function resolveLastTransactionDates(accountIds: string[], reportDate: Date) {
  if (accountIds.length === 0) return new Map<string, Date>();

  const shareRows = await db.shareTransaction.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: accountIds },
      transactionDate: { lte: reportDate },
      isReversed: false,
    },
    _max: {
      transactionDate: true,
    },
  });

  const txnRows = await db.transaction.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: accountIds },
      transactionDate: { lte: reportDate },
      status: "COMPLETED",
    },
    _max: {
      transactionDate: true,
    },
  });

  const dateMap = new Map<string, Date>();
  for (const row of shareRows) {
    if (row._max.transactionDate) dateMap.set(row.accountId, row._max.transactionDate);
  }
  for (const row of txnRows) {
    const existing = dateMap.get(row.accountId);
    if (row._max.transactionDate && (!existing || row._max.transactionDate > existing)) {
      dateMap.set(row.accountId, row._max.transactionDate);
    }
  }

  return dateMap;
}

function mapAccountRows(
  accounts: any[],
  lastTrxDates: Map<string, Date>,
  reportDate: Date,
) {
  return accounts.map((account) => {
    const productCode = getProductCode(account);
    const lastTrxDate = lastTrxDates.get(account.id) || account.lastTransactionDate || account.openedDate;
    const safeLastTrx = lastTrxDate instanceof Date ? lastTrxDate : new Date(lastTrxDate);
    const daysWithoutActivity = differenceInCalendarDays(reportDate, safeLastTrx);

    return {
      accountId: account.id,
      accountNumber: account.accountNumber,
      memberName: getMemberName(account),
      bvnTin: account.member?.user?.nationalId || account.member?.nin || account.institution?.user?.nationalId || null,
      refNo: asNumericRef(account.member?.memberNumber || account.institution?.institutionNumber),
      lastTrxDate: safeLastTrx,
      daysWithoutActivity,
      dateOpened: new Date(account.openedDate),
      currentBalance: Number(account.totalValue || 0),
      status: normalizeStatus(account.status),
      phone: normalizePhone(account.member?.user?.phone || account.institution?.user?.phone),
      batchNumber: account.batchNumber == null ? null : Number(account.batchNumber),
      productCode,
      productName: getProductName(account, productCode),
      branchName: account.branch?.name || "All Branches",
    } as ShareAccountRow;
  });
}

function productRows(records: ShareAccountRow[]) {
  return PRODUCT_ORDER.map((productCode) => {
    const accounts = records.filter((record) => record.productCode === productCode);
    const totalBalance = accounts.reduce((sum, row) => sum + row.currentBalance, 0);
    return {
      product_code: productCode,
      product_name: PRODUCT_NAMES[productCode],
      accounts,
      subtotal: {
        count: accounts.length,
        total_balance: totalBalance,
      },
      grand_total: {
        count: accounts.length,
        total_balance: totalBalance,
      },
    };
  });
}

function groupByBatch(records: ShareAccountRow[]) {
  const orderedBatches = Array.from(
    records.reduce((map, record) => {
      const key = record.batchNumber == null ? "__blank__" : String(record.batchNumber);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(record);
      return map;
    }, new Map<string, ShareAccountRow[]>()),
  ).sort((a, b) => {
    const aBlank = a[0] === "__blank__";
    const bBlank = b[0] === "__blank__";
    if (aBlank && !bBlank) return -1;
    if (!aBlank && bBlank) return 1;
    if (aBlank && bBlank) return 0;
    return Number(a[0]) - Number(b[0]);
  });

  return orderedBatches.map(([key, accounts]) => ({
    batch_number: key === "__blank__" ? null : Number(key),
    batch_label: key === "__blank__" ? "BATCH:" : `BATCH: ${key}`,
    accounts,
    subtotal: {
      count: accounts.length,
      total_balance: accounts.reduce((sum, row) => sum + row.currentBalance, 0),
    },
  }));
}

export async function getShareAccountsListingReport(params: {
  user: AuthUserLike;
  reportDate?: string;
  productId?: string;
  productCode?: string;
  status?: string;
  minDaysInactive?: string | number;
  search?: string;
  branchId?: string;
}) {
  const branchId = await resolveBranchScope(params.user, params.branchId);
  const reportDate = params.reportDate ? parseISO(params.reportDate) : new Date();
  const thresholds = await getDormancyThresholds();

  const accounts = await fetchShareAccounts(branchId, reportDate);
  const lastTrxDates = await resolveLastTransactionDates(
    accounts.map((account) => account.id),
    reportDate,
  );

  let records = mapAccountRows(accounts, lastTrxDates, reportDate);
  const productFilter = (params.productId || params.productCode || "").trim();
  const statusFilter = (params.status || "All").trim().toLowerCase();
  const minDays = params.minDaysInactive == null || params.minDaysInactive === ""
    ? null
    : Number(params.minDaysInactive);
  const search = (params.search || "").trim().toLowerCase();

  // Only filter out empty-code records (no linked ledger account); include all valid product codes
  records = records.filter((record) => record.productCode && record.productCode.length > 0);
  if (productFilter && productFilter !== "all") {
    records = records.filter((record) => record.productCode === productFilter || record.accountId === productFilter);
  }
  if (statusFilter !== "all") {
    records = records.filter((record) => record.status.toLowerCase() === statusFilter);
  }
  if (minDays != null && !Number.isNaN(minDays)) {
    records = records.filter((record) => record.daysWithoutActivity >= minDays);
  }
  if (search) {
    records = records.filter((record) =>
      [record.accountNumber, record.memberName, record.bvnTin || "", record.phone]
        .some((value) => value.toLowerCase().includes(search)),
    );
  }

  // Group by actual product codes found in the data, falling back to PRODUCT_ORDER for known products
  const allProductCodes = Array.from(new Set(records.map((r) => r.productCode)));
  // Sort: known products first (in PRODUCT_ORDER order), then any unknown codes alphabetically
  const sortedProductCodes = [
    ...PRODUCT_ORDER.filter((code) => allProductCodes.includes(code)),
    ...allProductCodes.filter((code) => !PRODUCT_ORDER.includes(code as any)).sort(),
  ];

  const grouped = sortedProductCodes.map((productCode) => {
    const productRecords = records.filter((record) => record.productCode === productCode);
    return {
      product_code: productCode,
      product_name: PRODUCT_NAMES[productCode] || productRecords[0]?.productName || productCode,
      accounts: productRecords.map((record) => ({
        account_number: record.accountNumber,
        member_name: record.memberName,
        bvn_tin: record.bvnTin,
        ref_no: record.refNo,
        last_trx_date: record.lastTrxDate.toISOString(),
        days_without_activity: record.daysWithoutActivity,
        date_opened: record.dateOpened.toISOString(),
        current_balance: record.currentBalance,
        status: record.status,
        tone: dormancyTone(record.daysWithoutActivity, thresholds),
      })),
      subtotal: {
        count: productRecords.length,
        total_balance: productRecords.reduce((sum, row) => sum + row.currentBalance, 0),
      },
    };
  });

  const branchMeta = await resolveBranchLabel(branchId, accounts);

  return {
    sacco_name: REPORT_HEADER_DETAILS.institutionName,
    branch: branchMeta.branchLabel,
    branch_location: branchMeta.branchLocation,
    report_date: reportDate.toISOString(),
    generated_at: new Date().toISOString(),
    thresholds,
    products: grouped,
  };
}

export async function getShareBatchTotalsReport(params: {
  user: AuthUserLike;
  reportDate?: string;
  productId?: string;
  productCode?: string;
  batchNumber?: string | number;
  memberSearch?: string;
  minBalance?: string | number;
  branchId?: string;
}) {
  const branchId = await resolveBranchScope(params.user, params.branchId);
  const reportDate = params.reportDate ? parseISO(params.reportDate) : new Date();
  const accounts = await fetchShareAccounts(branchId, reportDate);
  const lastTrxDates = await resolveLastTransactionDates(
    accounts.map((account) => account.id),
    reportDate,
  );

  const records = mapAccountRows(accounts, lastTrxDates, reportDate);

  const productFilter = (params.productId || params.productCode || "").trim();
  const memberSearch = (params.memberSearch || "").trim().toLowerCase();
  const minBalance = params.minBalance == null || params.minBalance === ""
    ? null
    : Number(params.minBalance);
  const batchNumber = params.batchNumber == null || params.batchNumber === ""
    ? null
    : Number(params.batchNumber);

  let filtered = records;
  if (productFilter && productFilter !== "all") {
    filtered = filtered.filter((record) => record.productCode === productFilter || record.accountId === productFilter);
  }
  if (batchNumber != null && !Number.isNaN(batchNumber)) {
    filtered = filtered.filter((record) => record.batchNumber === batchNumber);
  }
  if (memberSearch) {
    filtered = filtered.filter((record) =>
      [record.accountNumber, record.memberName, record.bvnTin || "", record.phone]
        .some((value) => value.toLowerCase().includes(memberSearch)),
    );
  }
  if (minBalance != null && !Number.isNaN(minBalance)) {
    filtered = filtered.filter((record) => record.currentBalance >= minBalance);
  }

  const grouped = PRODUCT_ORDER.map((productCode) => {
    const productRecords = filtered.filter((record) => record.productCode === productCode);
    const batchMap = new Map<string, ShareAccountRow[]>();
    productRecords.forEach((record) => {
      const key = record.batchNumber == null ? "__blank__" : String(record.batchNumber);
      const current = batchMap.get(key) || [];
      current.push(record);
      batchMap.set(key, current);
    });

    const batches = Array.from(batchMap.entries())
      .sort((a, b) => {
        const aBlank = a[0] === "__blank__";
        const bBlank = b[0] === "__blank__";
        if (aBlank && !bBlank) return -1;
        if (!aBlank && bBlank) return 1;
        if (aBlank && bBlank) return 0;
        return Number(a[0]) - Number(b[0]);
      })
      .map(([key, batchRecords]) => ({
        batch_number: key === "__blank__" ? null : Number(key),
        batch_label: key === "__blank__" ? "BATCH:" : `BATCH: ${key}`,
        accounts: batchRecords
          .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
          .map((record) => ({
            account_number: record.accountNumber,
            member_name: record.memberName,
            bvn_tin: record.bvnTin,
            phone: record.phone,
            ref_no: record.batchNumber,
            current_balance: record.currentBalance,
          })),
        subtotal: {
          count: batchRecords.length,
          total_balance: batchRecords.reduce((sum, row) => sum + row.currentBalance, 0),
        },
      }));

    const totalBalance = batches.reduce((sum, batch) => sum + batch.subtotal.total_balance, 0);
    const totalCount = batches.reduce((sum, batch) => sum + batch.subtotal.count, 0);

    return {
      product_code: productCode,
      product_name: PRODUCT_NAMES[productCode],
      batches,
      grand_total: {
        count: totalCount,
        total_balance: totalBalance,
      },
    };
  }).filter((p) => p.grand_total.count > 0);

  const otherRecords = filtered.filter((record) => !PRODUCT_ORDER.includes(record.productCode as any));
  if (otherRecords.length > 0) {
    const batchMap = new Map<string, ShareAccountRow[]>();
    otherRecords.forEach((record) => {
      const key = record.batchNumber == null ? "__blank__" : String(record.batchNumber);
      const current = batchMap.get(key) || [];
      current.push(record);
      batchMap.set(key, current);
    });

    const batches = Array.from(batchMap.entries())
      .sort((a, b) => {
        const aBlank = a[0] === "__blank__";
        const bBlank = b[0] === "__blank__";
        if (aBlank && !bBlank) return -1;
        if (!aBlank && bBlank) return 1;
        if (aBlank && bBlank) return 0;
        return Number(a[0]) - Number(b[0]);
      })
      .map(([key, batchRecords]) => ({
        batch_number: key === "__blank__" ? null : Number(key),
        batch_label: key === "__blank__" ? "BATCH:" : `BATCH: ${key}`,
        accounts: batchRecords
          .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
          .map((record) => ({
            account_number: record.accountNumber,
            member_name: record.memberName,
            bvn_tin: record.bvnTin,
            phone: record.phone,
            ref_no: record.batchNumber,
            current_balance: record.currentBalance,
          })),
        subtotal: {
          count: batchRecords.length,
          total_balance: batchRecords.reduce((sum, row) => sum + row.currentBalance, 0),
        },
      }));

    const totalBalance = batches.reduce((sum, batch) => sum + batch.subtotal.total_balance, 0);
    const totalCount = batches.reduce((sum, batch) => sum + batch.subtotal.count, 0);

    grouped.push({
      product_code: "OTHER",
      product_name: "Other Share Accounts",
      batches,
      grand_total: {
        count: totalCount,
        total_balance: totalBalance,
      },
    } as any);
  }

  const branchMeta = await resolveBranchLabel(branchId, accounts);

  return {
    sacco_name: REPORT_HEADER_DETAILS.institutionName,
    branch: branchMeta.branchLabel,
    branch_location: branchMeta.branchLocation,
    report_date: reportDate.toISOString(),
    generated_at: new Date().toISOString(),
    products: grouped,
  };
}

function headerCellStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

function writeStandardShareHeader(sheet: ExcelJS.Worksheet, report: any, title: string) {
  const reportDateLabel = report.report_date ? format(new Date(report.report_date), "dd/MM/yyyy") : "";

  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").value = report.sacco_name;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.getCell("H2").value = format(new Date(report.generated_at || new Date()), "dd/MM/yyyy");
  sheet.getCell("H2").alignment = { horizontal: "right" };

  sheet.getCell("H4").value = format(new Date(report.generated_at || new Date()), "HH:mm:ss");
  sheet.getCell("H4").alignment = { horizontal: "right" };

  sheet.mergeCells("A5:H5");
  sheet.getCell("A5").value = report.branch_location || "KISINGA Kasese District";
  sheet.getCell("A5").alignment = { horizontal: "left" };

  sheet.mergeCells("A8:H8");
  sheet.getCell("A8").value = title;
  sheet.getCell("A8").font = { bold: true, size: 14 };
  sheet.getCell("A8").alignment = { horizontal: "center" };

  sheet.mergeCells("A10:H10");
  sheet.getCell("A10").value = `Reporting Date: ${reportDateLabel}`;
  sheet.getCell("A10").alignment = { horizontal: "center" };
}

export async function buildShareAccountsListingWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = REPORT_HEADER_DETAILS.institutionName;
  const sheet = workbook.addWorksheet("Shares Accounts Listing");
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions® 08.45.u",
  };
  sheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "14:14",
  };
  sheet.columns = [
    { width: 16 },
    { width: 24 },
    { width: 18 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
  ];

  writeStandardShareHeader(sheet, report, "Shares Accounts Listing Report");

  report.products.forEach((product: any) => {
    sheet.addRow([]);
    const productRow = sheet.addRow([`Product: ${product.product_code} - ${product.product_name}`]);
    productRow.font = { bold: true };
    productRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    sheet.mergeCells(`A${productRow.number}:I${productRow.number}`);

    sheet.addRow([
      "A/C No.",
      "Name",
      "Bank Verification No./TIN",
      "Ref. No.",
      "Last Trx Date",
      "Days Without Activity",
      "Date Opened",
      "Status",
      "Current Balance",
    ]);
    sheet.lastRow!.eachCell((cell) => headerCellStyle(cell));

    product.accounts.forEach((account: any) => {
      const row = sheet.addRow([
        account.account_number,
        account.member_name,
        account.bvn_tin || "",
        account.ref_no == null ? "" : account.ref_no,
        account.last_trx_date,
        account.days_without_activity,
        account.date_opened,
        account.status,
        account.current_balance,
      ]);
      row.getCell(5).numFmt = "dd/MM/yyyy";
      row.getCell(6).numFmt = "#,##0";
      row.getCell(7).numFmt = "dd/MM/yyyy";
      row.getCell(9).numFmt = "#,##0";
    });

    const totalRow = sheet.addRow([
      `Total: ${product.subtotal.count}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      product.subtotal.total_balance,
    ]);
    totalRow.font = { bold: true };
    totalRow.getCell(9).numFmt = "#,##0";
  });

  return workbook.xlsx.writeBuffer();
}

export async function buildShareBatchTotalsWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = REPORT_HEADER_DETAILS.institutionName;
  const sheet = workbook.addWorksheet("Shares Batch Totals");
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions® 08.45.u",
  };
  sheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "14:14",
  };
  sheet.columns = [
    { width: 16 },
    { width: 24 },
    { width: 18 },
    { width: 14 },
    { width: 12 },
    { width: 16 },
  ];

  writeStandardShareHeader(sheet, report, "Shares Batch Totals Report");

  report.products.forEach((product: any) => {
    sheet.addRow([]);
    const productRow = sheet.addRow([`Product: ${product.product_code} - ${product.product_name}`]);
    productRow.font = { bold: true };
    productRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    sheet.mergeCells(`A${productRow.number}:F${productRow.number}`);

    product.batches.forEach((batch: any) => {
      const batchRow = sheet.addRow([batch.batch_label]);
      batchRow.font = { bold: true };
      batchRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: batch.batch_number == null ? "FFF3F4F6" : "FFE2E8F0" } };
      sheet.mergeCells(`A${batchRow.number}:F${batchRow.number}`);

      batch.accounts.forEach((account: any) => {
        const row = sheet.addRow([
          account.account_number,
          account.member_name,
          account.bvn_tin || "",
          account.phone || "Unknown",
          account.ref_no == null ? "" : account.ref_no,
          account.current_balance,
        ]);
        row.getCell(6).numFmt = "#,##0";
      });

      const subtotalRow = sheet.addRow([
        `Total: ${batch.subtotal.count}   ${currency(batch.subtotal.total_balance)}`,
        "",
        "",
        "",
        "",
        "",
      ]);
      subtotalRow.font = { bold: true };
      subtotalRow.getCell(1).alignment = { horizontal: "left" };
      subtotalRow.getCell(6).numFmt = "#,##0";
    });

    const totalRow = sheet.addRow([
      `Total: ${product.grand_total.count}`,
      "",
      "",
      "",
      "",
      product.grand_total.total_balance,
    ]);
    totalRow.font = { bold: true };
    totalRow.getCell(6).numFmt = "#,##0";
  });

  return workbook.xlsx.writeBuffer();
}

export { PRODUCT_ORDER, PRODUCT_NAMES, DEFAULT_DORMANCY };
