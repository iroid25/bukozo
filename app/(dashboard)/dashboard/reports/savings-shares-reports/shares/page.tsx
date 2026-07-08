"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { SaccoReportHeader } from "@/components/reports/SaccoReportHeader";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

type BranchOption = { id: string; name: string };

type BandRow = {
  band_label: string;
  account_count: number;
  account_pct: number;
  total_balance: number;
  balance_pct: number;
  avg_balance: number;
};

type ProductSection = {
  product_code: string;
  product_name: string;
  bands: BandRow[];
  total: {
    account_count: number;
    total_balance: number;
    avg_balance: number;
  };
};

type ShareConcentrationReport = {
  saccoName: string;
  branch: string;
  branchLocation?: string;
  reportTitle: string;
  reportDate: string;
  generatedAt: string;
  exclude_non_financial: boolean;
  products: ProductSection[];
  aggregate: {
    bands: BandRow[];
    total: {
      account_count: number;
      total_balance: number;
      avg_balance: number;
    };
  };
  loan_deduction_summary?: {
    total_count: number;
    total_amount: number;
    by_product: Array<{
      product_code: string;
      product_name: string;
      count: number;
      total_amount: number;
    }>;
  };
};

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const displayDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd/MM/yyyy");
};
const currency = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

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

export default function SharesConcentrationPage() {
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
  const [report, setReport] = useState<ShareConcentrationReport | null>(null);
  const [filters, setFilters] = useState({
    branchId: "all",
    reportDate: todayIso(),
    excludeNonFinancial: true,
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

  const reportMeta = useMemo(
    () => `Reporting Date: ${displayDate(filters.reportDate)}`,
    [filters.reportDate],
  );

  const loadReport = useCallback(
    async (override?: Partial<typeof filters>) => {
      setLoading(true);
      try {
        const current = { ...filters, ...(override || {}) };
        const response = await fetch("/api/v1/reports/shares/concentration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportDate: current.reportDate,
            branchId: isAdmin ? (current.branchId === "all" ? undefined : current.branchId) : userBranchId,
            excludeNonFinancial: current.excludeNonFinancial,
            format: "JSON",
          }),
        });

        const json = await response.json();
        if (!response.ok || !json?.success) {
          throw new Error(json?.error || "Failed to load share concentration report");
        }

        setReport(json.data);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Failed to load share concentration report");
      } finally {
        setLoading(false);
      }
    },
    [filters, isAdmin, userBranchId],
  );

  const loadReportRef = useRef(loadReport);

  useEffect(() => {
    loadReportRef.current = loadReport;
  }, [loadReport]);

  useEffect(() => {
    void loadReportRef.current?.();
  }, [liveRefreshVersion]);

  const exportExcel = useCallback(async () => {
    try {
      setExporting(true);
      const response = await fetch("/api/v1/reports/shares/concentration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportDate: filters.reportDate,
          branchId: isAdmin ? (filters.branchId === "all" ? undefined : filters.branchId) : userBranchId,
          excludeNonFinancial: filters.excludeNonFinancial,
          format: "EXCEL",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export shares concentration report");
      }

      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `shares-concentration-${filters.reportDate}.xlsx`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [filters, isAdmin, userBranchId]);

  const sections = report?.products || [];
  const aggregate = report?.aggregate;
  const loanDeductionSummary = report?.loan_deduction_summary;

  return (
    <div className="space-y-4 p-4 md:p-5">
      <SaccoReportHeader
        title="Shares Concentration Report"
        subtitle="Concentration analysis of share balances across affiliate, ordinary, and associate member products."
        branchLabel={branchLabel}
        periodLabel={reportMeta}
        generatedAt={report?.generatedAt ? format(new Date(report.generatedAt), "dd/MM/yyyy HH:mm:ss") : undefined}
      />

      {loanDeductionSummary ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Loan deduction summary
              </div>
              <div className="text-xs text-emerald-600">
                Exclude Non-Financial Accounts: {filters.excludeNonFinancial ? "Yes" : "No"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs md:text-sm">
              <span className="rounded-full bg-white/80 px-2.5 py-1 font-semibold text-emerald-800">
                Loan deductions {Number(loanDeductionSummary.total_count || 0).toLocaleString()}
              </span>
              <span className="rounded-full bg-white/80 px-2.5 py-1 font-semibold text-emerald-800">
                Amount UGX {currency(loanDeductionSummary.total_amount || 0)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-600">
            Exclude Non-Financial Accounts: {filters.excludeNonFinancial ? "Yes" : "No"}
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-4">
          {isAdmin ? (
            <div className="space-y-2 lg:col-span-2">
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
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-medium md:text-sm">Branch</label>
              <input className="h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-xs md:text-sm" value={branchLabel} disabled />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Reporting Date</label>
            <input
              type="date"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.reportDate}
              onChange={(e) => setFilters((current) => ({ ...current, reportDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Non-Financial</label>
            <button
              type="button"
              className={`h-9 w-full rounded-md border px-3 py-2 text-xs font-semibold md:text-sm ${
                filters.excludeNonFinancial ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-input bg-background text-slate-700"
              }`}
              onClick={() => setFilters((current) => ({ ...current, excludeNonFinancial: !current.excludeNonFinancial }))}
            >
              {filters.excludeNonFinancial ? "Yes" : "No"}
            </button>
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
          {sections.map((section) => (
            <div key={section.product_code} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2.5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Product</div>
                  <div className="text-sm font-bold text-slate-950 md:text-base">
                    {section.product_code} - {section.product_name}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs md:text-sm">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Records {Number(section.total.account_count).toLocaleString()}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Balance UGX {currency(section.total.total_balance)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Avg UGX {currency(section.total.avg_balance)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-[11px] md:text-xs">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      {[
                        "Size of Account",
                        "Account (count)",
                        "Account %",
                        "Balance Amount",
                        "Balance %",
                        "Average Balance",
                      ].map((header) => (
                        <th key={header} className="px-2 py-2 text-left font-semibold uppercase tracking-[0.12em] leading-tight">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.bands.map((band) => (
                      <tr key={`${section.product_code}-${band.band_label}`} className="border-b last:border-0">
                        <td className="px-2 py-2 font-medium break-words">{band.band_label}</td>
                        <td className="px-2 py-2 tabular-nums">{Number(band.account_count).toLocaleString()}</td>
                        <td className="px-2 py-2 tabular-nums">{band.account_pct.toFixed(2)}%</td>
                        <td className="px-2 py-2 tabular-nums">UGX {currency(band.total_balance)}</td>
                        <td className="px-2 py-2 tabular-nums">{band.balance_pct.toFixed(2)}%</td>
                        <td className="px-2 py-2 tabular-nums">UGX {currency(band.avg_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-slate-100 font-bold">
                      <td className="px-2 py-2">TOTAL</td>
                      <td className="px-2 py-2 tabular-nums">{Number(section.total.account_count).toLocaleString()}</td>
                      <td className="px-2 py-2 tabular-nums">100.00%</td>
                      <td className="px-2 py-2 tabular-nums">UGX {currency(section.total.total_balance)}</td>
                      <td className="px-2 py-2 tabular-nums">100.00%</td>
                      <td className="px-2 py-2 tabular-nums">UGX {currency(section.total.avg_balance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2.5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Aggregate</div>
                <div className="text-sm font-bold text-slate-950 md:text-base">AGGREGATE</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs md:text-sm">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                  Records {Number(aggregate?.total.account_count || 0).toLocaleString()}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                  Balance UGX {currency(aggregate?.total.total_balance || 0)}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                  Avg UGX {currency(aggregate?.total.avg_balance || 0)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-[11px] md:text-xs">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    {[
                      "Size of Account",
                      "Account (count)",
                      "Account %",
                      "Balance Amount",
                      "Balance %",
                      "Average Balance",
                    ].map((header) => (
                      <th key={header} className="px-2 py-2 text-left font-semibold uppercase tracking-[0.12em] leading-tight">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aggregate?.bands.map((band) => (
                    <tr key={`aggregate-${band.band_label}`} className="border-b last:border-0">
                      <td className="px-2 py-2 font-medium break-words">{band.band_label}</td>
                      <td className="px-2 py-2 tabular-nums">{Number(band.account_count).toLocaleString()}</td>
                      <td className="px-2 py-2 tabular-nums">{band.account_pct.toFixed(2)}%</td>
                      <td className="px-2 py-2 tabular-nums">UGX {currency(band.total_balance)}</td>
                      <td className="px-2 py-2 tabular-nums">{band.balance_pct.toFixed(2)}%</td>
                      <td className="px-2 py-2 tabular-nums">UGX {currency(band.avg_balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-slate-100 font-bold">
                    <td className="px-2 py-2">TOTAL</td>
                    <td className="px-2 py-2 tabular-nums">{Number(aggregate?.total.account_count || 0).toLocaleString()}</td>
                    <td className="px-2 py-2 tabular-nums">100.00%</td>
                    <td className="px-2 py-2 tabular-nums">UGX {currency(aggregate?.total.total_balance || 0)}</td>
                    <td className="px-2 py-2 tabular-nums">100.00%</td>
                    <td className="px-2 py-2 tabular-nums">UGX {currency(aggregate?.total.avg_balance || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
          Generate the report to view the concentration bands.
        </div>
      )}
    </div>
  );
}
