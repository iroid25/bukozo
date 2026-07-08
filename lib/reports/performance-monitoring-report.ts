import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";

import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { db } from "@/prisma/db";
import {
  BRANCH_LABEL,
  SACCO_NAME,
  formatDate,
  formatDateTime,
  formatUGXPlain,
  toNumber,
} from "@/lib/reports/member-ledger-utils";

type TrendDirection = "good" | "bad" | "neutral";
type ValueType = "cumulative" | "snapshot" | "ratio" | "not_computed";
type DisplayFormat = "number" | "currency" | "percentage" | "text";

type KpiDefinition = {
  kpi_number: string;
  kpi_label: string;
  category: string;
  value_type: ValueType;
  display_format: DisplayFormat;
  decimal_places: number;
  sort_order: number;
  trend_direction: TrendDirection;
  is_sub_item?: boolean;
  parent_kpi_number?: string;
  metric_key?: string;
  sub_items?: Array<{
    kpi_label: string;
    is_sub_item: boolean;
    start_of_period: number | string | null;
    during_period: number | string | null;
    end_of_period: number | string | null;
  }>;
};

type SnapshotData = {
  loans: any[];
  members: any[];
  savingsAccounts: any[];
  shareAccounts: any[];
  branches: any[];
  repayments: any[];
  writeOffs: any[];
};

export type PerformanceMonitoringReport = {
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    from_date: string;
    to_date: string;
  };
  categories: Array<{
    category_name: string;
    items: Array<
      KpiDefinition & {
        start_of_period: number | string | null;
        during_period: number | string | null;
        end_of_period: number | string | null;
        sub_items: Array<{
          kpi_number?: string;
          kpi_label: string;
          start_of_period: number | string | null;
          during_period: number | string | null;
          end_of_period: number | string | null;
          is_sub_item: boolean;
        }>;
      }
    >;
  }>;
  derived_kpis: {
    par30_pct: number;
    par1_pct: number;
    arrears_rate_pct: number;
    avg_loan_size: number;
    loan_to_savings_ratio_pct: number;
  };
};

