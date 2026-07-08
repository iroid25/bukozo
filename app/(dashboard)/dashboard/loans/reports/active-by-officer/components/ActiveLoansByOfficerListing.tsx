"use client";

import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Download, Filter } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ActiveByOfficerListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function ActiveByOfficerListing({
  title,
  subtitle,
  initialRole,
}: ActiveByOfficerListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);
  const [filterBranches, setFilterBranches] = useState<any[]>([]);

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/active-by-officer${queryString ? `?${queryString}` : ""}`, {
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
      header: "Loan ID",
      accessorKey: "loanId",
      cell: (row: any) => (
        <span className="font-mono text-xs">{row.loanId}</span>
      ),
    },
    {
      header: "Member",
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
      header: "Phone",
      accessorKey: "memberPhone",
      cell: (row: any) => (
        <span className="text-sm">{row.memberPhone || "N/A"}</span>
      ),
    },
    {
      header: "Loan Product",
      accessorKey: "loanProduct",
      cell: (row: any) => (
        <span className="font-medium">{row.loanProduct}</span>
      ),
    },
    {
      header: "Principal Amount",
      accessorKey: "principalAmount",
      cell: (row: any) => (
        <span className="font-semibold text-blue-600">
          {formatCurrency(row.principalAmount || 0)}
        </span>
      ),
    },
    {
      header: "Outstanding Balance",
      accessorKey: "outstandingBalance",
      cell: (row: any) => (
        <span className="font-semibold text-orange-600">
          {formatCurrency(row.outstandingBalance || 0)}
        </span>
      ),
    },
    {
      header: "Disbursement Date",
      accessorKey: "disbursementDate",
      cell: (row: any) => (
        <span className="text-sm">
          {row.disbursementDate
            ? format(new Date(row.disbursementDate), "dd/MM/yyyy")
            : "N/A"}
        </span>
      ),
    },
    {
      header: "Due Date",
      accessorKey: "dueDate",
      cell: (row: any) => (
        <span className="text-sm">
          {row.dueDate ? format(new Date(row.dueDate), "dd/MM/yyyy") : "N/A"}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: any) => {
        const statusColors: Record<string, string> = {
          ACTIVE: "bg-green-100 text-green-800",
          PENDING: "bg-yellow-100 text-yellow-800",
          OVERDUE: "bg-red-100 text-red-800",
          CLOSED: "bg-gray-100 text-gray-800",
        };
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              statusColors[row.status] || "bg-gray-100 text-gray-800"
            }`}
          >
            {row.status}
          </span>
        );
      },
    },
    {
      header: "Loan Officer",
      accessorKey: "loanOfficer",
      cell: (row: any) => (
        <span className="text-sm text-muted-foreground">
          {row.loanOfficer || "N/A"}
        </span>
      ),
    },
    {
      header: "Branch",
      accessorKey: "branch",
      cell: (row: any) => <span className="text-sm">{row.branch}</span>,
    },
  ];

  // ✅ Add safety check for data
  const loans = data?.loans || [];
  const summary = data?.summary || {
    totalActiveLoans: 0,
    totalPrincipal: 0,
    totalOutstanding: 0,
    averageLoanSize: 0,
  };

  const handleExport = async (filteredData: any[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item: any) => ({
        "Loan ID": item.loanId,
        "Member Name": item.memberName,
        "Member Number": item.memberNumber,
        "Member Phone": item.memberPhone,
        "Loan Product": item.loanProduct,
        "Principal Amount": item.principalAmount,
        "Outstanding Balance": item.outstandingBalance,
        "Disbursement Date": item.disbursementDate
          ? format(new Date(item.disbursementDate), "dd/MM/yyyy")
          : "N/A",
        "Due Date": item.dueDate
          ? format(new Date(item.dueDate), "dd/MM/yyyy")
          : "N/A",
        Status: item.status,
        "Loan Officer": item.loanOfficer,
        Branch: item.branch,
      }));

      // Add summary row
      exportData.push({
        "Loan ID": "",
        "Member Name": "SUMMARY",
        "Member Number": "",
        "Member Phone": "",
        "Loan Product": "",
        "Principal Amount": summary.totalPrincipal,
        "Outstanding Balance": summary.totalOutstanding,
        "Disbursement Date": "",
        "Due Date": "",
        Status: "",
        "Loan Officer": `Total Loans: ${summary.totalActiveLoans}`,
        Branch: `Avg Loan Size: ${formatCurrency(summary.averageLoanSize)}`,
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Active Loans by Officer");
      const fileName = `active-loans-by-officer-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
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
    <div className="space-y-6">
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={() => handleExport(loans)}
        disableExport={!loans.length}
      >
        <div className="flex items-center space-x-2 mr-4 bg-muted/50 p-2 rounded-lg border">
          <Switch
            id="summary-mode"
            checked={viewMode === "summary"}
            onCheckedChange={(checked) => setViewMode(checked ? "summary" : "detailed")}
          />
          <Label htmlFor="summary-mode" className="cursor-pointer font-medium">
            {viewMode === "summary" ? "Summary Print" : "Detailed Print"}
          </Label>
        </div>
      </ReportHeader>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {["ADMIN", "AUDITOR"].includes(initialRole) && (
          <Select
            value={searchParams.get("branchId") || "all"}
            onValueChange={(v) => updateFilter("branchId", v)}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {filterBranches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={searchParams.get("officerId") || "all"}
          onValueChange={(v) => updateFilter("officerId", v)}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Officers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Officers</SelectItem>
            {filterOfficers.map((officer) => (
              <SelectItem key={officer.id} value={officer.id}>
                {officer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(searchParams.get("branchId") || searchParams.get("officerId")) && (
          <Button
            variant="ghost"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("branchId");
              params.delete("officerId");
              router.push(`?${params.toString()}`);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Active Loans</p>
          <p className="text-2xl font-bold">{summary.totalActiveLoans}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Principal</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.totalPrincipal)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.totalOutstanding)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Average Loan Size</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.averageLoanSize)}
          </p>
        </div>
      </div>

      {/* Data Table with Filters */}
      <div className={viewMode === 'summary' ? 'print:hidden' : ''}>
      <DataTable
        title="Active Loans Details"
        subtitle={`Showing ${loans.length} active loans`}
        data={loans}
        columns={columns}
        keyField="loanId"
        isLoading={loading}
        onRefresh={fetchData}
        actions={{
          onExport: handleExport,
        }}
        filters={{
          searchFields: [
            "loanId",
            "memberName",
            "memberNumber",
            "memberPhone",
            "loanProduct",
            "loanOfficer",
            "branch",
          ],
          enableDateFilter: true,
          getItemDate: (item) => item.disbursementDate,
        }}
      />
      </div>

       {/* Summary Only Footer / Text */}
      {viewMode === 'summary' && (
          <div className="hidden print:block mt-8 text-center text-sm text-muted-foreground">
              <p>*** Summary Report Only ***</p>
          </div>
      )}
    </div>
  );
}
