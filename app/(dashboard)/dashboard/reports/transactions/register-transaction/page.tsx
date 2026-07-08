"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { ArrowDownUp, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Shape returned by /api/v1/reports/transactions/register-transaction
interface RegisterRow {
  transactionRef: string;
  transactionDate: string;
  date: string;
  memberName: string;
  accountNumber: string;
  accountType: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
  status: string;
  processedBy: string;
  processedByRole: string;
  branch: string;
  channel: string;
  description: string;
}

function ugx(n: number) {
  return new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(n);
}

const columns: Column<RegisterRow>[] = [
  {
    header: "Txn Date",
    accessorKey: "date",
    cell: (row) => new Date(row.date).toLocaleDateString("en-UG"),
  },
  {
    header: "Ref No.",
    accessorKey: "transactionRef",
  },
  {
    header: "Member",
    accessorKey: "memberName",
  },
  {
    header: "Account No.",
    accessorKey: "accountNumber",
  },
  {
    header: "Account Type",
    accessorKey: "accountType",
  },
  {
    header: "Type",
    accessorKey: "type",
    cell: (row) => (
      <Badge variant="outline" className="capitalize text-xs">
        {row.type.replace(/_/g, " ").toLowerCase()}
      </Badge>
    ),
  },
  {
    header: "Channel",
    accessorKey: "channel",
  },
  {
    header: "Debit (UGX)",
    accessorKey: "debit",
    cell: (row) => (
      <span className={row.debit > 0 ? "text-rose-600 font-medium" : "text-muted-foreground"}>
        {row.debit > 0 ? ugx(row.debit) : "—"}
      </span>
    ),
  },
  {
    header: "Credit (UGX)",
    accessorKey: "credit",
    cell: (row) => (
      <span className={row.credit > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
        {row.credit > 0 ? ugx(row.credit) : "—"}
      </span>
    ),
  },
  {
    header: "Balance (UGX)",
    accessorKey: "balance",
    cell: (row) => (
      <span className={row.balance < 0 ? "text-destructive font-semibold" : "font-medium"}>
        {ugx(row.balance)}
      </span>
    ),
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: (row) => (
      <Badge variant={row.status === "REVERSED" ? "destructive" : "secondary"} className="text-xs">
        {row.status}
      </Badge>
    ),
  },
  {
    header: "Processed By",
    accessorKey: "processedBy",
  },
  {
    header: "Branch",
    accessorKey: "branch",
  },
];

export default function RegisterTransactionPage() {
  return (
    <GenericReportPage
      title="Transaction Register (By Transaction Date)"
      description="Running-balance register ordered by the transaction value date (uses valueDate when set). Source: Transaction table."
      endpoint="/api/v1/reports/transactions/register-transaction"
      columns={columns}
      keyField="transactionRef"
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard
            title="Total Transactions"
            value={summary.totalTransactions?.toString() ?? "0"}
            icon={Wallet}
          />
          <ReportSummaryCard
            title="Total Debits"
            value={ugx(summary.totalDebits ?? 0)}
            icon={TrendingDown}
            className="border-rose-200 bg-rose-50/50"
          />
          <ReportSummaryCard
            title="Total Credits"
            value={ugx(summary.totalCredits ?? 0)}
            icon={TrendingUp}
            className="border-emerald-200 bg-emerald-50/50"
          />
          <ReportSummaryCard
            title="Closing Balance"
            value={ugx(summary.closingBalance ?? 0)}
            icon={ArrowDownUp}
          />
        </>
      )}
    />
  );
}
