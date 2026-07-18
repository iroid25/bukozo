"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Download, Printer, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { printReport } from "@/lib/reports/print-report";

type BranchOption = { id: string; name: string };

type ListingRecord = {
  id: string;
  accountNumber: string;
  memberName: string;
  sessionDate: string;
  trxDate: string;
  fdNumber: string;
  depositAmount: number;
  interestAmount: number;
  maturityValue: number;
  maturityDate: string;
  annualRate: number;
  depositPeriod: string;
  atMaturityCode: number;
  atMaturityLabel: string;
};

type ListingSection = {
  productCode: string;
  productName: string;
  records: ListingRecord[];
  subtotal: {
    count: number;
    depositAmount: number;
    interestAmount: number;
    maturityValue: number;
  };
};

type ListingReport = {
  saccoName: string;
  branch: string;
  branchLocation?: string;
  reportTitle: string;
  reportDate: string;
  generatedAt: string;
  dateRange: { from: string; to: string };
  sections: ListingSection[];
  grandTotal: ListingSection["subtotal"];
  legend?: string[];
};

const todayIso = () => format(new Date(), "yyyy-MM-dd");

const currency = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number(value || 0));

const displayDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd/MM/yyyy");
};

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function FixedDepositListingPage() {
  const { data: session } = useSession();
  const isAdmin = String((session?.user as any)?.role || "").toUpperCase() === "ADMIN";
  const userBranchId = (session?.user as any)?.branchId as string | undefined;

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<ListingReport | null>(null);
  const hasLoadedRef = useRef(false);
  const [filters, setFilters] = useState({
    branchId: "all",
    fromDate: todayIso(),
    toDate: todayIso(),
    memberSearch: "",
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
        setBranches(Array.isArray(json?.data) ? json.data.map((branch: any) => ({ id: branch.id, name: branch.name })) : []);
      } catch (error) {
        console.error(error);
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
      const params = new URLSearchParams();
      if (isAdmin ? filters.branchId !== "all" : userBranchId) {
        params.set("branchId", isAdmin ? filters.branchId : String(userBranchId));
      }
      params.set("fromDate", filters.fromDate);
      params.set("toDate", filters.toDate);
      if (filters.memberSearch.trim()) params.set("memberSearch", filters.memberSearch.trim());

      const response = await fetch(`/api/v1/reports/fixed-deposits/listing?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load listing report");
      }
      setReport(json.data);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load listing report");
    } finally {
      setLoading(false);
    }
  }, [filters.branchId, filters.fromDate, filters.memberSearch, filters.toDate, isAdmin, userBranchId]);

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

      const response = await fetch(`/api/v1/reports/fixed-deposits/listing/export?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to export listing");
      }
      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `fixed-deposit-listing-${filters.toDate}.xlsx`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [filters.branchId, filters.fromDate, filters.memberSearch, filters.toDate, isAdmin, userBranchId]);

  const handlePrint = useCallback(() => {
    if (!report) {
      toast.error("Generate the report first before printing.");
      return;
    }

    const headers = [
      "A/C No.",
      "Name",
      "Session Date",
      "Trx Date",
      "FD No.",
      "Deposit Amount",
      "Interest Amount",
      "Maturity Value",
      "Maturity Date",
      "Annual Rate (%)",
      "Deposit Period",
      "At Maturity",
    ];

    printReport({
      title: report.reportTitle || "Fixed Deposit Listing",
      subtitle: report.saccoName,
      period: `${displayDate(filters.fromDate)} — ${displayDate(filters.toDate)}`,
      headers,
      rows: [],
      groupBy: report.sections.map((section) => ({
        key: 0,
        label: `${section.productCode} - ${section.productName}`,
        subRows: section.records.map((r) => [
          r.accountNumber,
          r.memberName,
          displayDate(r.sessionDate),
          displayDate(r.trxDate),
          r.fdNumber,
          r.depositAmount,
          r.interestAmount,
          r.maturityValue,
          displayDate(r.maturityDate),
          `${Number(r.annualRate).toFixed(2)}%`,
          r.depositPeriod,
          r.atMaturityLabel,
        ]),
        subTotals: [
          `${section.subtotal.count} records`,
          "",
          "",
          "",
          "",
          section.subtotal.depositAmount,
          section.subtotal.interestAmount,
          section.subtotal.maturityValue,
        ],
      })),
      totals: [
        `${report.grandTotal.count} records`,
        "",
        "",
        "",
        "",
        report.grandTotal.depositAmount,
        report.grandTotal.interestAmount,
        report.grandTotal.maturityValue,
      ],
    });
  }, [report, filters.fromDate, filters.toDate]);

  const sections = report?.sections || [];
  const grandTotal = report?.grandTotal;

  return (
    <div className="space-y-4 p-4 md:p-6">
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
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">BUKONZO UNITED TEACHERS SACCO</div>
            <h1 className="mt-1 text-xl font-black text-slate-950 md:text-2xl">Fixed Deposit Listing</h1>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">Detailed listing of fixed deposits opened in the selected period.</p>
            <p className="mt-2 text-xs font-medium text-slate-700 md:text-sm">Branch: {branchLabel}</p>
            <p className="text-xs text-slate-700 md:text-sm">
              Reporting Date From: {displayDate(filters.fromDate)} To: {displayDate(filters.toDate)}
            </p>
          </div>
          </div>
          <div className="text-xs text-slate-500 md:text-sm">
            {report?.generatedAt ? `Generated: ${format(new Date(report.generatedAt), "dd/MM/yyyy HH:mm:ss")}` : ""}
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm lg:grid-cols-6">
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
              placeholder="Search by member name or account"
            />
          </div>
        </div>
        <div className="flex items-end gap-2 lg:col-span-6">
          <button
            type="button"
            className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-xs font-medium md:text-sm"
            onClick={() => void loadReport()}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""} md:h-4 md:w-4`} />
            Generate
          </button>
          <button
            type="button"
            className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground md:text-sm"
            onClick={() => void exportExcel()}
            disabled={exporting || !report}
          >
            <Download className={`mr-2 h-3.5 w-3.5 ${exporting ? "animate-spin" : ""} md:h-4 md:w-4`} />
            Excel
          </button>
          <button
            type="button"
            className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-xs font-medium md:text-sm"
            onClick={() => void handlePrint()}
            disabled={!report}
          >
            <Printer className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
            Print
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600 shadow-sm">Loading report...</div>
      ) : null}

      {report ? (
        <div className="space-y-3">
          {sections.map((section) => (
            <div key={section.productCode} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2.5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Product</div>
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
                        "Interest Amount",
                        "Maturity Value",
                        "Maturity Date",
                        "Annual Int. Rate (%)",
                        "Deposit Period",
                        "Transaction at Maturity",
                      ].map((header) => (
                        <th key={header} className="px-2 py-2 text-left font-semibold uppercase tracking-[0.12em] leading-tight">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.records.map((record) => (
                      <tr key={record.id} className="border-b last:border-0">
                        <td className="px-2 py-2 font-medium break-words">{record.accountNumber}</td>
                        <td className="px-2 py-2 break-words" title={record.memberName}>
                          {record.memberName}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">{displayDate(record.sessionDate)}</td>
                        <td className="whitespace-nowrap px-2 py-2">{displayDate(record.trxDate)}</td>
                        <td className="whitespace-nowrap px-2 py-2">{record.fdNumber}</td>
                        <td className="px-2 py-2 tabular-nums">UGX {currency(record.depositAmount)}</td>
                        <td className="px-2 py-2 tabular-nums">UGX {currency(record.interestAmount)}</td>
                        <td className="px-2 py-2 tabular-nums">UGX {currency(record.maturityValue)}</td>
                        <td className="whitespace-nowrap px-2 py-2">{displayDate(record.maturityDate)}</td>
                        <td className="px-2 py-2 tabular-nums">{Number(record.annualRate).toFixed(2)}%</td>
                        <td className="whitespace-nowrap px-2 py-2">{record.depositPeriod}</td>
                        <td className="px-2 py-2 leading-tight">
                          <div>{record.atMaturityCode}</div>
                          <div className="text-[10px] text-slate-500">{record.atMaturityLabel}</div>
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
                      <td className="px-2 py-2 tabular-nums">UGX {currency(section.subtotal.interestAmount)}</td>
                      <td className="px-2 py-2 tabular-nums">UGX {currency(section.subtotal.maturityValue)}</td>
                      <td className="px-2 py-2" colSpan={4}>
                        {Number(section.subtotal.count).toLocaleString()} records
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          <div className="rounded-2xl border bg-slate-950 px-3 py-2.5 text-xs font-bold text-white md:text-sm">
            GRAND TOTAL: {Number(grandTotal?.count || 0).toLocaleString()} records | Deposit UGX {currency(grandTotal?.depositAmount || 0)} | Interest UGX {currency(grandTotal?.interestAmount || 0)} | Maturity UGX {currency(grandTotal?.maturityValue || 0)}
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
          Generate the report to view the listing.
        </div>
      )}
    </div>
  );
}
