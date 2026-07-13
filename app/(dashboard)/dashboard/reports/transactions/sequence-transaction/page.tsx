"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { ArrowDownUp, Hash, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SequenceRow {
  id: string;
  sequence: number;
  transactionRef: string;
  transactionDate: string;
  memberName: string;
  accountNumber: string;
  accountType: string;
  type: string;
  transactionType: string;
  amount: number;
  status: string;
  processedBy: string;
  teller: { name: string };
  branch: { name: string };
  channel: string;
  description: string;
}

const CREDIT_TYPES = new Set(["DEPOSIT", "LOAN_DISBURSEMENT", "TRANSFER"]);

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

function ugx(n: number) {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(n);
}

const columns: Column<SequenceRow>[] = [
  {
    header: "#",
    accessorKey: "sequence",
  },
  {
    header: "Ref No.",
    accessorKey: "transactionRef",
  },
  {
    header: "Transaction Date",
    accessorKey: "transactionDate",
    cell: (row) => new Date(row.transactionDate).toLocaleString("en-UG"),
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
    header: "Amount (UGX)",
    accessorKey: "amount",
    cell: (row) => (
      <span className={CREDIT_TYPES.has(row.type) ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
        {ugx(row.amount)}
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
    header: "Channel",
    accessorKey: "channel",
  },
  {
    header: "Teller",
    accessorKey: (row) => row.teller?.name || row.processedBy || "System",
  },
  {
    header: "Branch",
    accessorKey: (row) => row.branch?.name || "Head Office",
  },
];

export default function SequenceByTransactionPage() {
  return (
    <GenericReportPage
      title="Transaction Sequence (By Transaction Date)"
      description="All transactions listed chronologically by their actual value date. Source: Transaction table — covers all types."
      endpoint="/api/v1/reports/transactions/sequence-transaction"
      columns={columns}
      keyField="id"
      searchFields={["transactionRef", "memberName", "accountNumber", "accountType", "channel", "description", "type"]}
      typeField="type"
      typeOptions={TRANSACTION_TYPES}
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard
            title="Total Transactions"
            value={summary.count?.toString() ?? "0"}
            icon={Hash}
          />
          <ReportSummaryCard
            title="Total Volume"
            value={ugx(summary.totalAmount ?? 0)}
            icon={ArrowDownUp}
          />
          <ReportSummaryCard
            title="Total Deposits"
            value={ugx(summary.totalDeposits ?? 0)}
            icon={TrendingUp}
            className="border-emerald-200 bg-emerald-50/50"
          />
          <ReportSummaryCard
            title="Total Withdrawals"
            value={ugx(summary.totalWithdrawals ?? 0)}
            icon={TrendingDown}
            className="border-rose-200 bg-rose-50/50"
          />
        </>
      )}
    />
  );
}
