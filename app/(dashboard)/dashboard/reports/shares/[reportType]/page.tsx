"use client";

import React from "react";
import { useParams } from "next/navigation";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { PieChart } from "lucide-react";

interface ShareRecord {
  memberNumber: string;
  memberName: string;
  shareType: string;
  numberOfShares: number;
  valuePerShare: number;
  totalValue: number;
}

const columns: Column<ShareRecord>[] = [
  { header: "Member No.", accessorKey: "memberNumber" },
  { header: "Member Name", accessorKey: "memberName" },
  { header: "Share Type", accessorKey: "shareType" },
  { header: "Shares", accessorKey: "numberOfShares", cell: (row) => row.numberOfShares.toLocaleString() },
  { header: "Value/Share", accessorKey: "valuePerShare", cell: (row) => row.valuePerShare.toLocaleString() },
  { 
    header: "Total Value", 
    accessorKey: "totalValue",
    cell: (row) => row.totalValue.toLocaleString() 
  },
];

const reportTitles: Record<string, string> = {
    "shares-listing": "Share Register",
    "shares-performance": "Share Performance",
    "shares-transfers": "Share Transfers",
};

export default function DynamicSharesReportPage() {
  const params = useParams();
  const reportType = params?.reportType as string;
  const title = reportTitles[reportType] || "Share Report";

  return (
    <GenericReportPage
      title={title}
      description={`Share report: ${title}`}
      endpoint="/api/v1/reports/comprehensive"
      method="POST"
      extraParams={{ reportType }}
      columns={columns}
      keyField="memberNumber"
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard title="Total Shareholders" value={summary.count} icon={PieChart} />
          <ReportSummaryCard title="Total Shares" value={summary.totalShares?.toLocaleString()} />
          <ReportSummaryCard title="Capital Value" value={summary.totalValue?.toLocaleString()} />
        </>
      )}
    />
  );
}
