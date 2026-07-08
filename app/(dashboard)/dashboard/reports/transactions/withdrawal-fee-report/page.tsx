"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { Banknote, Hash, Landmark, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WithdrawalFeeRow {
  sequence: number;
  id: string;
  transactionRef: string;
  transactionDate: string;
  status: string;
  memberName: string;
  accountNumber: string;
  accountType: string;
  branch: string;
  channel: string;
  withdrawalAmount: number;
  chargedFee: number;
  expectedFee: number;
  feeDifference: number;
  totalDeducted: number;
  processedBy: string;
}

function ugx(n: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(n);
}

const columns: Column<WithdrawalFeeRow>[] = [
  { header: "#", accessorKey: "sequence" },
  { header: "Ref No.", accessorKey: "transactionRef" },
  { header: "Status", accessorKey: "status" },
  {
    header: "Date",
    accessorKey: "transactionDate",
    cell: (row) => new Date(row.transactionDate).toLocaleString("en-UG"),
  },
  { header: "Member", accessorKey: "memberName" },
  { header: "Account No.", accessorKey: "accountNumber" },
  { header: "Account Type", accessorKey: "accountType" },
  { header: "Branch", accessorKey: "branch" },
  {
    header: "Channel",
    accessorKey: "channel",
    cell: (row) => (
      <Badge variant="outline" className="text-xs capitalize">
        {row.channel.toLowerCase()}
      </Badge>
    ),
  },
  {
    header: "Withdrawal (UGX)",
    accessorKey: "withdrawalAmount",
    cell: (row) => (
      <span className="font-medium text-rose-600">{ugx(row.withdrawalAmount)}</span>
    ),
  },
  {
    header: "Charged Fee (UGX)",
    accessorKey: "chargedFee",
    cell: (row) => (
      <span className="font-semibold text-amber-700">{ugx(row.chargedFee)}</span>
    ),
  },
  {
    header: "Expected Fee (UGX)",
    accessorKey: "expectedFee",
    cell: (row) => (
      <span className="font-semibold text-emerald-700">{ugx(row.expectedFee)}</span>
    ),
  },
  {
    header: "Variance (UGX)",
    accessorKey: "feeDifference",
    cell: (row) => (
      <span className={row.feeDifference === 0 ? "font-medium text-slate-700" : row.feeDifference > 0 ? "font-medium text-amber-700" : "font-medium text-rose-700"}>
        {ugx(row.feeDifference)}
      </span>
    ),
  },
  {
    header: "Total Deducted (UGX)",
    accessorKey: "totalDeducted",
    cell: (row) => <span className="font-bold">{ugx(row.totalDeducted)}</span>,
  },
  { header: "Processed By", accessorKey: "processedBy" },
];

export default function WithdrawalFeeReportPage() {
  return (
    <GenericReportPage
      title="Completed Withdrawal Fee Report"
      description="Completed withdrawals with the fee actually charged, the fee expected from the current withdrawal rules, and any variance between the two."
      endpoint="/api/v1/reports/transactions/withdrawal-fees"
      columns={columns}
      keyField="id"
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard
            title="Completed Withdrawals"
            value={summary.count?.toString() ?? "0"}
            icon={Hash}
          />
          <ReportSummaryCard
            title="Charged Fees"
            value={ugx(summary.totalChargedFees ?? 0)}
            icon={Landmark}
            className="border-amber-200 bg-amber-50/50"
          />
          <ReportSummaryCard
            title="Expected Fees"
            value={ugx(summary.totalExpectedFees ?? 0)}
            icon={Banknote}
            className="border-emerald-200 bg-emerald-50/50"
          />
          <ReportSummaryCard
            title="Fee Variance"
            value={ugx(summary.totalFeeVariance ?? 0)}
            icon={TrendingDown}
          />
        </>
      )}
    />
  );
}
