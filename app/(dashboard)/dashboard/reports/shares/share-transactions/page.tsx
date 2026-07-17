"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { format, subDays } from "date-fns";
import { Download, Loader2, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

type BranchOption = { id: string; name: string };

type TransactionRow = {
  accountNumber: string;
  memberName: string;
  phone: string;
  reference: string;
  sessionDate: string;
  transactionDate: string;
  debit: number;
  credit: number;
  userName: string;
  isReversed: boolean;
};

type ProductSection = {
  productCode: string;
  productName: string;
  transactions: TransactionRow[];
  subtotal: {
    count: number;
    totalDebit: number;
    totalCredit: number;
  };
};

type TransactionsReport = {
  saccoName: string;
  branchLabel: string;
  branchLocation: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  products: ProductSection[];
  grandTotal: {
    count: number;
    totalDebit: number;
    totalCredit: number;
  };
};

const money = (value: number) =>
  new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Number(value || 0));

const dateDisplay = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd/MM/yyyy");
};

export default function ShareTransactionsPage() {
  const { data: session } = useSession();
  const isAdmin = String((session?.user as any)?.role || "").toUpperCase() === "ADMIN";
  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  const liveRefreshVersion = useReportLiveRefresh({ enabled: true, intervalMs: 15000 });

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<TransactionsReport | null>(null);
  const [pageByProduct, setPageByProduct] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState({
    branchId: "all",
    dateFrom: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    dateTo: format(new Date(), "yyyy-MM-dd"),
    accountTypeId: "all",
    tellerId: "all",
    memberSearch: "",
  });

  useEffect(() => {
    if (!isAdmin && userBranchId) {
      setFilters((current) => ({ ...current, branchId: userBranchId }));
    }
  }, [isAdmin, userBranchId]);

  useEffect(() => {
    async function loadBranches() {
      try {
        const response = await fetch("/api/v1/branches", { cache: "no-store" });
        if (!response.ok) return;
        const json = await response.json();
        const items = Array.isArray(json?.data) ? json.data : [];
        setBranches(items.map((branch: any) => ({ id: branch.id, name: branch.name })));
      } catch {
        // ignore
      }
    }
    void loadBranches();
  }, []);

  const branchLabel = useMemo(() => {
    if (!isAdmin) return branches.find((b) => b.id === userBranchId)?.name || "Assigned Branch";
    if (filters.branchId === "all") return "All Branches";
    return branches.find((b) => b.id === filters.branchId)?.name || filters.branchId;
  }, [branches, filters.branchId, isAdmin, userBranchId]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
      if (isAdmin && filters.branchId !== "all") params.set("branchId", filters.branchId);
      if (!isAdmin && userBranchId) params.set("branchId", userBranchId);
      if (filters.accountTypeId !== "all") params.set("accountTypeId", filters.accountTypeId);
      if (filters.tellerId !== "all") params.set("tellerId", filters.tellerId);

      const response = await fetch(`/api/v1/reports/shares/transactions?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok || !json?.success) throw new Error(json?.error || "Failed to load report");
      setReport(json.data);
      setPageByProduct({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [filters, isAdmin, userBranchId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!report) return;
    void loadReport();
  }, [liveRefreshVersion, loadReport, report]);

  const exportExcel = useCallback(async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
      if (isAdmin && filters.branchId !== "all") params.set("branchId", filters.branchId);
      if (!isAdmin && userBranchId) params.set("branchId", userBranchId);
      if (filters.accountTypeId !== "all") params.set("accountTypeId", filters.accountTypeId);
      if (filters.tellerId !== "all") params.set("tellerId", filters.tellerId);

      const response = await fetch(`/api/v1/reports/shares/transactions/export?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to export report");
      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `shares-transactions-${filters.dateFrom}_to_${filters.dateTo}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [filters, isAdmin, userBranchId]);

  const filteredSections = useMemo(() => {
    return (report?.products || []).map((product) => {
      let rows = [...product.transactions];
      if (filters.memberSearch.trim()) {
        const q = filters.memberSearch.trim().toLowerCase();
        rows = rows.filter(
          (tx) =>
            tx.accountNumber.toLowerCase().includes(q) ||
            tx.memberName.toLowerCase().includes(q) ||
            tx.phone.toLowerCase().includes(q) ||
            tx.reference.toLowerCase().includes(q),
        );
      }
      return {
        ...product,
        transactions: rows,
        subtotal: {
          count: rows.length,
          totalDebit: rows.reduce((s, r) => s + r.debit, 0),
          totalCredit: rows.reduce((s, r) => s + r.credit, 0),
        },
      };
    });
  }, [report?.products, filters.memberSearch]);

  const pageSize = 15;

  return (
    <div className="space-y-4 p-4 md:p-5">
      {/* Header */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {report?.saccoName || "BUKONZO UNITED TEACHERS SACCO"}
            </div>
            <h1 className="mt-1 text-xl font-black text-slate-950 md:text-2xl">Shares Transactions Report</h1>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              Transaction movement report grouped by product.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-700 md:text-sm">Branch: {branchLabel}</p>
            <p className="text-xs text-slate-700 md:text-sm">
              Reporting Date From: {dateDisplay(filters.dateFrom)} To: {dateDisplay(filters.dateTo)}
            </p>
          </div>
          <div className="text-xs text-slate-500 md:text-sm">
            {report?.generatedAt ? `Generated: ${format(new Date(report.generatedAt), "dd/MM/yyyy HH:mm:ss")}` : ""}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-5">
          {isAdmin ? (
            <div className="space-y-2">
              <label className="text-xs font-medium md:text-sm">Branch</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
                value={filters.branchId}
                onChange={(e) => setFilters((c) => ({ ...c, branchId: e.target.value }))}
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium md:text-sm">Branch</label>
              <input
                className="h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-xs md:text-sm"
                value={branchLabel}
                disabled
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">From</label>
            <input
              type="date"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.dateFrom}
              onChange={(e) => setFilters((c) => ({ ...c, dateFrom: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">To</label>
            <input
              type="date"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.dateTo}
              onChange={(e) => setFilters((c) => ({ ...c, dateTo: e.target.value }))}
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-medium md:text-sm">Search</label>
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground md:h-4 md:w-4" />
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
                value={filters.memberSearch}
                onChange={(e) => setFilters((c) => ({ ...c, memberSearch: e.target.value }))}
                placeholder="Filter by account, name, phone, or reference"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-xs font-semibold md:text-sm"
            onClick={() => void loadReport()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Generate
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground md:text-sm"
            onClick={() => void exportExcel()}
            disabled={exporting || !report}
          >
            <Download className={`h-4 w-4 ${exporting ? "animate-spin" : ""}`} />
            Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Loading report...
        </div>
      ) : null}

      {/* Product sections */}
      {report ? (
        <div className="space-y-3">
          {filteredSections.map((product) => {
            const currentPage = pageByProduct[product.productCode] || 1;
            const totalPages = Math.max(1, Math.ceil(product.transactions.length / pageSize));
            const start = (currentPage - 1) * pageSize;
            const visible = product.transactions.slice(start, start + pageSize);

            return (
              <div key={product.productCode} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2.5">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Product</div>
                    <div className="text-sm font-bold text-slate-950 md:text-base">
                      {product.productCode} - {product.productName}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs md:text-sm">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                      Records {product.subtotal.count.toLocaleString()}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                      Debit UGX {money(product.subtotal.totalDebit)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                      Credit UGX {money(product.subtotal.totalCredit)}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-[11px] md:text-xs">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        {["A/C No.", "Name", "Phone/Ref", "Trx Ref No.", "Session Date", "Trx Date", "Debit", "Credit", "User Name"].map(
                          (header) => (
                            <th key={header} className="px-2 py-2 text-left font-semibold uppercase tracking-[0.12em] leading-tight">
                              {header}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((tx, idx) => (
                        <tr
                          key={`${tx.reference}-${idx}`}
                          className={`border-b last:border-0 ${
                            tx.isReversed ? "bg-red-50 line-through opacity-60" : ""
                          }`}
                        >
                          <td className="px-2 py-2 font-medium break-words">{tx.accountNumber}</td>
                          <td className="px-2 py-2 break-words" title={tx.memberName}>{tx.memberName}</td>
                          <td className="px-2 py-2 break-words">{tx.phone}</td>
                          <td className="px-2 py-2 font-mono text-[11px] break-all">{tx.reference}</td>
                          <td className="whitespace-nowrap px-2 py-2">{dateDisplay(tx.sessionDate)}</td>
                          <td className="whitespace-nowrap px-2 py-2">{dateDisplay(tx.transactionDate)}</td>
                          <td className={`px-2 py-2 tabular-nums ${tx.debit === 0 ? "text-muted-foreground" : ""}`}>
                            {tx.debit ? money(tx.debit) : ""}
                          </td>
                          <td className={`px-2 py-2 tabular-nums ${tx.credit === 0 ? "text-muted-foreground" : ""}`}>
                            {tx.credit ? money(tx.credit) : ""}
                          </td>
                          <td className="px-2 py-2 break-words">{tx.userName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50 px-3 py-2 text-sm font-semibold">
                  <div>
                    Total: {product.subtotal.count.toLocaleString()}
                    {"   "}Debit: {money(product.subtotal.totalDebit)}
                    {"   "}Credit: {money(product.subtotal.totalCredit)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-2.5 py-1 text-xs"
                      disabled={currentPage <= 1}
                      onClick={() => setPageByProduct((c) => ({ ...c, [product.productCode]: Math.max(1, currentPage - 1) }))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-slate-600">
                      Page {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-2.5 py-1 text-xs"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPageByProduct((c) => ({ ...c, [product.productCode]: Math.min(totalPages, currentPage + 1) }))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {!filteredSections.length && !loading ? (
            <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
              No transactions found for the selected period.
            </div>
          ) : null}

          {/* Grand total */}
          <div className="rounded-2xl border bg-white p-4 text-sm font-semibold shadow-sm">
            Grand Total: {report.grandTotal.count.toLocaleString()}
            {"   "}Debit: {money(report.grandTotal.totalDebit)}
            {"   "}Credit: {money(report.grandTotal.totalCredit)}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
          Select a date range and click Generate to view transactions.
        </div>
      )}
    </div>
  );
}
