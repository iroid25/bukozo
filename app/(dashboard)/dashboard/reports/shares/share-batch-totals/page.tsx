"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Download, Loader2, Printer, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { printReport } from "@/lib/reports/print-report";

type BranchOption = { id: string; name: string };

type BatchAccount = {
  account_number: string;
  member_name: string;
  bvn_tin: string | null;
  phone: string;
  ref_no: number | null;
  current_balance: number;
};

type BatchSection = {
  batch_number: number | null;
  batch_label: string;
  accounts: BatchAccount[];
  subtotal: {
    count: number;
    total_balance: number;
  };
};

type ProductSection = {
  product_code: string;
  product_name: string;
  batches: BatchSection[];
  grand_total: {
    count: number;
    total_balance: number;
  };
};

type BatchTotalsReport = {
  sacco_name: string;
  branch: string;
  branch_location?: string;
  report_date: string;
  generated_at: string;
  products: ProductSection[];
};

const todayIso = () => format(new Date(), "yyyy-MM-dd");

const currency = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd/MM/yyyy");
};

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ShareBatchTotalsPage() {
  const { data: session } = useSession();
  const isAdmin = String((session?.user as any)?.role || "").toUpperCase() === "ADMIN";
  const userBranchId = (session?.user as any)?.branchId as string | undefined;

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<BatchTotalsReport | null>(null);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 15000,
  });
  const [filters, setFilters] = useState({
    branchId: "all",
    reportDate: todayIso(),
    productId: "all",
    batchNumber: "",
    memberSearch: "",
    minBalance: "",
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
      } catch (error) {
        console.error(error);
      }
    }

    void loadBranches();
  }, []);

  const branchLabel = useMemo(() => {
    if (!isAdmin) {
      return branches.find((branch) => branch.id === userBranchId)?.name || "Assigned Branch";
    }
    if (filters.branchId === "all") return "All Branches";
    return branches.find((branch) => branch.id === filters.branchId)?.name || filters.branchId;
  }, [branches, filters.branchId, isAdmin, userBranchId]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/reports/shares/batch-totals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          reportDate: filters.reportDate,
          productId: filters.productId === "all" ? undefined : filters.productId,
          batchNumber: filters.batchNumber || undefined,
          memberSearch: filters.memberSearch || undefined,
          minBalance: filters.minBalance || undefined,
          branchId: isAdmin ? (filters.branchId === "all" ? undefined : filters.branchId) : userBranchId,
          format: "JSON",
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load share batch totals");
      }
      setReport(json.data);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load share batch totals");
    } finally {
      setLoading(false);
    }
  }, [filters, isAdmin, userBranchId]);

  const loadReportRef = useRef(loadReport);

  useEffect(() => {
    loadReportRef.current = loadReport;
  }, [loadReport]);

  useEffect(() => {
    void loadReportRef.current();
  }, [liveRefreshVersion]);

  const exportExcel = useCallback(async () => {
    try {
      setExporting(true);
      const response = await fetch("/api/v1/reports/shares/batch-totals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          reportDate: filters.reportDate,
          productId: filters.productId === "all" ? undefined : filters.productId,
          batchNumber: filters.batchNumber || undefined,
          memberSearch: filters.memberSearch || undefined,
          minBalance: filters.minBalance || undefined,
          branchId: isAdmin ? (filters.branchId === "all" ? undefined : filters.branchId) : userBranchId,
          format: "xlsx",
        }),
      });
      if (!response.ok) throw new Error("Failed to export report");
      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `shares-batch-totals-${filters.reportDate}.xlsx`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [filters, isAdmin, userBranchId]);

  const handlePrint = useCallback(() => {
    if (!report) {
      toast.error("No report data to print");
      return;
    }

    const groupBy = report.products.map((product) => {
      const subHeaders = ["A/C No.", "Name", "BVN/TIN", "Phone", "Ref. No.", "Balance"];
      const subRows: (string | number)[][] = [];
      for (const batch of product.batches) {
        for (const account of batch.accounts) {
          subRows.push([
            account.account_number,
            account.member_name,
            account.bvn_tin || "",
            account.phone || "",
            account.ref_no == null ? "" : account.ref_no,
            account.current_balance,
          ]);
        }
      }
      const subTotals = [
        "Subtotal",
        String(product.grand_total.count),
        "",
        "",
        "",
        product.grand_total.total_balance,
      ];
      return {
        key: 0,
        label: `${product.product_code} - ${product.product_name}`,
        subHeaders,
        subRows,
        subTotals,
      };
    });

    printReport({
      title: "Share Batch Totals",
      subtitle: `${branchLabel} — ${formatDate(filters.reportDate)}`,
      headers: [],
      rows: [],
      groupBy,
    });
  }, [report, branchLabel, filters.reportDate]);

  const products = report?.products || [];

  return (
    <div className="space-y-4 p-4 md:p-5">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {report?.sacco_name || "BUKONZO UNITED TEACHERS SACCO"}
            </div>
            <h1 className="mt-1 text-xl font-black text-slate-950 md:text-2xl">Shares Batch Totals Report</h1>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              Batch-based share totals grouped by product and batch number.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-700 md:text-sm">Branch: {branchLabel}</p>
            <p className="text-xs text-slate-700 md:text-sm">Reporting Date: {formatDate(filters.reportDate)}</p>
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
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
                value={filters.branchId}
                onChange={(e) => setFilters((current) => ({ ...current, branchId: e.target.value }))}
              >
                <option value="all">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
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
            <label className="text-xs font-medium md:text-sm">Report Date</label>
            <input
              type="date"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.reportDate}
              onChange={(e) => setFilters((current) => ({ ...current, reportDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Product</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.productId}
              onChange={(e) => setFilters((current) => ({ ...current, productId: e.target.value }))}
            >
              <option value="all">All Products</option>
              <option value="300501">300501 - AFFILIATE MEMBERS</option>
              <option value="300502">300502 - ORDINARY MEMBERS</option>
              <option value="300503">300503 - ASSOCIATE MEMBERS</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Batch Number</label>
            <input
              type="number"
              min="0"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.batchNumber}
              onChange={(e) => setFilters((current) => ({ ...current, batchNumber: e.target.value }))}
              placeholder="1"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Min Balance</label>
            <input
              type="number"
              min="0"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.minBalance}
              onChange={(e) => setFilters((current) => ({ ...current, minBalance: e.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-medium md:text-sm">Member Search</label>
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground md:h-4 md:w-4" />
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
                value={filters.memberSearch}
                onChange={(e) => setFilters((current) => ({ ...current, memberSearch: e.target.value }))}
                placeholder="Search by member name, account, phone, or BVN/TIN"
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
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-xs font-semibold md:text-sm"
            onClick={() => void handlePrint()}
            disabled={!report}
          >
            <Printer className="h-4 w-4" />
            Print
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
          {products.map((product) => (
            <div key={product.product_code} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2.5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Product</div>
                  <div className="text-sm font-bold text-slate-950 md:text-base">
                    {product.product_code} - {product.product_name}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs md:text-sm">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Batches {Number(product.batches.length).toLocaleString()}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Accounts {Number(product.grand_total.count).toLocaleString()}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Balance UGX {currency(product.grand_total.total_balance)}
                  </span>
                </div>
              </div>

              <div className="space-y-4 p-3">
                {product.batches.map((batch) => (
                  <div key={`${product.product_code}-${batch.batch_label}`} className="overflow-hidden rounded-xl border">
                    <div className={`flex items-center justify-between px-3 py-2 text-sm font-bold ${batch.batch_number == null ? "bg-slate-100" : "bg-emerald-50"}`}>
                      <div>{batch.batch_label}</div>
                      <div className="text-xs font-semibold text-slate-700">
                        {batch.subtotal.count} accounts | UGX {currency(batch.subtotal.total_balance)}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed border-collapse text-[11px] md:text-xs">
                        <thead className="bg-slate-950 text-white">
                          <tr>
                            {["A/C No.", "Name", "Bank Verification No./TIN", "Phone", "Ref. No.", "Balance"].map((header) => (
                              <th key={header} className="px-2 py-2 text-left font-semibold uppercase tracking-[0.12em] leading-tight">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {batch.accounts.map((account) => (
                            <tr
                              key={account.account_number}
                              className={`border-b last:border-0 ${batch.batch_number == null ? "bg-slate-50" : ""}`}
                            >
                              <td className="px-2 py-2 font-medium break-words">{account.account_number}</td>
                              <td className="px-2 py-2 break-words" title={account.member_name}>
                                {account.member_name}
                              </td>
                              <td className="px-2 py-2 break-words">{account.bvn_tin || ""}</td>
                              <td className={`px-2 py-2 break-words ${account.phone === "Unknown" ? "italic text-muted-foreground" : ""}`}>
                                {account.phone || "Unknown"}
                              </td>
                              <td className="px-2 py-2 tabular-nums">{account.ref_no == null ? "" : account.ref_no}</td>
                              <td className="px-2 py-2 tabular-nums">UGX {currency(account.current_balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 bg-slate-100 font-bold">
                            <td className="px-2 py-2" colSpan={5}>
                              Total: {Number(batch.subtotal.count).toLocaleString()}   {currency(batch.subtotal.total_balance)}
                            </td>
                            <td className="px-2 py-2 tabular-nums">UGX {currency(batch.subtotal.total_balance)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white">
                  <div>Total: {Number(product.grand_total.count).toLocaleString()}</div>
                  <div>UGX {currency(product.grand_total.total_balance)}</div>
                </div>
              </div>
            </div>
          ))}

          {!products.length ? (
            <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
              Generate the report to view batch totals.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
          Generate the report to view batch totals.
        </div>
      )}
    </div>
  );
}
