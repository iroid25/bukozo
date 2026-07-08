"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SaccoReportHeader } from "@/components/reports/SaccoReportHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scale, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import type { TBEntry } from "@/lib/services/financial-reports";

// ─── types ──────────────────────────────────────────────────────────────────

type TBGroup = Record<string, TBEntry[]>;

type TBResponse = {
  reportType: string;
  period: { startDate: string; endDate: string };
  groups: TBGroup;
  entries: TBEntry[];
  totals: {
    debit: number;
    credit: number;
    difference: number;
    balanced: boolean;
  };
  generatedAt: string;
};

type Branch = { id: string; name: string; location?: string; contactPhone?: string | null; email?: string | null };

// ─── constants ───────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const LEDGER_LABELS: Record<string, string> = {
  ASSETS: "Assets",
  LIABILITIES: "Liabilities",
  EQUITY: "Equity / Capital",
  INCOME: "Income / Revenue",
  EXPENDITURES: "Expenses",
};

const LEDGER_COLORS: Record<string, string> = {
  ASSETS: "bg-blue-50 text-blue-900",
  LIABILITIES: "bg-orange-50 text-orange-900",
  EQUITY: "bg-purple-50 text-purple-900",
  INCOME: "bg-green-50 text-green-900",
  EXPENDITURES: "bg-red-50 text-red-900",
};

const LEDGER_ORDER = ["ASSETS", "LIABILITIES", "EQUITY", "INCOME", "EXPENDITURES"];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2019 + 2 }, (_, i) => 2020 + i);

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(value: number) {
  if (value === 0) return "—";
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(value);
}

function fmtNum(value: number) {
  if (value === 0) return "—";
  return new Intl.NumberFormat("en-UG", { minimumFractionDigits: 0 }).format(value);
}

function groupSubtotals(entries: TBEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      openingDebit: acc.openingDebit + e.openingDebit,
      openingCredit: acc.openingCredit + e.openingCredit,
      periodDebit: acc.periodDebit + e.periodDebit,
      periodCredit: acc.periodCredit + e.periodCredit,
      closingDebit: acc.closingDebit + e.closingDebit,
      closingCredit: acc.closingCredit + e.closingCredit,
    }),
    { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, closingDebit: 0, closingCredit: 0 },
  );
}

// ─── skeleton ────────────────────────────────────────────────────────────────

function TBSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-md border overflow-hidden">
        <div className="bg-muted/40 px-4 py-2">
          <Skeleton className="h-4 w-48" />
        </div>
        {[...Array(12)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t px-4 py-2">
            <Skeleton className="h-3 w-16 shrink-0" />
            <Skeleton className={`h-3 ${i % 3 === 0 ? "w-48" : "w-36"}`} />
            <div className="ml-auto flex gap-6">
              {[...Array(6)].map((__, j) => (
                <Skeleton key={j} className="h-3 w-20" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function TrialBalancePage() {
  const { data: session } = useSession();
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: !!session,
    intervalMs: 15000,
  });

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<TBResponse | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [branchId, setBranchId] = useState("all");
  const [showDetailed, setShowDetailed] = useState(true);

  const userRole = (session?.user as any)?.role as string | undefined;
  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  const isAdmin = userRole === "ADMIN";

  // Derive date range from month + year
  const { startDate, endDate } = useMemo(() => {
    const m = parseInt(month) - 1;
    const y = parseInt(year);
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, [month, year]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/branches", { cache: "no-store" });
      if (!res.ok) return;
      const result = await res.json();
      setBranches((result.data || []).map((b: any) => ({
        id: b.id, name: b.name, location: b.location,
        contactPhone: b.contactPhone, email: b.email,
      })));
    } catch {}
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const selectedBranchId = isAdmin ? (branchId === "all" ? undefined : branchId) : userBranchId;
      const branchQuery = selectedBranchId ? `&branchId=${selectedBranchId}` : "";
      const response = await fetch(
        `/api/v1/reports/financial-year/trial-balance?year=${parseInt(year)}${branchQuery}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Request failed");
      const result = await response.json();
      setReport(result.data);
    } catch {
      toast.error("Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  }, [branchId, isAdmin, userBranchId, year]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchReport(); }, [fetchReport, liveRefreshVersion]);

  useEffect(() => {
    if (!isAdmin && userBranchId) setBranchId(userBranchId);
  }, [isAdmin, userBranchId]);

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === (isAdmin ? branchId : userBranchId)) ?? null,
    [branches, branchId, isAdmin, userBranchId],
  );

  const periodLabel = useMemo(() => {
    const m = MONTHS[parseInt(month) - 1];
    return `${m} ${year}`;
  }, [month, year]);

  // ─── PDF Export ────────────────────────────────────────────────────────────

  const handleExportPdf = useCallback(() => {
    if (!report) { toast.error("Generate the report first."); return; }

    const branchLabel = activeBranch?.name ?? (branchId === "all" ? "All Branches" : branchId);
    const h = REPORT_HEADER_DETAILS;

    const colHeader = (text: string) =>
      `<th style="border:1px solid #d1d5db;padding:6px 8px;text-align:right;background:#f3f4f6;font-size:11px;white-space:nowrap">${text}</th>`;
    const colLeft = (text: string) =>
      `<th style="border:1px solid #d1d5db;padding:6px 8px;text-align:left;background:#f3f4f6;font-size:11px">${text}</th>`;
    const cell = (val: number) =>
      `<td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">${val === 0 ? "—" : val.toLocaleString("en-UG")}</td>`;
    const cellL = (text: string, bold = false) =>
      `<td style="border:1px solid #d1d5db;padding:5px 8px;font-size:11px;${bold ? "font-weight:600" : ""}">${text}</td>`;

    const sectionRows = LEDGER_ORDER.map((lt) => {
      const rows = report.groups[lt] ?? [];
      if (rows.length === 0) return "";
      const sub = groupSubtotals(rows);
      const label = LEDGER_LABELS[lt] ?? lt;
      const sectionRow = `<tr><td colspan="8" style="border:1px solid #d1d5db;padding:5px 8px;font-weight:700;font-size:12px;background:#f9fafb;letter-spacing:0.5px">${label}</td></tr>`;
      const dataRows = rows.map((e) => `<tr>
        ${cellL(e.accountCode)}
        ${cellL(e.accountName)}
        ${cell(e.openingDebit)}${cell(e.openingCredit)}
        ${cell(e.periodDebit)}${cell(e.periodCredit)}
        ${cell(e.closingDebit)}${cell(e.closingCredit)}
      </tr>`).join("");
      const subtotalRow = `<tr style="background:#f3f4f6;font-weight:600">
        ${cellL("")}${cellL("Subtotal — " + label, true)}
        ${cell(sub.openingDebit)}${cell(sub.openingCredit)}
        ${cell(sub.periodDebit)}${cell(sub.periodCredit)}
        ${cell(sub.closingDebit)}${cell(sub.closingCredit)}
      </tr>`;
      return sectionRow + dataRows + subtotalRow;
    }).join("");

    const t = report.totals;
    const totalRow = `<tr style="background:#e5e7eb;font-weight:700;border-top:2px solid #374151">
      <td colspan="6" style="border:1px solid #d1d5db;padding:6px 8px;font-size:12px">GRAND TOTAL</td>
      <td style="border:2px solid #374151;padding:6px 8px;text-align:right;font-size:12px">${t.debit.toLocaleString("en-UG")}</td>
      <td style="border:2px solid #374151;padding:6px 8px;text-align:right;font-size:12px">${t.credit.toLocaleString("en-UG")}</td>
    </tr>`;

    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) { toast.error("Unable to open print window."); return; }

    win.document.write(`<html><head><title>Trial Balance — ${periodLabel}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111827;font-size:12px}
        .header-grid{display:grid;grid-template-columns:110px 1fr 110px;gap:16px;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:16px}
        .center{text-align:center}.logo{width:96px;height:96px;object-fit:contain}
        .main{font-size:22px;font-weight:900;text-transform:uppercase;color:#0f7ea4}
        .sub{font-size:16px;font-weight:900;text-transform:uppercase;color:#0f7ea4}
        .reg{font-size:14px;font-weight:800;color:#1f2937;margin-top:6px}
        .italic{font-style:italic;color:#9f1239;font-size:13px}
        .contact{font-size:13px;font-weight:700;color:#1f2937}
        .title-block{margin-top:12px;border-top:4px solid #312e81;padding-top:12px;text-align:center}
        .report-title{font-size:22px;font-weight:900;text-transform:uppercase}
        .muted{color:#6b7280;font-size:11px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        @media print{@page{size:A3 landscape;margin:1cm}}
      </style></head><body>
      <div class="header-grid">
        <div class="center"><img class="logo" src="${window.location.origin}${h.logoPath}" alt="logo"/></div>
        <div class="center">
          <div class="main">Bukonzo United Teachers'</div>
          <div class="sub">Cooperative Savings and Credit Society Limited.</div>
          <div class="reg">${h.registrationNumber}</div>
          <div class="italic">Email: ${activeBranch?.email ?? h.email}</div>
          <div class="contact">Contacts: ${h.contacts.join(" / ")}</div>
          ${h.postalAddress.map((l) => `<div class="contact">${l}</div>`).join("")}
        </div>
        <div></div>
      </div>
      <div class="title-block">
        <div class="report-title">Trial Balance</div>
        <div class="muted">Period: ${periodLabel}</div>
        <div class="muted">Branch: ${branchLabel}</div>
        <div class="muted">Generated: ${new Date(report.generatedAt).toLocaleString("en-UG")}</div>
        <div style="margin-top:4px;font-weight:700;color:${t.balanced ? "#16a34a" : "#dc2626"}">${t.balanced ? "✓ BALANCED" : "✗ UNBALANCED — Difference: " + t.difference.toLocaleString("en-UG")}</div>
      </div>
      <table>
        <thead><tr>
          ${colLeft("Code")}${colLeft("Account Name")}
          ${colHeader("Opening Dr")}${colHeader("Opening Cr")}
          ${colHeader("Period Dr")}${colHeader("Period Cr")}
          ${colHeader("Closing Dr")}${colHeader("Closing Cr")}
        </tr></thead>
        <tbody>${sectionRows}${totalRow}</tbody>
      </table>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }, [report, activeBranch, branchId, periodLabel]);

  // ─── render ─────────────────────────────────────────────────────────────────

  const totals = report?.totals;
  const groups = report?.groups ?? {};

  return (
    <ReportPageLayout
      title="Trial Balance"
      description="General ledger account balances for the selected period"
      fitContent
      onPrint={handleExportPdf}
      summary={
        totals ? (
          <>
            <ReportSummaryCard title="Total Debits" value={fmt(totals.debit)} icon={Scale} />
            <ReportSummaryCard title="Total Credits" value={fmt(totals.credit)} icon={Scale} />
            <ReportSummaryCard
              title="Difference"
              value={fmt(totals.difference)}
              className={totals.balanced ? "border-green-200 text-green-700" : "border-red-200 text-red-700"}
            />
            <ReportSummaryCard
              title="Status"
              value={totals.balanced ? "Balanced ✓" : "Unbalanced ✗"}
              className={totals.balanced ? "border-green-200 text-green-700" : "border-red-200 text-red-700"}
            />
          </>
        ) : null
      }
      summaryFirst
      filters={
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Month */}
          <div>
            <Label className="text-xs">Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Year */}
          <div>
            <Label className="text-xs">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Branch */}
          {isAdmin ? (
            <div>
              <Label className="text-xs">Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All Branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Branch</Label>
              <Input
                className="h-9"
                value={branches.find((b) => b.id === userBranchId)?.name ?? "Assigned Branch"}
                disabled
              />
            </div>
          )}

          {/* Detailed toggle */}
          <div className="flex items-end">
            <Button
              variant={showDetailed ? "default" : "outline"}
              size="sm"
              className="h-9 w-full"
              onClick={() => setShowDetailed((v) => !v)}
            >
              {showDetailed ? "Detailed" : "Summary"}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2 lg:col-span-2">
            <Button className="h-9 flex-1" onClick={fetchReport} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading…" : "Generate"}
            </Button>
            <Button variant="outline" className="h-9 flex-1" onClick={handleExportPdf} disabled={!report}>
              Export PDF
            </Button>
          </div>
        </div>
      }
    >
      {loading && !report ? (
        <TBSkeleton />
      ) : (
        <div className="w-full">
          {/* ── Report Header ── */}
          <div className="px-6 py-4">
            <SaccoReportHeader
              title="Trial Balance"
              subtitle="General ledger account balances for the selected period"
              branchLabel={activeBranch?.name ?? (branchId === "all" ? "All Branches" : branchId)}
              periodLabel={periodLabel}
              generatedAt={report?.generatedAt ? new Date(report.generatedAt).toLocaleString("en-UG") : undefined}
            />
          </div>

          {/* ── Status badges ── */}
          {report && (
            <div className="flex flex-wrap items-center gap-2 px-6 py-2">
              <Badge variant={totals?.balanced ? "default" : "destructive"}>
                {totals?.balanced ? "✓ Balanced" : "✗ Unbalanced"}
              </Badge>
              {!totals?.balanced && (
                <Badge variant="outline" className="text-red-600">
                  Difference: {fmt(totals?.difference ?? 0)}
                </Badge>
              )}
              <Badge variant="secondary">Period: {periodLabel}</Badge>
              <Badge variant="secondary">
                {activeBranch?.name ?? (branchId === "all" ? "All Branches" : branchId)}
              </Badge>
              {loading && <Badge variant="outline" className="animate-pulse">Refreshing…</Badge>}
            </div>
          )}

          {/* ── Table ── */}
          {report && (
            <div className="overflow-x-auto px-6 pb-6">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-50">
                    <th className="py-2 pl-3 pr-2 text-left font-semibold text-slate-700 w-[100px]">Code</th>
                    <th className="py-2 px-2 text-left font-semibold text-slate-700">Account Name</th>
                    {showDetailed && (
                      <>
                        <th className="py-2 px-2 text-right font-semibold text-slate-700 whitespace-nowrap w-[110px]">Opening Dr</th>
                        <th className="py-2 px-2 text-right font-semibold text-slate-700 whitespace-nowrap w-[110px]">Opening Cr</th>
                        <th className="py-2 px-2 text-right font-semibold text-slate-700 whitespace-nowrap w-[110px]">Period Dr</th>
                        <th className="py-2 px-2 text-right font-semibold text-slate-700 whitespace-nowrap w-[110px]">Period Cr</th>
                      </>
                    )}
                    <th className="py-2 px-2 text-right font-semibold text-blue-800 whitespace-nowrap w-[120px]">Closing Dr</th>
                    <th className="py-2 pr-3 text-right font-semibold text-blue-800 whitespace-nowrap w-[120px]">Closing Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {LEDGER_ORDER.map((lt) => {
                    const rows = groups[lt] ?? [];
                    if (rows.length === 0) return null;
                    const sub = groupSubtotals(rows);
                    return (
                      <React.Fragment key={lt}>
                        {/* Section header */}
                        <tr className={`${LEDGER_COLORS[lt]} border-t-2 border-slate-300`}>
                          <td
                            colSpan={showDetailed ? 8 : 4}
                            className="py-2 pl-3 font-bold uppercase tracking-wider text-xs"
                          >
                            {LEDGER_LABELS[lt]}
                          </td>
                        </tr>

                        {/* Account rows */}
                        {rows.map((entry) => (
                          <tr key={entry.accountCode} className="border-b border-slate-100 hover:bg-slate-50/60">
                            <td className="py-1.5 pl-3 pr-2 font-mono text-xs text-slate-500 whitespace-nowrap">
                              {entry.accountCode}
                            </td>
                            <td className="py-1.5 px-2 text-slate-800 min-w-0">
                              {entry.accountName}
                            </td>
                            {showDetailed && (
                              <>
                                <td className="py-1.5 px-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{fmtNum(entry.openingDebit)}</td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{fmtNum(entry.openingCredit)}</td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{fmtNum(entry.periodDebit)}</td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{fmtNum(entry.periodCredit)}</td>
                              </>
                            )}
                            <td className="py-1.5 px-2 text-right tabular-nums font-medium text-blue-900 whitespace-nowrap">{fmtNum(entry.closingDebit)}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums font-medium text-blue-900 whitespace-nowrap">{fmtNum(entry.closingCredit)}</td>
                          </tr>
                        ))}

                        {/* Section subtotal */}
                        <tr className="border-t border-slate-300 bg-slate-50 font-semibold text-xs">
                          <td className="py-1.5 pl-3 pr-2 text-slate-500" />
                          <td className="py-1.5 px-2 text-slate-700 italic">
                            Subtotal — {LEDGER_LABELS[lt]}
                          </td>
                          {showDetailed && (
                            <>
                              <td className="py-1.5 px-2 text-right tabular-nums text-slate-700 whitespace-nowrap">{fmtNum(sub.openingDebit)}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-slate-700 whitespace-nowrap">{fmtNum(sub.openingCredit)}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-slate-700 whitespace-nowrap">{fmtNum(sub.periodDebit)}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-slate-700 whitespace-nowrap">{fmtNum(sub.periodCredit)}</td>
                            </>
                          )}
                          <td className="py-1.5 px-2 text-right tabular-nums text-blue-900 whitespace-nowrap">{fmtNum(sub.closingDebit)}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-blue-900 whitespace-nowrap">{fmtNum(sub.closingCredit)}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* Grand total */}
                  <tr className="border-t-2 border-slate-800 bg-slate-100 font-bold text-sm">
                    <td
                      colSpan={showDetailed ? 6 : 2}
                      className="py-2.5 pl-3 pr-2 uppercase tracking-wide text-slate-800"
                    >
                      Grand Total
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-blue-900 border-t-2 border-slate-800 whitespace-nowrap">
                      {fmtNum(totals?.debit ?? 0)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-blue-900 border-t-2 border-slate-800 whitespace-nowrap">
                      {fmtNum(totals?.credit ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* No data */}
              {(report.entries?.length ?? 0) === 0 && (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  No GL account activity found for {periodLabel}.
                  <br />
                  <span className="text-xs">
                    Ensure journal entries have been posted for this period.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Empty state before first generate */}
          {!report && !loading && (
            <div className="py-16 text-center text-muted-foreground text-sm px-6">
              Select a period and click Generate to load the trial balance.
            </div>
          )}
        </div>
      )}
    </ReportPageLayout>
  );
}
