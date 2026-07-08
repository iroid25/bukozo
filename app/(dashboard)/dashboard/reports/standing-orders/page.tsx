"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { Repeat } from "lucide-react";

interface StandingOrder {
  id: string;
  description: string;
  amount: number;
  frequency: string;
  nextRunDate: string;
  status: string;
  account: { accountNumber: string };
}

const columns: Column<StandingOrder>[] = [
  { header: "Description", accessorKey: "description" },
  { header: "Account", accessorKey: (row) => row.account?.accountNumber || 'N/A' },
  { header: "Amount", accessorKey: "amount", cell: (row) => row.amount.toLocaleString() },
  { header: "Frequency", accessorKey: "frequency" },
  { header: "Next Run", accessorKey: "nextRunDate", cell: (row) => new Date(row.nextRunDate).toLocaleDateString() },
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
      description="List of active and executed standing orders."
      endpoint="/api/v1/reports/standing-orders"
      columns={columns}
      keyField="id"
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard title="Total Orders" value={summary.count} icon={Repeat} />
          <ReportSummaryCard title="Total Value" value={summary.totalAmount?.toLocaleString()} />
          <ReportSummaryCard title="Successful Executions" value={summary.successfulExecutions || 0} />
        </>
      )}
    />
  );
}
