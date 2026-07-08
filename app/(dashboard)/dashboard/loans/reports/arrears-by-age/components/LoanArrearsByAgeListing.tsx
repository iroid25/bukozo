"use client";

import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface ArrearsByAgeListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function ArrearsByAgeListing({
  title,
  subtitle,
  initialRole,
}: ArrearsByAgeListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);
  const [selectedBracket, setSelectedBracket] = useState<string>("all");

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
      const response = await fetch(`/api/v1/reports/loans/arrears-by-age${queryString ? `?${queryString}` : ""}`, {
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

  const columns: Column<any>[] = [
    {
      header: "Aging Bracket",
      accessorKey: "agingBracket",
      cell: (row: any) => {
        const colorMap: Record<string, string> = {
          "1-30 days": "bg-blue-100 text-blue-800",
          "31-60 days": "bg-yellow-100 text-yellow-800",
          "61-90 days": "bg-orange-100 text-orange-800",
          "91-180 days": "bg-red-100 text-red-800",
          "181-365 days": "bg-red-600 text-white",
          "365+ days": "bg-black text-white",
        };
        return (
          <Badge variant="outline" className={colorMap[row.agingBracket] || ""}>
            {row.agingBracket}
          </Badge>
        );
      },
    },
    {
      header: "Loans",
      accessorKey: "numberOfLoans",
      cell: (row: any) => (
        <span className="font-bold text-lg">{row.numberOfLoans}</span>
      ),
    },
    {
      header: "Principal",
      accessorKey: "principalArrears",
      cell: (row: any) => (
        <span className="font-semibold text-red-600">
          {formatCurrency(row.principalArrears || 0)}
        </span>
      ),
    },
    {
      header: "Interest",
      accessorKey: "interestArrears",
      cell: (row: any) => (
        <span className="font-semibold text-orange-600">
          {formatCurrency(row.interestArrears || 0)}
        </span>
      ),
    },
    {
      header: "Penalty",
      accessorKey: "penaltyArrears",
      cell: (row: any) => (
        <span className="font-semibold text-amber-600">
          {formatCurrency(row.penaltyArrears || 0)}
        </span>
      ),
    },
    {
      header: "Total Arrears",
      accessorKey: "totalArrears",
      cell: (row: any) => (
        <span className="font-bold text-red-700 text-lg">
          {formatCurrency(row.totalArrears || 0)}
        </span>
      ),
    },
    {
      header: "Percentage",
      accessorKey: "percentage",
      cell: (row: any) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 rounded-full"
              style={{ width: `${Math.min(row.percentage || 0, 100)}%` }}
            />
          </div>
          <span className="font-medium">
            {(row.percentage || 0).toFixed(2)}%
          </span>
        </div>
      ),
    },
    {
      header: "Members",
      accessorKey: "members",
      cell: (row: any) => {
        const members = row.members || [];
        if (!members.length) return <span className="text-xs text-muted-foreground">None</span>;
        const displayMembers = members.slice(0, 5);
        return (
          <div className="flex flex-col gap-0.5 max-w-[200px]">
            {displayMembers.map((m: any, i: number) => (
              <span key={i} className="text-[10px] text-muted-foreground truncate">
                {m.name} ({m.memberNumber}) - {formatCurrency(m.amount)}
              </span>
            ))}
            {members.length > 5 && (
              <span className="text-[10px] font-medium text-blue-600">
                +{members.length - 5} more...
              </span>
            )}
          </div>
        );
      },
    },
  ];

  // Safe access to data
  const agingBrackets = data?.agingBrackets || [];

  // Filter by selected bracket
  const filteredBrackets = selectedBracket === "all" 
    ? agingBrackets 
    : agingBrackets.filter((b: any) => b.agingBracket === selectedBracket);

  // Calculate summary from filtered data
  const summaryData = selectedBracket === "all" 
    ? (data?.summary || {
        totalLoans: 0,
        totalPrincipalArrears: 0,
        totalInterestArrears: 0,
        totalPenaltyArrears: 0,
        totalArrears: 0,
      })
    : {
        totalLoans: filteredBrackets.reduce((sum: number, b: any) => sum + (b.numberOfLoans || 0), 0),
        totalPrincipalArrears: filteredBrackets.reduce((sum: number, b: any) => sum + (b.principalArrears || 0), 0),
        totalInterestArrears: filteredBrackets.reduce((sum: number, b: any) => sum + (b.interestArrears || 0), 0),
        totalPenaltyArrears: filteredBrackets.reduce((sum: number, b: any) => sum + (b.penaltyArrears || 0), 0),
        totalArrears: filteredBrackets.reduce((sum: number, b: any) => sum + (b.totalArrears || 0), 0),
      };

  const handleExport = async (filteredData: any[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item: any) => ({
        "Aging Bracket": item.agingBracket,
        "Number of Loans": item.numberOfLoans,
        "Principal Arrears": item.principalArrears,
        "Interest Arrears": item.interestArrears,
        "Total Arrears": item.totalArrears,
        Percentage: `${(item.percentage || 0).toFixed(2)}%`,
      }));

      // Calculate filtered summary
      const filteredSummary = {
        totalLoans: filteredData.reduce(
          (sum, item) => sum + (item.numberOfLoans || 0),
          0
        ),
        totalPrincipal: filteredData.reduce(
          (sum, item) => sum + (item.principalArrears || 0),
          0
        ),
        totalInterest: filteredData.reduce(
          (sum, item) => sum + (item.interestArrears || 0),
          0
        ),
        totalArrears: filteredData.reduce(
          (sum, item) => sum + (item.totalArrears || 0),
          0
        ),
      };

      // Add summary row
      exportData.push({
        "Aging Bracket": "TOTAL",
        "Number of Loans": filteredSummary.totalLoans,
        "Principal Arrears": filteredSummary.totalPrincipal,
        "Interest Arrears": filteredSummary.totalInterest,
        "Total Arrears": filteredSummary.totalArrears,
        Percentage: "100.00%",
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Arrears by Age");
      const fileName = `arrears-by-age-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
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
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={() => handleExport(filteredBrackets)}
        disableExport={!filteredBrackets.length}
      />

      {/* Bracket Filter */}
      <div className="flex gap-3 items-center">
        <label className="text-sm font-medium">Filter by Bracket:</label>
        <Select value={selectedBracket} onValueChange={setSelectedBracket}>
          <SelectTrigger className="w-[250px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Brackets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Aging Brackets</SelectItem>
            <SelectItem value="1-30 days">1-30 days</SelectItem>
            <SelectItem value="31-60 days">31-60 days</SelectItem>
            <SelectItem value="61-90 days">61-90 days</SelectItem>
            <SelectItem value="91-180 days">91-180 days</SelectItem>
            <SelectItem value="181-365 days">181-365 days</SelectItem>
            <SelectItem value="365+ days">365+ days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards - Responsive Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Loans
          </p>
          <p className="text-xl font-bold sm:text-2xl">{summaryData.totalLoans}</p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Principal Arrears
          </p>
          <p className="text-xl font-bold text-red-600 sm:text-2xl">
            {formatCurrency(summaryData.totalPrincipalArrears)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Interest Arrears
          </p>
          <p className="text-xl font-bold text-orange-600 sm:text-2xl">
            {formatCurrency(summaryData.totalInterestArrears)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Penalty Arrears
          </p>
          <p className="text-xl font-bold text-amber-600 sm:text-2xl">
            {formatCurrency(summaryData.totalPenaltyArrears)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Total Arrears
          </p>
          <p className="text-xl font-bold text-red-700 sm:text-2xl">
            {formatCurrency(summaryData.totalArrears)}
          </p>
        </div>
      </div>

      {/* Data Table with Vertical Scrolling */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <div className="h-full overflow-y-auto">
          <DataTable
            title="Aging Analysis"
            subtitle={`${agingBrackets.length} aging brackets`}
            data={agingBrackets}
            columns={columns}
            keyField="agingBracket"
            isLoading={loading}
            onRefresh={fetchData}
            actions={{
              onExport: handleExport,
            }}
            filters={{
              searchFields: ["agingBracket"],
            }}
          />
        </div>
      </div>
    </div>
  );
}
