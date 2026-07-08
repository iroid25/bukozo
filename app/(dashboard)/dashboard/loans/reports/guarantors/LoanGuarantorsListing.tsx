"use client";

import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ReportHeader } from "@/components/reports/ReportHeader";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface GuarantorsListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function GuarantorsListing({
  title,
  subtitle,
  initialRole,
}: GuarantorsListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/guarantors${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to fetch data");
        toast.error(result.error || "Failed to fetch data");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setError("An error occurred while fetching data");
      toast.error("An error occurred while fetching data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const columns: Column<any>[] = [
    {
      header: "Guarantor Name",
      accessorKey: "guarantorName",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.guarantorName}</span>
          <span className="text-xs text-muted-foreground">
            {row.guarantorIdNumber || "N/A"}
          </span>
        </div>
      ),
    },
    {
      header: "Contact",
      accessorKey: "guarantorPhone",
      cell: (row: any) => (
        <span className="text-sm">{row.guarantorPhone || "N/A"}</span>
      ),
    },
    {
      header: "Borrower",
      accessorKey: "memberName",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.memberName}</span>
          <span className="text-xs text-muted-foreground">
            {row.memberNumber}
          </span>
        </div>
      ),
    },
    {
      header: "Loan Amount",
      accessorKey: "amountApplied",
      cell: (row: any) => (
        <span className="font-semibold text-blue-600">
          {formatCurrency(row.amountApplied || 0)}
        </span>
      ),
    },
    {
      header: "Guarantor Amount",
      accessorKey: "guaranteedAmount",
      cell: (row: any) => (
        <span className="font-semibold text-purple-600">
          {formatCurrency(row.guaranteedAmount || 0)}
        </span>
      ),
    },
    {
      header: "Loan Status",
      accessorKey: "loanStatus",
      cell: (row: any) => (
        <Badge variant="secondary">{row.loanStatus || row.status || "N/A"}</Badge>
      ),
    },
  ];

  const guarantorsList = data?.guarantorsList || [];
  const summary = data?.summary || {
    totalLoans: 0,
    totalGuarantors: 0,
    averageGuarantorsPerLoan: 0,
  };

  // Flatten guarantors data - each guarantor gets its own row
  const flattenedData: any[] = [];
  guarantorsList.forEach((loan: any) => {
    if (loan.guarantors && loan.guarantors.length > 0) {
      loan.guarantors.forEach((guarantor: any) => {
        flattenedData.push({
          loanApplicationId: loan.loanApplicationId,
          loanId: loan.loanId || "N/A",
          memberName: loan.memberName,
          memberNumber: loan.memberNumber,
          loanProduct: loan.loanProduct,
          amountApplied: loan.amountApplied,
          status: loan.status,
          loanStatus: loan.loanStatus,
          outstandingBalance: loan.outstandingBalance,
          guarantorName: guarantor.name,
          guarantorPhone: guarantor.phone,
          guarantorIdNumber: guarantor.idNumber,
          guarantorAddress: guarantor.address,
          relationship: guarantor.relationship,
          guaranteedAmount: guarantor.guaranteedAmount,
        });
      });
    } else {
      // Loan with no guarantors
      flattenedData.push({
        loanApplicationId: loan.loanApplicationId,
        loanId: loan.loanId || "N/A",
        memberName: loan.memberName,
        memberNumber: loan.memberNumber,
        loanProduct: loan.loanProduct,
        amountApplied: loan.amountApplied,
        status: loan.status,
        loanStatus: loan.loanStatus,
        outstandingBalance: loan.outstandingBalance,
        guarantorName: "No Guarantor",
        guarantorPhone: "N/A",
        guarantorIdNumber: "N/A",
        guarantorAddress: "N/A",
        relationship: "N/A",
        guaranteedAmount: 0,
      });
    }
  });

  const handleExport = async (filteredData: any[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item: any) => ({
        "Guarantor Name": item.guarantorName,
        "A/C (ID)": item.guarantorIdNumber || "N/A",
        Contact: item.guarantorPhone || "N/A",
        "Borrower Name": item.memberName,
        "Borrower Number": item.memberNumber,
        "Loan Amount": item.amountApplied,
        "Guarantor Amount": item.guaranteedAmount,
        "Loan Status": item.loanStatus || item.status,
      }));

      const filteredSummary = {
        count: filteredData.length,
        totalGuaranteed: filteredData.reduce(
          (sum, item) => sum + (item.guaranteedAmount || 0),
          0
        ),
        totalOutstanding: filteredData.reduce(
          (sum, item) => sum + (item.outstandingBalance || 0),
          0
        ),
      };

      // Add summary row
      exportData.push({
        "Guarantor Name": `Total Guarantors: ${filteredSummary.count}`,
        "A/C (ID)": "SUMMARY",
        Contact: "",
        "Borrower Name": "",
        "Borrower Number": "",
        "Loan Amount": filteredSummary.totalOutstanding,
        "Guarantor Amount": filteredSummary.totalGuaranteed,
        "Loan Status": "",
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Loan Guarantors");
      const fileName = `loan-guarantors-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful", {
        description: `Report exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header - Responsive */}
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={() => handleExport(flattenedData)}
        disableExport={!flattenedData.length}
      />

      {/* Summary Cards - Responsive Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Loans with Guarantors
          </p>
          <p className="text-xl font-bold sm:text-2xl">{summary.totalLoans}</p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Guarantors
          </p>
          <p className="text-xl font-bold sm:text-2xl">
            {summary.totalGuarantors}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Avg Guarantors per Loan
          </p>
          <p className="text-xl font-bold sm:text-2xl">
            {summary.averageGuarantorsPerLoan.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Data Table with Vertical Scrolling */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <div className="h-full overflow-y-auto">
          <DataTable
            title="Guarantor Details"
            subtitle={`${flattenedData.length} guarantor records`}
            data={flattenedData}
            columns={columns}
            keyField="loanApplicationId"
            isLoading={loading}
            onRefresh={fetchData}
            actions={{
              onExport: handleExport,
            }}
            filters={{
              searchFields: [
                "loanApplicationId",
                "loanId",
                "memberName",
                "memberNumber",
                "loanProduct",
                "guarantorName",
                "guarantorPhone",
                "relationship",
              ],
            }}
          />
        </div>
      </div>
    </div>
  );
}
