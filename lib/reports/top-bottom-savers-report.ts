import ExcelJS from "exceljs";
import { AccountStatus } from "@prisma/client";
import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import {
  BRANCH_LABEL,
  SACCO_NAME,
  formatDate,
  formatDateTime,
  formatRankDisplay,
  formatUGXPlain,
  inferProductCode,
  inferSavingsProductName,
  normalize,
  phoneLooksSuspicious,
  toNumber,
} from "@/lib/reports/member-ledger-utils";

export type TopBottomSaversFilters = {
  accountCategory?: "savings" | "shares";
  startDate: string;
  endDate: string;
  mode: "top" | "bottom";
  n: number | null;
  productId?: string;
  excludeZero?: boolean;
  areaCode?: string;
  memberType?: string;
  includeClosed?: boolean;
  branchId?: string;
  user?: any;
};

export type TopBottomSaversAccount = {
  rank: number;
  account_no: string;
  member_id: string;
  member_name: string;
  address: string;
  bvn_tin: string;
  phone: string;
  ref_no: number | null;
  balance: number;
  product_code: string;
  product_name: string;
  rank_display: string;
  phone_anomaly: boolean;
};

export type TopBottomSaversProductSection = {
  product_code: string;
  product_name: string;
  accounts: TopBottomSaversAccount[];
  subtotal: {
    count: number;
    total_balance: number;
  };
};

export type TopBottomSaversReport = {
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    report_date: string;
    start_date: string;
    end_date: string;
    account_category: "savings" | "shares";
    mode: "top" | "bottom";
    n: number | null;
    exclude_zero: boolean;
  };
  products: TopBottomSaversProductSection[];
  summary: {
    top_account: { name: string; balance: number; account_no: string } | null;
    bottom_account: { name: string; balance: number; account_no: string } | null;
    list_total: number;
    list_average: number;
    portfolio_coverage_pct: number;
    zero_balance_count: number;
    standard_share_value?: number;
    members_at_standard?: number;
    members_above_standard?: number;
    members_below_standard?: number;
    zero_shareholders?: number;
  };
  grand_total: {
    count: number;
    total_balance: number;
  };
};

type SavingsAccountRecord = any;
type ShareAccountRecord = any;

const PRODUCT_NAME_MAP: Record<string, string> = {
  "201001": "FIXED DEPOSIT SAVINGS",
  "201002": "JUNIOR SAVINGS A/C",
  "201003": "VOLUNTARY SAVINGS",
  "201004": "COMPULSORY SAVINGS",
  "200600": "LOAN INSURANCE",
  "200800": "TARGET SAVINGS",
  "200810": "SCHOOL FEES SAVINGS",
};

const SHARE_PRODUCT_NAME_MAP: Record<string, string> = {
  "300501": "AFFILIATE MEMBERS",
  "300502": "ORDINARY MEMBERS",
  "300503": "ASSOCIATE MEMBERS",
};

function openStatus(value: string) {
  return String(value || "").toUpperCase() !== String(AccountStatus.CLOSED);
}

function amountDelta(tx: any): number {
  const before = toNumber(tx.balanceBefore);
  const after = toNumber(tx.balanceAfter);
  if (Number.isFinite(before) && Number.isFinite(after) && (before !== 0 || after !== 0)) {
    return after - before;
  }

  const amount = toNumber(tx.amount);
  switch (String(tx.transactionType || "").toUpperCase()) {
    case "DEPOSIT":
    case "INTEREST":
    case "TRANSFER_IN":
      return amount;
    case "WITHDRAWAL":
    case "FEE":
    case "TRANSFER_OUT":
      return -amount;
    default:
      return amount;
  }
}

function shareAmountDelta(tx: any): number {
  const before = toNumber(tx.sharesBefore);
  const after = toNumber(tx.sharesAfter);
  if (Number.isFinite(before) && Number.isFinite(after) && (before !== 0 || after !== 0)) {
    return after - before;
  }

  const amount = toNumber(tx.amount);
  switch (String(tx.transactionType || "").toUpperCase()) {
    case "PURCHASE":
    case "TRANSFER_IN":
    case "DIVIDEND":
      return amount;
    case "SALE":
    case "TRANSFER_OUT":
      return -amount;
    default:
      return amount;
  }
}

function accountBalanceAsOf(account: any, _reportDate: Date): number {
  // Account.balance is the authoritative current balance (TXN-001).
  // Historical as-of-date reconstruction is not supported here because Account
  // does not carry SavingsTransaction history — use Account.balance directly.
  return toNumber(account.balance);
}

