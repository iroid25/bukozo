"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Search, Filter, RefreshCw } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface PortfolioConcentrationListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function PortfolioConcentrationListing({
  title,
  subtitle,
  initialRole,
}: PortfolioConcentrationListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [concentrationFilter, setConcentrationFilter] = useState<string>("all");
  const selectedOfficer = searchParams.get("officerId") || "all";

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/portfolio-concentration${queryString ? `?${queryString}` : ""}`, {
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

  // Re-fetch when URL params change
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
    { header: "Category", accessorKey: "category" },
    { header: "Number of Loans", accessorKey: "numberOfLoans" },
    { header: "Total Loan Amount", accessorKey: "totalAmountFormatted" },
    {
      header: "Outstanding Balance",
      accessorKey: "outstandingBalanceFormatted",
    },
    { header: "Portfolio %", accessorKey: "percentageOfPortfolioFormatted" },
    { header: "Average Loan Size", accessorKey: "averageLoanSizeFormatted" },
  ];

  // Safe access to data
  const concentrations = data?.concentrations || [];

  // Filter data based on search and concentration level
  const filteredConcentrations = useMemo(() => {
    return concentrations.filter((item: any) => {
      const matchesSearch = item.category
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      const matchesConcentration =
        concentrationFilter === "all" ||
        (concentrationFilter === "high" && item.percentageOfPortfolio >= 30) ||
        (concentrationFilter === "medium" &&
          item.percentageOfPortfolio >= 15 &&
          item.percentageOfPortfolio < 30) ||
        (concentrationFilter === "low" && item.percentageOfPortfolio < 15);

      return matchesSearch && matchesConcentration;
    });
  }, [concentrations, searchTerm, concentrationFilter]);

  // Calculate summary from filtered data
  const summary = {
    totalCategories: filteredConcentrations.length,
    totalLoans: filteredConcentrations.reduce(
      (sum: number, item: any) => sum + (item.numberOfLoans || 0),
      0
    ),
    totalAmount: filteredConcentrations.reduce(
      (sum: number, item: any) => sum + (item.totalAmount || 0),
      0
    ),
    totalOutstanding: filteredConcentrations.reduce(
      (sum: number, item: any) => sum + (item.outstandingBalance || 0),
      0
    ),
  };

  // Format the filtered data
  const formattedData = filteredConcentrations.map((item: any) => ({
    ...item,
    totalAmountFormatted: formatCurrency(item.totalAmount || 0),
    outstandingBalanceFormatted: formatCurrency(item.outstandingBalance || 0),
    percentageOfPortfolioFormatted: `${(
      item.percentageOfPortfolio || 0
    ).toFixed(2)}%`,
    averageLoanSizeFormatted: formatCurrency(item.averageLoanSize || 0),
  }));

  const handleExport = () => {
    try {
      if (!filteredConcentrations.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredConcentrations.map((item: any) => ({
        Category: item.category,
        "Number of Loans": item.numberOfLoans,
        "Total Amount": item.totalAmount,
        "Outstanding Balance": item.outstandingBalance,
        "Percentage of Portfolio": `${(item.percentageOfPortfolio || 0).toFixed(
          2
        )}%`,
        "Average Loan Size": item.averageLoanSize,
      }));

      // Add summary row
      exportData.push({
        Category: "TOTAL",
        "Number of Loans": summary.totalLoans,
        "Total Amount": summary.totalAmount,
        "Outstanding Balance": summary.totalOutstanding,
        "Percentage of Portfolio":
          filteredConcentrations
            .reduce(
              (sum: number, item: any) =>
                sum + (item.percentageOfPortfolio || 0),
              0
            )
            .toFixed(2) + "%",
        "Average Loan Size":
          summary.totalLoans > 0 ? summary.totalAmount / summary.totalLoans : 0,
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Portfolio Concentration");
      XLSX.writeFile(
        wb,
        `portfolio-concentration-${formatISODate(new Date())}.xlsx`
      );
      toast.success("Exported successfully");
    } catch (error) {
      toast.error("Export failed");
      console.error("Export error:", error);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setConcentrationFilter("all");
    router.push(pathname);
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={handleExport}
        disableExport={!filteredConcentrations.length}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Categories</p>
          <p className="text-2xl font-bold">{summary.totalCategories}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Loans</p>
          <p className="text-2xl font-bold">{summary.totalLoans}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.totalAmount)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.totalOutstanding)}
          </p>
        </div>
      </div>

      {/* Search and Filter Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* Officer Filter - Only for ADMIN and BRANCHMANAGER */}
            {["ADMIN", "BRANCHMANAGER", "ACCOUNTANT", "AUDITOR"].includes(initialRole) && data?.filterOptions?.officers && (
              <Select 
                value={selectedOfficer} 
                onValueChange={(val) => {
                  handleFilterChange("officerId", val);
                }}
              >
                <SelectTrigger className="w-full md:w-[200px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Loan Officer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Officers</SelectItem>
                  {data.filterOptions?.officers.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={concentrationFilter}
              onValueChange={setConcentrationFilter}
            >
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Concentration Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Concentrations</SelectItem>
                <SelectItem value="high">High (≥30%)</SelectItem>
                <SelectItem value="medium">Medium (15-30%)</SelectItem>
                <SelectItem value="low">Low (&lt;15%)</SelectItem>
              </SelectContent>
            </Select>
            {(searchTerm || concentrationFilter !== "all" || selectedOfficer !== "all") && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
          {filteredConcentrations.length !== concentrations.length && (
            <p className="text-sm text-muted-foreground mt-2">
              Showing {filteredConcentrations.length} of {concentrations.length}{" "}
              categories
            </p>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      {filteredConcentrations.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              No categories found matching your filters
            </div>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          title=""
          subtitle=""
          data={formattedData}
          columns={columns}
          keyField="category"
          isLoading={loading}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}
