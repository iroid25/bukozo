"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { ArrowLeftRight, FileText, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TRANSACTION_TYPES = [
  { label: "Deposit", value: "DEPOSIT" },
  { label: "Withdrawal", value: "WITHDRAWAL" },
  { label: "Loan Disbursement", value: "LOAN_DISBURSEMENT" },
  { label: "Loan Repayment", value: "LOAN_REPAYMENT" },
  { label: "Fee", value: "FEE" },
  { label: "Transfer", value: "TRANSFER" },
  { label: "Shares Purchase", value: "SHARES_PURCHASE" },
  { label: "Insurance Premium", value: "INSURANCE_PREMIUM" },
  { label: "Float Allocation", value: "FLOAT_ALLOCATION" },
  { label: "Float Purchase", value: "FLOAT_PURCHASE" },
  { label: "Float Reconciliation", value: "FLOAT_RECONCILIATION" },
  { label: "Loan Fee", value: "LOAN_FEE" },
];

// Shape returned by /api/v1/reports/transactions/journal-transaction
interface JournalRow {
  entryNumber: string;
  transactionRef: string;
  transactionDate: string;
  entryDate: string;
  accountCode: string;
  accountName: string;
  ledgerType: string;
  debitAmount: number;
  creditAmount: number;
  description: string;
  memberName: string;
  transactionType: string;
  createdBy: string;
}

function ugx(n: number) {
  return new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(n);
}

const columns: Column<JournalRow>[] = [
  {
    header: "Entry No.",
    accessorKey: "entryNumber",
  },
  {
    header: "Txn Ref",
    accessorKey: "transactionRef",
  },
  {
    header: "Txn Date",
    accessorKey: "transactionDate",
    cell: (row) => new Date(row.transactionDate).toLocaleDateString("en-UG"),
  },
  {
    header: "Entry Date",
    accessorKey: "entryDate",
    cell: (row) => new Date(row.entryDate).toLocaleDateString("en-UG"),
  },
  {
    header: "GL A/C Code",
    accessorKey: "accountCode",
  },
  {
    header: "Account Name",
    accessorKey: "accountName",
  },
  {
    header: "Ledger Type",
    accessorKey: "ledgerType",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">
        {row.ledgerType}
      </Badge>
    ),
  },
  {
    header: "Debit (UGX)",
    accessorKey: "debitAmount",
    cell: (row) => (
      <span className={row.debitAmount > 0 ? "text-rose-600 font-medium" : "text-muted-foreground"}>
        {row.debitAmount > 0 ? ugx(row.debitAmount) : "—"}
      </span>
    ),
  },
  {
    header: "Credit (UGX)",
    accessorKey: "creditAmount",
    cell: (row) => (
      <span className={row.creditAmount > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
        {row.creditAmount > 0 ? ugx(row.creditAmount) : "—"}
      </span>
    ),
  },
  {
    header: "Txn Type",
    accessorKey: "transactionType",
    cell: (row) => (
      <Badge variant="secondary" className="capitalize text-xs">
        {row.transactionType.replace(/_/g, " ").toLowerCase()}
      </Badge>
    ),
  },
  {
    header: "Member",
    accessorKey: "memberName",
  },
  {
    header: "Description",
    accessorKey: "description",
  },
  {
    header: "Posted By",
    accessorKey: "createdBy",
  },
];

export default function JournalTransactionPage() {
  return (
    <GenericReportPage
      title="Journal Listing (By Transaction Date)"
      description="Double-entry journal lines filtered by the transaction's actual value date. Manual entries without a linked transaction fall back to entry date. Source: JournalEntry → Transaction."
      endpoint="/api/v1/reports/transactions/journal-transaction"
      columns={columns}
      keyField="entryNumber"
      searchFields={["entryNumber", "transactionRef", "accountCode", "accountName", "memberName", "description", "createdBy", "transactionType"]}
      typeField="transactionType"
      typeOptions={TRANSACTION_TYPES}
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard
            title="Total Entries"
            value={summary.totalEntries?.toString() ?? "0"}
            icon={FileText}
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
            title="Balance Check"
            value={
              Math.abs((summary.totalDebits ?? 0) - (summary.totalCredits ?? 0)) < 0.01
                ? "BALANCED"
                : "UNBALANCED"
            }
            icon={ArrowLeftRight}
            className={
              Math.abs((summary.totalDebits ?? 0) - (summary.totalCredits ?? 0)) < 0.01
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50"
            }
          />
        </>
      )}
    />
  );
}