const DEFINITION_GROUPS: Array<{ category: string; items: KpiDefinition[] }> = [
  {
    category: "Portfolio Activity",
    items: [
      { kpi_number: "01", kpi_label: "Value of loans disbursed:", category: "Portfolio Activity", value_type: "cumulative", display_format: "currency", decimal_places: 0, sort_order: 1, trend_direction: "good", metric_key: "loansDisbursedValue" },
      { kpi_number: "02", kpi_label: "No. of loans disbursed:", category: "Portfolio Activity", value_type: "cumulative", display_format: "number", decimal_places: 0, sort_order: 2, trend_direction: "good", metric_key: "loansDisbursedCount" },
      { kpi_number: "03", kpi_label: "No. of clients taking 1st loan:", category: "Portfolio Activity", value_type: "cumulative", display_format: "number", decimal_places: 0, sort_order: 3, trend_direction: "good", metric_key: "firstLoanClients" },
      { kpi_number: "04", kpi_label: "No. of clients taking 2nd and subsequent loans:", category: "Portfolio Activity", value_type: "cumulative", display_format: "number", decimal_places: 0, sort_order: 4, trend_direction: "good", metric_key: "subsequentLoanClients" },
      { kpi_number: "05", kpi_label: "No. of active loans clients:", category: "Portfolio Activity", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 5, trend_direction: "good", metric_key: "activeLoanClients" },
      { kpi_number: "06", kpi_label: "No. of outstanding loans:", category: "Portfolio Activity", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 6, trend_direction: "good", metric_key: "outstandingLoansCount" },
      { kpi_number: "07", kpi_label: "Value of outstanding loans:", category: "Portfolio Activity", value_type: "snapshot", display_format: "currency", decimal_places: 0, sort_order: 7, trend_direction: "bad", metric_key: "outstandingLoansValue" },
      { kpi_number: "08", kpi_label: "% of portfolio financed by Compulsory Savings:", category: "Portfolio Activity", value_type: "not_computed", display_format: "percentage", decimal_places: 2, sort_order: 8, trend_direction: "neutral", metric_key: "notComputed" },
      { kpi_number: "09", kpi_label: "% of portfolio financed by Voluntary Savings:", category: "Portfolio Activity", value_type: "not_computed", display_format: "percentage", decimal_places: 2, sort_order: 9, trend_direction: "neutral", metric_key: "notComputed" },
      { kpi_number: "10", kpi_label: "Average loan term in months:", category: "Portfolio Activity", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 10, trend_direction: "neutral", metric_key: "averageLoanTerm" },
    ],
  },
  {
    category: "Outreach",
    items: [
      { kpi_number: "11", kpi_label: "No. of active loan clients receiving loans as members of a group:", category: "Outreach", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 11, trend_direction: "good", metric_key: "groupLoanClients" },
      { kpi_number: "12", kpi_label: "No. of active loan clients receiving loans as individual:", category: "Outreach", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 12, trend_direction: "good", metric_key: "individualLoanClients" },
      { kpi_number: "13", kpi_label: "No. of loans with a disbursed loan amount < 200,000:", category: "Outreach", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 13, trend_direction: "good", metric_key: "loansBelow200k" },
      { kpi_number: "14", kpi_label: "No. of loans with a disbursed loan amount > 3,000,000:", category: "Outreach", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 14, trend_direction: "bad", metric_key: "loansAbove3m" },
      { kpi_number: "15", kpi_label: "Drop-out rate %:", category: "Outreach", value_type: "ratio", display_format: "percentage", decimal_places: 2, sort_order: 15, trend_direction: "bad", metric_key: "dropoutRate" },
      { kpi_number: "16", kpi_label: "Number of Members:", category: "Outreach", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 16, trend_direction: "good", metric_key: "memberCount" },
      { kpi_number: "17", kpi_label: "Number of Branches:", category: "Outreach", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 17, trend_direction: "neutral", metric_key: "branchCount" },
      { kpi_number: "18", kpi_label: "No. of active loan clients in rural branches:", category: "Outreach", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 18, trend_direction: "good", metric_key: "ruralLoanClients" },
    ],
  },
  {
    category: "Savings",
    items: [
      { kpi_number: "19", kpi_label: "Total number of clients with savings:", category: "Savings", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 19, trend_direction: "good", metric_key: "totalSavingsClients" },
      { kpi_number: "20", kpi_label: "No. of clients with compulsory savings:", category: "Savings", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 20, trend_direction: "good", metric_key: "compulsorySavingsClients" },
      { kpi_number: "21", kpi_label: "Value of compulsory savings:", category: "Savings", value_type: "snapshot", display_format: "currency", decimal_places: 0, sort_order: 21, trend_direction: "good", metric_key: "compulsorySavingsValue" },
      { kpi_number: "22", kpi_label: "No. of voluntary savers:", category: "Savings", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 22, trend_direction: "good", metric_key: "voluntarySaversCount" },
      { kpi_number: "23", kpi_label: "Value of voluntary savings:", category: "Savings", value_type: "snapshot", display_format: "currency", decimal_places: 0, sort_order: 23, trend_direction: "good", metric_key: "voluntarySavingsValue" },
      { kpi_number: "24", kpi_label: "Interest rate paid on voluntary savings (%):", category: "Savings", value_type: "ratio", display_format: "percentage", decimal_places: 2, sort_order: 24, trend_direction: "neutral", metric_key: "voluntarySavingsInterestRate" },
      { kpi_number: "25", kpi_label: "Minimum balance required for interest payment:", category: "Savings", value_type: "snapshot", display_format: "currency", decimal_places: 0, sort_order: 25, trend_direction: "neutral", metric_key: "voluntarySavingsMinBalance" },
      { kpi_number: "26", kpi_label: "% of savings in MFI custody:", category: "Savings", value_type: "not_computed", display_format: "percentage", decimal_places: 2, sort_order: 26, trend_direction: "neutral", metric_key: "notComputed" },
      { kpi_number: "27", kpi_label: "% of savings in Bank custody:", category: "Savings", value_type: "not_computed", display_format: "percentage", decimal_places: 2, sort_order: 27, trend_direction: "neutral", metric_key: "notComputed" },
    ],
  },
  {
    category: "Portfolio Quality",
    items: [
      { kpi_number: "28", kpi_label: "Value of arrears (Principal + Interest):", category: "Portfolio Quality", value_type: "snapshot", display_format: "currency", decimal_places: 0, sort_order: 28, trend_direction: "bad", metric_key: "arrearsValue" },
      { kpi_number: "29", kpi_label: "No. of loans in arrears >= 1 day:", category: "Portfolio Quality", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 29, trend_direction: "bad", metric_key: "loansInArrears1Day" },
      { kpi_number: "30", kpi_label: "Value of outstanding loan balance with arrears >= 1 day:", category: "Portfolio Quality", value_type: "snapshot", display_format: "currency", decimal_places: 0, sort_order: 30, trend_direction: "bad", metric_key: "outstandingWithArrears1Day" },
      { kpi_number: "31", kpi_label: "No. of loans in arrears > 30 days:", category: "Portfolio Quality", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 31, trend_direction: "bad", metric_key: "loansInArrears30Days" },
      { kpi_number: "32", kpi_label: "Value of outstanding loan balance with arrears > 30 days (PAR):", category: "Portfolio Quality", value_type: "snapshot", display_format: "currency", decimal_places: 0, sort_order: 32, trend_direction: "bad", metric_key: "outstandingWithArrears30Days" },
      { kpi_number: "33", kpi_label: "All payments received during period including arrears but excluding [new disbursements]:", category: "Portfolio Quality", value_type: "cumulative", display_format: "currency", decimal_places: 0, sort_order: 33, trend_direction: "good", metric_key: "allPaymentsReceived" },
      { kpi_number: "34", kpi_label: "Scheduled amount due in period plus arrears:", category: "Portfolio Quality", value_type: "not_computed", display_format: "currency", decimal_places: 0, sort_order: 34, trend_direction: "neutral", metric_key: "notComputed" },
      { kpi_number: "35", kpi_label: "Amount realised from savings & guarantees to repay loans:", category: "Portfolio Quality", value_type: "not_computed", display_format: "currency", decimal_places: 0, sort_order: 35, trend_direction: "neutral", metric_key: "notComputed" },
      { kpi_number: "36", kpi_label: "No. of loans repaid from savings & guarantees:", category: "Portfolio Quality", value_type: "not_computed", display_format: "number", decimal_places: 0, sort_order: 36, trend_direction: "neutral", metric_key: "notComputed" },
    ],
  },
  {
    category: "Aging of Portfolio at Risk",
    items: [
      { kpi_number: "37", kpi_label: "Value of loans outstanding with arrears by age:", category: "Aging of Portfolio at Risk", value_type: "snapshot", display_format: "currency", decimal_places: 0, sort_order: 37, trend_direction: "bad", metric_key: "arrearsByAgeHeader", sub_items: [
        { kpi_label: "1 - 30 Days", is_sub_item: true, start_of_period: null, during_period: null, end_of_period: null },
        { kpi_label: "31 - 60 Days", is_sub_item: true, start_of_period: null, during_period: null, end_of_period: null },
        { kpi_label: "61 - 90 Days", is_sub_item: true, start_of_period: null, during_period: null, end_of_period: null },
        { kpi_label: "91 - 120 Days", is_sub_item: true, start_of_period: null, during_period: null, end_of_period: null },
        { kpi_label: "> 120 Days", is_sub_item: true, start_of_period: null, during_period: null, end_of_period: null },
      ] as any },
    ],
  },
  {
    category: "Write-offs",
    items: [
      { kpi_number: "38", kpi_label: "Amount written-off:", category: "Write-offs", value_type: "snapshot", display_format: "currency", decimal_places: 0, sort_order: 38, trend_direction: "bad", metric_key: "writeOffAmount" },
      { kpi_number: "39", kpi_label: "No. of loans written-off:", category: "Write-offs", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 39, trend_direction: "bad", metric_key: "writeOffCount" },
    ],
  },
  {
    category: "Men/Women",
    items: [
      { kpi_number: "40", kpi_label: "No. of Men:", category: "Men/Women", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 40, trend_direction: "good", metric_key: "menCount" },
      { kpi_number: "41", kpi_label: "No. of Women:", category: "Men/Women", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 41, trend_direction: "good", metric_key: "womenCount" },
      { kpi_number: "42", kpi_label: "No. of Children:", category: "Men/Women", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 42, trend_direction: "good", metric_key: "childrenCount" },
      { kpi_number: "43", kpi_label: "No. of Orphans:", category: "Men/Women", value_type: "snapshot", display_format: "number", decimal_places: 0, sort_order: 43, trend_direction: "good", metric_key: "orphansCount" },
    ],
  },
];

