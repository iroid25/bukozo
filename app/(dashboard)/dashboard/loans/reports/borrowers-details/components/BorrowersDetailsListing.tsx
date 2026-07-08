"use client";

import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BorrowersDetailsListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function BorrowersDetailsListing({
  title,
  subtitle,
  initialRole,
}: BorrowersDetailsListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);
  const [filterBranches, setFilterBranches] = useState<any[]>([]);
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; title: string; content: any }>({
    open: false, title: "", content: null
  });

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/borrowers-details${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (result.success) {
        setBorrowers(result.data || []);
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

  // Fetch filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [officersRes, branchesRes] = await Promise.all([
          fetch("/api/v1/users?role=LOANOFFICER", { cache: "no-store" }),
          fetch("/api/v1/branches", { cache: "no-store" }),
        ]);
        const [officers, branches] = await Promise.all([
          officersRes.json(),
          branchesRes.json(),
        ]);
        if (officers.success) setFilterOfficers(officers.data);
        if (branches.success) setFilterBranches(branches.data);
      } catch (error) {
        console.error("Error fetching filters:", error);
      }
    };
    fetchFilters();
  }, []);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const columns: Column<any>[] = [
    {
      header: "Type",
      accessorKey: "isInstitution",
      cell: (row: any) => (
        <Badge variant={row.isInstitution ? "secondary" : "outline"} className="text-[10px] h-5 px-1">
          {row.isInstitution ? "INSTITUTION" : "MEMBER"}
        </Badge>
      ),
    },
    {
      header: "Member ID",
      accessorKey: "memberId",
      cell: (row: any) => (
        <span className="font-mono text-xs">{row.memberId}</span>
      ),
    },
    {
      header: "Member",
      accessorKey: "name",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.memberNumber}
          </span>
        </div>
      ),
    },
    {
      header: "Contact",
      accessorKey: "phone",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.phone || "N/A"}</span>
          <span className="text-xs text-muted-foreground">{row.email}</span>
        </div>
      ),
    },
    {
      header: "Loan Amount",
      accessorKey: "recentLoanAmount",
      cell: (row: any) => (
        <span className="font-semibold text-blue-600">
          {formatCurrency(row.recentLoanAmount || 0)}
        </span>
      ),
    },
    {
      header: "Period",
      accessorKey: "recentLoanPeriod",
      cell: (row: any) => (
        <span className="text-sm">
          {row.recentLoanPeriod} {row.recentLoanPeriod !== "N/A" ? "Months" : ""}
        </span>
      ),
    },
    {
      header: "Guarantors",
      accessorKey: "guarantors",
      cell: (row: any) => (
        <span
          className="text-xs truncate max-w-[150px] inline-block cursor-pointer hover:text-blue-600"
          onClick={() => {
            const guarantors = row.guarantors;
            if (guarantors && guarantors !== "N/A") {
              setDetailDialog({
                open: true,
                title: `Guarantors for ${row.name}`,
                content: (
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-sm">{guarantors}</p>
                  </div>
                )
              });
            }
          }}
        >
          {row.guarantors}
        </span>
      ),
    },
    {
      header: "Guarantor Contacts",
      accessorKey: "guarantorContacts",
      cell: (row: any) => (
        <span
          className="text-xs truncate max-w-[170px] inline-block cursor-pointer hover:text-blue-600"
          onClick={() => {
            const guarantorContacts = row.guarantorContacts;
            if (guarantorContacts && guarantorContacts !== "N/A") {
              setDetailDialog({
                open: true,
                title: `Guarantor Contacts for ${row.name}`,
                content: (
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-sm">{guarantorContacts}</p>
                  </div>
                )
              });
            }
          }}
        >
          {row.guarantorContacts}
        </span>
      ),
    },
    {
      header: "Collateral",
      accessorKey: "collateral",
      cell: (row: any) => (
        <span
          className="text-xs truncate max-w-[150px] inline-block cursor-pointer hover:text-blue-600"
          onClick={() => {
            const collateral = row.collateral;
            if (collateral && collateral !== "N/A") {
              setDetailDialog({
                open: true,
                title: `Collateral for ${row.name}`,
                content: (
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-sm">{collateral}</p>
                  </div>
                )
              });
            }
          }}
        >
          {row.collateral}
        </span>
      ),
    },
    {
      header: "Disbursement Date",
      accessorKey: "disbursementDate",
      cell: (row: any) => (
        <span className="text-sm">
          {row.disbursementDate}
        </span>
      ),
    },
  ];

  const safeBorrowers = borrowers || [];

  // Calculate summary
  const summary = {
    totalBorrowers: safeBorrowers.length,
    totalActiveLoans: safeBorrowers.reduce(
      (sum, b) => sum + (b.activeLoans || 0),
      0
    ),
    totalOutstanding: safeBorrowers.reduce(
      (sum, b) => sum + (b.outstanding || 0),
      0
    ),
    totalBorrowed: safeBorrowers.reduce(
      (sum, b) => sum + (b.totalBorrowed || 0),
      0
    ),
    totalSavings: safeBorrowers.reduce(
      (sum, b) => sum + (b.totalSavings || 0),
      0
    ),
  };

  const handleExport = async (filteredData: any[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item: any) => ({
        "Member ID": item.memberId,
        "Member Number": item.memberNumber,
        "Member Name": item.name,
        Phone: item.phone || "N/A",
        Email: item.email,
        "Loan Amount": item.recentLoanAmount || 0,
        "Repayment Period": item.recentLoanPeriod,
        Guarantors: item.guarantors || "N/A",
        "Guarantor Contacts": item.guarantorContacts || "N/A",
        Collateral: item.collateral || "N/A",
        "Disbursement Date": item.disbursementDate || "N/A",
        District: item.district || "N/A",
      }));

      // Add summary
      const filteredSummary = {
        count: filteredData.length,
        activeLoans: filteredData.reduce(
          (sum, b) => sum + (b.activeLoans || 0),
          0
        ),
        outstanding: filteredData.reduce(
          (sum, b) => sum + (b.outstanding || 0),
          0
        ),
        borrowed: filteredData.reduce(
          (sum, b) => sum + (b.totalBorrowed || 0),
          0
        ),
        savings: filteredData.reduce(
          (sum, b) => sum + (b.totalSavings || 0),
          0
        ),
      };

      exportData.push({
        "Member ID": "",
        "Member Number": "SUMMARY",
        "Member Name": `${filteredSummary.count} borrowers`,
        Phone: "",
        Email: "",
        "Loan Amount": filteredSummary.borrowed,
        "Repayment Period": `Active: ${filteredSummary.activeLoans}`,
        Guarantors: `Savings: ${formatCurrency(filteredSummary.savings)}`,
        "Guarantor Contacts": "",
        Collateral: `Outstanding: ${formatCurrency(filteredSummary.outstanding)}`,
        "Disbursement Date": "",
        District: "",
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Borrowers Details");
      const fileName = `borrowers-details-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
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
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={() => handleExport(borrowers)}
        disableExport={!borrowers.length}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Borrowers
          </p>
          <p className="text-xl font-bold sm:text-2xl">
            {summary.totalBorrowers}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Active Loans
          </p>
          <p className="text-xl font-bold sm:text-2xl">
            {summary.totalActiveLoans}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Outstanding
          </p>
          <p className="text-xl font-bold text-red-600 sm:text-2xl">
            {formatCurrency(summary.totalOutstanding)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Borrowed
          </p>
          <p className="text-xl font-bold text-blue-600 sm:text-2xl">
            {formatCurrency(summary.totalBorrowed)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Savings
          </p>
          <p className="text-xl font-bold text-green-600 sm:text-2xl">
            {formatCurrency(summary.totalSavings)}
          </p>
        </div>
      </div>

      {/* Data Table with Vertical Scrolling */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <div className="h-full overflow-y-auto">
          <DataTable
            title="Borrower Details"
            subtitle={`Showing ${safeBorrowers.length} borrowers`}
            data={borrowers}
            columns={columns}
            keyField="memberId"
            isLoading={loading}
            onRefresh={fetchData}
            actions={{
              onExport: handleExport,
            }}
            filters={{
              searchFields: [
                "memberId",
                "memberNumber",
                "name",
                "phone",
                "email",
                "district",
              ],
              enableDateFilter: true,
              getItemDate: (item) => item.registrationDate,
            }}
          />
        </div>
      </div>

      {/* Detail Dialog for Guarantors/Collateral */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailDialog.title}</DialogTitle>
          </DialogHeader>
          {detailDialog.content}
        </DialogContent>
      </Dialog>
    </div>
  );
}