function shareBalanceAsOf(account: any, reportDate: Date): number {
  const rows = account.transactions
    .filter((tx: any) => new Date(tx.transactionDate).getTime() <= reportDate.getTime())
    .sort((a: any, b: any) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

  if (!rows.length) return 0;

  // Use the last known sharesAfter directly — avoids understatement when
  // transaction history is incomplete (pre-migration accounts).
  const last = rows[rows.length - 1];
  if (last.sharesAfter !== null && last.sharesAfter !== undefined) {
    return toNumber(last.sharesAfter);
  }

  // sharesAfter not recorded on older transactions — fall back to accumulation.
  let balance = 0;
  for (const tx of rows) {
    balance += shareAmountDelta(tx);
  }
  return balance;
}

function resolveMemberType(account: SavingsAccountRecord) {
  const code = inferProductCode(account.accountNumber, "201003");
  if (code === "300501") return "Affiliate";
  if (code === "300503") return "Associate";
  return "Ordinary";
}

function resolveMemberTypeFromCode(code: string) {
  if (code === "300501") return "Affiliate";
  if (code === "300503") return "Associate";
  return "Ordinary";
}

function resolveAddress(account: SavingsAccountRecord) {
  return (
    account.member.user?.address?.trim() ||
    account.member.parish?.trim() ||
    account.member.subCounty?.trim() ||
    account.member.town?.trim() ||
    account.member.district?.trim() ||
    ""
  );
}

function resolveBvnTin(account: SavingsAccountRecord) {
  return account.member.nin || account.member.user?.nationalId || "";
}

function resolveRefNo(account: SavingsAccountRecord) {
  const text = String(account.member.memberNumber || "").match(/\d+/)?.[0] || "";
  return text ? Number(text) : null;
}

function matchesAreaCode(account: SavingsAccountRecord, areaCode?: string) {
  if (!areaCode) return true;
  const target = normalize(areaCode);
  return (
    normalize(account.member.subCounty).includes(target) ||
    normalize(account.member.constituency).includes(target) ||
    normalize(account.member.parish).includes(target) ||
    normalize(account.member.town).includes(target) ||
    normalize(account.member.user?.areaOfOperation).includes(target)
  );
}

function matchesMemberType(account: SavingsAccountRecord, memberType?: string) {
  if (!memberType || memberType === "all") return true;
  return resolveMemberType(account) === memberType;
}

function shouldIncludeAccount(account: SavingsAccountRecord, includeClosed: boolean) {
  if (includeClosed) return true;
  return openStatus(account.status);
}

async function loadSavingsAccounts(filters: TopBottomSaversFilters, branchId?: string): Promise<any[]> {
  const startDate = new Date(filters.startDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(filters.endDate);
  endDate.setHours(23, 59, 59, 999);

  const where: any = {
    memberId: { not: null },
    accountType: { isShareAccount: false, hasFixedPeriod: false },
  };
  if (!filters.includeClosed) {
    where.status = { not: AccountStatus.CLOSED };
  }
  if (filters.productId && filters.productId !== "all") {
    where.accountNumber = { startsWith: `${filters.productId}.` };
  }
  if (branchId) {
    where.branchId = branchId;
  }

  let accounts = await db.account.findMany({
    where,
    include: {
      member: {
        include: {
          user: true,
        },
      },
      accountType: true,
    },
    orderBy: [{ accountNumber: "asc" }],
  });

  // Fallback: if legacy Account model returns nothing, try SavingsAccount model
  if (!accounts.length) {
    const savingsWhere: any = {
      memberId: { not: null },
      isClosed: filters.includeClosed ? undefined : false,
    };
    if (filters.productId && filters.productId !== "all") {
      savingsWhere.productCode = filters.productId;
    }
    if (branchId) {
      savingsWhere.branchId = branchId;
    }
    const savingsAccounts = await db.savingsAccount.findMany({
      where: savingsWhere,
      include: {
        member: {
          include: {
            user: true,
          },
        },
      },
      orderBy: [{ accountNumber: "asc" }],
    });
    accounts = savingsAccounts.map((sa: any) => ({
      id: sa.id,
      accountNumber: sa.accountNumber,
      memberId: sa.memberId,
      member: sa.member,
      accountType: null,
      status: sa.isClosed ? AccountStatus.CLOSED : AccountStatus.ACTIVE,
      balance: sa.balance,
      openedAt: sa.openedAt,
      transactions: [],
    })) as any;
  }

  // Build member type lookup from share accounts to avoid N+1
  const memberIds = [...new Set(accounts.map((a: any) => a.memberId).filter(Boolean))] as string[];
  let memberTypeMap = new Map<string, string>();
  if (memberIds.length > 0) {
    const shareAccounts = await db.shareAccount.findMany({
      where: { memberId: { in: memberIds } },
      select: { memberId: true, accountNumber: true },
    });
    for (const sa of shareAccounts) {
      const code = inferProductCode(sa.accountNumber, "300501");
      const t = code === "300501" ? "Affiliate" : code === "300503" ? "Associate" : "Ordinary";
      if (!memberTypeMap.has(sa.memberId)) {
        memberTypeMap.set(sa.memberId, t);
      }
    }
  }

  return accounts.filter((account: any) => {
    if (!shouldIncludeAccount(account, !!filters.includeClosed)) return false;
    if (filters.areaCode && !matchesAreaCode(account, filters.areaCode)) return false;
    if (filters.memberType) {
      const mt = memberTypeMap.get(account.memberId) || "Ordinary";
      if (mt !== filters.memberType) return false;
    }
    return true;
  });
}

async function loadShareAccounts(filters: TopBottomSaversFilters, branchId?: string): Promise<any[]> {
  const startDate = new Date(filters.startDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(filters.endDate);
  endDate.setHours(23, 59, 59, 999);

  const where: any = {};
  if (!filters.includeClosed) {
    where.status = { in: ["ACTIVE", "ON_HOLD", "DORMANT", "FROZEN"] };
  }
  if (filters.productId && filters.productId !== "all") {
    where.accountNumber = { startsWith: `${filters.productId}.` };
  }
  if (branchId) {
    where.branchId = branchId;
  }

  const accounts = await db.shareAccount.findMany({
    where,
    include: {
      member: {
        include: {
          user: true,
        },
      },
      accountType: true,
      transactions: {
        where: {
          transactionDate: {
            lte: endDate,
          },
        },
        include: {
          teller: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          transactionDate: "asc",
        },
      },
    },
    orderBy: [{ accountNumber: "asc" }],
  });

  // Build member type lookup from share product codes
  const memberIds = [...new Set(accounts.map((a: any) => a.memberId).filter(Boolean))] as string[];
  let memberTypeMap = new Map<string, string>();
  if (memberIds.length > 0) {
    const shareAccounts = await db.shareAccount.findMany({
      where: { memberId: { in: memberIds } },
      select: { memberId: true, accountNumber: true },
    });
    for (const sa of shareAccounts) {
      const code = inferProductCode(sa.accountNumber, "300501");
      const t = code === "300501" ? "Affiliate" : code === "300503" ? "Associate" : "Ordinary";
      if (!memberTypeMap.has(sa.memberId)) {
        memberTypeMap.set(sa.memberId, t);
      }
    }
  }

  return accounts.filter((account: any) => {
    if (!shouldIncludeAccount(account, !!filters.includeClosed)) return false;
    if (filters.areaCode && !matchesAreaCode(account, filters.areaCode)) return false;
    if (filters.memberType) {
      const mt = memberTypeMap.get(account.memberId) || "Ordinary";
      if (mt !== filters.memberType) return false;
    }
    return true;
  });
}

function computeSummary(reportRows: TopBottomSaversAccount[], portfolioTotal: number, zeroBalanceCount: number) {
  const listTotal = reportRows.reduce((sum, row) => sum + row.balance, 0);
  const listAverage = reportRows.length ? listTotal / reportRows.length : 0;
  const coverage = portfolioTotal > 0 ? (listTotal / portfolioTotal) * 100 : 0;
  const topAccount = reportRows.reduce<TopBottomSaversAccount | null>((best, row) => {
    if (!best) return row;
    return row.balance > best.balance ? row : best;
  }, null);
  const bottomAccount = reportRows.reduce<TopBottomSaversAccount | null>((worst, row) => {
    if (!worst) return row;
    return row.balance < worst.balance ? row : worst;
  }, null);

  return {
    top_account: topAccount
      ? { name: topAccount.member_name, balance: topAccount.balance, account_no: topAccount.account_no }
      : null,
    bottom_account: bottomAccount
      ? {
          name: bottomAccount.member_name,
          balance: bottomAccount.balance,
          account_no: bottomAccount.account_no,
        }
      : null,
    list_total: listTotal,
    list_average: listAverage,
    portfolio_coverage_pct: coverage,
    zero_balance_count: zeroBalanceCount,
  };
}

function computeShareAnalytics(reportRows: TopBottomSaversAccount[]) {
  if (!reportRows.length) {
    return {
      standard_share_value: 0,
      members_at_standard: 0,
      members_above_standard: 0,
      members_below_standard: 0,
      zero_shareholders: 0,
    };
  }

  const counts = new Map<number, number>();
  for (const row of reportRows) {
    const key = Math.round(row.balance);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const mostCommon = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] || 0;
  const zeroShareholders = reportRows.filter((row) => row.balance === 0).length;
  const membersAtStandard = reportRows.filter((row) => row.balance === mostCommon).length;
  const membersAboveStandard = reportRows.filter((row) => row.balance > mostCommon).length;
  const membersBelowStandard = reportRows.filter((row) => row.balance > 0 && row.balance < mostCommon).length;

  return {
    standard_share_value: mostCommon,
    members_at_standard: membersAtStandard,
    members_above_standard: membersAboveStandard,
    members_below_standard: membersBelowStandard,
    zero_shareholders: zeroShareholders,
  };
}

export async function buildTopBottomSaversReport(filters: TopBottomSaversFilters): Promise<TopBottomSaversReport> {
  const startDate = new Date(filters.startDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(filters.endDate);
  endDate.setHours(23, 59, 59, 999);
  const effectiveBranchId = filters.user
    ? (await getBranchFilterForService(filters.user, filters.branchId)).branchId
    : filters.branchId;
  const branchScope = effectiveBranchId && effectiveBranchId !== "all" ? effectiveBranchId : undefined;

  const accountCategory = filters.accountCategory || "savings";
  const limit = filters.n === null || filters.n === undefined || Number.isNaN(Number(filters.n))
    ? accountCategory === "shares"
      ? null
      : 40
    : Number(filters.n);

  const accounts = accountCategory === "shares" ? await loadShareAccounts(filters, branchScope) : await loadSavingsAccounts(filters, branchScope);
  const rowsByProduct = new Map<string, TopBottomSaversAccount[]>();

  let zeroBalanceCount = 0;
  let portfolioTotal = 0;

  for (const account of accounts) {
    const productCode = inferProductCode(account.accountNumber, accountCategory === "shares" ? "300501" : "201003");
    const balance = accountCategory === "shares" ? shareBalanceAsOf(account as ShareAccountRecord, endDate) : accountBalanceAsOf(account as SavingsAccountRecord, endDate);
    if (balance === 0) zeroBalanceCount += 1;
    portfolioTotal += balance;

    if (filters.excludeZero && balance <= 0) continue;

    const memberName = account.member.user?.name?.trim() || account.member.memberNumber;
    const row: TopBottomSaversAccount = {
      rank: 0,
      account_no: account.accountNumber,
      member_id: account.memberId,
      member_name: memberName,
      address: resolveAddress(account),
      bvn_tin: resolveBvnTin(account),
      phone: account.member.user?.phone || "",
      ref_no: resolveRefNo(account),
      balance,
      product_code: productCode,
      product_name:
        accountCategory === "shares"
          ? SHARE_PRODUCT_NAME_MAP[productCode] || "SHARES"
          : PRODUCT_NAME_MAP[productCode] || inferSavingsProductName(productCode),
      rank_display: "",
      phone_anomaly: phoneLooksSuspicious(account.member.user?.phone || ""),
    };

    const current = rowsByProduct.get(productCode) || [];
    current.push(row);
    rowsByProduct.set(productCode, current);
  }

  const defaultProductOrder =
    accountCategory === "shares"
      ? ["300501", "300502", "300503"]
      : ["201001", "201002", "201003", "201004", "200600", "200800", "200810"];
  const productFilter = filters.productId && filters.productId !== "all" ? [filters.productId] : defaultProductOrder;
  const productOrder = [...productFilter].filter((code) => rowsByProduct.has(code));

  const products: TopBottomSaversProductSection[] = [];
  const listRows: TopBottomSaversAccount[] = [];

  for (const productCode of productOrder) {
    const rows = rowsByProduct.get(productCode) || [];
    if (!rows.length) continue;

    const sorted = [...rows].sort((left, right) => {
      const balanceDiff = filters.mode === "top" ? right.balance - left.balance : left.balance - right.balance;
      if (balanceDiff !== 0) return balanceDiff;
      return left.account_no.localeCompare(right.account_no);
    });

    const sliceLimit = limit === null ? sorted.length : Math.max(limit || 0, 1);
    const limited = sorted.slice(0, sliceLimit).map((row, index) => {
      const ranked = {
        ...row,
        rank: index + 1,
        rank_display: formatRankDisplay(index + 1, row.member_name),
      };
      return ranked;
    });

    listRows.push(...limited);

    products.push({
      product_code: productCode,
      product_name:
        accountCategory === "shares"
          ? SHARE_PRODUCT_NAME_MAP[productCode] || "SHARES"
          : PRODUCT_NAME_MAP[productCode] || inferSavingsProductName(productCode),
      accounts: limited,
      subtotal: {
        count: limited.length,
        total_balance: limited.reduce((sum, row) => sum + row.balance, 0),
      },
    });
  }

  const grandTotal = {
    count: listRows.length,
    total_balance: listRows.reduce((sum, row) => sum + row.balance, 0),
  };

  return {
    report_meta: {
      sacco_name: SACCO_NAME,
      branch: BRANCH_LABEL,
      generated_at: new Date().toISOString(),
      report_date: formatDate(endDate),
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      account_category: accountCategory,
      mode: filters.mode,
      n: limit,
      exclude_zero: !!filters.excludeZero,
    },
    products,
    summary: {
      ...computeSummary(listRows, portfolioTotal, zeroBalanceCount),
      ...(accountCategory === "shares" ? computeShareAnalytics(listRows) : {}),
    },
    grand_total: grandTotal,
  };
}

export async function buildTopBottomSaversWorkbook(report: TopBottomSaversReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = SACCO_NAME;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Top Bottom Savers", {
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
  sheet.pageSetup.printTitlesRow = "1:12";
  sheet.columns = [
    { width: 16 },
    { width: 30 },
    { width: 28 },
    { width: 20 },
    { width: 16 },
    { width: 12 },
    { width: 16 },
  ];

  const titleRow = sheet.addRow([SACCO_NAME]);
  sheet.mergeCells(`A1:G1`);
  titleRow.font = { size: 14, bold: true };
  titleRow.alignment = { horizontal: "center" };

  const dateRow = sheet.addRow(["", "", "", "", "", "", `Date: ${formatDate(new Date())}`]);
  dateRow.getCell(7).alignment = { horizontal: "right" };

  sheet.addRow([]);
  const branchRow = sheet.addRow([`Branch: ${BRANCH_LABEL}`]);
  sheet.mergeCells(`A4:G4`);
  branchRow.font = { bold: true };

  const timeRow = sheet.addRow(["", "", "", "", "", "", `Time: ${formatDateTime(new Date()).split(" ").slice(1).join(" ")}`]);
  timeRow.getCell(7).alignment = { horizontal: "right" };

  sheet.addRow([]);
  const reportTitleRow = sheet.addRow([
    report.report_meta.account_category === "shares"
      ? "Top/Bottom Share Holders Report"
      : "Top/Bottom Savers Report",
  ]);
  sheet.mergeCells(`A6:G6`);
  reportTitleRow.font = { size: 13, bold: true };

  const infoRow = sheet.addRow([`Reporting Date: ${report.report_meta.report_date}`]);
  sheet.mergeCells(`A7:G7`);

  sheet.addRow([]);
  const headers = sheet.addRow(["A/C No.", "Name", "Physical/Postal Address", "Bank Verification No./TIN", "Phone", "Ref. No.", "Balance"]);
  headers.font = { bold: true };
  headers.alignment = { horizontal: "center" };
  headers.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
    };
  });

  for (const product of report.products) {
    const sectionRow = sheet.addRow([`Product: ${product.product_code} - ${product.product_name}`]);
    sheet.mergeCells(`A${sectionRow.number}:G${sectionRow.number}`);
    sectionRow.font = { bold: true };
    sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

    for (const row of product.accounts) {
      const dataRow = sheet.addRow([
        row.account_no,
        row.rank_display,
        row.address,
        row.bvn_tin,
        row.phone,
        row.ref_no ?? "",
        formatUGXPlain(row.balance),
      ]);
      dataRow.getCell(2).font = { bold: true };
      dataRow.getCell(7).alignment = { horizontal: "right" };
      dataRow.getCell(7).font = { bold: true };
      dataRow.getCell(2).alignment = { horizontal: "left" };
    }

    const subtotal = sheet.addRow([
      `Total: ${product.subtotal.count}`,
      "",
      "",
      "",
      "",
      "",
      formatUGXPlain(product.subtotal.total_balance),
    ]);
    subtotal.font = { bold: true };
    subtotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    subtotal.getCell(7).alignment = { horizontal: "right" };

    sheet.addRow([]);
  }

  const grand = sheet.addRow([
    `Total: ${report.grand_total.count}`,
    "",
    "",
    "",
    "",
    "",
    formatUGXPlain(report.grand_total.total_balance),
  ]);
  grand.font = { bold: true };
  grand.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
  grand.getCell(7).alignment = { horizontal: "right" };

  return workbook.xlsx.writeBuffer();
}
