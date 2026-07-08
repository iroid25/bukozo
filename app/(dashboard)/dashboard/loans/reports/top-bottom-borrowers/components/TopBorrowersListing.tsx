"use client";

import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface TopBorrowersListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function TopBorrowersListing({
  title,
  subtitle,
  initialRole,
}: TopBorrowersListingProps) {
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
      const response = await fetch(`/api/v1/reports/loans/top-bottom-borrowers${queryString ? `?${queryString}` : ""}`, {
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
    { header: "Rank", accessorKey: "rank" },
    { header: "Member Name", accessorKey: "memberName" },
    { header: "Member ID", accessorKey: "memberId" },
    { header: "Total Loans", accessorKey: "totalLoans" },
    { header: "Active Loans", accessorKey: "activeLoans" },
    { header: "Total Borrowed", accessorKey: "totalBorrowedFormatted" },
    {
      header: "Outstanding Balance",
      accessorKey: "outstandingBalanceFormatted",
    },
    { header: "Repayment Rate", accessorKey: "repaymentRateFormatted" },
  ];

  // Safe access to data
  const borrowers = data?.borrowers || [];

  // Calculate summary
  const summary = {
    totalBorrowers: borrowers.length,
    totalLoans: borrowers.reduce(
      (sum: number, item: any) => sum + (item.totalLoans || 0),
      0
    ),
    activeLoans: borrowers.reduce(
      (sum: number, item: any) => sum + (item.activeLoans || 0),
      0
    ),
    totalBorrowed: borrowers.reduce(
      (sum: number, item: any) => sum + (item.totalBorrowed || 0),
      0
    ),
    totalOutstanding: borrowers.reduce(
      (sum: number, item: any) => sum + (item.outstandingBalance || 0),
      0
    ),
    averageRepaymentRate:
      borrowers.length > 0
        ? borrowers.reduce(
            (sum: number, item: any) => sum + (item.repaymentRate || 0),
            0
          ) / borrowers.length
        : 0,
  };

  // Format the data
  const formattedData = borrowers.map((item: any) => ({
    ...item,
    totalBorrowedFormatted: formatCurrency(item.totalBorrowed || 0),
    outstandingBalanceFormatted: formatCurrency(item.outstandingBalance || 0),
    repaymentRateFormatted: `${((item.repaymentRate || 0) * 100).toFixed(1)}%`,
  }));

  const handleExport = () => {
    try {
      if (!borrowers.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = borrowers.map((item: any) => ({
        Rank: item.rank,
        "Member Name": item.memberName,
        "Member ID": item.memberId,
        "Total Loans": item.totalLoans,
        "Active Loans": item.activeLoans,
        "Total Borrowed": item.totalBorrowed,
        "Outstanding Balance": item.outstandingBalance,
        "Repayment Rate": `${((item.repaymentRate || 0) * 100).toFixed(1)}%`,
      }));

      // Add summary row
      exportData.push({
        Rank: "",
        "Member Name": "TOTAL",
        "Member ID": "",
        "Total Loans": summary.totalLoans,
        "Active Loans": summary.activeLoans,
        "Total Borrowed": summary.totalBorrowed,
        "Outstanding Balance": summary.totalOutstanding,
        "Repayment Rate": `Avg: ${(summary.averageRepaymentRate * 100).toFixed(1)}%`,
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Top Borrowers");
      XLSX.writeFile(wb, `top-borrowers-${formatISODate(new Date())}.xlsx`);
      toast.success("Exported successfully");
    } catch (error) {
      toast.error("Export failed");
      console.error("Export error:", error);
    }
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={handleExport}
        disableExport={!borrowers.length}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Top Borrowers</p>
          <p className="text-2xl font-bold">{summary.totalBorrowers}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Loans</p>
          <p className="text-2xl font-bold">{summary.totalLoans}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Active Loans</p>
          <p className="text-2xl font-bold">{summary.activeLoans}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Borrowed</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.totalBorrowed)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.totalOutstanding)}
          </p>
        </div>
      </div>

      <DataTable
        title=""
        subtitle=""
        data={formattedData}
        columns={columns}
        keyField="memberId"
        isLoading={loading}
        onRefresh={fetchData}
      />
    </div>
  );
}
