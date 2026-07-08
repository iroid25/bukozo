"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { Archive, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Shape returned by /api/v1/reports/fixed-deposits/active
interface FixedDeposit {
  id: string;
  accountNumber: string;
  memberName: string;
  principalAmount: number;
  interestRate: number;
  startDate: string;
  maturityDate: string;
  daysToMaturity: number;
  branch: string;
}

function ugx(n: number) {
  return new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(n);
}

const columns: Column<FixedDeposit>[] = [
  { header: "Account No.", accessorKey: "accountNumber" },
  { header: "Member", accessorKey: "memberName" },
  {
    header: "Principal (UGX)",
    accessorKey: "principalAmount",
    cell: (row) => <span className="font-medium">{ugx(row.principalAmount)}</span>,
  },
  { header: "Rate (%)", accessorKey: "interestRate" },
  {
    header: "Start Date",
    accessorKey: "startDate",
    cell: (row) => new Date(row.startDate).toLocaleDateString("en-UG"),
  },
  {
    header: "Maturity Date",
    accessorKey: "maturityDate",
    cell: (row) => new Date(row.maturityDate).toLocaleDateString("en-UG"),
  },
  {
    header: "Days to Maturity",
    accessorKey: "daysToMaturity",
    cell: (row) => (
      <Badge variant={row.daysToMaturity <= 30 ? "destructive" : "secondary"}>
        {row.daysToMaturity}d
      </Badge>
    ),
  },
  { header: "Branch", accessorKey: "branch" },
];

export default function ActiveFixedDepositsPage() {
  return (
    <GenericReportPage
      title="Active Fixed Deposits"
      description="List of currently active fixed deposit accounts. Source: FixedDeposit model."
      endpoint="/api/v1/reports/fixed-deposits/active"
      columns={columns}
      keyField="id"
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard title="Active Accounts" value={summary.totalRecords?.toString() ?? "0"} icon={Archive} />
          <ReportSummaryCard title="Total Principal" value={ugx(summary.totalAmount ?? 0)} icon={Building2} />
        </>
      )}
    />
  );
}
