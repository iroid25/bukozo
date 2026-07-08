import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  BookOpen,
  FileText,
  PieChart,
  Shield,
  ScrollText,
  PiggyBank,
  Scale,
} from "lucide-react";

export type ReportStatus = "ready" | "missing";

export type ReportItem = {
  slug: string;
  title: string;
  description: string;
  href: string;
  status: ReportStatus;
};

export type ReportCategory = {
  id: string;
  title: string;
  description: string;
  sources: string[];
  icon: LucideIcon;
  accent: string;
  iconTone: string;
  reportTone: string;
  reports: ReportItem[];
};

export const reportCatalog: ReportCategory[] = [
  {
    id: "audit-compliance",
    title: "Audit & Compliance",
    description: "Control checks, audit trails, and governance evidence.",
    sources: [
      "member profile edits",
      "admin and security actions",
      "branch controls",
      "audit snapshots",
    ],
    icon: Shield,
    accent: "border-l-sky-500",
    iconTone: "text-sky-600 bg-sky-50",
    reportTone: "border-sky-200 hover:border-sky-400",
    reports: [
      {
        slug: "audit-trail-customer-information",
        title: "Audit Trail Report Customer Information",
        description: "Controlled audit trail with customer context.",
        href: "/dashboard/reports/audit-trail/customer-information",
        status: "ready",
      },
      {
        slug: "audit-trail",
        title: "Audit Trail Report",
        description: "Audit history for administrative and security actions.",
        href: "/dashboard/reports/activity",
        status: "ready",
      },
      {
        slug: "customer-internal-accounting-system",
        title: "Customer Internal Accounting System",
        description: "Branch-scoped accounting review with export and control visibility.",
        href: "/dashboard/reports/customer-internal-accounting-system",
        status: "ready",
      },
      {
        slug: "sacco-internal-control-checklist",
        title: "SACCO Internal Control Checklist",
        description: "Editable branch control checklist with PDF and Excel export.",
        href: "/dashboard/reports/sacco-internal-control-checklist",
        status: "ready",
      },
    ],
  },
  {
    id: "financial-statements",
    title: "Accounting & Financial Statements",
    description: "Formal financial statements and year-end analysis.",
    sources: [
      "ledger postings",
      "journals",
      "income and expenditure",
      "closing entries",
    ],
    icon: Scale,
    accent: "border-l-indigo-500",
    iconTone: "text-indigo-600 bg-indigo-50",
    reportTone: "border-indigo-200 hover:border-indigo-400",
    reports: [
      {
        slug: "balance-sheet-financial-year",
        title: "Balance Sheet Financial Year",
        description: "Year-end balance sheet view.",
        href: "/dashboard/reports/financial-statements/balance-sheet-financial-year",
        status: "ready",
      },
      {
        slug: "balance-sheet",
        title: "Balance Sheet",
        description: "Core balance sheet report.",
        href: "/dashboard/reports/financial-statements/balance-sheet",
        status: "ready",
      },
      {
        slug: "cash-flow-review-balance-sheet",
        title: "Cash Flow Review Balance Sheet",
        description: "Balance sheet review under cash flow analysis.",
        href: "/dashboard/reports/financial-statements/cash-flow-review-balance-sheet",
        status: "ready",
      },
      {
        slug: "cash-flow-review-profit-and-loss",
        title: "Cash Flow Review Profit And Loss",
        description: "Profit and loss review under cash flow analysis.",
        href: "/dashboard/reports/financial-statements/cash-flow-review-profit-loss",
        status: "ready",
      },
      {
        slug: "profit-loss",
        title: "Profit & Loss",
        description: "Profit and loss statement for the current period.",
        href: "/dashboard/reports/financial-statements/profit-loss",
        status: "ready",
      },
      {
        slug: "profit-and-loss-statement-financial-year",
        title: "Profit And Loss Statement Financial Year",
        description: "Year-end profit and loss statement.",
        href: "/dashboard/reports/financial-statements/profit-loss-financial-year",
        status: "ready",
      },
      {
        slug: "statement-of-comprehensive-balance-sheet",
        title: "Statement Of Comprehensive Balance Sheet",
        description: "Comparative balance sheet with branch filtering, collapsible hierarchy, and PDF/Excel export.",
        href: "/dashboard/reports/statement-of-comprehensive-balance-sheet",
        status: "ready",
      },
      {
        slug: "statement-of-comprehensive-income-and-expenditure",
        title: "Statement Of Comprehensive Income & Expenses",
        description: "Comparative income and expenditure statement with branch filtering and exports.",
        href: "/dashboard/reports/statement-of-comprehensive-income-and-expenditure",
        status: "ready",
      },
      {
        slug: "statement-of-comprehensive-trial-balance",
        title: "Statement Of Comprehensive Trial Balance",
        description: "Master verification trial balance with branch filtering and exports.",
        href: "/dashboard/reports/statement-of-comprehensive-trial-balance",
        status: "ready",
      },
      {
        slug: "trial-balance-financial-year",
        title: "Trial Balance Financial Year",
        description: "Financial year trial balance view with year-to-date balances.",
        href: "/dashboard/reports/financial-statements/trial-balance",
        status: "ready",
      },
    ],
  },
  {
    id: "savings",
    title: "Savings",
    description: "Savings balances, statements, and batch summaries.",
    sources: [
      "account opening",
      "deposits",
      "withdrawals",
      "interest",
      "monthly fee charges",
      "dormancy",
    ],
    icon: PiggyBank,
    accent: "border-l-emerald-500",
    iconTone: "text-emerald-600 bg-emerald-50",
    reportTone: "border-emerald-200 hover:border-emerald-400",
    reports: [
      {
        slug: "savings-account-listing",
        title: "Savings Account Listing",
        description: "List of savings accounts.",
        href: "/dashboard/reports/savings/savings-listing",
        status: "ready",
      },
      {
        slug: "savings-account-statement",
        title: "Savings Account Statement",
        description: "Single-account savings statement with transactions and balances.",
        href: "/dashboard/reports/savings/savings-account-statement",
        status: "ready",
      },
      {
        slug: "savings-batch-totals",
        title: "Savings Batch Totals Report",
        description: "Savings batches grouped with member rows and subtotals.",
        href: "/dashboard/reports/savings/savings-batch-totals",
        status: "ready",
      },
      {
        slug: "savings-transactions",
        title: "Savings Transactions Report",
        description: "Savings transaction log with drill-down and export.",
        href: "/dashboard/reports/savings-shares-reports/savings",
        status: "ready",
      },
      {
        slug: "savings-zero-balance",
        title: "Savings Zero Balance Report",
        description: "Savings accounts with zero balance.",
        href: "/dashboard/reports/savings/zero-balance",
        status: "ready",
      },
      {
        slug: "savings-account-balance",
        title: "Savings Account Balance Report",
        description: "Savings balances by account.",
        href: "/dashboard/reports/savings/savings-balances",
        status: "ready",
      },
    ],
  },
  {
    id: "shares",
    title: "Shares",
    description: "Share capital and shareholding analysis.",
    sources: [
      "share purchases",
      "share transfers",
      "remittances",
      "share balances",
    ],
    icon: PieChart,
    accent: "border-l-violet-500",
    iconTone: "text-violet-600 bg-violet-50",
    reportTone: "border-violet-200 hover:border-violet-400",
    reports: [
      {
        slug: "share-account-balance",
        title: "Share Account Balance Report",
        description: "Share balance by member.",
        href: "/dashboard/reports/shares/share-account-balance",
        status: "ready",
      },
      {
        slug: "share-account-statement",
        title: "Share Account Statement",
        description: "Share statement and movements.",
        href: "/dashboard/reports/shares/share-account-statement",
        status: "ready",
      },
      {
        slug: "share-concentration",
        title: "Share Concentration Report",
        description: "Concentration of shareholding.",
        href: "/dashboard/reports/savings-shares-reports/shares",
        status: "ready",
      },
      {
        slug: "shares-account-listing",
        title: "Shares Account Listing Report",
        description: "List of share accounts.",
        href: "/dashboard/reports/shares/share-accounts-listing",
        status: "ready",
      },
      {
        slug: "shares-batch-totals",
        title: "Shares Batch Totals Report",
        description: "Batch totals for share processing.",
        href: "/dashboard/reports/shares/share-batch-totals",
        status: "ready",
      },
      {
        slug: "shares-transactions",
        title: "Shares Transaction Reports",
        description: "Share purchases and transfer activity.",
        href: "/dashboard/reports/shares/share-transactions",
        status: "ready",
      },
      {
        slug: "shares-zero-balance",
        title: "Shares Zero Balance Report",
        description: "Share accounts with zero balance.",
        href: "/dashboard/reports/shares/share-zero-balance",
        status: "ready",
      },
    ],
  },
  {
    id: "fixed-deposits",
    title: "Fixed Deposits",
    description: "Listings, withdrawals, and maturity tracking.",
    sources: [
      "fixed deposit openings",
      "maturity schedules",
      "withdrawals",
      "closures",
    ],
    icon: Archive,
    accent: "border-l-amber-500",
    iconTone: "text-amber-700 bg-amber-50",
    reportTone: "border-amber-200 hover:border-amber-400",
    reports: [
      {
        slug: "fixed-concentration",
        title: "Fixed Concentration Report",
        description: "Concentration of fixed deposits.",
        href: "/dashboard/reports/fixed-concentration",
        status: "ready",
      },
      {
        slug: "fixed-deposit-listing",
        title: "Fixed Deposit Listing",
        description: "Listing of fixed deposits.",
        href: "/dashboard/reports/fixed-deposits/listing",
        status: "ready",
      },
      {
        slug: "fixed-deposits-withdrawn",
        title: "Fixed Deposits Withdrawn Report",
        description: "Withdrawn fixed deposits.",
        href: "/dashboard/reports/fixed-deposits/withdrawn",
        status: "ready",
      },
      {
        slug: "upcoming-maturing-fixed-deposits",
        title: "Upcoming Maturing Fixed Deposits Report",
        description: "Maturity schedule for fixed deposits.",
        href: "/dashboard/reports/fixed-deposits/maturing",
        status: "ready",
      },
    ],
  },
  {
    id: "transactions",
    title: "Transactions & Journals",
    description: "Cashier status, journals, registers, and sequence checks.",
    sources: [
      "posted transactions",
      "sessions",
      "deposits",
      "withdrawals",
      "fees and charges",
      "float movement",
    ],
    icon: ScrollText,
    accent: "border-l-cyan-500",
    iconTone: "text-cyan-700 bg-cyan-50",
    reportTone: "border-cyan-200 hover:border-cyan-400",
    reports: [
      {
        slug: "cashier-teller-cash-status-by-session",
        title: "Cashier / Teller Cash Status By Session Date",
        description: "Cash position by teller session.",
        href: "/dashboard/reports/transactions/cashier-teller-cash-status-by-session-date",
        status: "ready",
      },
      {
        slug: "day-sheet-by-transaction-date",
        title: "Trx/Day Sheet By Transaction Date",
        description: "Daily transaction sheet by transaction date.",
        href: "/dashboard/reports/transactions/trx-day-sheet-by-transaction-date",
        status: "ready",
      },
      {
        slug: "day-sheet-by-session-date",
        title: "Trx/Day Sheet By Session Date",
        description: "Daily transaction sheet by session date.",
        href: "/dashboard/reports/transactions/trx-day-sheet-by-session-date",
        status: "ready",
      },
      {
        slug: "general-transaction-register-by-session",
        title: "General Transaction Register By Session",
        description: "Transaction register by session.",
        href: "/dashboard/reports/transactions/register-session",
        status: "ready",
      },
      {
        slug: "general-transaction-register-by-transaction-date",
        title: "General Transaction Register By Transaction Date",
        description: "Transaction register by transaction date.",
        href: "/dashboard/reports/transactions/general-transaction-register-by-transaction-date",
        status: "ready",
      },
      {
        slug: "transaction-journal-listing-by-session-date",
        title: "Transaction Journal Listing By Session Date",
        description: "Journal listing by session date.",
        href: "/dashboard/reports/transactions/transaction-journal-listing-by-session-date",
        status: "ready",
      },
      {
        slug: "transaction-journal-listing-by-transaction-date",
        title: "Transaction Journal Listing By Transaction Date",
        description: "Journal listing by transaction date.",
        href: "/dashboard/reports/transactions/journal-transaction",
        status: "ready",
      },
      {
        slug: "transaction-sequence-by-session-date",
        title: "Transaction Sequence By Session Date",
        description: "Transaction sequence by session date.",
        href: "/dashboard/reports/transactions/sequence-session",
        status: "ready",
      },
      {
        slug: "transaction-sequence-by-transaction-date",
        title: "Transaction Sequence By Transaction Date",
        description: "Transaction sequence by transaction date.",
        href: "/dashboard/reports/transactions/sequence-transaction",
        status: "ready",
      },
      {
        slug: "gl-account-performance",
        title: "GL Account Performance",
        description: "General Ledger account period performance with running balances — use this to check transactions for any specific account.",
        href: "/dashboard/reports/gl-performance",
        status: "ready",
      },
    ],
  },
  {
    id: "member-ledger",
    title: "Member & Ledger",
    description: "Ledger views and member ranking reports.",
    sources: [
      "member account movements",
      "balance ranking",
      "statements",
      "fee deductions",
    ],
    icon: BookOpen,
    accent: "border-l-rose-500",
    iconTone: "text-rose-600 bg-rose-50",
    reportTone: "border-rose-200 hover:border-rose-400",
    reports: [
      {
        slug: "personal-ledger",
        title: "Personal Ledger",
        description: "Ledger statement for a member.",
        href: "/dashboard/reports/personal-ledger",
        status: "ready",
      },
      {
        slug: "top-bottom-savers",
        title: "Top Bottom Savers Report",
        description: "Ranking of members by savings.",
        href: "/dashboard/reports/member-ledger/top-bottom-savers",
        status: "ready",
      },
      {
        slug: "top-bottom-share-holders",
        title: "Top Bottom Share Holders Report",
        description: "Ranking of members by shareholding.",
        href: "/dashboard/reports/member-ledger/top-bottom-share-holders",
        status: "ready",
      },
    ],
  },
  {
    id: "performance",
    title: "Performance & Monitoring",
    description: "Exposure, operational health, and KPI tracking.",
    sources: [
      "portfolio exposure",
      "transaction throughput",
      "branch KPIs",
      "agent performance",
    ],
    icon: Activity,
    accent: "border-l-emerald-600",
    iconTone: "text-emerald-700 bg-emerald-50",
    reportTone: "border-emerald-200 hover:border-emerald-400",
    reports: [
      {
        slug: "interest-exposure",
        title: "Interest Exposure Report",
        description: "Interest-risk monitoring summary.",
        href: "/dashboard/reports/interest-exposure",
        status: "ready",
      },
      {
        slug: "performance-monitoring",
        title: "Performance Monitoring Report",
        description: "Operational KPI monitoring.",
        href: "/dashboard/reports/performance-monitoring",
        status: "ready",
      },
    ],
  },
];

export const reportBySlug = new Map<string, ReportItem>(
  reportCatalog.flatMap((category) => category.reports.map((report) => [report.slug, report] as const))
);
