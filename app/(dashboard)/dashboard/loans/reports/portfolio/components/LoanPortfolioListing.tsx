"use client";

import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Filter, Download, Printer } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";

import { useMemo, useEffect, useState } from "react";

interface PortfolioSummaryListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function PortfolioSummaryListing({
  title,
  subtitle,
  initialRole,
}: PortfolioSummaryListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [officers, setOfficers] = useState<any[]>([]);
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; title: string; items: any[] }>({ open: false, title: "", items: [] });

  const branchId = searchParams.get("branchId") || "";
  const officerId = searchParams.get("officerId") || "";

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams(searchParams.toString());
        const response = await fetch(`/api/v1/reports/loans/portfolio?${params.toString()}`, {
          cache: "no-store",
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch portfolio data");
        }
        
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error || "Failed to fetch portfolio data");
        }
      } catch (err) {
        console.error("Error fetching portfolio:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
        toast.error("Failed to load portfolio data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchParams]);

  // Fetch officers for the filter dropdown
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
    { header: "Product Name", accessorKey: "productName" },
    { header: "Active Loans", accessorKey: "activeLoans" },
    { header: "Total Disbursed", accessorKey: "totalDisbursedFormatted" },
    {
      header: "Outstanding Balance",
      accessorKey: "outstandingBalanceFormatted",
    },
    { header: "Total Repaid", accessorKey: "totalRepaidFormatted" },
    { header: "PAR %", accessorKey: "parFormatted" },
    { header: "Average Loan Size", accessorKey: "averageLoanSizeFormatted" },
  ];

  // ✅ Use byProduct from data
  const products = data?.byProduct || [];

  // Format data with currency values
  const formattedProducts = products.map((item: any) => ({
    ...item,
    totalDisbursedFormatted: formatCurrency(item.totalDisbursed || 0),
    outstandingBalanceFormatted: formatCurrency(item.totalOutstanding || 0),
    totalRepaidFormatted: formatCurrency(item.totalRepaid || 0),
    parFormatted: item.portfolioAtRisk 
      ? `${item.portfolioAtRisk.toFixed(1)}%` 
      : "0.0%",
    averageLoanSizeFormatted: formatCurrency(
      item.totalDisbursed / (item.totalLoans || 1) || 0
    ),
  }));

  const handleExport = () => {
    try {
      if (!products.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = products.map((item: any) => ({
        "Product Name": item.productName,
        "Total Loans": item.totalLoans,
        "Active Loans": item.activeLoans,
        "Total Disbursed": item.totalDisbursed,
        "Outstanding Balance": item.totalOutstanding,
        "PAR %": item.portfolioAtRisk,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Portfolio Summary");
      XLSX.writeFile(wb, `portfolio-summary-${formatISODate(new Date())}.xlsx`);
      toast.success("Exported successfully");
    } catch (error) {
      toast.error("Export failed");
    }
  };

  // Calculate aggregate summary
  const aggregateSummary = useMemo(() => {
    return {
      totalActiveLoans: products.reduce((sum: number, p: any) => sum + (p.activeLoans || 0), 0),
      totalDisbursed: products.reduce((sum: number, p: any) => sum + (p.totalDisbursed || 0), 0),
      totalOutstanding: products.reduce((sum: number, p: any) => sum + (p.totalOutstanding || 0), 0),
      totalOverdueLoans: products.reduce((sum: number, p: any) => sum + (p.overdueLoans || 0), 0),
    };
  }, [products]);

  // Helper to show detail dialog
  const showDetailDialog = (cardType: string) => {
    let dialogTitle = "";
    let items: any[] = [];

    switch (cardType) {
      case "active":
        dialogTitle = "Active Loans Breakdown by Product";
        items = products.map((p: any) => ({
          label: p.productName || "Unknown Product",
          value: p.activeLoans || 0,
          formatted: `${p.activeLoans || 0} loans`,
        }));
        break;
      case "portfolio":
        dialogTitle = "Total Portfolio Breakdown by Product";
        items = products.map((p: any) => ({
          label: p.productName || "Unknown Product",
          value: p.totalOutstanding || 0,
          formatted: formatCurrency(p.totalOutstanding || 0),
        }));
        break;
      case "overdue":
        dialogTitle = "Overdue Loans Breakdown by Product";
        items = products.map((p: any) => ({
          label: p.productName || "Unknown Product",
          value: p.overdueLoans || 0,
          formatted: `${p.overdueLoans || 0} loans`,
        }));
        break;
      case "yield":
        dialogTitle = "Portfolio Yield Breakdown by Product";
        items = products.map((p: any) => {
          const yieldPct = p.totalDisbursed > 0
            ? ((p.totalDisbursed - (p.totalOutstanding || 0)) / p.totalDisbursed * 100)
            : 0;
          return {
            label: p.productName || "Unknown Product",
            value: yieldPct,
            formatted: `${yieldPct.toFixed(1)}%`,
          };
        });
        break;
    }

    setDetailDialog({ open: true, title: dialogTitle, items });
  };

  return (
    <div className="space-y-4">
      <ReportHeader 
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={handleExport}
        disableExport={!products.length}
      />

      {/* NEW: Branch & Officer Filters */}
      <div className="flex flex-col md:flex-row gap-4 print:hidden">
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
              router.push(`?${params.toString()}`);
            }}
          >
            Clear Search
          </Button>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-lg text-red-600">
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {/* Clickable Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className="rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          onClick={() => showDetailDialog("active")}
        >
          <p className="text-xs text-muted-foreground font-medium">Active Loans</p>
          <p className="text-xl font-bold">{aggregateSummary.totalActiveLoans}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Click for breakdown</p>
        </div>
        <div
          className="rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-400/50 transition-all"
          onClick={() => showDetailDialog("portfolio")}
        >
          <p className="text-xs text-muted-foreground font-medium">Total Portfolio</p>
          <p className="text-xl font-bold text-blue-600">
            {formatCurrency(aggregateSummary.totalOutstanding)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Click for breakdown</p>
        </div>
        <div
          className="rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-red-400/50 transition-all"
          onClick={() => showDetailDialog("overdue")}
        >
          <p className="text-xs text-muted-foreground font-medium">Overdue Loans</p>
          <p className="text-xl font-bold text-red-600">
            {aggregateSummary.totalOverdueLoans}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Click for breakdown</p>
        </div>
        <div
          className="rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-green-400/50 transition-all"
          onClick={() => showDetailDialog("yield")}
        >
          <p className="text-xs text-muted-foreground font-medium">Portfolio Yield %</p>
          <p className="text-xl font-bold text-green-600">
            {aggregateSummary.totalDisbursed > 0 
              ? ((aggregateSummary.totalDisbursed - aggregateSummary.totalOutstanding) / aggregateSummary.totalDisbursed * 100).toFixed(1)
              : 0}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Click for breakdown</p>
        </div>
      </div>

      <DataTable
        title=""
        data={formattedProducts}
        columns={columns}
        keyField="productName"
      />
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {detailDialog.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center py-2 px-3 rounded-md bg-muted/50 hover:bg-muted">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-sm font-bold">{item.formatted}</span>
              </div>
            ))}
            {detailDialog.items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