function cleanMemberType(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function money(value: unknown) {
  return Math.round(toNumber(value));
}

function asDate(value: string | Date) {
  return value instanceof Date ? value : parseISO(value);
}

function formatNullable(value: number | string | null, definition: KpiDefinition) {
  if (value == null) return null;
  if (definition.display_format === "currency") return money(value);
  if (definition.display_format === "percentage") return Number(value);
  if (definition.display_format === "number") return Math.round(Number(value));
  return value;
}

function formatForExport(value: number | string | null, definition: KpiDefinition) {
  if (value == null) return "-";
  if (definition.display_format === "currency") return formatUGXPlain(value);
  if (definition.display_format === "percentage") return `${Number(value).toFixed(definition.decimal_places)}%`;
  if (definition.display_format === "number") return Number(value).toLocaleString("en-UG", { maximumFractionDigits: 0 });
  return String(value);
}

async function loadSnapshots(asOfDate: Date, branchId?: string) {
  const branchFilter = branchId && branchId !== "all" ? { branchId } : {};

  const [members, branches, loans, savingsAccounts, shareAccounts, repayments, writeOffs] = await Promise.all([
    db.member.findMany({
      where: {
        registrationDate: { lte: asOfDate },
        ...(branchId && branchId !== "all"
          ? {
              OR: [
                { user: { branchId } },
                { accounts: { some: { branchId } } },
                { savingsAccounts: { some: { branchId } } },
                { shareAccounts: { some: { branchId } } },
                { fixedDeposits: { some: { branchId } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        gender: true,
        status: true,
        registrationDate: true,
        numberOfChildren: true,
        numberOfDependants: true,
      },
    }),
    db.branch.findMany({
      where: branchId && branchId !== "all" ? { id: branchId } : {},
      select: { id: true, name: true, location: true },
    }),
    db.loan.findMany({
      where: {
        disbursementDate: { lte: asOfDate },
        ...(branchFilter as any),
      },
      select: {
        id: true,
        memberId: true,
        amountGranted: true,
        outstandingBalance: true,
        disbursementDate: true,
        status: true,
        dueDate: true,
        interestRate: true,
        loanApplication: {
          select: {
            repaymentPeriodMonths: true,
            modeOfRepayment: true,
            guarantors: true,
          },
        },
        schedules: {
          select: {
            dueDate: true,
            totalPayment: true,
            paidAmount: true,
            principalPayment: true,
            interestPayment: true,
            status: true,
          },
        },
        branch: {
          select: {
            name: true,
            location: true,
          },
        },
        writeOffs: {
          select: {
            totalBalance: true,
            dateWrittenOff: true,
            status: true,
          },
        },
      },
      orderBy: { disbursementDate: "asc" },
    }),
    // Account is the master balance source for savings (TXN-001)
    db.account.findMany({
      where: {
        openedAt: { lte: asOfDate },
        memberId: { not: null },
        accountType: { isShareAccount: false, hasFixedPeriod: false },
        ...(branchFilter as any),
      },
      select: {
        memberId: true,
        balance: true,
        status: true,
        accountType: {
          select: {
            name: true,
            interestRate: true,
            minBalance: true,
            isShareAccount: true,
          },
        },
      },
    }),
    db.shareAccount.findMany({
      where: {
        openedDate: { lte: asOfDate },
        ...(branchFilter as any),
      },
      select: {
        memberId: true,
        totalValue: true,
        status: true,
        openedDate: true,
        accountType: {
          select: {
            name: true,
            isShareAccount: true,
          },
        },
      },
    }),
    db.loanRepayment.findMany({
      where: {
        repaymentDate: { lte: asOfDate },
        ...(branchId && branchId !== "all" ? { loan: { branchId } } : {}),
      },
      select: {
        amount: true,
        repaymentDate: true,
        memberId: true,
      },
    }),
    db.loanWriteOff.findMany({
      where: {
        status: "APPROVED",
        ...(branchId && branchId !== "all" ? { loan: { branchId } } : {}),
        OR: [{ dateWrittenOff: { lte: asOfDate } }, { requestedAt: { lte: asOfDate } }],
      },
      select: {
        totalBalance: true,
        dateWrittenOff: true,
        status: true,
      },
    }),
  ]);

  return { members, branches, loans, savingsAccounts, shareAccounts, repayments, writeOffs };
}

function loanIsActive(loan: any, asOfDate: Date) {
  return Boolean(loan.disbursementDate && new Date(loan.disbursementDate).getTime() <= asOfDate.getTime() && ["DISBURSED", "OVERDUE"].includes(String(loan.status || "").toUpperCase()));
}

function loanMemberGroups(loan: any) {
  const mode = cleanMemberType(loan.loanApplication?.modeOfRepayment);
  const guarantors = loan.loanApplication?.guarantors;
  const hasGroupHint =
    mode.includes("group") ||
    mode.includes("group loan") ||
    (Array.isArray(guarantors) && guarantors.length > 1) ||
    (typeof guarantors === "object" && guarantors !== null && Object.keys(guarantors).length > 1);
  return hasGroupHint;
}

function overdueSchedules(loan: any, asOfDate: Date) {
  return (loan.schedules || []).filter((schedule: any) => {
    const dueDate = new Date(schedule.dueDate);
    return dueDate.getTime() < asOfDate.getTime() && toNumber(schedule.paidAmount) < toNumber(schedule.totalPayment);
  });
}

function loanAgingBucket(loan: any, asOfDate: Date) {
  const overdue = overdueSchedules(loan, asOfDate);
  if (!overdue.length) return null;

  const oldest = overdue.reduce((best: any, schedule: any) => {
    if (!best) return schedule;
    return new Date(schedule.dueDate).getTime() < new Date(best.dueDate).getTime() ? schedule : best;
  }, null);
  const days = Math.max(0, Math.ceil((asOfDate.getTime() - new Date(oldest.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  if (days <= 120) return "91-120";
  return ">120";
}

function buildSnapshot(data: SnapshotData, asOfDate: Date) {
  const loans = data.loans.filter((loan) => loanIsActive(loan, asOfDate));
  const loanByMember = new Map<string, any[]>();
  for (const loan of data.loans.filter((loan) => loan.disbursementDate && new Date(loan.disbursementDate).getTime() <= asOfDate.getTime())) {
    const list = loanByMember.get(loan.memberId) || [];
    list.push(loan);
    loanByMember.set(loan.memberId, list);
  }

  const allLoanMembers = [...loanByMember.entries()];
  const firstLoanDateByMember = new Map<string, Date>();
  const secondLoanDateByMember = new Map<string, Date>();
  for (const [memberId, memberLoans] of allLoanMembers) {
    const sorted = [...memberLoans].sort((a, b) => new Date(a.disbursementDate).getTime() - new Date(b.disbursementDate).getTime());
    if (sorted[0]) firstLoanDateByMember.set(memberId, new Date(sorted[0].disbursementDate));
    if (sorted[1]) secondLoanDateByMember.set(memberId, new Date(sorted[1].disbursementDate));
  }

  const activeMembers = new Set(loans.map((loan) => loan.memberId));
  const outstandingLoans = loans.filter((loan) => toNumber(loan.outstandingBalance) > 0);
  const totalSavingsAccounts = data.savingsAccounts.filter((account) => ["ACTIVE", "DORMANT", "ON_HOLD", "FROZEN"].includes(String(account.status || "").toUpperCase()));
  const voluntarySavings = totalSavingsAccounts.filter((account) => {
    const name = cleanMemberType(account.accountType?.name);
    return name.includes("voluntary") || (account.accountType?.isShareAccount === false && !name.includes("compulsory"));
  });
  const compulsorySavings = totalSavingsAccounts.filter((account) => cleanMemberType(account.accountType?.name).includes("compulsory"));
  const savingsClientIds = new Set(totalSavingsAccounts.map((account) => account.memberId));

  const compulsoryRate = compulsorySavings[0] ? toNumber(compulsorySavings[0].accountType?.interestRate) : 0;
  const voluntaryRate = voluntarySavings[0] ? toNumber(voluntarySavings[0].accountType?.interestRate) : 0;
  const voluntaryMinBalance = voluntarySavings[0] ? toNumber(voluntarySavings[0].accountType?.minBalance) : 0;

  const arrearsRows = loans.flatMap((loan) =>
    overdueSchedules(loan, asOfDate).map((schedule: any) => ({
      loan,
      schedule,
      bucket: loanAgingBucket(loan, asOfDate),
    })),
  );

  const arrearsValue = arrearsRows.reduce(
    (sum, row) => sum + Math.max(0, toNumber(row.schedule.totalPayment) - toNumber(row.schedule.paidAmount)),
    0,
  );
  const loansInArrears1Day = new Set(arrearsRows.map((row) => row.loan.id)).size;
  const loansInArrears30Days = new Set(
    arrearsRows.filter((row) => {
      const due = new Date(row.schedule.dueDate);
      const days = Math.max(0, Math.ceil((asOfDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
      return days > 30;
    }).map((row) => row.loan.id),
  ).size;

  const outstandingWithArrears1Day = loans
    .filter((loan) => arrearsRows.some((row) => row.loan.id === loan.id))
    .reduce((sum, loan) => sum + toNumber(loan.outstandingBalance), 0);
  const outstandingWithArrears30Days = loans
    .filter((loan) =>
      arrearsRows.some((row) => {
        if (row.loan.id !== loan.id) return false;
        const due = new Date(row.schedule.dueDate);
        const days = Math.max(0, Math.ceil((asOfDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
        return days > 30;
      }),
    )
    .reduce((sum, loan) => sum + toNumber(loan.outstandingBalance), 0);

  const arrearsByAge = {
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "91-120": 0,
    ">120": 0,
  } as Record<string, number>;
  for (const loan of loans) {
    const bucket = loanAgingBucket(loan, asOfDate);
    if (!bucket) continue;
    arrearsByAge[bucket] += toNumber(loan.outstandingBalance);
  }

  const groupLoanClients = new Set(loans.filter((loan) => loanMemberGroups(loan)).map((loan) => loan.memberId)).size;
  const individualLoanClients = new Set(loans.filter((loan) => !loanMemberGroups(loan)).map((loan) => loan.memberId)).size;
  const loansBelow200k = loans.filter((loan) => toNumber(loan.amountGranted) < 200000).length;
  const loansAbove3m = loans.filter((loan) => toNumber(loan.amountGranted) > 3000000).length;
  const averageLoanTerm = loans.length
    ? loans.reduce((sum, loan) => sum + toNumber(loan.loanApplication?.repaymentPeriodMonths), 0) / loans.length
    : 0;

  const writeOffAmount = data.writeOffs.reduce((sum, row) => sum + toNumber(row.totalBalance), 0);
  const writeOffCount = data.writeOffs.length;

  const menCount = data.members.filter((member) => cleanMemberType(member.gender) === "male").length;
  const womenCount = data.members.filter((member) => cleanMemberType(member.gender) === "female").length;
  const childrenCount = data.members.reduce((sum, member) => sum + Number(member.numberOfChildren || 0), 0);
  const orphansCount = data.members.reduce((sum, member) => sum + Number(member.numberOfDependants || 0), 0);

  const currentLoansValue = outstandingLoans.reduce((sum, loan) => sum + toNumber(loan.outstandingBalance), 0);
  const totalPaymentsReceived = data.repayments.reduce((sum, repayment) => sum + toNumber(repayment.amount), 0);

  return {
    loansDisbursedValue: data.loans.filter((loan) => new Date(loan.disbursementDate).getTime() <= asOfDate.getTime()).reduce((sum, loan) => sum + toNumber(loan.amountGranted), 0),
    loansDisbursedCount: data.loans.filter((loan) => new Date(loan.disbursementDate).getTime() <= asOfDate.getTime()).length,
    firstLoanClients: [...firstLoanDateByMember.values()].filter((date) => date.getTime() <= asOfDate.getTime()).length,
    subsequentLoanClients: [...secondLoanDateByMember.values()].filter((date) => date.getTime() <= asOfDate.getTime()).length,
    activeLoanClients: activeMembers.size,
    outstandingLoansCount: outstandingLoans.length,
    outstandingLoansValue: currentLoansValue,
    averageLoanTerm,
    groupLoanClients,
    individualLoanClients,
    loansBelow200k,
    loansAbove3m,
    dropoutRate: data.members.length ? ((data.members.filter((member) => String(member.status || "").toUpperCase() !== "ACTIVE").length / data.members.length) * 100) : 0,
    memberCount: data.members.length,
    branchCount: data.branches.length,
    ruralLoanClients: new Set(
      loans
        .filter((loan) => {
          const branchName = cleanMemberType(loan.branch?.name);
          const branchLocation = cleanMemberType(loan.branch?.location);
          return branchName.includes("rural") || branchLocation.includes("rural");
        })
        .map((loan) => loan.memberId),
    ).size,
    totalSavingsClients: savingsClientIds.size,
    compulsorySavingsClients: new Set(compulsorySavings.map((account) => account.memberId)).size,
    compulsorySavingsValue: compulsorySavings.reduce((sum, account) => sum + toNumber(account.balance), 0),
    voluntarySaversCount: new Set(voluntarySavings.map((account) => account.memberId)).size,
    voluntarySavingsValue: voluntarySavings.reduce((sum, account) => sum + toNumber(account.balance), 0),
    voluntarySavingsInterestRate: voluntaryRate,
    voluntarySavingsMinBalance: voluntaryMinBalance,
    arrearsValue,
    loansInArrears1Day,
    outstandingWithArrears1Day,
    loansInArrears30Days,
    outstandingWithArrears30Days,
    allPaymentsReceived: totalPaymentsReceived,
    arrearsByAge,
    writeOffAmount,
    writeOffCount,
    menCount,
    womenCount,
    childrenCount,
    orphansCount,
    currentLoansValue,
  };
}

function makeItem(def: KpiDefinition, startSnapshot: Record<string, any>, endSnapshot: Record<string, any>) {
  const startValue = startSnapshot[def.metric_key || "notComputed"];
  const endValue = endSnapshot[def.metric_key || "notComputed"];

  if (def.value_type === "not_computed") {
    return {
      ...def,
      start_of_period: null,
      during_period: null,
      end_of_period: null,
      sub_items: [],
    };
  }

  if (def.kpi_number === "37") {
    const buckets = [
      { number: "37.1", label: "1 - 30 Days", key: "1-30" },
      { number: "37.2", label: "31 - 60 Days", key: "31-60" },
      { number: "37.3", label: "61 - 90 Days", key: "61-90" },
      { number: "37.4", label: "91 - 120 Days", key: "91-120" },
      { number: "37.5", label: "> 120 Days", key: ">120" },
    ];
    return {
      ...def,
      start_of_period: null,
      during_period: null,
      end_of_period: null,
      sub_items: buckets.map((bucket) => ({
        kpi_number: bucket.number,
        kpi_label: bucket.label,
        start_of_period: startSnapshot.arrearsByAge?.[bucket.key] ?? 0,
        during_period: endSnapshot.arrearsByAge?.[bucket.key] ?? 0,
        end_of_period: endSnapshot.arrearsByAge?.[bucket.key] ?? 0,
        is_sub_item: true,
      })),
    };
  }

  const start = formatNullable(startValue, def);
  const end = formatNullable(endValue, def);

  if (def.value_type === "cumulative") {
    const during = start == null || end == null ? null : Number(end) - Number(start);
    return {
      ...def,
      start_of_period: start,
      during_period: during,
      end_of_period: end,
      sub_items: [],
    };
  }

  if (def.value_type === "snapshot") {
    return {
      ...def,
      start_of_period: start,
      during_period: end,
      end_of_period: end,
      sub_items: [],
    };
  }

  if (def.value_type === "ratio") {
    return {
      ...def,
      start_of_period: start,
      during_period: "-",
      end_of_period: end,
      sub_items: [],
    };
  }

  return {
    ...def,
    start_of_period: null,
    during_period: null,
    end_of_period: null,
    sub_items: [],
  };
}

export async function buildPerformanceMonitoringReport(startDate: string, endDate: string, branchId?: string) {
  const from = asDate(startDate);
  const to = asDate(endDate);
  to.setHours(23, 59, 59, 999);

  const [startData, endData] = await Promise.all([
    loadSnapshots(from, branchId),
    loadSnapshots(to, branchId),
  ]);

  const startSnapshot = buildSnapshot(startData, from);
  const endSnapshot = buildSnapshot(endData, to);

  const categories = DEFINITION_GROUPS.map((group) => ({
    category_name: group.category,
    items: group.items.map((definition) => makeItem(definition, startSnapshot as any, endSnapshot as any)),
  }));

  const outstandingLoansValue = toNumber(endSnapshot.outstandingLoansValue);
  const loansInArrears1Day = toNumber(endSnapshot.loansInArrears1Day);
  const loansInArrears30Days = toNumber(endSnapshot.loansInArrears30Days);
  const arrearsValue = toNumber(endSnapshot.arrearsValue);
  const voluntarySavingsValue = toNumber(endSnapshot.voluntarySavingsValue);

  const report: PerformanceMonitoringReport = {
    report_meta: {
      sacco_name: REPORT_HEADER_DETAILS.institutionName,
      branch: branchId && branchId !== "all" ? endData.branches[0]?.name || BRANCH_LABEL : BRANCH_LABEL,
      generated_at: new Date().toISOString(),
      from_date: format(from, "dd/MM/yyyy"),
      to_date: format(to, "dd/MM/yyyy"),
    },
    categories,
    derived_kpis: {
      par30_pct: outstandingLoansValue > 0 ? (toNumber(endSnapshot.outstandingWithArrears30Days) / outstandingLoansValue) * 100 : 0,
      par1_pct: outstandingLoansValue > 0 ? (toNumber(endSnapshot.outstandingWithArrears1Day) / outstandingLoansValue) * 100 : 0,
      arrears_rate_pct: outstandingLoansValue > 0 ? (arrearsValue / outstandingLoansValue) * 100 : 0,
      avg_loan_size: endSnapshot.outstandingLoansCount ? outstandingLoansValue / endSnapshot.outstandingLoansCount : 0,
      loan_to_savings_ratio_pct: voluntarySavingsValue > 0 ? (outstandingLoansValue / voluntarySavingsValue) * 100 : 0,
    },
  };

  return report;
}

export async function buildPerformanceMonitoringWorkbook(report: PerformanceMonitoringReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = SACCO_NAME;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Performance Monitoring", {
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
    { width: 52 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  sheet.mergeCells("A1:D1");
  sheet.getCell("A1").value = report.report_meta.sacco_name;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.getCell("D2").value = `Date: ${formatDate(new Date())}`;
  sheet.getCell("D2").alignment = { horizontal: "right" };
  sheet.getCell("D4").value = `Time: ${formatDateTime(new Date()).split(" ").slice(1).join(" ")}`;
  sheet.getCell("D4").alignment = { horizontal: "right" };

  sheet.mergeCells("A5:D5");
  sheet.getCell("A5").value = report.report_meta.branch;
  sheet.getCell("A5").alignment = { horizontal: "center" };

  sheet.mergeCells("A8:D8");
  sheet.getCell("A8").value = "Performance Monitoring Report";
  sheet.getCell("A8").font = { bold: true, size: 14 };
  sheet.getCell("A8").alignment = { horizontal: "center" };

  sheet.mergeCells("A10:D10");
  sheet.getCell("A10").value = `Reporting Date From: ${report.report_meta.from_date} To: ${report.report_meta.to_date}`;
  sheet.getCell("A10").alignment = { horizontal: "center" };

  const headers = sheet.addRow(["Item", "Start of Period", "During Period", "End of Period"]);
  headers.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  for (const category of report.categories) {
    const categoryRow = sheet.addRow([`${category.category_name}:`, "-", "-", "-"]);
    categoryRow.font = { bold: true };
    categoryRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    categoryRow.getCell(2).alignment = { horizontal: "right" };
    categoryRow.getCell(3).alignment = { horizontal: "right" };
    categoryRow.getCell(4).alignment = { horizontal: "right" };

    for (const item of category.items) {
      const label = `${" ".repeat(5)}${item.kpi_number ? `${item.kpi_number}. ` : ""}${item.kpi_label}`;
      const row = sheet.addRow([
        label,
        formatForExport(item.start_of_period, item),
        formatForExport(item.during_period, item),
        formatForExport(item.end_of_period, item),
      ]);
      row.getCell(1).alignment = { indent: item.is_sub_item ? 2 : 0 };
      row.getCell(2).alignment = { horizontal: "right" };
      row.getCell(3).alignment = { horizontal: "right" };
      row.getCell(4).alignment = { horizontal: "right" };
    }
  }

  return workbook.xlsx.writeBuffer();
}
