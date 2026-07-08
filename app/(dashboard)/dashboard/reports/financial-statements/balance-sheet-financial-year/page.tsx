"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

type BranchOption = { id: string; name: string };
type FinancialYearOption = { id: string; label: string; startDate: string; endDate: string; isCurrent: boolean };

type BalanceSheetAccount = {
  id: string;
  accountCode: string;
  accountName: string;
  parentId: string | null;
  isGroup: boolean;
  ledgerType: "ASSETS" | "LIABILITIES" | "EQUITY";
  periodNet: number;
  ytdBalance: number;
  displayPeriodNet: number;
  displayYtdBalance: number;
  children: BalanceSheetAccount[];
};

type BalanceSheetSection = {
  section: "ASSETS" | "LIABILITIES" | "EQUITY";
  label: string;
  accounts: BalanceSheetAccount[];
  totalPeriodNet: number;
  totalYtdBalance: number;
};

type BalanceSheetReport = {
  saccoName: string;
  location: string;
  reportTitle: string;
  generatedDate: string;
  generatedTime: string;
  generatedAt: string;
  branch: { id: string | "all"; name: string };
  financialYear: FinancialYearOption | null;
  reportingPeriod: { from: string; to: string; fyStart: string };
  sections: BalanceSheetSection[];
  grandTotal: {
    totalAccounts: number;
    totalPeriodNet: number;
    totalYtdBalance: number;
    difference: number;
    balanced: boolean;
  };
  balances: {
    assets: number;
    liabilities: number;
    equity: number;
    net: number;
  };
};

type ReportApiResponse = { success: boolean; data: BalanceSheetReport };
type YearsApiResponse = { success: boolean; data: FinancialYearOption[] };

const CURRENCY = new Intl.NumberFormat("en-UG", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function currency(value: number) {
  const amount = Number(value || 0);
  const negative = amount < 0;
  return `${negative ? "(" : ""}${CURRENCY.format(Math.abs(amount))}${negative ? ")" : ""}`;
}

function printDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}

function downloadWorkbook(buffer: ArrayBuffer, filename: string) {
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

function flattenSectionRows(accounts: BalanceSheetAccount[], depth = 0): Array<{ node: BalanceSheetAccount; depth: number }> {
  return accounts.flatMap((account) => [
    { node: account, depth },
    ...flattenSectionRows(account.children || [], depth + 1),
  ]);
}

function fallbackYears() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => {
    const year = currentYear - index;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    return {
      id: `fallback-${year}`,
      label: `${year}`,
      startDate,
      endDate,
      isCurrent: index === 0,
    };
  });
}

