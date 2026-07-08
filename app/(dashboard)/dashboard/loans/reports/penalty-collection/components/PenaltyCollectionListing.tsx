"use client";

import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/utils";
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

interface PenaltyCollectionListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function PenaltyCollectionListing({
  title,
  subtitle,
  initialRole,
}: PenaltyCollectionListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/penalty-collection${queryString ? `?${queryString}` : ""}`, {
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

  useEffect(() => {
    fetchData();
  }, [searchParams]);

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
        <span className="text-sm font-semibold">{row.memberName}</span>
      ),
    },
    {
      header: "Product",
      accessorKey: "loanProduct",
      cell: (row: any) => <span className="text-xs">{row.loanProduct}</span>,
    },
    {
      header: "Disbursement Date",
      accessorKey: "disbursementDate",
      cell: (row: any) => (
        <span className="text-xs">
          {row.disbursementDate ? format(new Date(row.disbursementDate), "dd/MM/yyyy") : "N/A"}
        </span>
      ),
    },
    {
      header: "Penalty Charged",
      accessorKey: "penaltyCharged",
      cell: (row: any) => (
        <span className="font-semibold text-red-600">
          {formatCurrency(row.penaltyCharged || 0)}
        </span>
      ),
    },
    {
      header: "Penalty Paid",
      accessorKey: "penaltyPaid",
      cell: (row: any) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(row.penaltyPaid || 0)}
        </span>
      ),
    },
    {
      header: "Outstanding",
      accessorKey: "penaltyOutstanding",
      cell: (row: any) => (
        <span className={`font-semibold ${(row.penaltyOutstanding || 0) > 0 ? "text-orange-600" : "text-gray-500"}`}>
          {formatCurrency(row.penaltyOutstanding || 0)}
        </span>
      ),
    },
    {
      header: "Collection Rate",
      accessorKey: "collectionRate",
      cell: (row: any) => {
        const rate = row.collectionRate || 0;
        const colorClass =
          rate >= 90
            ? "text-green-600"
            : rate >= 50
              ? "text-yellow-600"
              : "text-red-600";
        return (
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${rate >= 90 ? "bg-green-600" : rate >= 50 ? "bg-yellow-600" : "bg-red-600"}`}
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

  const records = data?.records || [];

  const handleExport = async (filteredData: any[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item: any) => ({
        Member: item.memberName,
        Product: item.loanProduct,
        "Disbursement Date": item.disbursementDate ? format(new Date(item.disbursementDate), "dd/MM/yyyy") : "N/A",
        "Penalty Charged": item.penaltyCharged || 0,
        "Penalty Paid": item.penaltyPaid || 0,
        Outstanding: item.penaltyOutstanding || 0,
        "Collection Rate": `${(item.collectionRate || 0).toFixed(2)}%`,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Penalty Collections");
      const fileName = `penalty-collections-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful", {
        description: `Report exported to ${fileName}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={() => handleExport(records)}
        disableExport={!records.length}
      />

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
            Clear Filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">Total Penalty Charged</p>
          <p className="text-xl font-bold text-red-600 sm:text-2xl">
            {formatCurrency(data?.summary?.totalPenaltyCharged || 0)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">Total Penalty Paid</p>
          <p className="text-xl font-bold text-green-600 sm:text-2xl">
            {formatCurrency(data?.summary?.totalPenaltyPaid || 0)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Outstanding
          </p>
          <p className="text-xl font-bold text-orange-600 sm:text-2xl">
            {formatCurrency(data?.summary?.totalPenaltyOutstanding || 0)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Collection Rate
          </p>
          <p className="text-xl font-bold text-purple-600 sm:text-2xl">
            {(data?.summary?.overallCollectionRate || 0).toFixed(2)}%
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Loans with Penalties
          </p>
          <p className="text-xl font-bold text-cyan-600 sm:text-2xl">
            {data?.summary?.totalLoans || 0}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <div className="h-full overflow-y-auto">
          <DataTable
            title="Penalty Collections"
            subtitle={`${records.length} records`}
            data={records}
            columns={columns}
            keyField="loanId"
            isLoading={loading}
            onRefresh={fetchData}
            actions={{
              onExport: handleExport,
            }}
          />
        </div>
      </div>
    </div>
  );
}
