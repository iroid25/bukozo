// @ts-nocheck
// ============================================================
// app/dashboard/loans/reports/repayment-history/components/RepaymentHistoryReportView.tsx
// ============================================================
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatISODate } from "@/lib/utils";
import {
  Receipt,
  Banknote,
  PieChart,
  AlertCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface RepaymentHistoryData {
  repayments: Array<{
    repaymentId: string;
    loanId: string;
    memberName: string;
    memberNumber: string;
    loanProduct: string;
    amountPaid: number;
    principalPaid: number;
    interestPaid: number;
    penaltyPaid: number;
    paymentDate: Date;
    paymentMethod: string;
    transactionReference: string;
    collectedBy: string;
    branch: string;
  }>;
  summary: {
    totalRepayments: number;
    totalAmountCollected: number;
    totalPrincipalCollected: number;
    totalInterestCollected: number;
    totalPenaltyCollected: number;
  };
}

interface RepaymentHistoryReportViewProps {
  userRole: string;
  initialBranchId?: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function RepaymentHistoryReportView({
  userRole,
  initialBranchId,
}: RepaymentHistoryReportViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [data, setData] = useState<RepaymentHistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const branchFilter = searchParams.get("branchId") || "all";
  const dateRangeFilter = searchParams.get("dateRange") || "all";

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchFilter !== "all") params.set("branchId", branchFilter);

      const now = new Date();
      if (dateRangeFilter === "today") {
        params.set("startDate", now.toISOString());
        params.set("endDate", now.toISOString());
      } else if (dateRangeFilter === "week") {
        const lastWeek = new Date(now);
        lastWeek.setDate(now.getDate() - 7);
        params.set("startDate", lastWeek.toISOString());
        params.set("endDate", now.toISOString());
      } else if (dateRangeFilter === "month") {
        const lastMonth = new Date(now);
        lastMonth.setMonth(now.getMonth() - 1);
        params.set("startDate", lastMonth.toISOString());
        params.set("endDate", now.toISOString());
      } else if (dateRangeFilter === "quarter") {
        const lastQuarter = new Date(now);
        lastQuarter.setMonth(now.getMonth() - 3);
        params.set("startDate", lastQuarter.toISOString());
        params.set("endDate", now.toISOString());
      }

      const queryString = params.toString();
      const response = await fetch(
        `/api/v1/reports/loans/repayment-summary${queryString ? `?${queryString}` : ""}`,
        { cache: "no-store" }
      );
      const result = await response.json();

      if (result.success) {
        const rawRepayments = Array.isArray(result.data)
          ? result.data
          : result.data?.repayments || [];

        const mappedRepayments = rawRepayments
          .map((r: any) => ({
            repaymentId: r.id || r.repaymentId || "",
            loanId: r.loanId || "",
            memberName: r.memberName || "",
            memberNumber: r.memberNumber || "",
            loanProduct: r.loanProduct || "",
            amountPaid: r.amount || r.repaymentAmount || r.amountPaid || 0,
            principalPaid: r.principalPaid || 0,
            interestPaid: r.interestPaid || 0,
            penaltyPaid: r.penaltyPaid || 0,
            paymentDate: new Date(r.repaymentDate || r.paymentDate),
            paymentMethod: r.channel || r.paymentMethod || "N/A",
            transactionReference:
              r.transactionId || r.mobileMoneyRef || r.transactionReference || "",
            collectedBy: r.collectedBy || r.handlerName || "N/A",
            branch: r.branch || "N/A",
          }))
          .sort(
            (a: any, b: any) =>
              new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
          );

        setData({
          repayments: mappedRepayments,
          summary: {
            totalRepayments: mappedRepayments.length,
            totalAmountCollected: mappedRepayments.reduce((s: number, r: any) => s + r.amountPaid, 0),
            totalPrincipalCollected: mappedRepayments.reduce((s: number, r: any) => s + r.principalPaid, 0),
            totalInterestCollected: mappedRepayments.reduce((s: number, r: any) => s + r.interestPaid, 0),
            totalPenaltyCollected: mappedRepayments.reduce((s: number, r: any) => s + r.penaltyPaid, 0),
          },
        });
      } else {
        toast.error(result.error || "Failed to fetch data");
      }
    } catch (error) {
      console.error("Error fetching repayment history:", error);
      toast.error("Failed to load repayment history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [branchFilter, dateRangeFilter]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, paymentMethodFilter, pageSize]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setPaymentMethodFilter("all");
    router.replace(pathname);
  };

  const handleExportExcel = () => {
    try {
      if (!data) return;
      const exportData = filteredRepayments.map((repayment) => ({
        "Receipt Number": repayment.repaymentId,
        "Loan ID": repayment.loanId,
        "Member Name": repayment.memberName,
        "Member Number": repayment.memberNumber,
        "Loan Product": repayment.loanProduct,
        "Principal Paid": repayment.principalPaid,
        "Interest Paid": repayment.interestPaid,
        "Penalty Paid": repayment.penaltyPaid,
        "Total Amount Paid": repayment.amountPaid,
        "Payment Date": format(new Date(repayment.paymentDate), "yyyy-MM-dd"),
        "Payment Method": repayment.paymentMethod,
        "Transaction Reference": repayment.transactionReference,
        "Collected By": repayment.collectedBy,
        Branch: repayment.branch,
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Repayment History");
      XLSX.writeFile(wb, `repayment-history-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Report exported successfully");
    } catch (error) {
      toast.error("Failed to export report");
      console.error(error);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const paymentMethods = useMemo(() => {
    if (!data?.repayments) return [];
    return Array.from(new Set(data.repayments.map((r) => r.paymentMethod)));
  }, [data?.repayments]);

  const filteredRepayments = useMemo(() => {
    return (data?.repayments || []).filter((repayment) => {
      const matchesSearch =
        searchTerm === "" ||
        Object.values(repayment).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesPaymentMethod =
        paymentMethodFilter === "all" || repayment.paymentMethod === paymentMethodFilter;
      return matchesSearch && matchesPaymentMethod;
    });
  }, [data?.repayments, searchTerm, paymentMethodFilter]);

  const filteredSummary = useMemo(() => ({
    totalRepayments: filteredRepayments.length,
    totalAmountCollected: filteredRepayments.reduce((s, r) => s + (r.amountPaid || 0), 0),
    totalPrincipal: filteredRepayments.reduce((s, r) => s + (r.principalPaid || 0), 0),
    totalInterest: filteredRepayments.reduce((s, r) => s + (r.interestPaid || 0), 0),
    totalPenalty: filteredRepayments.reduce((s, r) => s + (r.penaltyPaid || 0), 0),
  }), [filteredRepayments]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filteredRepayments.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pagedRepayments = filteredRepayments.slice(pageStart, pageEnd);

  const pageWindow = useMemo(() => {
    const delta = 2;
    const range: number[] = [];
    for (
      let i = Math.max(1, safePage - delta);
      i <= Math.min(totalPages, safePage + delta);
      i++
    ) range.push(i);
    return range;
  }, [safePage, totalPages]);

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: Column<RepaymentHistoryData["repayments"][0]>[] = [
    {
      header: "Member",
      accessorKey: "memberName",
      cell: (row) => (
        <div className="flex flex-col min-w-[120px]">
          <span className="font-medium text-xs leading-none mb-1">{row.memberName}</span>
          <span className="text-[10px] text-muted-foreground font-bold">{row.memberNumber}</span>
        </div>
      ),
    },
    {
      header: "Product",
      accessorKey: "loanProduct",
      cell: (row) => (
        <div className="max-w-[150px]">
          <Badge variant="outline" className="text-[10px] font-normal truncate max-w-full">
            {row.loanProduct}
          </Badge>
        </div>
      ),
    },
    {
      header: "Principal",
      accessorKey: "principalPaid",
      cell: (row) => (
        <span className="text-secondary-foreground font-medium text-xs">
          {formatCurrency(row.principalPaid)}
        </span>
      ),
    },
    {
      header: "Interest",
      accessorKey: "interestPaid",
      cell: (row) => (
        <span className="text-orange-600 font-medium text-xs">
          {formatCurrency(row.interestPaid)}
        </span>
      ),
    },
    {
      header: "Penalty",
      accessorKey: "penaltyPaid",
      cell: (row) => (
        <span className="text-red-600 font-medium text-xs">
          {formatCurrency(row.penaltyPaid)}
        </span>
      ),
    },
    {
      header: "Total Paid",
      accessorKey: "amountPaid",
      cell: (row) => (
        <span className="font-bold text-green-600 text-xs">
          {formatCurrency(row.amountPaid)}
        </span>
      ),
    },
    {
      header: "Date",
      accessorKey: "paymentDate",
      cell: (row) => (
        <span className="text-xs whitespace-nowrap">{format(new Date(row.paymentDate), "dd MMM yyyy")}</span>
      ),
    },
    {
      header: "Method",
      accessorKey: "paymentMethod",
      cell: (row) => (
        <Badge variant="secondary" className="text-[10px] px-1 py-0">
          {row.paymentMethod}
        </Badge>
      ),
    },
    {
      header: "Collected By",
      accessorKey: "collectedBy",
      cell: (row) => <span className="text-sm">{row.collectedBy}</span>,
    },
    {
      header: "Branch",
      accessorKey: "branch",
      cell: (row) => <span className="text-sm">{row.branch}</span>,
    },
  ];

  const periodLabel =
    {
      all: "All Time",
      today: format(new Date(), "PPP"),
      week: `Last 7 Days (Since ${format(new Date(new Date().setDate(new Date().getDate() - 7)), "PPP")})`,
      month: `Last 30 Days (Since ${format(new Date(new Date().setDate(new Date().getDate() - 30)), "PPP")})`,
      quarter: `Last 90 Days (Since ${format(new Date(new Date().setDate(new Date().getDate() - 90)), "PPP")})`,
    }[dateRangeFilter] || "All Time";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <ReportHeader
        title="Repayment History Report"
        subtitle="Complete history of loan repayments"
        period={periodLabel}
        onPrint={() => window.print()}
        onExport={handleExportExcel}
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Repayments</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSummary.totalRepayments}</div>
            <p className="text-xs text-muted-foreground">Total transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Principal</CardTitle>
            <Banknote className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(filteredSummary.totalPrincipal)}</div>
            <p className="text-xs text-muted-foreground font-black uppercase">Capital Recovery</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interest</CardTitle>
            <PieChart className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(filteredSummary.totalInterest)}</div>
            <p className="text-xs text-muted-foreground font-black uppercase">Revenue Earned</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Penalty</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(filteredSummary.totalPenalty)}</div>
            <p className="text-xs text-muted-foreground font-black uppercase">Penalty Collection</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by member, loan ID, receipt..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {["ADMIN", "AUDITOR"].includes(userRole) && (
                <Select value={branchFilter} onValueChange={(val) => handleFilterChange("branchId", val)}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    <SelectItem value="Main Branch">Main Branch</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Select value={dateRangeFilter} onValueChange={(val) => handleFilterChange("dateRange", val)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="quarter">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(searchTerm || paymentMethodFilter !== "all" || branchFilter !== "all" || dateRangeFilter !== "all") && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Active Filters</p>
                <Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Data Table Card ─────────────────────────────────────────────────── */}
      <Card className={viewMode === "summary" ? "print:hidden" : ""}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Repayment Transaction Details
          </CardTitle>
          {/* Rows-per-page selector lives in the header so it never scrolls */}
          <div className="flex items-center gap-2 print:hidden">
            <span className="text-xs text-muted-foreground">Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        {/*
          p-0 so the scroll div sits flush against the card border.
          Do NOT add overflow-hidden to Card or CardContent —
          that clips the scrollbar before it can render.
        */}
        <CardContent className="p-0">

          {/* ── Scroll container: only this section scrolls horizontally ── */}
          <div
            style={{
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              width: "100%",
            }}
          >
            {/*
              minWidth forces the DataTable wider than its container.
              Without this, the table squishes to 100% and overflow never fires.
              Adjust the value to match the total natural width of your columns.
            */}
            <div style={{ minWidth: "1050px" }}>
              <DataTable
                columns={columns}
                data={pagedRepayments}
                isLoading={loading}
              />
            </div>
          </div>

          {/* ── Totals footer — sibling of scroll div, never scrolls ── */}
          {!loading && filteredRepayments.length > 0 && (
            <div className="flex font-black text-sm p-4 bg-muted/50 border-t justify-end gap-12">
              <div className="flex gap-4">
                <span>TOTALS:</span>
                <div className="flex flex-col items-end min-w-[120px]">
                  <span className="text-[10px] text-muted-foreground uppercase opacity-70">Principal</span>
                  <span className="text-blue-600 font-bold">{formatCurrency(filteredSummary.totalPrincipal)}</span>
                </div>
                <div className="flex flex-col items-end min-w-[120px]">
                  <span className="text-[10px] text-muted-foreground uppercase opacity-70">Interest</span>
                  <span className="text-orange-600 font-bold">{formatCurrency(filteredSummary.totalInterest)}</span>
                </div>
                <div className="flex flex-col items-end min-w-[120px]">
                  <span className="text-[10px] text-muted-foreground uppercase opacity-70">Penalty</span>
                  <span className="text-red-600 font-bold">{formatCurrency(filteredSummary.totalPenalty)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end border-l pl-8 min-w-[150px]">
                <span className="text-[10px] text-muted-foreground uppercase opacity-70">Total Collected</span>
                <span className="text-green-600 text-lg underline underline-offset-4 decoration-2">
                  {formatCurrency(filteredSummary.totalAmountCollected)}
                </span>
              </div>
            </div>
          )}

          {/* ── Pagination — sibling of scroll div, never scrolls ── */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t print:hidden">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {pageStart + 1}–{Math.min(pageEnd, filteredRepayments.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-foreground">
                  {filteredRepayments.length}
                </span>
              </p>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => setCurrentPage(1)}
                  disabled={safePage === 1}
                  aria-label="First page"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                {pageWindow[0] > 1 && (
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-xs" onClick={() => setCurrentPage(1)}>1</Button>
                    {pageWindow[0] > 2 && <span className="text-xs text-muted-foreground px-1">…</span>}
                  </>
                )}

                {pageWindow.map((p) => (
                  <Button
                    key={p}
                    variant={p === safePage ? "default" : "ghost"}
                    size="icon"
                    className="h-7 w-7 text-xs"
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </Button>
                ))}

                {pageWindow[pageWindow.length - 1] < totalPages && (
                  <>
                    {pageWindow[pageWindow.length - 1] < totalPages - 1 && (
                      <span className="text-xs text-muted-foreground px-1">…</span>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-xs" onClick={() => setCurrentPage(totalPages)}>
                      {totalPages}
                    </Button>
                  </>
                )}

                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safePage === totalPages}
                  aria-label="Last page"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Summary print footer */}
      {viewMode === "summary" && (
        <div className="hidden print:block mt-8 text-center text-sm text-muted-foreground">
          <p>*** Summary Report Only ***</p>
        </div>
      )}
    </div>
  );
}
