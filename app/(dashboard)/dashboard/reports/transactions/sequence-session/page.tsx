"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { ArrowDownUp, BadgeCheck, Hash, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SequenceRow {
  id: string;
  sequence: number;
  transactionRef: string;
  sessionId: string;
  sessionDate: string;
  transactionDate: string;
  memberName: string;
  accountNumber: string;
  type: string;
  transactionType: string;
  amount: number;
  status: string;
  processedBy: string;
  teller: { name: string };
  branch: { name: string };
  description: string;
}

const CREDIT_TYPES = new Set(["DEPOSIT", "LOAN_DISBURSEMENT", "TRANSFER"]);

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
    header: "Session Date",
    accessorKey: "sessionDate",
    cell: (row) => new Date(row.sessionDate).toLocaleDateString("en-UG"),
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
    header: "Teller",
    accessorKey: (row) => row.teller?.name || row.processedBy || "System",
  },
  {
    header: "Branch",
    accessorKey: (row) => row.branch?.name || "Head Office",
  },
  {
    header: "Description",
    accessorKey: "description",
  },
];

export default function SequenceBySessionPage() {
  return (
    <GenericReportPage
      title="Transaction Sequence (By Session Date)"
      description="All transactions listed in the order they were posted by session date. Source: Transaction table — covers all types."
      endpoint="/api/v1/reports/transactions/sequence-session"
      columns={columns}
      keyField="id"
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
