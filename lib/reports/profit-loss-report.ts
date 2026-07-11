import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";
import { TransactionStatus } from "@prisma/client";

import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";

function money(value: number) {
  const amount = Number(value || 0);
  const negative = amount < 0;
  return `${negative ? "(" : ""}${new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))}${negative ? ")" : ""}`;
}

function toDate(value: string | Date | undefined | null) {
  if (!value) return new Date();
  const parsed = typeof value === "string" ? parseISO(value) : value;
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function startOfDayIso(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDayIso(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

type FYProfitLossReportInput = {
  user: any;
  branchId?: string;
  financialYearId?: string;
  fyStart?: string;
  fromDate?: string;
  toDate?: string;
  year?: number;
};

type FYCategoryRow = {
  account_code: string;
  account_name: string;
  is_group_header: boolean;
  parent_group: string | null;
  section: "Income" | "Expenses";
  period: { debit: number; credit: number; net_change: number };
  ytd: { debit_balance: number; credit_balance: number };
};

type FYProfitLossReport = {
  report_title: string;
  location: string;
  generated_date: string;
  generated_time: string;
  financial_year_start: string;
  period: { from: string; to: string };
  days_into_fy: number;
  currency: string;
  income: {
    accounts: FYCategoryRow[];
    total: {
      account_count: number;
      period: { debit: number; credit: number; net_change: number };
      ytd: { debit_balance: number; credit_balance: number };
    };
  };
  expenses: {
    accounts: FYCategoryRow[];
    total: {
      account_count: number;
      period: { debit: number; credit: number; net_change: number };
      ytd: { debit_balance: number; credit_balance: number };
    };
  };
  grand_total: {
    account_count: number;
    period: { debit: number; credit: number; net_change: number };
    ytd: { debit_balance: number; credit_balance: number };
  };
  net_profit_ytd: number;
  is_profit: boolean;
};

async function resolveFinancialYear(input: FYProfitLossReportInput) {
  if (input.financialYearId) {
    const found = await db.financialPeriod.findUnique({
      where: { id: input.financialYearId },
      select: { id: true, name: true, startDate: true, endDate: true, isClosed: true },
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

  if (input.fyStart) {
    const startDate = toDate(input.fyStart);
    const found = await db.financialPeriod.findFirst({
      where: { startDate: { gte: startOfDayIso(startDate), lte: endOfDayIso(startDate) } },
      select: { id: true, name: true, startDate: true, endDate: true, isClosed: true },
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
      where: { name: { contains: input.year.toString() } },
      select: { id: true, name: true, startDate: true, endDate: true, isClosed: true },
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

function formatIsoDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function calcNetChange(section: "Income" | "Expenses", debit: number, credit: number) {
  return section === "Income" ? credit - debit : debit - credit;
}

function asDebitBalance(section: "Income" | "Expenses", debit: number, credit: number) {
  if (section === "Expenses") return Math.max(debit - credit, 0);
  return 0;
}

function asCreditBalance(section: "Income" | "Expenses", debit: number, credit: number) {
  if (section === "Income") return Math.max(credit - debit, 0);
  return 0;
}

type GroupDefinition = {
  code: string;
  name: string;
  section: "Income" | "Expenses";
  standalone?: boolean;
  prefixes: string[];
};

const GROUPS: GroupDefinition[] = [
  { code: "400100", name: "INTEREST ON LOANS", section: "Income", standalone: true, prefixes: ["400100"] },
  { code: "400200", name: "ACCOUNT OPENING FEES", section: "Income", standalone: true, prefixes: ["400200"] },
  { code: "400300", name: "STATIONERY SALES", section: "Income", prefixes: ["40030"] },
  { code: "400400", name: "COMMISSION RECEIVED", section: "Income", prefixes: ["40040"] },
  { code: "400500", name: "LOAN APPLICATION FEES", section: "Income", standalone: true, prefixes: ["400500"] },
  { code: "400600", name: "SUBSCRIPTIONS INCOMES", section: "Income", standalone: true, prefixes: ["400600"] },
  { code: "400700", name: "MEMBERSHIP FEES", section: "Income", standalone: true, prefixes: ["400700"] },
  { code: "400800", name: "PROJECT INCOME", section: "Income", prefixes: ["40080"] },
  { code: "400950", name: "LOAN PROCESSING FEES", section: "Income", standalone: true, prefixes: ["400950", "401002"] },
  { code: "401000", name: "SOCIAL FUND", section: "Income", standalone: true, prefixes: ["401000"] },
  { code: "401200", name: "SALE OF OLD ASSETS", section: "Income", standalone: true, prefixes: ["401200"] },
  { code: "401005", name: "PENALTY", section: "Income", standalone: true, prefixes: ["401005"] },
  { code: "401400", name: "LEDGER FEES", section: "Income", prefixes: ["40140"] },
  { code: "405000", name: "FEE INCOME", section: "Income", standalone: true, prefixes: ["4050"] },
  { code: "401500", name: "INTEREST ON BANK DEPOSITS", section: "Income", standalone: true, prefixes: ["401500"] },
  { code: "401600", name: "FUNDRAISING INCOMES", section: "Income", standalone: true, prefixes: ["401600"] },
  { code: "401700", name: "INTERVIEW FEE", section: "Income", standalone: true, prefixes: ["401700"] },
  { code: "401800", name: "WRITTEN OFF LOANS CR", section: "Income", standalone: true, prefixes: ["401800"] },
  { code: "401900", name: "LAND INCOME", section: "Income", standalone: true, prefixes: ["401900"] },
  { code: "401960", name: "INSURANCE CONTRIBUTION", section: "Income", standalone: true, prefixes: ["401960"] },
  { code: "500000", name: "STAFF & PERSONNEL COSTS", section: "Expenses", prefixes: ["5000"] },
  { code: "501000", name: "ADMINISTRATIVE COSTS", section: "Expenses", prefixes: ["5010"] },
  { code: "502000", name: "TRAVEL & SUBSISTENCE", section: "Expenses", prefixes: ["5020"] },
  { code: "503000", name: "GOVERNANCE COSTS", section: "Expenses", prefixes: ["5030"] },
  { code: "504000", name: "OPERATIONAL & MAINTENANCE", section: "Expenses", prefixes: ["5040"] },
  { code: "505000", name: "MISCELLANEOUS EXPENSES", section: "Expenses", prefixes: ["5050"] },
  { code: "506000", name: "SUNDRY COSTS", section: "Expenses", prefixes: ["5060"] },
];

function resolveGroup(accountCode: string, section: "Income" | "Expenses"): GroupDefinition {
  const definition = GROUPS.find(
    (group) => group.section === section && group.prefixes.some((prefix) => accountCode.startsWith(prefix)),
  );
  if (definition) return definition;
  if (section === "Income") {
    return { code: "409999", name: "OTHER INCOME", section, prefixes: [] };
  }
  return { code: "509999", name: "OTHER EXPENSES", section, prefixes: [] };
}

export async function buildFinancialYearProfitLossReport(input: FYProfitLossReportInput): Promise<FYProfitLossReport> {
  const generatedAt = new Date();
  const branchFilter = await getBranchFilterForService(input.user, input.branchId);
  const branchId = branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : undefined;
  const financialYear = await resolveFinancialYear(input);

  const fyStart = toDate(input.fyStart || financialYear?.startDate || `${input.year || new Date().getFullYear()}-01-01`);
  const fromDate = toDate(input.fromDate || financialYear?.startDate || fyStart);
  const toDateValue = toDate(input.toDate || financialYear?.endDate || generatedAt);

  // Read BudgetCategory for account structure (instead of COA)
  const categories = await db.budgetCategory.findMany({
    where: { isActive: true, kind: { in: ["INCOME", "EXPENSE"] } },
    select: { id: true, name: true, code: true, kind: true },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  // Direct source: read from IncomeRecord, ExpenditureRecord, InsuranceContribution
  const [incPeriodRecords, incYtdRecords, expPeriod, expYtd, insPeriod, insYtd] = await Promise.all([
    db.incomeRecord.groupBy({
      by: ["budgetCategoryId"],
      where: {
        recordDate: { gte: startOfDayIso(fromDate), lte: endOfDayIso(toDateValue) },
        status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        ...(branchId ? { member: { user: { branchId } } } : {}),
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.incomeRecord.groupBy({
      by: ["budgetCategoryId"],
      where: {
        recordDate: { gte: startOfDayIso(fyStart), lte: endOfDayIso(toDateValue) },
        status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        ...(branchId ? { member: { user: { branchId } } } : {}),
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.expenditureRecord.groupBy({
      by: ["budgetCategoryId"],
      where: {
        recordDate: { gte: startOfDayIso(fromDate), lte: endOfDayIso(toDateValue) },
        status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        ...(branchId ? { member: { user: { branchId } } } : {}),
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.expenditureRecord.groupBy({
      by: ["budgetCategoryId"],
      where: {
        recordDate: { gte: startOfDayIso(fyStart), lte: endOfDayIso(toDateValue) },
        status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        ...(branchId ? { member: { user: { branchId } } } : {}),
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.insuranceContribution.aggregate({
      where: {
        type: "CONTRIBUTION",
        createdAt: { gte: startOfDayIso(fromDate), lte: endOfDayIso(toDateValue) },
        ...(branchId ? { account: { branchId } } : {}),
      },
      _sum: { amount: true },
    }),
    db.insuranceContribution.aggregate({
      where: {
        type: "CONTRIBUTION",
        createdAt: { gte: startOfDayIso(fyStart), lte: endOfDayIso(toDateValue) },
        ...(branchId ? { account: { branchId } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  const incPeriodMap = new Map(incPeriodRecords.map((r) => [r.budgetCategoryId, { amount: Number(r._sum.amount || 0), count: r._count.id }]));
  const incYtdMap = new Map(incYtdRecords.map((r) => [r.budgetCategoryId, { amount: Number(r._sum.amount || 0), count: r._count.id }]));
  const expPeriodMap = new Map(expPeriod.map((r) => [r.budgetCategoryId, { amount: Number(r._sum.amount || 0), count: r._count.id }]));
  const expYtdMap = new Map(expYtd.map((r) => [r.budgetCategoryId, { amount: Number(r._sum.amount || 0), count: r._count.id }]));

  const insuranceContribPeriod = Number(insPeriod._sum.amount || 0);
  const insuranceContribYtd = Number(insYtd._sum.amount || 0);

  const sectionForKind = (kind: string): "Income" | "Expenses" =>
    kind === "INCOME" ? "Income" : "Expenses";

  const buildSection = (section: "Income" | "Expenses") => {
    const sectionCats = categories.filter((cat) => sectionForKind(cat.kind) === section);

    const groups = new Map<string, { definition: GroupDefinition; cats: typeof sectionCats }>();
    for (const cat of sectionCats) {
      const groupDef = resolveGroup(cat.code || "", section);
      const existing = groups.get(groupDef.code) || { definition: groupDef, cats: [] };
      existing.cats.push(cat);
      groups.set(groupDef.code, existing);
    }

    const rows: FYCategoryRow[] = [];
    const catMap = section === "Income" ? { period: incPeriodMap, ytd: incYtdMap } : { period: expPeriodMap, ytd: expYtdMap };

    for (const [, group] of groups) {
      rows.push({
        account_code: group.definition.code,
        account_name: group.definition.name,
        is_group_header: true,
        parent_group: null,
        section,
        period: { debit: 0, credit: 0, net_change: 0 },
        ytd: { debit_balance: 0, credit_balance: 0 },
      });

      for (const cat of group.cats) {
        const periodData = catMap.period.get(cat.id) || { amount: 0, count: 0 };
        const ytdData = catMap.ytd.get(cat.id) || { amount: 0, count: 0 };

        // Handle insurance contribution separately
        if (cat.code?.startsWith("401960")) {
          rows.push({
            account_code: cat.code || "",
            account_name: cat.name,
            is_group_header: false,
            parent_group: group.definition.name,
            section,
            period: {
              debit: 0,
              credit: insuranceContribPeriod,
              net_change: insuranceContribPeriod,
            },
            ytd: {
              debit_balance: 0,
              credit_balance: insuranceContribYtd,
            },
          });
        } else if (section === "Income") {
          rows.push({
            account_code: cat.code || "",
            account_name: cat.name,
            is_group_header: false,
            parent_group: group.definition.name,
            section,
            period: {
              debit: 0,
              credit: periodData.amount,
              net_change: periodData.amount,
            },
            ytd: {
              debit_balance: 0,
              credit_balance: ytdData.amount,
            },
          });
        } else {
          rows.push({
            account_code: cat.code || "",
            account_name: cat.name,
            is_group_header: false,
            parent_group: group.definition.name,
            section,
            period: {
              debit: periodData.amount,
              credit: 0,
              net_change: -periodData.amount,
            },
            ytd: {
              debit_balance: ytdData.amount,
              credit_balance: 0,
            },
          });
        }
      }
    }

    const accountRows = rows.filter((row) => !row.is_group_header);
    const periodDebit = accountRows.reduce((sum, row) => sum + row.period.debit, 0);
    const periodCredit = accountRows.reduce((sum, row) => sum + row.period.credit, 0);
    const ytdDebit = accountRows.reduce((sum, row) => sum + row.ytd.debit_balance, 0);
    const ytdCredit = accountRows.reduce((sum, row) => sum + row.ytd.credit_balance, 0);

    return {
      accounts: rows,
      total: {
        account_count: accountRows.length,
        period: {
          debit: periodDebit,
          credit: periodCredit,
          net_change: periodCredit - periodDebit,
        },
        ytd: {
          debit_balance: ytdDebit,
          credit_balance: ytdCredit,
        },
      },
    };
  };

  const income = buildSection("Income");
  const expenses = buildSection("Expenses");

  const grandTotal = {
    account_count: income.total.account_count + expenses.total.account_count,
    period: {
      debit: income.total.period.debit + expenses.total.period.debit,
      credit: income.total.period.credit + expenses.total.period.credit,
      net_change: income.total.period.net_change + expenses.total.period.net_change,
    },
    ytd: {
      debit_balance: income.total.ytd.debit_balance + expenses.total.ytd.debit_balance,
      credit_balance: income.total.ytd.credit_balance + expenses.total.ytd.credit_balance,
    },
  };

  const daysIntoFy = Math.max(
    1,
    Math.floor((startOfDayIso(toDateValue).getTime() - startOfDayIso(fyStart).getTime()) / 86400000) + 1,
  );
  const netProfitYtd = income.total.ytd.credit_balance - expenses.total.ytd.debit_balance;

  return {
    report_title: "Profit & Loss Statement (Financial Year)",
    location: "KISINGA, Kasese District",
    generated_date: format(generatedAt, "dd/MM/yyyy"),
    generated_time: format(generatedAt, "HH:mm:ss"),
    financial_year_start: formatIsoDate(fyStart),
    period: {
      from: formatIsoDate(fromDate),
      to: formatIsoDate(toDateValue),
    },
    days_into_fy: daysIntoFy,
    currency: "UGX",
    income,
    expenses,
    grand_total: grandTotal,
    net_profit_ytd: netProfitYtd,
    is_profit: netProfitYtd >= 0,
  };
}

export async function buildProfitLossWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BUKONZO UNITED TEACHERS SACCO";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Profit & Loss");
  sheet.views = [{ state: "frozen", ySplit: 12 }];
  sheet.pageSetup = { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  sheet.columns = [
    { header: "A/C Name", key: "name", width: 55 },
    { header: "From Balance", key: "from", width: 18 },
    { header: "Debit", key: "debit", width: 18 },
    { header: "To Balance", key: "to", width: 18 },
  ];

  const title = sheet.addRow([report.reportType || "Profit & Loss (P&L) Statement"]);
  title.font = { bold: true, size: 16 };
  title.alignment = { horizontal: "center" };
  sheet.mergeCells(title.number, 1, title.number, 4);

  const location = sheet.addRow([report.location || "KISINGA, Kasese District"]);
  location.alignment = { horizontal: "center" };
  sheet.mergeCells(location.number, 1, location.number, 4);

  const dateRow = sheet.addRow([`Report Date: ${report.report_date || report.generated_date || format(new Date(), "dd/MM/yyyy")}`]);
  dateRow.alignment = { horizontal: "right" };
  sheet.mergeCells(dateRow.number, 1, dateRow.number, 4);

  const timeRow = sheet.addRow([`Report Time: ${report.generated_time || format(new Date(), "HH:mm:ss")}`]);
  timeRow.alignment = { horizontal: "right" };
  sheet.mergeCells(timeRow.number, 1, timeRow.number, 4);

  const period = report.period || report.current_period;
  const periodLabel = period?.label
    || (period?.startDate && period?.endDate
      ? `${format(toDate(period.startDate), "dd/MM/yyyy")} to ${format(toDate(period.endDate), "dd/MM/yyyy")}`
      : "Selected period");
  const periodRow = sheet.addRow([periodLabel]);
  periodRow.alignment = { horizontal: "center" };
  sheet.mergeCells(periodRow.number, 1, periodRow.number, 4);

  sheet.addRow([]);
  const header = sheet.addRow(["A/C Name", "From Balance", "Debit", "To Balance"]);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" } };
  });

  const renderGroup = (group: any, sectionName: string) => {
    const sectionAccounts = Array.isArray(group.items) ? group.items : [];
    const subtotal = group.amount ?? group.subtotal ?? 0;

    const groupRow = sheet.addRow([`${group.code || ""} ${group.name || group.label || ""}`.trim()]);
    groupRow.font = { bold: true };
    groupRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    sheet.mergeCells(groupRow.number, 1, groupRow.number, 4);

    for (const item of sectionAccounts) {
      const row = sheet.addRow([
        item.itemName || item.name || "",
        item.from_balance ?? item.fromBalance ?? 0,
        item.debit_movement ?? item.debit ?? item.amount ?? 0,
        item.to_balance ?? item.toBalance ?? item.amount ?? 0,
      ]);
      row.getCell(2).numFmt = "#,##0;(#,##0)";
      row.getCell(3).numFmt = "#,##0;(#,##0)";
      row.getCell(4).numFmt = "#,##0;(#,##0)";
      row.getCell(2).alignment = { horizontal: "right" };
      row.getCell(3).alignment = { horizontal: "right" };
      row.getCell(4).alignment = { horizontal: "right" };
    }

    const totalRow = sheet.addRow([`${group.name || group.label || sectionName} subtotal`, "", "", subtotal]);
    totalRow.font = { bold: true };
    totalRow.getCell(4).numFmt = "#,##0;(#,##0)";
    totalRow.eachCell((cell) => {
      cell.border = { top: { style: "thin" } };
    });
  };

  const incomeGroups = report.income?.categories || report.income?.groups || [];
  const expenseGroups = report.expenses?.categories || report.expenses?.groups || [];

  sheet.addRow(["Income"]).font = { bold: true };
  for (const group of incomeGroups) renderGroup(group, "Income");

  sheet.addRow([]);
  sheet.addRow(["Expenses"]).font = { bold: true };
  for (const group of expenseGroups) renderGroup(group, "Expenses");

  sheet.addRow([]);
  const incomeTotal = sheet.addRow(["Total - Income", "", "", report.income?.total || 0]);
  incomeTotal.font = { bold: true };
  incomeTotal.getCell(4).numFmt = "#,##0;(#,##0)";

  const expenseTotal = sheet.addRow(["Total - Expenses", "", "", report.expenses?.total || 0]);
  expenseTotal.font = { bold: true };
  expenseTotal.getCell(4).numFmt = "#,##0;(#,##0)";

  const grand = sheet.addRow(["Total", "", "", report.netProfit ?? report.net_profit ?? 0]);
  grand.font = { bold: true, color: { argb: "FFFFFFFF" } };
  grand.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  grand.getCell(4).numFmt = "#,##0;(#,##0)";

  const profit = typeof report.netProfit === "number" ? report.netProfit : Number(report.net_profit || 0);
  const profitRow = sheet.addRow([
    profit >= 0 ? "Profit" : "Loss",
    "",
    "",
    profit,
  ]);
  profitRow.font = { bold: true };
  profitRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: profit >= 0 ? "FFC6EFCE" : "FFFFC7CE" } };
  profitRow.getCell(4).numFmt = "#,##0;(#,##0)";

  return workbook.xlsx.writeBuffer();
}

export async function buildFinancialYearProfitLossWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BUKONZO UNITED TEACHERS SACCO";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("FY P&L");
  sheet.views = [{ state: "frozen", ySplit: 16 }];
  sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  sheet.columns = [
    { header: "A/C Name", key: "name", width: 55 },
    { header: "Period Debit", key: "pDebit", width: 14 },
    { header: "Period Credit", key: "pCredit", width: 14 },
    { header: "Net Change", key: "net", width: 14 },
    { header: "YTD Debit Balance", key: "yDebit", width: 18 },
    { header: "YTD Credit Balance", key: "yCredit", width: 18 },
  ];

  const title = sheet.addRow([report.report_title || "Profit & Loss Statement (Financial Year)"]);
  title.font = { bold: true, size: 16 };
  title.alignment = { horizontal: "center" };
  sheet.mergeCells(title.number, 1, title.number, 6);

  const location = sheet.addRow([report.location || "KISINGA, Kasese District"]);
  location.alignment = { horizontal: "center" };
  sheet.mergeCells(location.number, 1, location.number, 6);

  const fyRow = sheet.addRow([`Financial Year Start: ${report.financial_year_start || ""}`]);
  fyRow.alignment = { horizontal: "center" };
  sheet.mergeCells(fyRow.number, 1, fyRow.number, 6);

  const period = report.period || {};
  const periodRow = sheet.addRow([`Reporting Period: ${period.from || ""} To: ${period.to || ""}`]);
  periodRow.alignment = { horizontal: "center" };
  sheet.mergeCells(periodRow.number, 1, periodRow.number, 6);

  sheet.addRow([]);
  const header1 = sheet.addRow(["", "TRANSACTIONS DURING A PERIOD", "", "", "CUMMULATIVE BALANCE YEAR-TO-DATE", ""]);
  header1.font = { bold: true };
  header1.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" } };
  });
  sheet.mergeCells(header1.number, 2, header1.number, 4);
  sheet.mergeCells(header1.number, 5, header1.number, 6);

  const header2 = sheet.addRow(["A/C Name", "Debit", "Credit", "Net Change", "Debit Balance", "Credit Balance"]);
  header2.font = { bold: true };
  header2.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" } };
  });

  const renderSection = (label: string, accounts: any[], total: any) => {
    const sectionRow = sheet.addRow([label]);
    sectionRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: label === "Income" ? { argb: "FF065F46" } : { argb: "FF9F1239" } };
    sheet.mergeCells(sectionRow.number, 1, sectionRow.number, 6);

    let currentGroup = "";
    for (const account of accounts) {
      const group = account.parent_group || account.parentGroup || "";
      if (account.is_group_header) {
        const groupRow = sheet.addRow([`${account.account_code || account.code || ""} ${account.account_name || account.name || ""}`.trim()]);
        groupRow.font = { italic: true, bold: true };
        groupRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        sheet.mergeCells(groupRow.number, 1, groupRow.number, 6);
        currentGroup = group;
        continue;
      }
      if (group && group !== currentGroup) {
        const groupRow = sheet.addRow([group]);
        groupRow.font = { bold: true };
        groupRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        sheet.mergeCells(groupRow.number, 1, groupRow.number, 6);
        currentGroup = group;
      }
      const row = sheet.addRow([
        `${account.account_code || account.code || ""} ${account.account_name || account.name || ""}`.trim(),
        account.period?.debit ?? account.current_period?.debit ?? 0,
        account.period?.credit ?? account.current_period?.credit ?? 0,
        account.period?.net_change ?? account.current_period?.net_change ?? 0,
        account.ytd?.debit_balance ?? account.ytd?.debit ?? 0,
        account.ytd?.credit_balance ?? account.ytd?.credit ?? 0,
      ]);
      row.getCell(2).numFmt = "#,##0;(#,##0)";
      row.getCell(3).numFmt = "#,##0;(#,##0)";
      row.getCell(4).numFmt = "#,##0;(#,##0)";
      row.getCell(5).numFmt = "#,##0;(#,##0)";
      row.getCell(6).numFmt = "#,##0;(#,##0)";
    }

    const totalRow = sheet.addRow([
      `Total - ${label}`,
      total.period?.debit ?? total.current_period?.debit ?? 0,
      total.period?.credit ?? total.current_period?.credit ?? 0,
      total.period?.net_change ?? total.current_period?.net_change ?? 0,
      total.ytd?.debit_balance ?? 0,
      total.ytd?.credit_balance ?? 0,
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    totalRow.eachCell((cell, col) => {
      cell.border = { top: { style: "thin" } };
      if (col > 1) cell.numFmt = "#,##0;(#,##0)";
    });
  };

  renderSection("Income", report.income?.accounts || [], report.income?.total || {});
  renderSection("Expenses", report.expenses?.accounts || [], report.expenses?.total || {});

  const grand = sheet.addRow([
    "Total",
    report.grand_total?.period?.debit ?? 0,
    report.grand_total?.period?.credit ?? 0,
    report.grand_total?.period?.net_change ?? 0,
    report.grand_total?.ytd?.debit_balance ?? 0,
    report.grand_total?.ytd?.credit_balance ?? 0,
  ]);
  grand.font = { bold: true, color: { argb: "FFFFFFFF" } };
  grand.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  grand.eachCell((cell, col) => {
    if (col > 1) cell.numFmt = "#,##0;(#,##0)";
  });

  const profit = Number(report.net_profit_ytd ?? 0);
  const profitRow = sheet.addRow([profit >= 0 ? "Profit" : "Loss", "", "", "", "", profit]);
  profitRow.font = { bold: true };
  profitRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: profit >= 0 ? "FFC6EFCE" : "FFFFC7CE" } };
  profitRow.getCell(6).numFmt = "#,##0;(#,##0)";

  return workbook.xlsx.writeBuffer();
}
