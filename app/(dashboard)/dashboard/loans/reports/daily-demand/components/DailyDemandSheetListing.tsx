"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, RefreshCw } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface DailyDemandListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function DailyDemandListing({
  title,
  subtitle,
  initialRole,
}: DailyDemandListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedOfficer = searchParams.get("officerId") || "all";

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/daily-demand${queryString ? `?${queryString}` : ""}`, {
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

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

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
      header: "Product",
      accessorKey: "loanProduct",
      cell: (row: any) => <Badge variant="outline">{row.loanProduct}</Badge>,
    },
    {
      header: "Amount Due",
      accessorKey: "amountDue",
      cell: (row: any) => (
        <span className="font-bold text-green-600">
          {formatCurrency(row.amountDue || 0)}
        </span>
      ),
    },
    {
      header: "Officer",
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

  const loansDue = data?.loansDue || [];
  const summary = data?.summary || {
    totalLoansDue: 0,
    expectedAmount: 0,
    totalRepayments: 0,
    collectedAmount: 0,
    collectionRate: 0,
    shortfall: 0,
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
        "Amount Due": item.amountDue,
        "Loan Officer": item.loanOfficer,
        Branch: item.branch,
      }));

      const filteredSummary = {
        count: filteredData.length,
        totalDue: filteredData.reduce(
          (sum, item) => sum + (item.amountDue || 0),
          0
        ),
      };

      exportData.push({
        "Loan ID": "",
        "Member Name": "SUMMARY",
        "Member Number": "",
        "Member Phone": "",
        "Loan Product": "",
        "Amount Due": filteredSummary.totalDue,
        "Loan Officer": `Total Loans: ${filteredSummary.count}`,
        Branch: "",
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Daily Demand Sheet");
      const fileName = `daily-demand-sheet-${format(data.date || new Date(), "yyyy-MM-dd")}.xlsx`;
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
        onExport={() => handleExport(loansDue)}
        disableExport={!loansDue.length}
      />

      {/* Officer Filter */}
      {["ADMIN", "BRANCHMANAGER", "ACCOUNTANT", "AUDITOR"].includes(initialRole) && data?.filterOptions?.officers && (
        <div className="flex gap-3 items-center">
          <label className="text-sm font-medium">Filter by Officer:</label>
          <Select 
            value={selectedOfficer} 
            onValueChange={(val) => {
              handleFilterChange("officerId", val);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Officers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Officers</SelectItem>
              {data.filterOptions.officers.map((o: any) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Loans Due
          </p>
          <p className="text-xl font-bold sm:text-2xl">
            {summary.totalLoansDue}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Expected Amount
          </p>
          <p className="text-xl font-bold text-blue-600 sm:text-2xl">
            {formatCurrency(summary.expectedAmount)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Collected Amount
          </p>
          <p className="text-xl font-bold text-green-600 sm:text-2xl">
            {formatCurrency(summary.collectedAmount)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Collection Rate
          </p>
          <p className="text-xl font-bold text-purple-600 sm:text-2xl">
            {summary.collectionRate.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <div className="h-full overflow-y-auto">
          <DataTable
            title="Daily Demand Details"
            subtitle={`${loansDue.length} loans due today`}
            data={loansDue}
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
            }}
          />
        </div>
      </div>
    </div>
  );
}
