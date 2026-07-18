"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { addDays, format } from "date-fns";
import { Bell, CalendarDays, Download, Loader2, Printer, RefreshCw, Search, ShieldAlert, ArrowRightCircle } from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { printReport } from "@/lib/reports/print-report";

type BranchOption = { id: string; name: string };

type MaturingRecord = {
  id: string;
  accountNumber: string;
  memberName: string;
  sessionDate: string;
  trxDate: string;
  fdNumber: string;
  depositAmount: number;
  totalInterest: number;
  maturityValue: number;
  maturityDate: string;
  annualRate: number;
  depositPeriod: string;
  atMaturityCode: number;
  atMaturityLabel: string;
  daysToMaturity: number;
  urgency: "red" | "amber" | "green";
};

type MaturingSection = {
  productCode: string;
  productName: string;
  records: MaturingRecord[];
  subtotal: {
    count: number;
    depositAmount: number;
    totalInterest: number;
    maturityValue: number;
  };
};

type MaturingReport = {
  saccoName: string;
  branch: string;
  branchLocation?: string;
  reportTitle: string;
  reportDate: string;
  generatedAt: string;
  dateRange: { from: string; to: string };
  summary: {
    total_count: number;
    total_deposit: number;
    total_interest: number;
    total_maturity_value: number;
    by_action_code: Record<
      string,
      {
        code: number;
        label: string;
        count: number;
        depositAmount: number;
        totalInterest: number;
        maturityValue: number;
      }
    >;
  };
  products: MaturingSection[];
  grand_total: {
    count: number;
    deposit: number;
    interest: number;
    maturity_value: number;
  };
  legend?: string[];
};

type Filters = {
  branchId: string;
  fromDate: string;
  toDate: string;
  memberSearch: string;
  atMaturityCode: string;
};

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const displayDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd/MM/yyyy");
};
const currency = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
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

function urgencyClasses(level: MaturingRecord["urgency"]) {
  switch (level) {
    case "red":
      return "bg-rose-50 text-rose-700";
    case "amber":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-emerald-50 text-emerald-700";
  }
}

