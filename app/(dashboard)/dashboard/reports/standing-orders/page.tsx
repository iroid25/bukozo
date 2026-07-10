"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { Repeat } from "lucide-react";

interface StandingOrder {
  referenceNumber: string;
  memberName: string;
  accountNumber: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  amount: number;
  frequency: string;
  startDate: string;
  endDate: string;
  nextExecutionDate: string;
  lastExecutionDate: string;
  status: string;
  executionCount: number;
  failureCount: number;
  createdBy: string;
}

const columns: Column<StandingOrder>[] = [
  { header: "Reference", accessorKey: "referenceNumber" },
  { header: "Member", accessorKey: "memberName" },
  { header: "Account", accessorKey: "accountNumber" },
  { header: "Beneficiary", accessorKey: "beneficiaryName" },
  { header: "Beneficiary Account", accessorKey: "beneficiaryAccount" },
  { header: "Amount", accessorKey: "amount", cell: (row) => row.amount.toLocaleString() },
  { header: "Frequency", accessorKey: "frequency" },
  { header: "Next Execution", accessorKey: "nextExecutionDate", cell: (row) => new Date(row.nextExecutionDate).toLocaleDateString() },
  { header: "Last Execution", accessorKey: "lastExecutionDate", cell: (row) => new Date(row.lastExecutionDate).toLocaleDateString() },
  { 
    header: "Status", 
    accessorKey: "status",
    cell: (row) => (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
        row.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
      }`}>
        {row.status}
      </span>
    )
  },
];

export default function StandingOrdersReportPage() {
  return (
    <GenericReportPage
      title="Standing Orders"
      description="List of standing orders and execution history."
      endpoint="/api/v1/reports/standing-orders"
      columns={columns}
      keyField="referenceNumber"
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard title="Total Orders" value={summary.totalRecords || 0} icon={Repeat} />
          <ReportSummaryCard title="Monthly Value" value={summary.totalMonthlyAmount?.toLocaleString() || "0"} />
          <ReportSummaryCard title="Active Orders" value={summary.activeOrders || 0} />
        </>
      )}
    />
  );
}
