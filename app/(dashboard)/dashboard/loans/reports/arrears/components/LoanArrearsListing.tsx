"use client";

import { ReportPrintHeader } from "@/components/reports/ReportPrintHeader";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

interface ArrearsListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function ArrearsListing({
  title,
  subtitle,
  initialRole,
}: ArrearsListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [officers, setOfficers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ✅ Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/arrears${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (result.success) {
        setLoans(result.data?.loans || result.data || []);
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
    const fetchOfficers = async () => {
      try {
        const response = await fetch("/api/v1/users?role=LOANOFFICER", {
          cache: "no-store",
        });
        const result = await response.json();
        if (result.success) {
          setOfficers(result.data);
        }
      } catch (error) {
        console.error("Error fetching officers:", error);
      }
    };
    fetchOfficers();
  }, []);

  // ✅ Re-fetch when URL params change
  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");

  const [dateRange, setDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: null,
    end: null,
  });

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
      header: "Days",
      accessorKey: "daysInArrears",
      cell: (row: any) => {
        const days = row.daysInArrears || 0;
        const colorClass =
          days > 90
            ? "text-red-600"
            : days > 30
              ? "text-orange-600"
              : "text-yellow-600";
        return <span className={`font-bold ${colorClass}`}>{days}d</span>;
      },
    },
    {
      header: "Principal",
      accessorKey: "outstandingPrincipal",
      cell: (row: any) => (
        <span className="font-semibold text-red-600">
          {formatCurrency(row.outstandingPrincipal || 0)}
        </span>
      ),
    },
    {
      header: "Interest",
      accessorKey: "outstandingInterest",
      cell: (row: any) => (
        <span className="font-semibold text-orange-600">
          {formatCurrency(row.outstandingInterest || 0)}
        </span>
      ),
    },
    {
      header: "Penalty",
      accessorKey: "totalPenalty",
      cell: (row: any) => (
        <span className="font-semibold text-amber-600">
          {formatCurrency(row.totalPenalty || 0)}
        </span>
      ),
    },
    {
      header: "Total",
      accessorKey: "totalOutstanding",
      cell: (row: any) => (
        <span className="font-bold text-red-700">
          {formatCurrency(row.totalOutstanding || 0)}
        </span>
      ),
    },
    {
      header: "Due Date",
      accessorKey: "dueDate",
      cell: (row: any) => (
        <span className="text-sm">
          {row.dueDate
            ? format(new Date(row.dueDate), "dd/MM/yyyy")
            : "N/A"}
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

  const safeLoans = loans || [];

  const searchFields = [
    "loanId",
    "memberName",
    "memberNumber",
    "memberPhone",
    "loanProduct",
    "loanOfficer",
    "branch",
  ];

  // ✅ Calculate filtered data manually
  const filteredData = useMemo(() => {
    let result = safeLoans;

    // Apply search filter
    if (searchQuery) {
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = (item as any)[field];
          return value
            ?.toString()
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        })
      );
    }

    // Apply date filter
    if (dateRange.start || dateRange.end) {
      result = result.filter((item) => {
        const itemDate = item.lastPaymentDate
          ? new Date(item.lastPaymentDate)
          : null;
        if (!itemDate) return false;

        if (dateRange.start && itemDate < dateRange.start) return false;
        if (dateRange.end && itemDate > dateRange.end) return false;

        return true;
      });
    }

    return result;
  }, [safeLoans, searchQuery, dateRange]);

  // ✅ Calculate summary dynamically based on FILTERED data
  const dynamicSummary = useMemo(() => {
    return {
      totalLoansInArrears: filteredData.length,
      totalPrincipalArrears: filteredData.reduce(
        (sum, loan) => sum + (loan.outstandingPrincipal || 0),
        0
      ),
      totalInterestArrears: filteredData.reduce(
        (sum, loan) => sum + (loan.outstandingInterest || 0),
        0
      ),
      totalPenaltyArrears: filteredData.reduce(
        (sum, loan) => sum + (loan.totalPenalty || 0),
        0
      ),
      totalArrears: filteredData.reduce(
        (sum, loan) => sum + (loan.totalOutstanding || 0),
        0
      ),
      averageDaysInArrears:
        filteredData.length > 0
          ? filteredData.reduce(
              (sum, loan) => sum + (loan.daysInArrears || 0),
              0
            ) / filteredData.length
          : 0,
    };
  }, [filteredData]);

  const handleExport = async (exportData: any[]) => {
    try {
      if (!exportData.length) {
        toast.error("No data to export");
        return;
      }

      const formattedData = exportData.map((item: any) => ({
        "Loan ID": item.loanId,
        "Member Name": item.memberName,
        "Member Number": item.memberNumber,
        "Member Phone": item.memberPhone,
        "Loan Product": item.loanProduct,
        "Days in Arrears": item.daysInArrears,
        "Principal Arrears": item.principalArrears,
        "Interest Arrears": item.interestArrears,
        "Total Arrears": item.totalArrears,
        "Outstanding Balance": item.outstandingBalance,
        "Last Payment Date": item.lastPaymentDate
          ? format(new Date(item.lastPaymentDate), "dd/MM/yyyy")
          : "N/A",
        "Loan Officer": item.loanOfficer,
        Branch: item.branch,
      }));

      const exportSummary = {
        count: exportData.length,
        totalPrincipalArrears: exportData.reduce(
          (sum, loan) => sum + (loan.principalArrears || 0),
          0
        ),
        totalInterestArrears: exportData.reduce(
          (sum, loan) => sum + (loan.interestArrears || 0),
          0
        ),
        totalArrears: exportData.reduce(
          (sum, loan) => sum + (loan.totalArrears || 0),
          0
        ),
        avgDaysInArrears:
          exportData.length > 0
            ? exportData.reduce(
                (sum, loan) => sum + (loan.daysInArrears || 0),
                0
              ) / exportData.length
            : 0,
      };

      formattedData.push({
        "Loan ID": "",
        "Member Name": "SUMMARY",
        "Member Number": "",
        "Member Phone": "",
        "Loan Product": "",
        "Days in Arrears": "",
        "Principal Arrears": exportSummary.totalPrincipalArrears,
        "Interest Arrears": exportSummary.totalInterestArrears,
        "Total Arrears": exportSummary.totalArrears,
        "Outstanding Balance": "",
        "Last Payment Date": "",
        "Loan Officer": `Total Loans: ${exportSummary.count}`,
        Branch: `Avg Days: ${exportSummary.avgDaysInArrears.toFixed(0)}`,
      });

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Loan Arrears");
      const fileName = `loan-arrears-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful", {
        description: `Report exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
      console.error("Export error:", error);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
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
            {officers.map((officer) => (
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

      <ReportHeader
        title={title}
        subtitle={subtitle}
        period={dateRange.start && dateRange.end ? `${format(dateRange.start, "PPP")} - ${format(dateRange.end, "PPP")}` : `As of ${format(new Date(), "PPP")}`}
        onPrint={() => window.print()}
        onExport={() => handleExport(filteredData)}
        disableExport={!filteredData.length}
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

      {/* ✅ Summary Cards - Now DYNAMIC based on filtered data */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Loans in Arrears
          </p>
          <p className="text-xl font-bold sm:text-2xl">
            {dynamicSummary.totalLoansInArrears}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Principal Arrears
          </p>
          <p className="text-xl font-bold text-red-600 sm:text-2xl">
            {formatCurrency(dynamicSummary.totalPrincipalArrears)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Penalty Arrears
          </p>
          <p className="text-xl font-bold text-amber-600 sm:text-2xl">
            {formatCurrency(dynamicSummary.totalPenaltyArrears)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Arrears
          </p>
          <p className="text-xl font-bold text-red-700 sm:text-2xl">
            {formatCurrency(dynamicSummary.totalArrears)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Avg Days Overdue
          </p>
          <p className="text-xl font-bold text-orange-600 sm:text-2xl">
            {dynamicSummary.averageDaysInArrears.toFixed(0)} days
          </p>
        </div>
      </div>

      {/* ✅ DataTable - Using filtered data directly, no callback needed */}
      <div className={`flex-1 overflow-hidden rounded-lg border bg-card ${viewMode === 'summary' ? 'print:hidden' : ''}`}>
        <div className="h-full overflow-y-auto">
          <DataTable
            title="Arrears Details"
            subtitle={`Showing ${dynamicSummary.totalLoansInArrears} loans in arrears`}
            data={safeLoans}
            columns={columns}
            keyField="loanId"
            isLoading={loading}
            onRefresh={fetchData}
            actions={{
              onExport: handleExport,
            }}
            filters={{
              searchFields,
              enableDateFilter: true,
              getItemDate: (item) => item.lastPaymentDate,
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
