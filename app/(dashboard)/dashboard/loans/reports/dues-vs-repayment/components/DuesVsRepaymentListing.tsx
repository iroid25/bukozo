"use client";

import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Filter } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DuesVsRepaymentListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function DuesVsRepaymentListing({
  title,
  subtitle,
  initialRole,
}: DuesVsRepaymentListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);

  // ✅ Fetch filter options (officers)
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch("/api/v1/users?role=LOANOFFICER", {
          cache: "no-store",
        });
        const result = await response.json();
        if (result.success) {
          setFilterOfficers(result.data);
        }
      } catch (error) {
        console.error("Error fetching officer options:", error);
      }
    };
    fetchOptions();
  }, []);

  // ✅ Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/dues-vs-repayment${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error || "Failed to fetch data");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("An error occurred while fetching data");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Re-fetch when URL params change
  useEffect(() => {
    fetchData();
  }, [searchParams]);


  // Handle URL Filter Changes (for pagination or other params if needed)
  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const columns: Column<any>[] = [
    {
      header: "Member",
      accessorKey: "memberName",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{row.memberName}</span>
          <span className="text-[10px] text-muted-foreground">
            {row.memberNumber} • {row.subjectType === "INSTITUTION" ? "Institution" : "Member"}
          </span>
        </div>
      ),
    },
    {
      header: "Product",
      accessorKey: "loanProduct",
      cell: (row: any) => <span className="text-xs">{row.loanProduct}</span>,
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
      header: "Total Paid",
      accessorKey: "totalPaid",
      cell: (row: any) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(row.totalPaid || 0)}
        </span>
      ),
    },
    {
      header: "Outstanding",
      accessorKey: "outstandingBalance",
      cell: (row: any) => (
        <span
          className={`font-semibold ${
            (row.outstandingBalance || 0) > 0 ? "text-red-500" : "text-gray-500"
          }`}
        >
          {formatCurrency(row.outstandingBalance || 0)}
        </span>
      ),
    },
    {
      header: "Principal Paid",
      accessorKey: "principalPaid",
      cell: (row: any) => (
        <span className="font-medium text-green-500 text-xs">
          {formatCurrency(row.principalPaid || 0)}
        </span>
      ),
    },
    {
      header: "Interest Paid",
      accessorKey: "interestPaid",
      cell: (row: any) => (
        <span className="font-medium text-emerald-600 text-xs">
          {formatCurrency(row.interestPaid || 0)}
        </span>
      ),
    },
    {
      header: "Penalty Paid",
      accessorKey: "penaltyPaid",
      cell: (row: any) => (
        <span className="font-medium text-amber-600 text-xs">
          {formatCurrency(row.penaltyPaid || 0)}
        </span>
      ),
    },
    {
      header: "Latest Payment",
      accessorKey: "latestPaymentDate",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {row.latestPaymentDate ? formatISODate(row.latestPaymentDate) : "No payment"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatCurrency(row.latestPaymentAmount || 0)}
          </span>
        </div>
      ),
    },
    {
      header: "Recovery Rate",
      accessorKey: "collectionRate",
      cell: (row: any) => {
        const rate = row.collectionRate || 0;
        const colorClass =
          rate >= 90
            ? "text-green-600"
            : rate >= 70
              ? "text-yellow-600"
              : "text-red-600";
        return (
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${rate >= 90 ? "bg-green-600" : rate >= 70 ? "bg-yellow-600" : "bg-red-600"}`}
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
            <span className={`font-bold text-xs ${colorClass}`}>
              {rate.toFixed(1)}%
            </span>
          </div>
        );
      },
    },
  ];

  const comparisons = data?.records || [];

  // Calculate totals
  const summary = {
    totalDisbursed: comparisons.reduce(
      (sum: number, item: any) => sum + (item.totalDisbursed || 0),
      0
    ),
    totalPaid: comparisons.reduce(
      (sum: number, item: any) => sum + (item.totalPaid || 0),
      0
    ),
    principalPaid: comparisons.reduce(
      (sum: number, item: any) => sum + (item.principalPaid || 0),
      0
    ),
    interestPaid: comparisons.reduce(
      (sum: number, item: any) => sum + (item.interestPaid || 0),
      0
    ),
    penaltyPaid: comparisons.reduce(
      (sum: number, item: any) => sum + (item.penaltyPaid || 0),
      0
    ),
    totalOutstanding: comparisons.reduce(
      (sum: number, item: any) => sum + (item.outstandingBalance || 0),
      0
    ),
    averageRate: data?.summary?.overallCollectionRate || 0,
  };

  const handleExport = async (filteredData: any[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item: any) => ({
        Member: item.memberName || "N/A",
        Number: item.memberNumber || "N/A",
        Type: item.subjectType || "MEMBER",
        Product: item.loanProduct || "N/A",
        "Loan Count": item.loanCount || 0,
        Branch: item.branch || "N/A",
        Officer: item.officer || "N/A",
        Disbursed: item.totalDisbursed || 0,
        "Total Paid": item.totalPaid || 0,
        "Principal Paid": item.principalPaid || 0,
        "Interest Paid": item.interestPaid || 0,
        "Penalty Paid": item.penaltyPaid || 0,
        Outstanding: item.outstandingBalance || 0,
        "Latest Payment Date": item.latestPaymentDate
          ? format(new Date(item.latestPaymentDate), "dd/MM/yyyy")
          : "No payment",
        "Latest Payment Amount": item.latestPaymentAmount || 0,
        Status: item.status || "N/A",
        "Recovery Rate": `${(item.collectionRate || 0).toFixed(2)}%`,
      }));

      const filteredSummary = {
        totalDisbursed: filteredData.reduce(
          (sum, item) => sum + (item.totalDisbursed || 0),
          0
        ),
        totalPaid: filteredData.reduce(
          (sum, item) => sum + (item.totalPaid || 0),
          0
        ),
        totalOutstanding: filteredData.reduce(
          (sum, item) => sum + (item.outstandingBalance || 0),
          0
        ),
        avgRate:
          filteredData.length > 0
            ? filteredData.reduce(
                (sum, item) => sum + (item.collectionRate || 0),
                0
              ) / filteredData.length
            : 0,
      };

      exportData.push({
        Member: "SUMMARY",
        Number: "",
        Type: "",
        Product: "",
        "Loan Count": "",
        Branch: "",
        Officer: "",
        Disbursed: filteredSummary.totalDisbursed,
        "Total Paid": filteredSummary.totalPaid,
        "Principal Paid": "",
        "Interest Paid": "",
        "Penalty Paid": "",
        Outstanding: filteredSummary.totalOutstanding,
        "Latest Payment Date": "",
        "Latest Payment Amount": "",
        Status: "",
        "Recovery Rate": `${filteredSummary.avgRate.toFixed(2)}%`,
      } as any);

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dues vs Repayment");
      const fileName = `dues-vs-repayment-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
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
        onExport={() => handleExport(comparisons)}
        disableExport={!comparisons.length}
      />

      {/* NEW: Branch & Officer Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        {["ADMIN", "AUDITOR"].includes(initialRole) && (
          <Select
            value={searchParams.get("branchId") || "all"}
            onValueChange={(v) => handleFilterChange("branchId", v)}
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
          onValueChange={(v) => handleFilterChange("officerId", v)}
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

        {(searchParams.get("branchId") || searchParams.get("officerId") || searchParams.get("startDate") || searchParams.get("endDate")) && (
          <Button
            variant="ghost"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("branchId");
              params.delete("officerId");
              params.delete("startDate");
              params.delete("endDate");
              router.push(`${pathname}?${params.toString()}`);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">Total Due</p>
          <p className="text-xl font-bold text-blue-600 sm:text-2xl">
            {formatCurrency(data?.summary?.totalDue || 0)}
          </p>
          <div className="mt-1 text-[10px] text-muted-foreground flex gap-2">
            <span>P: {formatCurrency(data?.summary?.totalPrincipalDue || 0)}</span>
            <span>I: {formatCurrency(data?.summary?.totalInterestDue || 0)}</span>
            <span>Pn: {formatCurrency(data?.summary?.totalPenaltyDue || 0)}</span>
          </div>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">Total Paid</p>
          <p className="text-xl font-bold text-green-600 sm:text-2xl">
            {formatCurrency(data?.summary?.totalPaid || 0)}
          </p>
          <div className="mt-1 text-[10px] text-muted-foreground flex gap-2">
            <span>P: {formatCurrency(data?.summary?.totalPrincipalPaid || 0)}</span>
            <span>I: {formatCurrency(data?.summary?.totalInterestPaid || 0)}</span>
            <span>Pn: {formatCurrency(data?.summary?.totalPenaltyPaid || 0)}</span>
          </div>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Outstanding
          </p>
          <p className="text-xl font-bold text-red-600 sm:text-2xl">
            {formatCurrency(data?.summary?.totalOutstanding || 0)}
          </p>
          <div className="mt-1 text-[10px] text-muted-foreground flex gap-2">
            <span>Amount yet to be collected</span>
          </div>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Loan Recovery Rate
          </p>
          <p className="text-xl font-bold text-purple-600 sm:text-2xl">
            {(data?.summary?.overallCollectionRate || 0).toFixed(2)}%
          </p>
          <div className="mt-1 text-[10px] text-muted-foreground flex gap-2">
            <span>Avg collection efficiency</span>
          </div>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Loans Tracked
          </p>
          <p className="text-xl font-bold text-cyan-600 sm:text-2xl">
            {comparisons.length}
          </p>
          <div className="mt-1 text-[10px] text-muted-foreground flex gap-2">
            <span>Total loans in period</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <div className="h-full overflow-y-auto">
          <DataTable
            title="Dues vs Repayment Comparison"
            subtitle={`${comparisons.length} records`}
            data={comparisons}
            columns={columns}
            keyField="dueDate"
            isLoading={loading}
            onRefresh={fetchData}
            actions={{
              onExport: handleExport,
            }}
            filters={{
              enableDateFilter: true,
              getItemDate: (item) => item.dueDate,
            }}
          />
        </div>
      </div>
    </div>
  );
}
