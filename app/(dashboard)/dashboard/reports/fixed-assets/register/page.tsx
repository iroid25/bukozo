"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { Building } from "lucide-react";

interface AssetRecord {
  assetCode: string;
  assetName: string;
  category: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  branch: string;
  status: string;
}

const columns: Column<AssetRecord>[] = [
  { header: "Asset Code", accessorKey: "assetCode" },
  { header: "Asset Name", accessorKey: "assetName" },
  { header: "Category", accessorKey: "category" },
  { header: "Purchase Date", accessorKey: "purchaseDate", cell: (row) => new Date(row.purchaseDate).toLocaleDateString() },
  { header: "Cost", accessorKey: "purchasePrice", cell: (row) => row.purchasePrice.toLocaleString() },
  { header: "Current Value", accessorKey: "currentValue", cell: (row) => row.currentValue.toLocaleString() },
  { header: "Branch", accessorKey: "branch" },
  { header: "Status", accessorKey: "status" },
];

export default function AssetRegisterPage() {
  return (
    <GenericReportPage
      title="Asset Register"
      description="List of assets registered within the selected period."
      endpoint="/api/v1/reports/fixed-assets"
      method="POST"
      extraParams={{ reportType: "assets-registered" }}
      columns={columns}
      keyField="assetCode"
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard title="Total Assets" value={summary.totalRecords} icon={Building} />
          <ReportSummaryCard title="Total Cost" value={summary.totalPurchaseValue?.toLocaleString()} />
          <ReportSummaryCard title="Current Value" value={summary.totalCurrentValue?.toLocaleString()} />
        </>
      )}
    />
  );
}
