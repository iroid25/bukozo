"use client";

import React from "react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { Calculator } from "lucide-react";

interface DepreciationRecord {
  assetCode: string;
  assetName: string;
  year: number;
  month: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

const columns: Column<DepreciationRecord>[] = [
  { header: "Asset Code", accessorKey: "assetCode" },
  { header: "Asset Name", accessorKey: "assetName" },
  { header: "Period", accessorKey: "month", cell: (row) => `${row.month}/${row.year}` },
  { header: "Depreciation", accessorKey: "depreciationAmount", cell: (row) => row.depreciationAmount.toLocaleString() },
  { header: "Accumulated", accessorKey: "accumulatedDepreciation", cell: (row) => row.accumulatedDepreciation.toLocaleString() },
  { header: "Book Value", accessorKey: "bookValue", cell: (row) => row.bookValue.toLocaleString() },
];

export default function AssetDepreciationPage() {
  return (
    <GenericReportPage
      title="Depreciation Schedule"
      description="Depreciation entries for the current financial year."
      endpoint="/api/v1/reports/fixed-assets"
      method="POST"
      extraParams={{ reportType: "assets-depreciation", year: new Date().getFullYear() }}
      columns={columns}
      keyField="assetCode" // Warning: duplicate keys if multiple months per asset. Need composite key.
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard title="Total Records" value={summary.totalRecords} icon={Calculator} />
          <ReportSummaryCard title="Total Depreciation" value={summary.totalDepreciation?.toLocaleString()} />
        </>
      )}
    />
  );
}
