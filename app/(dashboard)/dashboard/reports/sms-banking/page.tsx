"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { MessageSquare } from "lucide-react";

interface SmsLog {
  id: string;
  phoneNumber: string;
  memberName: string;
  smsType: string;
  message: string;
  status: string;
  sentAt: string;
  deliveredAt: string;
  cost: number;
  provider: string;
}

const columns: Column<SmsLog>[] = [
  { header: "Sent At", accessorKey: "sentAt", cell: (row) => new Date(row.sentAt).toLocaleString() },
  { header: "Phone Number", accessorKey: "phoneNumber" },
  { header: "Member", accessorKey: "memberName" },
  { header: "Type", accessorKey: "smsType" },
  { header: "Message", accessorKey: "message", cell: (row) => row.message.length > 50 ? row.message.substring(0, 50) + "..." : row.message },
  { header: "Status", accessorKey: "status" },
  { header: "Delivered At", accessorKey: "deliveredAt", cell: (row) => new Date(row.deliveredAt).toLocaleString() },
  { header: "Cost", accessorKey: "cost", cell: (row) => row.cost?.toLocaleString() || '0' },
  { header: "Provider", accessorKey: "provider" },
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
          <ReportSummaryCard title="Total SMS" value={summary.totalRecords || 0} icon={MessageSquare} />
          <ReportSummaryCard title="Total Cost" value={summary.totalCost?.toLocaleString() || "0"} />
          <ReportSummaryCard title="Delivered" value={summary.delivered || 0} />
        </>
      )}
    />
  );
}
