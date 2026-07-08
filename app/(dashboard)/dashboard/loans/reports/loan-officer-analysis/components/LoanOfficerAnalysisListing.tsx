"use client";

import { ReportPrintHeader } from "@/components/reports/ReportPrintHeader";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface LoanOfficerAnalysisListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function LoanOfficerAnalysisListing({
  title,
  subtitle,
  initialRole,
}: LoanOfficerAnalysisListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/loan-officer-analysis${queryString ? `?${queryString}` : ""}`, {
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

  // Fetch officers for filter
  useEffect(() => {
    const fetchFilterOfficers = async () => {
      try {
        const response = await fetch("/api/v1/users?role=LOANOFFICER", {
          cache: "no-store",
        });
        const result = await response.json();
        if (result.success) {
          setFilterOfficers(result.data);
        }
      } catch (error) {
        console.error("Error fetching filter officers:", error);
      }
    };
    fetchFilterOfficers();
  }, []);

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  const columns: Column<any>[] = [
    {
      header: "Officer",
      accessorKey: "officerName",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.officerName}</span>
          <span className="text-xs text-muted-foreground">{row.email}</span>
        </div>
      ),
    },
    {
      header: "Role",
      accessorKey: "role",
      cell: (row: any) => <Badge variant="outline">{row.role}</Badge>,
    },
    {
      header: "Loans",
      accessorKey: "totalLoansManaged",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-lg">{row.totalLoansManaged}</span>
          <div className="flex gap-2 text-xs">
            <span className="text-green-600">✓ {row.activeLoans}</span>
            <span className="text-red-600">⚠ {row.overdueLoans}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Disbursed",
      accessorKey: "totalDisbursed",
      cell: (row: any) => (
        <span className="font-semibold text-blue-600">
          {formatCurrency(row.totalDisbursed || 0)}
        </span>
      ),
    },
    {
      header: "Repaid",
      accessorKey: "totalRepaid",
      cell: (row: any) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(row.totalRepaid || 0)}
        </span>
      ),
    },
    {
      header: "Outstanding",
      accessorKey: "totalOutstanding",
      cell: (row: any) => (
        <span className="font-semibold text-orange-600">
          {formatCurrency(row.totalOutstanding || 0)}
        </span>
      ),
    },
    {
      header: "Portfolio at Risk",
      accessorKey: "portfolioAtRisk",
      cell: (row: any) => (
        <span className="font-semibold text-red-600">
          {formatCurrency(row.portfolioAtRisk || 0)}
        </span>
      ),
    },
    {
      header: "Repayment Rate",
      accessorKey: "repaymentRate",
      cell: (row: any) => {
        const rate = row.repaymentRate * 100;
        const colorClass =
          rate >= 90
            ? "text-green-600"
            : rate >= 70
              ? "text-yellow-600"
              : "text-red-600";
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${rate >= 90 ? "bg-green-600" : rate >= 70 ? "bg-yellow-600" : "bg-red-600"}`}
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
            <span className={`font-bold ${colorClass}`}>
              {rate.toFixed(1)}%
            </span>
          </div>
        );
      },
    },
    {
      header: "Default Rate",
      accessorKey: "defaultRate",
      cell: (row: any) => {
        const rate = row.defaultRate * 100;
        return (
          <span
            className={`font-semibold ${rate > 10 ? "text-red-600" : rate > 5 ? "text-yellow-600" : "text-green-600"}`}
          >
            {rate.toFixed(1)}%
          </span>
        );
      },
    },
    {
      header: "Applications",
      accessorKey: "totalApplications",
      cell: (row: any) => (
        <div className="flex flex-col text-sm">
          <span className="font-medium">{row.totalApplications} total</span>
          <span className="text-green-600">
            {row.applicationsApproved} approved
          </span>
        </div>
      ),
    },
  ];

  const officers = data?.officers || [];
  const summary = data?.summary || {
    totalOfficers: 0,
    totalLoans: 0,
    totalDisbursed: 0,
    totalOutstanding: 0,
    averageRepaymentRate: 0,
  };

  const handleExport = async (filteredData: any[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item: any) => ({
        "Loan Officer": item.officerName,
        Email: item.email,
        Role: item.role,
        "Total Loans": item.totalLoansManaged,
        "Active Loans": item.activeLoans,
        "Overdue Loans": item.overdueLoans,
        "Repaid Loans": item.repaidLoans,
        "Total Disbursed": item.totalDisbursed,
        "Total Outstanding": item.totalOutstanding,
        "Total Repaid": item.totalRepaid,
        "Portfolio at Risk": item.portfolioAtRisk,
        "Repayment Rate": (item.repaymentRate * 100).toFixed(1) + "%",
        "Default Rate": (item.defaultRate * 100).toFixed(1) + "%",
        Applications: item.totalApplications,
        Approved: item.applicationsApproved,
      }));

      const filteredSummary = {
        count: filteredData.length,
        totalLoans: filteredData.reduce(
          (sum, item) => sum + (item.totalLoansManaged || 0),
          0
        ),
        totalDisbursed: filteredData.reduce(
          (sum, item) => sum + (item.totalDisbursed || 0),
          0
        ),
        totalOutstanding: filteredData.reduce(
          (sum, item) => sum + (item.totalOutstanding || 0),
          0
        ),
        avgRepayment:
          filteredData.length > 0
            ? filteredData.reduce(
                (sum, item) => sum + (item.repaymentRate || 0),
                0
              ) / filteredData.length
            : 0,
      };

      // Add summary row
      exportData.push({
        "Loan Officer": "SUMMARY",
        Email: "",
        Role: "",
        "Total Loans": filteredSummary.totalLoans,
        "Active Loans": "",
        "Overdue Loans": "",
        "Repaid Loans": "",
        "Total Disbursed": filteredSummary.totalDisbursed,
        "Total Outstanding": filteredSummary.totalOutstanding,
        "Total Repaid": "",
        "Portfolio at Risk": "",
        "Repayment Rate": `Avg: ${(filteredSummary.avgRepayment * 100).toFixed(1)}%`,
        "Default Rate": "",
        Applications: "",
        Approved: `Total Officers: ${filteredSummary.count}`,
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Loan Officer Analysis");
      const fileName = `loan-officer-analysis-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
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

  // imports moved to top

  // ... inside component
  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");

  // ... inside return
  return (
    <div className="flex h-full flex-col gap-4">
       {/* Print Header */}
       <ReportPrintHeader 
         title={title} 
         subtitle={subtitle} 
         filters={`Generated on ${format(new Date(), "PPP")}`}
       />

       {/* Header & Actions */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <ReportHeader
            title={title}
            subtitle={subtitle}
            onPrint={() => window.print()}
            onExport={() => handleExport(officers)}
            disableExport={!officers.length}
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
       </div>

      {/* Filters (Hide on Print) */}
      <div className="flex flex-col md:flex-row gap-4 items-center print:hidden">
        {/* ... existing filters ... */}
        {["ADMIN", "AUDITOR"].includes(initialRole) && (
          <Select
            value={searchParams.get("branchId") || "all"}
            onValueChange={(v) => updateFilter("branchId", v)}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select
          value={searchParams.get("officerId") || "all"}
          onValueChange={(v) => updateFilter("officerId", v)}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Officers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Officers</SelectItem>
            {filterOfficers.map((officer: any) => (
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
         {/* ... existing cards ... */}
        <div className="rounded-lg border p-3 sm:p-4 break-inside-avoid">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Officers
          </p>
          <p className="text-xl font-bold sm:text-2xl">
            {summary.totalOfficers}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 break-inside-avoid">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Loans
          </p>
          <p className="text-xl font-bold sm:text-2xl">{summary.totalLoans}</p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 break-inside-avoid">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Disbursed
          </p>
          <p className="text-xl font-bold text-blue-600 sm:text-2xl">
            {formatCurrency(summary.totalDisbursed)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 break-inside-avoid">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Outstanding
          </p>
          <p className="text-xl font-bold text-orange-600 sm:text-2xl">
            {formatCurrency(summary.totalOutstanding)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 break-inside-avoid">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Avg Repayment Rate
          </p>
          <p className="text-xl font-bold text-green-600 sm:text-2xl">
            {(summary.averageRepaymentRate * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className={`flex-1 overflow-hidden rounded-lg border bg-card ${viewMode === 'summary' ? 'print:hidden' : ''}`}>
        <div className="h-full overflow-y-auto">
          <DataTable
            title="Officer Performance Analysis"
            subtitle={`${officers.length} loan officers`}
            data={officers}
            columns={columns}
            keyField="officerId"
            isLoading={loading}
            onRefresh={fetchData}
            actions={{
              onExport: handleExport,
            }}
            filters={{
              searchFields: ["officerName", "email", "role"],
            }}
          />
        </div>
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