function SectionCard({
  section,
  collapsed,
  onToggle,
}: {
  section: BalanceSheetSection;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="overflow-hidden border-slate-200">
      <Collapsible open={!collapsed} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between gap-3 bg-emerald-950 px-3 py-3 text-left text-white sm:px-4">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200">
                {section.section}
              </div>
              <div className="text-base font-black sm:text-lg">{section.label}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                Total YTD
              </span>
              <span className="text-sm font-semibold text-emerald-100 sm:text-base">
                {currency(section.totalYtdBalance)}
              </span>
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            <div className="grid grid-cols-[minmax(0,2.5fr)_minmax(9rem,1fr)_minmax(9rem,1fr)] border-b bg-slate-50 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:px-4 sm:text-xs">
              <div>Account Name</div>
              <div className="text-right">Transactions During Period</div>
              <div className="text-right">Cumulative YTD Balance</div>
            </div>
            <div className="divide-y">
              {flattenSectionRows(section.accounts).map(({ node, depth }) => {
                const isGroup = node.children.length > 0;
                return (
                  <div
                    key={node.id}
                    className={`grid grid-cols-[minmax(0,2.5fr)_minmax(9rem,1fr)_minmax(9rem,1fr)] items-center px-3 py-2 text-xs sm:px-4 sm:text-sm ${
                      isGroup ? "bg-slate-50/80 font-semibold" : ""
                    }`}
                  >
                    <div style={{ paddingLeft: `${depth * 14}px` }} className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 w-4 shrink-0 text-slate-400">{isGroup ? "+" : "-"}</span>
                      <span className="min-w-0 whitespace-normal break-words leading-snug">
                        <span className="font-medium text-slate-900">{node.accountCode}</span>{" "}
                        <span className="text-slate-700">{node.accountName}</span>
                      </span>
                    </div>
                    <div className="text-right tabular-nums text-slate-500">{isGroup ? "-" : currency(node.displayPeriodNet)}</div>
                    <div className="text-right tabular-nums">{isGroup ? "-" : currency(node.displayYtdBalance)}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
export default function BalanceSheetFinancialYearPage() {
  const { data: session } = useSession();
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: !!session,
    intervalMs: 15000,
  });
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYearOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    ASSETS: false,
    LIABILITIES: false,
    EQUITY: false,
  });

  const userRole = String((session?.user as any)?.role || "").toUpperCase();
  const userBranchId = (session?.user as any)?.branchId || "all";
  const isAdmin = userRole === "ADMIN";

  const [filters, setFilters] = useState({
    branchId: "all",
    financialYearId: "",
    fromDate: "",
    toDate: "",
    fyStart: "",
  });

  useEffect(() => {
    if (!isAdmin) {
      setFilters((current) => ({ ...current, branchId: userBranchId }));
    }
  }, [isAdmin, userBranchId]);

  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; });

  const loadReport = useCallback(async (override?: typeof filters) => {
    const activeFilters = override ?? filtersRef.current;
    if (!activeFilters.toDate) {
      toast.error("Choose a reporting date");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilters.financialYearId) params.set("financialYearId", activeFilters.financialYearId);
      if (activeFilters.fromDate) params.set("fromDate", activeFilters.fromDate);
      if (activeFilters.toDate) params.set("toDate", activeFilters.toDate);
      if (activeFilters.fyStart) params.set("fyStart", activeFilters.fyStart);
      if (isAdmin && activeFilters.branchId !== "all") params.set("branchId", activeFilters.branchId);
      if (!isAdmin && userBranchId) params.set("branchId", userBranchId);

      const response = await fetch(`/api/v1/reports/financial-year/balance-sheet?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        let errorMsg = "Failed to load balance sheet";
        try {
          const j = await response.json();
          errorMsg = j?.error || errorMsg;
        } catch {
          const text = await response.text().catch(() => "");
          if (text) errorMsg = text.slice(0, 300);
        }
        throw new Error(errorMsg);
      }

      const json: ReportApiResponse = await response.json();
      setReport(json.data);
    } catch (error) {
      console.error("Balance sheet load error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load report");
    } finally {
      setLoading(false);
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
        console.error("Failed to load branches", error);
      }
    }

    async function loadYears() {
      setLoadingYears(true);
      try {
        const response = await fetch("/api/v1/financial-years", { cache: "no-store" });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(text || "Failed to load financial years");
        }
        const json = await response.json();
        const years = Array.isArray(json?.data) && json.data.length > 0 ? json.data : fallbackYears();
        setFinancialYears(years);
        const currentYear = years.find((year: FinancialYearOption) => year.isCurrent) || years[0] || null;
        if (currentYear) {
          const nextFilters = {
            branchId: isAdmin ? "all" : userBranchId,
            financialYearId: currentYear.id,
            fromDate: currentYear.startDate,
            toDate: currentYear.endDate,
            fyStart: currentYear.startDate,
          };
          setFilters((current) => ({
            ...current,
            ...nextFilters,
          }));
          void loadReport(nextFilters);
        }
      } catch (error) {
        console.error(error);
        const years = fallbackYears();
        setFinancialYears(years);
        toast.error(error instanceof Error ? error.message : "Failed to load financial years");
      } finally {
        setLoadingYears(false);
      }
    }

    void loadBranches();
    void loadYears();
  }, [isAdmin, userBranchId, loadReport]);

  useEffect(() => {
    if (!report) return;
    void loadReport();
  }, [liveRefreshVersion, loadReport, report]);

  function exportExcel() {
    if (!report) {
      toast.error("Generate the report first");
      return;
    }

    const rows: any[] = [];
    rows.push([report.saccoName]);
    rows.push([report.location]);
    rows.push([]);
    rows.push([report.reportTitle]);
    rows.push([`Branch: ${report.branch.name}`]);
    rows.push([`Financial Year: ${report.financialYear?.label || "Selected year"}`]);
    rows.push([`Reporting Date From: ${printDate(report.reportingPeriod.from)} To: ${printDate(report.reportingPeriod.to)}`]);
    rows.push([`Start of Financial Year: ${printDate(report.reportingPeriod.fyStart)}`]);
    rows.push([]);
    rows.push(["A/C Name", "Transactions During a Period", "Cumulative Balance Year-To-Date"]);

    report.sections.forEach((section) => {
      rows.push([section.label]);
      const walk = (account: BalanceSheetAccount, depth = 0) => {
        const prefix = `${" ".repeat(depth * 4)}${account.accountCode} ${account.accountName}`;
        if (account.children.length > 0) {
          rows.push([prefix, "", ""]);
          account.children.forEach((child) => walk(child, depth + 1));
        } else {
          rows.push([prefix, account.displayPeriodNet, account.displayYtdBalance]);
        }
      };
      section.accounts.forEach((account) => walk(account));
      rows.push([`Total - ${section.label}`, section.totalPeriodNet, section.totalYtdBalance]);
      rows.push([]);
    });

    rows.push(["Grand Total", report.grandTotal.totalPeriodNet, report.grandTotal.totalYtdBalance]);

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Balance Sheet");
    XLSX.writeFile(workbook, `balance-sheet-financial-year-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
  }

  function printPdf() {
    if (!report) {
      toast.error("Generate the report first");
      return;
    }

    const win = window.open("", "_blank", "width=1200,height=1000");
    if (!win) {
      toast.error("Unable to open print window");
      return;
    }

    const renderRows = (accounts: BalanceSheetAccount[], depth = 0): string =>
      accounts
        .map((account) => {
          const isGroup = account.children.length > 0;
          return `
            <tr>
              <td style="padding:6px 8px 6px ${12 + depth * 18}px;border-bottom:1px solid #e5e7eb;font-weight:${isGroup ? 700 : 400}">
                ${isGroup ? "▸" : "•"} ${account.accountCode} ${account.accountName}
              </td>
              <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${isGroup ? "-" : currency(account.displayPeriodNet)}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${isGroup ? "-" : currency(account.displayYtdBalance)}</td>
            </tr>
            ${renderRows(account.children || [], depth + 1)}
          `;
        })
        .join("");

    win.document.write(`
      <html>
        <head>
          <title>${report.reportTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .letterhead { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #1e1b4b; padding-bottom: 12px; margin-bottom: 12px; }
            .letterhead img { height: 64px; width: 64px; object-fit: contain; border-radius: 50%; }
            .letterhead-text { flex: 1; }
            .letterhead-name { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #1e1b4b; margin: 0; }
            .letterhead-sub { font-size: 11px; color: #475569; margin: 2px 0 0; }
            .header { text-align: center; margin-bottom: 18px; }
            .header h1 { margin: 6px 0; font-size: 22px; }
            .meta { font-size: 12px; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; }
            th { background: #0f172a; color: white; padding: 8px; text-align: left; }
            .section { background: #14532d; color: white; font-weight: 800; }
            .section td { padding: 8px 10px; }
          </style>
        </head>
        <body>
          <div class="letterhead">
            <img src="${window.location.origin}/images/logo.jpg" alt="Logo" onerror="this.style.display='none'" />
            <div class="letterhead-text">
              <p class="letterhead-name">${report.saccoName}</p>
              <p class="letterhead-sub">${report.location}</p>
            </div>
          </div>
          <div class="header">
            <h1>${report.reportTitle}</h1>
            <div class="meta">Branch: ${report.branch.name}</div>
            <div class="meta">Reporting Date From: ${printDate(report.reportingPeriod.from)} To: ${printDate(report.reportingPeriod.to)}</div>
            <div class="meta">Start of Financial Year: ${printDate(report.reportingPeriod.fyStart)}</div>
            <div class="meta">Generated: ${report.generatedDate} ${report.generatedTime}</div>
          </div>
          ${
            !report.grandTotal.balanced
              ? `<div style="border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;padding:10px 12px;margin-bottom:12px">⚠ Balance sheet does not balance. Difference: ${currency(report.grandTotal.difference)}</div>`
              : ""
          }
          <table>
            <thead>
              <tr>
                <th>Account Name</th>
                <th style="text-align:right">Transactions During a Period</th>
                <th style="text-align:right">Cumulative Balance Year-To-Date</th>
              </tr>
            </thead>
            <tbody>
              ${report.sections
                .map(
                  (section) => `
                    <tr class="section"><td colspan="3">${section.label}</td></tr>
                    ${renderRows(section.accounts)}
                    <tr style="font-weight:700;background:#f8fafc">
                      <td style="padding:8px 10px">Total - ${section.label}</td>
                      <td style="padding:8px 10px;text-align:right">${currency(section.totalPeriodNet)}</td>
                      <td style="padding:8px 10px;text-align:right">${currency(section.totalYtdBalance)}</td>
                    </tr>
                  `,
                )
                .join("")}
              <tr style="font-weight:800;border-top:2px solid #111827">
                <td style="padding:8px 10px">Grand Total</td>
                <td style="padding:8px 10px;text-align:right">${currency(report.grandTotal.totalPeriodNet)}</td>
                <td style="padding:8px 10px;text-align:right">${currency(report.grandTotal.totalYtdBalance)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.setTimeout(() => win.print(), 300);
  }

  const summaryCards = report
    ? [
        { title: "Total Accounts", value: report.grandTotal.totalAccounts.toLocaleString() },
        { title: "Assets", value: currency(report.balances.assets) },
        { title: "Liabilities", value: currency(report.balances.liabilities) },
        { title: "Equity", value: currency(report.balances.equity) },
      ]
    : [];

  return (
    <ReportPageLayout
      title="Balance Sheet Financial Year"
      description="Year-end balance sheet view with branch filtering, period totals, and YTD balances."
      fitContent
      onPrint={printPdf}
      period={
        report
          ? `${printDate(report.reportingPeriod.from)} to ${printDate(report.reportingPeriod.to)}`
          : `${filters.fromDate || "--"} to ${filters.toDate || "--"}`
      }
      generatedAt={report ? `${report.generatedDate} ${report.generatedTime}` : undefined}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadReport()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Generate Report
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={!report || exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Excel
          </Button>
          <Button onClick={printPdf} disabled={!report}>
            <FileText className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>
        </div>
      }
      filters={
        <div className="grid gap-4 xl:grid-cols-5">
          <div>
            <Label>Financial Year</Label>
            <Select
              value={filters.financialYearId}
              onValueChange={(value) => {
                const selected = financialYears.find((year) => year.id === value);
                const nextFilters = {
                  ...filters,
                  financialYearId: value,
                  fromDate: selected?.startDate || filters.fromDate,
                  toDate: selected?.endDate || filters.toDate,
                  fyStart: selected?.startDate || filters.fyStart,
                };
                setFilters(nextFilters);
                void loadReport(nextFilters);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingYears ? "Loading years..." : "Select financial year"} />
              </SelectTrigger>
              <SelectContent>
                {financialYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reporting Date From</Label>
            <Input value={filters.fromDate} type="date" onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} />
          </div>
          <div>
            <Label>Reporting Date To</Label>
            <Input value={filters.toDate} type="date" onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} />
          </div>
          <div>
            <Label>Start of FY</Label>
            <Input value={filters.fyStart} type="date" onChange={(event) => setFilters((current) => ({ ...current, fyStart: event.target.value }))} />
          </div>
          <div>
            <Label>Branch</Label>
            <Select
              value={filters.branchId}
              onValueChange={(value) => setFilters((current) => ({ ...current, branchId: value }))}
              disabled={!isAdmin}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    >
      {report ? (
        <div className="space-y-4">
          {!report.grandTotal.balanced ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              Balance sheet does not balance. Difference: {currency(report.grandTotal.difference)}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <ReportSummaryCard key={card.title} title={card.title} value={card.value} />
            ))}
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Branch</div>
                  <div className="mt-1 break-words font-medium text-slate-900">{report.branch.name}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Financial Year</div>
                  <div className="mt-1 break-words font-medium text-slate-900">
                    {report.financialYear?.label || "Selected"}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Reporting Period</div>
                  <div className="mt-1 break-words font-medium text-slate-900">
                    {printDate(report.reportingPeriod.from)} to {printDate(report.reportingPeriod.to)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Start of FY</div>
                  <div className="mt-1 break-words font-medium text-slate-900">
                    {printDate(report.reportingPeriod.fyStart)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {report.sections.map((section, index) => (
              <SectionCard
                key={section.section}
                section={section}
                collapsed={collapsedSections[section.section]}
                onToggle={() =>
                  setCollapsedSections((current) => ({
                    ...current,
                    [section.section]: !current[section.section],
                  }))
                }
              />
            ))}
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Assets</div>
                  <div className="mt-1 text-lg font-semibold">{currency(report.balances.assets)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Liabilities</div>
                  <div className="mt-1 text-lg font-semibold">{currency(report.balances.liabilities)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Equity</div>
                  <div className="mt-1 text-lg font-semibold">{currency(report.balances.equity)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      )}
    </ReportPageLayout>
  );
}

