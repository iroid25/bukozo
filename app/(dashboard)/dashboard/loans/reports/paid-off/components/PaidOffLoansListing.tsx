"use client";

import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { useState, useEffect } from "react";

interface PaidOffListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function PaidOffListing({
  title,
  subtitle,
  initialRole,
}: PaidOffListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/paid-off${queryString ? `?${queryString}` : ""}`, {
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
    router.push(`${pathname}?${params.toString()}`);
  };

  const columns: Column<any>[] = [
    {
      header: "Loan ID",
      accessorKey: "loanId",
      cell: (row: any) => (
        <span className="font-mono text-xs">
          {row.loanId?.substring(0, 8) || "N/A"}
        </span>
      ),
    },
    {
      header: "Member",
      accessorKey: "memberName",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.memberName}</span>
          <span className="text-[10px] text-muted-foreground">
            {row.memberNumber}
          </span>
        </div>
      ),
    },
    {
      header: "Phone",
      accessorKey: "memberPhone",
      cell: (row: any) => <span className="text-xs">{row.memberPhone}</span>,
    },
    {
      header: "Product",
      accessorKey: "loanProduct",
      cell: (row: any) => (
        <Badge variant="outline" className="text-[10px]">
          {row.loanProduct}
        </Badge>
      ),
    },
    {
      header: "Disbursed",
      accessorKey: "principalAmount",
      cell: (row: any) => (
        <span className="font-semibold text-xs">
          {formatCurrency(row.principalAmount || 0)}
        </span>
      ),
    },
    {
      header: "Interest",
      accessorKey: "interestEarned",
      cell: (row: any) => {
        const interest = (row.totalRepaid || 0) - (row.principalAmount || 0);
        return (
          <span className="font-semibold text-xs text-purple-600">
            {formatCurrency(interest)}
          </span>
        );
      },
    },
    {
      header: "Paid",
      accessorKey: "totalRepaid",
      cell: (row: any) => (
        <span className="font-bold text-xs text-green-600">
          {formatCurrency(row.totalRepaid || 0)}
        </span>
      ),
    },
    {
      header: "Date Cleared",
      accessorKey: "completionDate",
      cell: (row: any) => (
        <span className="text-xs font-medium text-green-600">
          {row.completionDate
            ? format(new Date(row.completionDate), "dd/MM/yyyy")
            : "N/A"}
        </span>
      ),
    },
    {
      header: "Days +/-",
      accessorKey: "daysEarlyOrLate",
      cell: (row: any) => {
        const days = row.daysEarlyOrLate || 0;
        if (days > 0) return <span className="text-xs font-bold text-green-600">+{days} days</span>;
        if (days < 0) return <span className="text-xs font-bold text-red-600">{days} days</span>;
        return <span className="text-xs text-muted-foreground">On time</span>;
      },
    },
    {
      header: "Officer",
      accessorKey: "loanOfficer",
      cell: (row: any) => (
        <span className="text-xs text-muted-foreground">{row.loanOfficer}</span>
      ),
    },
    {
      header: "Branch",
      accessorKey: "branch",
      cell: (row: any) => <span className="text-xs">{row.branch}</span>,
    },
  ];

  const loans = data?.loans || [];

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
        Product: item.loanProduct,
        Disbursed: item.principalAmount,
        Interest: (item.totalRepaid || 0) - (item.principalAmount || 0),
        Paid: item.totalRepaid,
        "Date Cleared": item.completionDate
          ? format(new Date(item.completionDate), "dd/MM/yyyy")
          : "N/A",
        "Days +/-": item.daysEarlyOrLate || 0,
        Officer: item.loanOfficer,
        Branch: item.branch,
      }));

      const filteredSummary = {
        count: filteredData.length,
        totalPrincipal: filteredData.reduce(
          (sum, item) => sum + (item.principalAmount || 0),
          0
        ),
        totalRepaid: filteredData.reduce(
          (sum, item) => sum + (item.totalRepaid || 0),
          0
        ),
        totalInterest: filteredData.reduce(
          (sum, item) =>
            sum + ((item.totalRepaid || 0) - (item.principalAmount || 0)),
          0
        ),
      };

      exportData.push({
        "Loan ID": "",
        "Member Name": "SUMMARY",
        "Member Number": "",
        "Member Phone": "",
        Product: "",
        Disbursed: filteredSummary.totalPrincipal,
        Interest: filteredSummary.totalInterest,
        Paid: filteredSummary.totalRepaid,
        "Date Cleared": `Total Loans: ${filteredSummary.count}`,
        "Days +/-": "",
        Officer: "",
        Branch: "",
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Paid Off Loans");
      const fileName = `paid-off-loans-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful", {
        description: `Report exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed");
      console.error("Export error:", error);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
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

      {/* NEW: Branch & Officer Filters */}
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
              router.push(`${pathname}?${params.toString()}`);
            }}
          >
            Clear Search
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-3 sm:p-4 bg-card">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Loans
          </p>
          <p className="text-xl font-bold sm:text-2xl">{data?.summary?.totalLoans || 0}</p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 bg-card">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Principal
          </p>
          <p className="text-xl font-bold text-blue-600 sm:text-2xl">
            {formatCurrency(data?.summary?.totalPrincipal || 0)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 bg-card">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Repaid
          </p>
          <p className="text-xl font-bold text-green-600 sm:text-2xl">
            {formatCurrency(data?.summary?.totalRepaid || 0)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 bg-card">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Avg. Days to completion
          </p>
          <p className="text-xl font-bold text-purple-600 sm:text-2xl">
            {Math.round(data?.summary?.averageDaysToCompletion || 0)} Days
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className={`flex-1 overflow-hidden rounded-lg border bg-card ${viewMode === 'summary' ? 'print:hidden' : ''}`}>
        <div className="h-full overflow-y-auto">
          <DataTable
            title="Paid Off Loans Details"
            subtitle={`${loans.length} successfully completed loans`}
            data={loans}
            columns={columns}
            keyField="loanId"
            isLoading={loading}
            onRefresh={fetchData}
            actions={{
              onExport: handleExport,
            }}
            filters={{
              searchFields: ["memberName", "memberNumber", "loanProduct", "loanOfficer"],
              enableDateFilter: true,
            }}
          />
        </div>
      </div>
      {viewMode === 'summary' && (
          <div className="hidden print:block mt-8 text-center text-sm text-muted-foreground">
              <p>*** Summary Report Only ***</p>
          </div>
      )}
    </div>
  );
}
