"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { format, parseISO } from "date-fns";
import { Download, Loader2, RefreshCw, Search, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

type BranchOption = { id: string; name: string };
type ShareProductOption = { id: string; name: string; code: string };

type ShareAccount = {
  account_number: string;
  member_name: string;
  bvn_tin: string | null;
  ref_no: number | null;
  last_trx_date: string;
  days_without_activity: number;
  date_opened: string;
  current_balance: number;
  status: string;
  tone?: string;
};

type ProductSection = {
  product_code: string;
  product_name: string;
  accounts: ShareAccount[];
  subtotal: {
    count: number;
    total_balance: number;
  };
};

type ListingReport = {
  sacco_name: string;
  branch: string;
  branch_location?: string;
  report_date: string;
  generated_at: string;
  thresholds?: {
    recentlyActiveDays: number;
    moderatelyIdleDays: number;
    inactiveDays: number;
    dormantDays: number;
  };
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

function rowTone(days: number, thresholds?: ListingReport["thresholds"]) {
  if (!thresholds) return "";
  if (days >= thresholds.dormantDays) return "bg-red-50 text-red-700";
  if (days >= thresholds.inactiveDays) return "bg-amber-50 text-amber-700";
  if (days > thresholds.recentlyActiveDays) return "bg-yellow-50 text-yellow-800";
  return "";
}

export default function ShareAccountsListingPage() {
  const { data: session } = useSession();
  const isAdmin = String((session?.user as any)?.role || "").toUpperCase() === "ADMIN";
  const userBranchId = (session?.user as any)?.branchId as string | undefined;

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [shareProducts, setShareProducts] = useState<ShareProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<ListingReport | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [sortField, setSortField] = useState<"last_trx_date" | "date_opened" | "days_without_activity">("days_without_activity");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState({
    branchId: "all",
    reportDate: todayIso(),
    status: "All",
    productId: "all",
    minDaysInactive: "",
    search: "",
  });
  const filtersRef = useRef(filters);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 20000,
  });

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  useEffect(() => {
    if (!isAdmin && userBranchId) {
      setFilters((current) => ({ ...current, branchId: userBranchId }));
    }
  }, [isAdmin, userBranchId]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [branchRes, atRes] = await Promise.all([
          fetch("/api/v1/branches", { cache: "no-store" }),
          fetch("/api/v1/account-types?linkedOnly=true", { cache: "no-store" }),
        ]);
        if (branchRes.ok) {
          const json = await branchRes.json();
          const items = Array.isArray(json?.data) ? json.data : [];
          setBranches(items.map((b: any) => ({ id: b.id, name: b.name })));
        }
        if (atRes.ok) {
          const json = await atRes.json();
          const products: ShareProductOption[] = (json.data || [])
            .filter((t: any) => t.isShareAccount && t.ledgerAccount?.accountCode)
            .map((t: any) => ({ id: t.id, name: t.name, code: t.ledgerAccount.accountCode }));
          setShareProducts(products);
        }
      } catch (error) {
        console.error(error);
      }
    }

    void loadInitialData();
  }, []);

  const branchLabel = useMemo(() => {
    if (!isAdmin) return branches.find((branch) => branch.id === userBranchId)?.name || "Assigned Branch";
    if (filters.branchId === "all") return "All Branches";
    return branches.find((branch) => branch.id === filters.branchId)?.name || filters.branchId;
  }, [branches, filters.branchId, isAdmin, userBranchId]);

  const loadReport = useCallback(async () => {
    const currentFilters = filtersRef.current;
    setLoading(true);
    try {
      const response = await fetch("/api/v1/reports/shares/account-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          reportDate: currentFilters.reportDate,
          productId: currentFilters.productId === "all" ? undefined : currentFilters.productId,
          status: currentFilters.status,
          minDaysInactive: currentFilters.minDaysInactive || undefined,
          search: currentFilters.search || undefined,
          branchId: isAdmin ? (currentFilters.branchId === "all" ? undefined : currentFilters.branchId) : userBranchId,
          format: "JSON",
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) throw new Error(json?.error || "Failed to load report");
      setReport(json.data);
      setHasLoadedOnce(true);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, userBranchId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!hasLoadedOnce) return;
    void loadReport();
  }, [hasLoadedOnce, liveRefreshVersion, loadReport]);

  const exportExcel = useCallback(async () => {
    try {
      setExporting(true);
      const response = await fetch("/api/v1/reports/shares/account-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          reportDate: filtersRef.current.reportDate,
          productId: filtersRef.current.productId === "all" ? undefined : filtersRef.current.productId,
          status: filtersRef.current.status,
          minDaysInactive: filtersRef.current.minDaysInactive || undefined,
          search: filtersRef.current.search || undefined,
          branchId: isAdmin ? (filtersRef.current.branchId === "all" ? undefined : filtersRef.current.branchId) : userBranchId,
          format: "xlsx",
        }),
      });
      if (!response.ok) throw new Error("Failed to export report");
      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `shares-accounts-listing-${filters.reportDate}.xlsx`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [isAdmin, userBranchId]);

  const sections = useMemo(() => {
    const compareDates = (a: string, b: string) => {
      const left = parseISO(a).getTime();
      const right = parseISO(b).getTime();
      return left - right;
    };

    return (report?.products || []).map((product) => {
      const accounts = [...product.accounts].sort((left, right) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        switch (sortField) {
          case "date_opened":
            return direction * compareDates(left.date_opened, right.date_opened);
          case "last_trx_date":
            return direction * compareDates(left.last_trx_date, right.last_trx_date);
          default:
            return direction * (left.days_without_activity - right.days_without_activity);
        }
      });

      return {
        ...product,
        accounts,
      };
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

  return (
    <div className="space-y-4 p-4 md:p-5">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {report?.sacco_name || "BUKONZO UNITED TEACHERS SACCO"}
            </div>
            <h1 className="mt-1 text-xl font-black text-slate-950 md:text-2xl">Shares Accounts Listing Report</h1>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              Snapshot of all share accounts with activity metrics and account status.
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
        <div className="grid gap-3 lg:grid-cols-5">
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
            <label className="text-xs font-medium md:text-sm">Status</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.status}
              onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}
            >
              <option value="All">All</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Product</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.productId}
              onChange={(e) => setFilters((current) => ({ ...current, productId: e.target.value }))}
            >
              <option value="all">All Products</option>
              {shareProducts.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Min Days Inactive</label>
            <input
              type="number"
              min="0"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.minDaysInactive}
              onChange={(e) => setFilters((current) => ({ ...current, minDaysInactive: e.target.value }))}
              placeholder="365"
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-medium md:text-sm">Member Search</label>
            <div className="flex items-center gap-2">
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
                value={filters.search}
                onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") void loadReport(); }}
                placeholder="Search by member name, BVN/TIN, or account"
              />
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold md:text-sm"
                onClick={() => void loadReport()}
                disabled={loading}
              >
                <Search className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Search
              </button>
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

      {report ? (
        <div className="space-y-3">
          {sections.map((product) => (
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
                    Records {Number(product.subtotal.count).toLocaleString()}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Balance UGX {currency(product.subtotal.total_balance)}
                  </span>
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
                        "Last Trx Date",
                        "Days Without Activity",
                        "Date Opened",
                        "Status",
                        "Current Balance",
                      ].map((header) => (
                        <th
                          key={header}
                          className="px-2 py-2 text-left font-semibold uppercase tracking-[0.12em] leading-tight"
                        >
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => {
                              if (header === "Days Without Activity") toggleSort("days_without_activity");
                              if (header === "Date Opened") toggleSort("date_opened");
                              if (header === "Last Trx Date") toggleSort("last_trx_date");
                            }}
                          >
                            {header}
                            {["Days Without Activity", "Date Opened", "Last Trx Date"].includes(header) ? (
                              <ArrowUpDown className="h-3 w-3" />
                            ) : null}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {product.accounts.map((account) => (
                      <tr key={account.account_number} className={`border-b last:border-0 ${rowTone(account.days_without_activity, report.thresholds)}`}>
                        <td className="px-2 py-2 font-medium break-words">{account.account_number}</td>
                        <td className="px-2 py-2 break-words" title={account.member_name}>
                          {account.member_name}
                        </td>
                        <td className="px-2 py-2 break-words">{account.bvn_tin || ""}</td>
                        <td className="px-2 py-2 tabular-nums">{account.ref_no == null ? "" : account.ref_no}</td>
                        <td className="whitespace-nowrap px-2 py-2">{formatDate(account.last_trx_date)}</td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">{currency(account.days_without_activity)}</td>
                        <td className="whitespace-nowrap px-2 py-2">{formatDate(account.date_opened)}</td>
                        <td className="px-2 py-2">{account.status}</td>
                        <td className="px-2 py-2 tabular-nums">UGX {currency(account.current_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-slate-100 font-bold">
                      <td className="px-2 py-2" colSpan={8}>
                        Total: {Number(product.subtotal.count).toLocaleString()}
                      </td>
                      <td className="px-2 py-2 tabular-nums">UGX {currency(product.subtotal.total_balance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          {!sections.length ? (
            <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
              Generate the report to view share account rows.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
          Generate the report to view account listings.
        </div>
      )}
    </div>
  );
}
