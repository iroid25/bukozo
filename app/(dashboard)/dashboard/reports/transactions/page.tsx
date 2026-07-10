"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  Landmark,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ReportItem = {
  name: string;
  href: string;
  source: string;
  description: string;
};

type ReportGroup = {
  title: string;
  description: string;
  color: string;
  iconBg: string;
  badge: string;
  icon: typeof ClipboardList;
  items: ReportItem[];
};

const reportGroups: ReportGroup[] = [
  {
    title: "Sequence Listings",
    description: "Chronological view of all posted transactions in order of occurrence.",
    color: "from-blue-500/10 to-blue-500/5 border-blue-200 dark:border-blue-800",
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: ClipboardList,
    items: [
      {
        name: "By Selected Date",
        href: "/dashboard/reports/transactions/sequence-session",
        source: "legacy session order",
        description: "Transactions listed in the order they were processed for the selected session-style date.",
      },
      {
        name: "By Transaction Date",
        href: "/dashboard/reports/transactions/sequence-transaction",
        source: "transaction timestamp",
        description: "Transactions listed chronologically by their actual transaction timestamp.",
      },
    ],
  },
  {
    title: "Journal Listings",
    description: "Audit-friendly double-entry registers and journal listings with debit/credit separation.",
    color: "from-emerald-500/10 to-emerald-500/5 border-emerald-200 dark:border-emerald-800",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    icon: FileText,
    items: [
      {
        name: "General Transaction Register",
        href: "/dashboard/reports/transactions/general-transaction-register-by-transaction-date",
        source: "posted register entries",
        description: "Full audit register with debit/credit columns and balance validation.",
      },
      {
        name: "Transaction Journal Listing",
        href: "/dashboard/reports/transactions/transaction-journal-listing-by-session-date",
        source: "journal lines by selected date",
        description: "Detailed journal lines grouped by the selected date with supervisor sign-off blocks.",
      },
    ],
  },
  {
    title: "Day Sheets",
    description: "Daily transaction summaries rolled up by deposits, withdrawals and reversals.",
    color: "from-violet-500/10 to-violet-500/5 border-violet-200 dark:border-violet-800",
    iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    icon: CalendarDays,
    items: [
      {
        name: "Day Sheet By Selected Date",
        href: "/dashboard/reports/transactions/trx-day-sheet-by-session-date",
        source: "selected date totals",
        description: "End-of-day totals grouped by the selected processing date.",
      },
      {
        name: "Day Sheet By Transaction Date",
        href: "/dashboard/reports/transactions/trx-day-sheet-by-transaction-date",
        source: "transaction date totals",
        description: "End-of-day totals grouped by the actual transaction value date.",
      },
    ],
  },
  {
    title: "Registers & Status",
    description: "Transaction registers and real-time cashier/teller cash position reports.",
    color: "from-amber-500/10 to-amber-500/5 border-amber-200 dark:border-amber-800",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon: Wallet,
    items: [
      {
        name: "Register (Selected Date)",
        href: "/dashboard/reports/transactions/register-session",
        source: "selected date register",
        description: "Transaction register summarised by the selected date with running totals.",
      },
      {
        name: "Register (Transaction Date)",
        href: "/dashboard/reports/transactions/register-transaction",
        source: "transaction-date register",
        description: "Transaction register summarised by value date with running totals.",
      },
      {
        name: "Cashier / Teller Cash Status",
        href: "/dashboard/reports/transactions/cashier-teller-cash-status-by-session-date",
        source: "teller float & cash position",
        description: "Live teller float position, opening balance, and net cash movement.",
      },
    ],
  },
  {
    title: "Fee Reports",
    description: "Withdrawal fees and service charges collected over a selected period.",
    color: "from-rose-500/10 to-rose-500/5 border-rose-200 dark:border-rose-800",
    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    icon: Landmark,
    items: [
      {
        name: "Withdrawal Fee Report",
        href: "/dashboard/reports/transactions/withdrawal-fee-report",
        source: "withdrawal transactions with fee",
        description: "All withdrawals that attracted a service fee, with per-transaction fee breakdown.",
      },
    ],
  },
  {
    title: "GL Analysis",
    description: "General Ledger account performance and running balance summaries.",
    color: "from-indigo-500/10 to-indigo-500/5 border-indigo-200 dark:border-indigo-800",
    iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    icon: BarChart3,
    items: [
      {
        name: "GL Account Performance",
        href: "/dashboard/reports/gl-performance",
        source: "chart of accounts",
        description: "Period performance and running balances for each GL account.",
      },
    ],
  },
];

const statCards = [
  { label: "Report Categories", value: "6", sub: "Sequence · Journal · Day Sheet · Registers · Fees · GL" },
  { label: "Total Reports", value: "11", sub: "Across all categories" },
  { label: "Export Formats", value: "2", sub: "PDF print · Excel download" },
  { label: "Data Coverage", value: "All Branches", sub: "With role-based filtering" },
];

export default function TransactionReportsPage() {
  return (
    <div className="flex min-h-screen flex-col space-y-8 p-6 md:p-8">

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Reports</span>
          <span>/</span>
          <span className="text-foreground font-medium">Transactions</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transaction Reports</h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              API-backed transaction and journal reports across all branches. Select a report below to view, filter, and export data.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Live refresh every 15 s
          </div>
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{s.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Report Groups ── */}
      <div className="grid gap-5 md:grid-cols-2">
        {reportGroups.map((group) => {
          const Icon = group.icon;
          return (
            <div
              key={group.title}
              className={`rounded-2xl border bg-gradient-to-br ${group.color} p-5 shadow-sm flex flex-col gap-4`}
            >
              {/* Group header */}
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 rounded-xl p-2.5 ${group.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-base leading-tight">{group.title}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${group.badge}`}>
                      {group.items.length} reports
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{group.description}</p>
                </div>
              </div>

              {/* Report items */}
              <div className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-start gap-3 rounded-xl border border-transparent bg-background/70 px-4 py-3 shadow-sm transition-all hover:border-border hover:bg-background hover:shadow-md"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                      <Badge variant="outline" className="mt-1.5 h-5 rounded-full px-2 text-[10px] font-normal">
                        {item.source}
                      </Badge>
                    </div>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