export default function UpcomingMaturingFixedDepositsPage() {
  const { data: session } = useSession();
  const isAdmin = String((session?.user as any)?.role || "").toUpperCase() === "ADMIN";
  const userBranchId = (session?.user as any)?.branchId as string | undefined;

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<MaturingReport | null>(null);
  const hasLoadedRef = useRef(false);
  const [filters, setFilters] = useState<Filters>({
    branchId: "all",
    fromDate: todayIso(),
    toDate: addDays(new Date(), 30).toISOString().split("T")[0],
    memberSearch: "",
    atMaturityCode: "",
  });
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 20000,
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
    if (filters.branchId === "all") {
      return "All Branches";
    }
    return branches.find((branch) => branch.id === filters.branchId)?.name || filters.branchId;
  }, [branches, filters.branchId, isAdmin, userBranchId]);

  const reportRangeLabel = useMemo(
    () => `Reporting Date From: ${displayDate(filters.fromDate)} To: ${displayDate(filters.toDate)}`,
    [filters.fromDate, filters.toDate],
  );

  const loadReport = useCallback(
    async (override?: Partial<Filters>) => {
      setLoading(true);
      try {
        const current = { ...filters, ...(override || {}) };
        const params = new URLSearchParams();
        if (isAdmin ? current.branchId !== "all" : userBranchId) {
          params.set("branchId", isAdmin ? current.branchId : String(userBranchId));
        }
        params.set("fromDate", current.fromDate);
        params.set("toDate", current.toDate);
        if (current.memberSearch.trim()) params.set("memberSearch", current.memberSearch.trim());
        if (current.atMaturityCode) params.set("atMaturityCode", current.atMaturityCode);

        const response = await fetch(`/api/v1/reports/fixed-deposits/maturing?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await response.json();
        if (!response.ok || !json?.success) {
          throw new Error(json?.error || "Failed to load maturing report");
        }

        setReport(json.data);
        hasLoadedRef.current = true;
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Failed to load maturing report");
      } finally {
        setLoading(false);
      }
    },
    [filters, isAdmin, userBranchId],
  );

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRefreshVersion]);

  const exportExcel = useCallback(async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (isAdmin ? filters.branchId !== "all" : userBranchId) {
        params.set("branchId", isAdmin ? filters.branchId : String(userBranchId));
      }
      params.set("fromDate", filters.fromDate);
      params.set("toDate", filters.toDate);
      if (filters.memberSearch.trim()) params.set("memberSearch", filters.memberSearch.trim());
      if (filters.atMaturityCode) params.set("atMaturityCode", filters.atMaturityCode);

      const response = await fetch(`/api/v1/reports/fixed-deposits/maturing/export?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to export fixed deposit maturing report");
      }
      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `upcoming-maturing-fixed-deposits-${filters.toDate}.xlsx`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [filters, isAdmin, userBranchId]);

  const handlePrint = useCallback(() => {
    if (!report) {
      toast.error("Generate the report first before printing.");
      return;
    }

    const printHeaders = ["A/C No.", "Member", "FD No", "Trx Date", "Deposit", "Interest", "Maturity", "Maturity Date", "At Maturity", "Days", "Urgency"];

    const groupBy = report.products.map((section) => ({
      key: 0,
      label: `${section.productCode} - ${section.productName}`,
      subHeaders: printHeaders,
      subRows: section.records.map((record) => [
        record.accountNumber,
        record.memberName,
        record.fdNumber,
        displayDate(record.trxDate),
        record.depositAmount,
        record.totalInterest,
        record.maturityValue,
        displayDate(record.maturityDate),
        record.atMaturityLabel,
        record.daysToMaturity,
        record.urgency,
      ]),
      subTotals: [
        "Subtotal",
        String(section.subtotal.count),
        "", "", "",
        section.subtotal.depositAmount,
        section.subtotal.totalInterest,
        section.subtotal.maturityValue,
        "", "", "",
      ],
    }));

    printReport({
      title: "Upcoming Maturing Fixed Deposits",
      subtitle: `${report.saccoName} | ${report.branch}`,
      period: reportRangeLabel,
      filters: { Branch: branchLabel },
      headers: printHeaders,
      rows: [],
      groupBy,
      totals: [
        "Grand Total",
        String(report.grand_total?.count || 0),
        "", "", "",
        report.grand_total?.deposit || 0,
        report.grand_total?.interest || 0,
        report.grand_total?.maturity_value || 0,
        "", "", "",
      ],
    });
  }, [report, reportRangeLabel, branchLabel]);

  const applyQuickRange = (days: number) => {
    const next = {
      ...filters,
      fromDate: todayIso(),
      toDate: addDays(new Date(), days).toISOString().split("T")[0],
    };
    setFilters(next);
    void loadReport(next);
  };

  const sections = report?.products || [];
  const summary = report?.summary;
  const totalCount = Number(summary?.total_count || 0);
  const totalDeposit = Number(summary?.total_deposit || 0);
  const totalInterest = Number(summary?.total_interest || 0);
  const totalMaturity = Number(summary?.total_maturity_value || 0);
  const dueThisWeek = sections
    .flatMap((section) => section.records)
    .filter((record) => record.daysToMaturity <= 7).length;

  return (
    <div className="space-y-4 p-4 md:p-5">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/images/logo.jpg"
              alt="SACCO logo"
              className="h-14 w-14 rounded-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {report?.saccoName || "BUKONZO UNITED TEACHERS SACCO"}
            </div>
            <h1 className="mt-1 text-xl font-black text-slate-950 md:text-2xl">
              Upcoming Maturing Fixed Deposits
            </h1>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              Forward-looking maturity planning report for cashflow and renewal preparation.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-700 md:text-sm">Branch: {branchLabel}</p>
            <p className="text-xs text-slate-700 md:text-sm">{reportRangeLabel}</p>
          </div>
          </div>
          <div className="text-xs text-slate-500 md:text-sm">
            {report?.generatedAt ? `Generated: ${format(new Date(report.generatedAt), "dd/MM/yyyy HH:mm:ss")}` : ""}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Maturing Deposits</div>
          <div className="mt-1 text-2xl font-black text-slate-950">{totalCount.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Deposit Amount</div>
          <div className="mt-1 text-2xl font-black text-slate-950">UGX {currency(totalDeposit)}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total Interest</div>
          <div className="mt-1 text-2xl font-black text-slate-950">UGX {currency(totalInterest)}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Maturity Value</div>
          <div className="mt-1 text-2xl font-black text-slate-950">UGX {currency(totalMaturity)}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Maturing This Week</div>
          <div className="mt-1 text-2xl font-black text-rose-700">{dueThisWeek.toLocaleString()}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-6">
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
            <label className="text-xs font-medium md:text-sm">From</label>
            <input
              type="date"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.fromDate}
              onChange={(e) => setFilters((current) => ({ ...current, fromDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">To</label>
            <input
              type="date"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.toDate}
              onChange={(e) => setFilters((current) => ({ ...current, toDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-medium md:text-sm">Member / Account</label>
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground md:h-4 md:w-4" />
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
                value={filters.memberSearch}
                onChange={(e) => setFilters((current) => ({ ...current, memberSearch: e.target.value }))}
                placeholder="Search member or account"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium md:text-sm">Maturity Code</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs md:text-sm"
              value={filters.atMaturityCode}
              onChange={(e) => setFilters((current) => ({ ...current, atMaturityCode: e.target.value }))}
            >
              <option value="">All</option>
              <option value="1">1 - Withdrawal Manually</option>
              <option value="2">2 - Transfer to savings account</option>
              <option value="3">3 - Transfer interest to savings account & renew principal</option>
              <option value="4">4 - Renew principal & interest</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold md:text-sm"
            onClick={() => applyQuickRange(7)}
          >
            <CalendarDays className="h-4 w-4" />
            Next 7 Days
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold md:text-sm"
            onClick={() => applyQuickRange(30)}
          >
            <CalendarDays className="h-4 w-4" />
            Next 30 Days
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold md:text-sm"
            onClick={() => applyQuickRange(60)}
          >
            <CalendarDays className="h-4 w-4" />
            Next 60 Days
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs font-semibold md:text-sm"
            onClick={() => toast.info("Custom range uses the date inputs above.")}
          >
            <ShieldAlert className="h-4 w-4" />
            Custom Range
          </button>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-xs font-semibold md:text-sm"
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

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {Object.values(summary?.by_action_code || {}).map((item) => (
          <div key={item.code} className="rounded-xl border bg-white p-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {item.code} - {item.label}
            </div>
            <div className="mt-1 flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-black text-slate-950">{Number(item.count || 0).toLocaleString()}</div>
                <div className="text-[11px] text-slate-500">Accounts</div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>UGX {currency(item.depositAmount)}</div>
                <div>Interest UGX {currency(item.totalInterest)}</div>
              </div>
            </div>
          </div>
        ))}
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
            <div key={section.productCode} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2.5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Product</div>
                  <div className="text-sm font-bold text-slate-950 md:text-base">
                    {section.productCode} - {section.productName}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs md:text-sm">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Records {Number(section.subtotal.count).toLocaleString()}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Deposit UGX {currency(section.subtotal.depositAmount)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Maturity UGX {currency(section.subtotal.maturityValue)}
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
                        "Session Date",
                        "Trx Date",
                        "Fixed Deposit No.",
                        "Deposit Amount",
                        "Total Interest",
                        "Maturity Value",
                        "Maturity Date",
                        "Annual Int. Rate (%)",
                        "Deposit Period",
                        "Days",
                        "Action",
                      ].map((header) => (
                        <th key={header} className="px-2 py-2 text-left font-semibold uppercase tracking-[0.12em] leading-tight">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.records.map((record) => (
                      <tr key={record.id} className={`border-b last:border-0 ${urgencyClasses(record.urgency)}`}>
                        <td className="px-2 py-2 font-medium break-words">{record.accountNumber}</td>
                        <td className="px-2 py-2 break-words" title={record.memberName}>
                          {record.memberName}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">{displayDate(record.sessionDate)}</td>
                        <td className="whitespace-nowrap px-2 py-2">{displayDate(record.trxDate)}</td>
                        <td className="whitespace-nowrap px-2 py-2">{record.fdNumber}</td>
                        <td className="px-2 py-2 tabular-nums">UGX {currency(record.depositAmount)}</td>
                        <td className="px-2 py-2 tabular-nums">UGX {currency(record.totalInterest)}</td>
                        <td className="px-2 py-2 tabular-nums">UGX {currency(record.maturityValue)}</td>
                        <td className="whitespace-nowrap px-2 py-2">{displayDate(record.maturityDate)}</td>
                        <td className="px-2 py-2 tabular-nums">{Number(record.annualRate).toFixed(1)}%</td>
                        <td className="whitespace-nowrap px-2 py-2">{record.depositPeriod}</td>
                        <td className="px-2 py-2 font-semibold tabular-nums">{record.daysToMaturity}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold"
                              onClick={() => toast.info(`Notify member for ${record.accountNumber}. SMS/email workflow can be hooked here.`)}
                            >
                              <Bell className="h-3.5 w-3.5" />
                              Notify Member
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white"
                              onClick={() => toast.info(`Process maturity workflow for ${record.accountNumber}.`)}
                            >
                              <ArrowRightCircle className="h-3.5 w-3.5" />
                              Process Maturity
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-slate-100 font-bold">
                      <td className="px-2 py-2" colSpan={5}>
                        SUBTOTAL
                      </td>
                      <td className="px-2 py-2 tabular-nums">UGX {currency(section.subtotal.depositAmount)}</td>
                      <td className="px-2 py-2 tabular-nums">UGX {currency(section.subtotal.totalInterest)}</td>
                      <td className="px-2 py-2 tabular-nums">UGX {currency(section.subtotal.maturityValue)}</td>
                      <td className="px-2 py-2" colSpan={5}>
                        {Number(section.subtotal.count).toLocaleString()} records
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          <div className="rounded-2xl border bg-slate-950 px-3 py-2.5 text-xs font-bold text-white md:text-sm">
            GRAND TOTAL: {Number(report.grand_total?.count || 0).toLocaleString()} records | Deposit UGX {currency(report.grand_total?.deposit || 0)} | Interest UGX {currency(report.grand_total?.interest || 0)} | Maturity UGX {currency(report.grand_total?.maturity_value || 0)}
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold md:text-base">Transaction at Maturity Legend</div>
            <div className="mt-3 space-y-2 text-xs md:text-sm">
              {(report.legend || []).map((item) => (
                <div key={item} className="rounded-lg border bg-slate-50 px-3 py-2 leading-tight">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
          Generate the report to view the maturity schedule.
        </div>
      )}
    </div>
  );
}
