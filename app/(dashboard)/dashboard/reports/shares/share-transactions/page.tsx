"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { format, subDays } from "date-fns";
import { Download, Loader2, RefreshCw, Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

type BranchOption = { id: string; name: string };

type TransactionRow = {
  account_number: string;
  member_name: string;
  bvn_tin_note: string;
  ref_no: number | null;
  trx_number: string;
  session_date: string;
  trx_date: string;
  debit_amount: number;
  credit_amount: number;
  user_name: string;
  teller_code: string;
  direction: "debit" | "credit";
};

type ProductSection = {
  product_code: string;
  product_name: string;
  transactions: TransactionRow[];
  subtotal: {
    count: number;
    total_debit: number;
    total_credit: number;
    net: number;
  };
};

type TransactionsReport = {
  sacco_name: string;
  branch: string;
  branch_location?: string;
  from_date: string;
  to_date: string;
  generated_at: string;
  products: ProductSection[];
  grand_total: {
    count: number;
    total_debit: number;
    total_credit: number;
    net: number;
  };
};

const money = (value: number) =>
  new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Number(value || 0));

const dateValue = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd/MM/yyyy");
};

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ShareTransactionsPage() {
  const { data: session } = useSession();
  const isAdmin = String((session?.user as any)?.role || "").toUpperCase() === "ADMIN";
  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 15000,
  });

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<TransactionsReport | null>(null);
  const [sortField, setSortField] = useState<"trx_date" | "amount" | "user_name">("trx_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [pageByProduct, setPageByProduct] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState({
    branchId: "all",
    fromDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    toDate: format(new Date(), "yyyy-MM-dd"),
    productId: "all",
    userName: "",
    accountNumber: "",
    memberSearch: "",
    direction: "all",
    minAmount: "",
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
        // ignore branch loading errors for report screen
      }
    }
    void loadBranches();
  }, []);

  const branchLabel = useMemo(() => {
    if (!isAdmin) return branches.find((branch) => branch.id === userBranchId)?.name || "Assigned Branch";
    if (filters.branchId === "all") return "All Branches";
    return branches.find((branch) => branch.id === filters.branchId)?.name || filters.branchId;
  }, [branches, filters.branchId, isAdmin, userBranchId]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/reports/shares/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          productId: filters.productId === "all" ? undefined : filters.productId,
          userName: filters.userName || undefined,
          accountNumber: filters.accountNumber || undefined,
          memberSearch: filters.memberSearch || undefined,
          direction: filters.direction,
          minAmount: filters.minAmount || undefined,
          branchId: isAdmin ? (filters.branchId === "all" ? undefined : filters.branchId) : userBranchId,
          format: "JSON",
        }),
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
      const response = await fetch("/api/v1/reports/shares/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          productId: filters.productId === "all" ? undefined : filters.productId,
          userName: filters.userName || undefined,
          accountNumber: filters.accountNumber || undefined,
          memberSearch: filters.memberSearch || undefined,
          direction: filters.direction,
          minAmount: filters.minAmount || undefined,
          branchId: isAdmin ? (filters.branchId === "all" ? undefined : filters.branchId) : userBranchId,
          format: "xlsx",
        }),
      });
      if (!response.ok) throw new Error("Failed to export report");
      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `shares-transactions-${filters.fromDate}_to_${filters.toDate}.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [filters, isAdmin, userBranchId]);

  const sections = useMemo(() => {
    return (report?.products || []).map((product) => {
      const rows = [...product.transactions].sort((left, right) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        if (sortField === "trx_date") {
          return direction * (new Date(left.trx_date).getTime() - new Date(right.trx_date).getTime());
        }
        if (sortField === "user_name") {
          return direction * left.user_name.localeCompare(right.user_name);
        }
        const leftAmount = Math.max(left.debit_amount, left.credit_amount);
        const rightAmount = Math.max(right.debit_amount, right.credit_amount);
        return direction * (leftAmount - rightAmount);
      });
      return { ...product, transactions: rows };
    });
  }, [report?.products, sortDirection, sortField]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  };

  const pageSize = 10;

  return (
    <div className="space-y-4 p-4 md:p-5">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {report?.sacco_name || "BUKONZO UNITED TEACHERS SACCO"}
            </div>
            <h1 className="mt-1 text-xl font-black text-slate-950 md:text-2xl">Shares Transactions Report</h1>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              Transaction movement report grouped by product and teller.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-700 md:text-sm">Branch: {branchLabel}</p>
            <p className="text-xs text-slate-700 md:text-sm">
              Reporting Date From: {dateValue(filters.fromDate)} To: {dateValue(filters.toDate)}
            </p>
          </div>
          <div className="text-xs text-slate-500 md:text-sm">
            {report?.generated_at ? `Generated: ${format(new Date(report.generated_at), "dd/MM/yyyy HH:mm:ss")}` : ""}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-6">
          {isAdmin ? (
            <div className="space-y-2 lg:col-span-1">
              <label className="text-xs font-medium md:text-sm">Branch</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.branchId} onChange={(e) => setFilters((current) => ({ ...current, branchId: e.target.value }))}>
                <option value="all">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2 lg:col-span-1">
              <label className="text-xs font-medium md:text-sm">Branch</label>
              <input className="h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-xs md:text-sm" value={branchLabel} disabled />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">From</label>
            <input type="date" className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.fromDate} onChange={(e) => setFilters((current) => ({ ...current, fromDate: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">To</label>
            <input type="date" className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.toDate} onChange={(e) => setFilters((current) => ({ ...current, toDate: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Product</label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.productId} onChange={(e) => setFilters((current) => ({ ...current, productId: e.target.value }))}>
              <option value="all">All Products</option>
              <option value="300501">300501 - AFFILIATE MEMBERS</option>
              <option value="300502">300502 - ORDINARY MEMBERS</option>
              <option value="300503">300503 - ASSOCIATE MEMBERS</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Direction</label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.direction} onChange={(e) => setFilters((current) => ({ ...current, direction: e.target.value }))}>
              <option value="all">All</option>
              <option value="credit">Credits Only</option>
              <option value="debit">Debits Only</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Min Amount</label>
            <input type="number" min="0" className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.minAmount} onChange={(e) => setFilters((current) => ({ ...current, minAmount: e.target.value }))} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-medium md:text-sm">User / Teller</label>
            <input className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.userName} onChange={(e) => setFilters((current) => ({ ...current, userName: e.target.value }))} placeholder="Filter by user or teller name" />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-medium md:text-sm">Member Search</label>
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground md:h-4 md:w-4" />
              <input className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.memberSearch} onChange={(e) => setFilters((current) => ({ ...current, memberSearch: e.target.value }))} placeholder="Search by account, member, BVN/TIN, or note" />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-xs font-semibold md:text-sm" onClick={() => void loadReport()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Generate
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground md:text-sm" onClick={() => void exportExcel()} disabled={exporting || !report}>
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

      {report ? (
        <div className="space-y-3">
          {sections.map((product) => {
            const currentPage = pageByProduct[product.product_code] || 1;
            const totalPages = Math.max(1, Math.ceil(product.transactions.length / pageSize));
            const start = (currentPage - 1) * pageSize;
            const visible = product.transactions.slice(start, start + pageSize);
            return (
              <div key={product.product_code} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2.5">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Product</div>
                    <div className="text-sm font-bold text-slate-950 md:text-base">{product.product_code} - {product.product_name}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs md:text-sm">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">Records {product.subtotal.count.toLocaleString()}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">Debit UGX {money(product.subtotal.total_debit)}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">Credit UGX {money(product.subtotal.total_credit)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-[11px] md:text-xs">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        {[
                          "A/C No.",
                          "Name",
                          "Bank Verification No./TIN",
                          "Ref. No.",
                          "Trx No.",
                          "Session Date",
                          "Trx Date",
                          "Debit",
                          "Credit",
                          "User Name",
                        ].map((header) => (
                          <th key={header} className="px-2 py-2 text-left font-semibold uppercase tracking-[0.12em] leading-tight">
                            <button type="button" className="inline-flex items-center gap-1" onClick={() => {
                              if (header === "Trx Date") toggleSort("trx_date");
                              if (header === "User Name") toggleSort("user_name");
                              if (header === "Debit" || header === "Credit") toggleSort("amount");
                            }}>
                              {header}
                              {["Trx Date", "User Name", "Debit", "Credit"].includes(header) ? <ArrowUpDown className="h-3 w-3" /> : null}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((tx) => (
                        <tr key={tx.trx_number} className={`border-b last:border-0 ${tx.direction === "credit" ? "border-l-4 border-l-emerald-400" : "border-l-4 border-l-rose-400"}`}>
                          <td className="px-2 py-2 font-medium break-words">{tx.account_number}</td>
                          <td className="px-2 py-2 break-words" title={tx.member_name}>{tx.member_name}</td>
                          <td className="px-2 py-2 break-words" title={tx.bvn_tin_note}>{tx.bvn_tin_note}</td>
                          <td className="px-2 py-2 tabular-nums">{tx.ref_no == null ? "" : tx.ref_no}</td>
                          <td className="px-2 py-2 font-mono text-[11px] break-all">{tx.trx_number}</td>
                          <td className="whitespace-nowrap px-2 py-2">{dateValue(tx.session_date)}</td>
                          <td className="whitespace-nowrap px-2 py-2">{dateValue(tx.trx_date)}</td>
                          <td className={`px-2 py-2 tabular-nums ${tx.debit_amount === 0 ? "text-muted-foreground" : ""}`}>{money(tx.debit_amount)}</td>
                          <td className={`px-2 py-2 tabular-nums ${tx.credit_amount === 0 ? "text-muted-foreground" : ""}`}>{money(tx.credit_amount)}</td>
                          <td className="px-2 py-2 break-words">{tx.user_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50 px-3 py-2 text-sm font-semibold">
                  <div>Total: {product.subtotal.count.toLocaleString()}   Debit: {money(product.subtotal.total_debit)}   Credit: {money(product.subtotal.total_credit)}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-2.5 py-1 text-xs"
                      disabled={currentPage <= 1}
                      onClick={() => setPageByProduct((current) => ({ ...current, [product.product_code]: Math.max(1, currentPage - 1) }))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-slate-600">Page {currentPage} / {totalPages}</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-2.5 py-1 text-xs"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPageByProduct((current) => ({ ...current, [product.product_code]: Math.min(totalPages, currentPage + 1) }))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!sections.length ? <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">Generate the report to view transactions.</div> : null}

          {report ? (
            <div className="rounded-2xl border bg-white p-4 text-sm font-semibold shadow-sm">
              Grand Total: {report.grand_total.count.toLocaleString()}   Debit: {money(report.grand_total.total_debit)}   Credit: {money(report.grand_total.total_credit)}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">Generate the report to view transactions.</div>
      )}
    </div>
  );
}
