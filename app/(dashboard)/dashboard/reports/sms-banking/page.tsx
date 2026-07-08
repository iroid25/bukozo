"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { MessageSquare } from "lucide-react";

interface SmsLog {
  id: string;
  phoneNumber: string;
  message: string;
  status: string;
  createdAt: string;
  cost: number;
}

const columns: Column<SmsLog>[] = [
  { header: "Date", accessorKey: "createdAt", cell: (row) => new Date(row.createdAt).toLocaleString() },
  { header: "Phone Number", accessorKey: "phoneNumber" },
  { header: "Message", accessorKey: "message", cell: (row) => row.message.length > 50 ? row.message.substring(0, 50) + "..." : row.message },
  { header: "Status", accessorKey: "status" },
  { header: "Cost", accessorKey: "cost", cell: (row) => row.cost?.toLocaleString() || '0' },
];

export default function SmsBankingReportPage() {
  return (
    <GenericReportPage
      title="SMS Banking Logs"
      description="Log of all SMS messages sent and received."
      endpoint="/api/v1/reports/sms-banking"
      columns={columns}
      keyField="id"
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard title="Total SMS" value={summary.count} icon={MessageSquare} />
          <ReportSummaryCard title="Total Cost" value={summary.totalCost?.toLocaleString()} />
          <ReportSummaryCard title="Delivery Rate" value={`${summary.deliveryRate || 0}%`} />
        </>
      )}
    />
  );
}
