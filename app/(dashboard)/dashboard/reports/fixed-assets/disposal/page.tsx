"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { Trash2 } from "lucide-react";

interface DisposalRecord {
  assetCode: string;
  assetName: string;
  disposalDate: string;
  disposalAmount: number;
  bookValueAtDisposal: number;
  gainLoss: number;
}

const columns: Column<DisposalRecord>[] = [
  { header: "Asset Code", accessorKey: "assetCode" },
  { header: "Asset Name", accessorKey: "assetName" },
  { header: "Disposal Date", accessorKey: "disposalDate", cell: (row) => new Date(row.disposalDate).toLocaleDateString() },
  { header: "Sale Amount", accessorKey: "disposalAmount", cell: (row) => row.disposalAmount.toLocaleString() },
  { header: "Book Value", accessorKey: "bookValueAtDisposal", cell: (row) => row.bookValueAtDisposal.toLocaleString() },
  { 
    header: "Gain/Loss", 
    accessorKey: "gainLoss",
    cell: (row) => (
      <span className={row.gainLoss >= 0 ? "text-green-600" : "text-red-600"}>
        {row.gainLoss.toLocaleString()}
      </span>
    )
  },
];

export default function AssetDisposalPage() {
  return (
    <GenericReportPage
      title="Asset Disposal Report"
      description="List of assets disposed or written off."
      endpoint="/api/v1/reports/fixed-assets"
      method="POST"
      extraParams={{ reportType: "assets-disposal" }}
      columns={columns}
      keyField="assetCode"
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard title="Disposed Assets" value={summary.totalRecords} icon={Trash2} />
          <ReportSummaryCard title="Total Proceeds" value={summary.totalDisposalAmount?.toLocaleString()} />
          <ReportSummaryCard title="Total Gain/Loss" value={summary.totalGainLoss?.toLocaleString()} />
        </>
      )}
    />
  );
}
