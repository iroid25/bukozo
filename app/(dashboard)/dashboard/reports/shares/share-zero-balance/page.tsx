"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Download, Loader2, RefreshCw, Search, AlertTriangle, Printer } from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { printReport } from "@/lib/reports/print-report";

type BranchOption = { id: string; name: string };

type ZeroBalanceAccount = {
  account_number: string;
  member_name: string;
  gender: string;
  bvn_tin: string;
  ref_no: number | null;
  phone: string;
  id_card_raw: string;
  id_card_normalised: string;
  area_code: string;
  flags: {
    ref_is_phone: boolean;
    phone_non_standard: boolean;
    id_card_unknown: boolean;
  };
};

type ProductSection = {
  product_code: string;
  product_name: string;
  accounts: ZeroBalanceAccount[];
  subtotal: { count: number };
};

type ZeroBalanceReport = {
  sacco_name: string;
  branch: string;
  branch_location?: string;
  report_date: string;
  generated_at: string;
  products: ProductSection[];
  grand_total: { count: number };
  summary: {
    total_zero_balance_accounts: number;
    missing_phone_count: number;
    unknown_id_count: number;
    gender_breakdown: { male: number; female: number };
    area_code_breakdown: Array<{ area_code: string; count: number }>;
  };
};

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

export default function ShareZeroBalancePage() {
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
  const [report, setReport] = useState<ZeroBalanceReport | null>(null);
  const [filters, setFilters] = useState({
    branchId: "all",
    reportDate: format(new Date(), "yyyy-MM-dd"),
    productId: "all",
    gender: "all",
    areaCode: "",
    idCardType: "",
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
        // ignore branch errors
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
      const response = await fetch("/api/v1/reports/shares/zero-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          reportDate: filters.reportDate,
          productId: filters.productId === "all" ? undefined : filters.productId,
          gender: filters.gender,
          areaCode: filters.areaCode || undefined,
          idCardType: filters.idCardType || undefined,
          memberSearch: filters.memberSearch || undefined,
          branchId: isAdmin ? (filters.branchId === "all" ? undefined : filters.branchId) : userBranchId,
          format: "JSON",
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) throw new Error(json?.error || "Failed to load report");
      setReport(json.data);
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
      const response = await fetch("/api/v1/reports/shares/zero-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          reportDate: filters.reportDate,
          productId: filters.productId === "all" ? undefined : filters.productId,
          gender: filters.gender,
          areaCode: filters.areaCode || undefined,
          idCardType: filters.idCardType || undefined,
          memberSearch: filters.memberSearch || undefined,
          branchId: isAdmin ? (filters.branchId === "all" ? undefined : filters.branchId) : userBranchId,
          format: "xlsx",
        }),
      });
      if (!response.ok) throw new Error("Failed to export report");
      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `shares-zero-balance-${filters.reportDate}.xlsx`);
    } catch (error) {
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

    const groupBy = report.products.map((product, index) => ({
      key: index,
      label: `${product.product_code} - ${product.product_name}`,
      subHeaders: ["A/C No.", "Name", "Gender", "BVN/TIN", "Ref. No.", "Phone", "ID Card", "Area Code"],
      subRows: product.accounts.map((account) => [
        account.account_number,
        account.member_name,
        account.gender,
        account.bvn_tin,
        account.ref_no == null ? "" : account.ref_no,
        account.phone,
        account.id_card_normalised,
        account.area_code,
      ]),
      subTotals: ["Subtotal", String(product.subtotal.count)],
    }));

    printReport({
      title: "Share Zero Balance Accounts",
      subtitle: `${branchLabel} | ${dateValue(filters.reportDate)}`,
      headers: [],
      rows: [],
      groupBy,
      totals: ["Grand Total", String(report.grand_total.count)],
    });
  }, [report, branchLabel, filters.reportDate]);

  const products = report?.products || [];

  return (
    <div className="space-y-4 p-4 md:p-5">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{report?.sacco_name || "BUKONZO UNITED TEACHERS SACCO"}</div>
            <h1 className="mt-1 text-xl font-black text-slate-950 md:text-2xl">Shares Zero Balance Report</h1>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">Zero-balance accounts with data quality flags and outreach markers.</p>
            <p className="mt-2 text-xs font-medium text-slate-700 md:text-sm">Branch: {branchLabel}</p>
            <p className="text-xs text-slate-700 md:text-sm">Reporting Date: {dateValue(filters.reportDate)}</p>
          </div>
          <div className="text-xs text-slate-500 md:text-sm">{report?.generated_at ? `Generated: ${format(new Date(report.generated_at), "dd/MM/yyyy HH:mm:ss")}` : ""}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Zero-Balance</div>
          <div className="mt-1 text-2xl font-bold">{report?.summary.total_zero_balance_accounts || 0}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Male / Female</div>
          <div className="mt-1 text-2xl font-bold">{report?.summary.gender_breakdown.male || 0} / {report?.summary.gender_breakdown.female || 0}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Missing Phone</div>
          <div className="mt-1 text-2xl font-bold">{report?.summary.missing_phone_count || 0}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Unknown / Missing ID</div>
          <div className="mt-1 text-2xl font-bold">{report?.summary.unknown_id_count || 0}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-6">
          {isAdmin ? (
            <div className="space-y-2 lg:col-span-1">
              <label className="text-xs font-medium md:text-sm">Branch</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.branchId} onChange={(e) => setFilters((current) => ({ ...current, branchId: e.target.value }))}>
                <option value="all">All Branches</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
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
            <input type="date" className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.reportDate} onChange={(e) => setFilters((current) => ({ ...current, reportDate: e.target.value }))} />
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
            <label className="text-xs font-medium md:text-sm">Gender</label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.gender} onChange={(e) => setFilters((current) => ({ ...current, gender: e.target.value }))}>
              <option value="all">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Area Code</label>
            <input className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.areaCode} onChange={(e) => setFilters((current) => ({ ...current, areaCode: e.target.value }))} placeholder="Kisinga" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">ID Card Type</label>
            <input className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.idCardType} onChange={(e) => setFilters((current) => ({ ...current, idCardType: e.target.value }))} placeholder="National ID" />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-medium md:text-sm">Member Search</label>
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground md:h-4 md:w-4" />
              <input className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm" value={filters.memberSearch} onChange={(e) => setFilters((current) => ({ ...current, memberSearch: e.target.value }))} placeholder="Search by account, name, phone, ID, or area code" />
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
          <button type="button" className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-xs font-semibold md:text-sm" onClick={handlePrint} disabled={!report}>
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
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-wrap gap-2 border-b bg-slate-50 px-3 py-2.5 text-xs md:text-sm">
              {report.summary.area_code_breakdown.map((item) => (
                <span key={item.area_code} className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                  {item.area_code}: {item.count.toLocaleString()}
                </span>
              ))}
            </div>
          </div>

          {products.map((product) => (
            <div key={product.product_code} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2.5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Product</div>
                  <div className="text-sm font-bold text-slate-950 md:text-base">{product.product_code} - {product.product_name}</div>
                </div>
                <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Total: {product.subtotal.count.toLocaleString()}</div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-[11px] md:text-xs">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      {["A/C No.", "Name", "Gender", "Bank Verification No./TIN", "Ref. No.", "Phone", "ID Card", "Area Code"].map((header) => (
                        <th key={header} className="px-2 py-2 text-left font-semibold uppercase tracking-[0.12em] leading-tight">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {product.accounts.map((account) => (
                      <tr key={account.account_number} className="border-b last:border-0">
                        <td className="px-2 py-2 font-medium break-words">{account.account_number}</td>
                        <td className="px-2 py-2 break-words" title={account.member_name}>{account.member_name}</td>
                        <td className="px-2 py-2">{account.gender}</td>
                        <td className="px-2 py-2 break-words">{account.bvn_tin}</td>
                        <td className={`px-2 py-2 tabular-nums ${account.flags.ref_is_phone ? "bg-amber-50" : ""}`}>{account.ref_no == null ? "" : account.ref_no}</td>
                        <td className={`px-2 py-2 break-words ${account.flags.phone_non_standard ? "text-amber-700 italic" : ""}`}>{account.phone}</td>
                        <td className={`px-2 py-2 break-words ${account.flags.id_card_unknown ? "text-rose-700 italic" : ""}`} title={account.id_card_normalised}>{account.id_card_raw}</td>
                        <td className="px-2 py-2 break-words">{account.area_code}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-slate-100 font-bold">
                      <td className="px-2 py-2" colSpan={8}>Total: {product.subtotal.count.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          {report && !products.length ? (
            <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">Generate the report to view zero-balance accounts.</div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
          Generate the report to view zero-balance accounts.
        </div>
      )}
    </div>
  );
}
