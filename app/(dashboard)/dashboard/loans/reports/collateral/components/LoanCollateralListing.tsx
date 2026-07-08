"use client";

import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
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

import { useState, useEffect } from "react";

interface CollateralListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function CollateralListing({
  title,
  subtitle,
  initialRole,
}: CollateralListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
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
      const response = await fetch(`/api/v1/reports/loans/collateral${queryString ? `?${queryString}` : ""}`, {
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
        <span className="font-mono text-xs">{row.loanId?.substring(0, 8) || "N/A"}</span>
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
      cell: (row: any) => (
        <span className="text-xs">{row.memberPhone || "N/A"}</span>
      ),
    },
    {
      header: "Collateral",
      accessorKey: "collateralOffered",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold">{row.collateralOffered}</span>
          <span className="text-[10px] text-muted-foreground">{row.collateralType}</span>
        </div>
      ),
    },
    {
      header: "Value",
      accessorKey: "collateralValue",
      cell: (row: any) => (
        <span className="font-semibold text-xs text-blue-600">
          {formatCurrency(row.collateralValue || 0)}
        </span>
      ),
    },
    {
      header: "FSV",
      accessorKey: "forcedSaleValue",
      cell: (row: any) => (
        <span className="font-semibold text-xs text-orange-600">
          {formatCurrency(row.forcedSaleValue || 0)}
        </span>
      ),
    },
    {
      header: "Location",
      accessorKey: "collateralLocation",
      cell: (row: any) => (
        <span className="text-xs italic truncate max-w-[100px] inline-block">
          {row.collateralLocation || "N/A"}
        </span>
      ),
    },
    {
      header: "Details",
      accessorKey: "collateralDetails",
      cell: (row: any) => (
        <span className="text-[10px] text-muted-foreground truncate max-w-[150px] inline-block">
          {row.collateralDetails || "N/A"}
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

  const loans = data?.loans || [];
  const summary = data?.summary || {
    totalLoans: 0,
    totalApplications: 0,
    totalPrincipal: 0,
    totalOutstanding: 0,
    percentageRecovered: 0,
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
        Collateral: item.collateralOffered,
        Value: item.collateralValue || 0,
        "FSV (Forced Sale Value)": item.forcedSaleValue || 0,
        Location: item.collateralLocation || "N/A",
        Details: item.collateralDetails || "N/A",
      }));

      const filteredSummary = {
        count: filteredData.length,
        totalPrincipal: filteredData.reduce(
          (sum, item) => sum + (item.principalAmount || 0),
          0
        ),
        totalOutstanding: filteredData.reduce(
          (sum, item) => sum + (item.outstandingBalance || 0),
          0
        ),
      };

      exportData.push({
        "Loan ID": "",
        "Member Name": "SUMMARY",
        "Member Number": "",
        "Member Phone": "",
        Collateral: "",
        Value: filteredSummary.totalPrincipal,
        "FSV (Forced Sale Value)": 0,
        Location: "",
        Details: `Total Loans: ${filteredSummary.count}`,
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Loan Collateral");
      const fileName = `loan-collateral-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
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

      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={() => handleExport(loans)}
        disableExport={!loans.length}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Loans with Collateral
          </p>
          <p className="text-xl font-bold sm:text-2xl">{summary.totalLoans}</p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Principal
          </p>
          <p className="text-xl font-bold text-blue-600 sm:text-2xl">
            {formatCurrency(summary.totalPrincipal)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Outstanding
          </p>
          <p className="text-xl font-bold text-orange-600 sm:text-2xl">
            {formatCurrency(summary.totalOutstanding)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Recovery Rate
          </p>
          <p className="text-xl font-bold text-green-600 sm:text-2xl">
            {summary.percentageRecovered.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <div className="h-full overflow-y-auto">
          <DataTable
            title="Collateral Details"
            subtitle={`${loans.length} loans with collateral`}
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
                "collateralOffered",
                "loanOfficer",
                "branch",
              ],
              enableDateFilter: true,
              getItemDate: (item) => item.disbursementDate,
            }}
          />
        </div>
      </div>
    </div>
  );
}
