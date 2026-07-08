"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

type BranchOption = { id: string; name: string };
type FinancialYear = { id: string; yearLabel?: string; label?: string; startDate: string; endDate: string; isCurrent?: boolean };

type FyAccount = {
  account_code: string;
  account_name: string;
  section: "Income" | "Expenses";
  parent_group?: string | null;
  is_group_header?: boolean;
  period: { debit: number; credit: number; net_change: number };
  ytd: { debit_balance: number; credit_balance: number };
};

type FyReport = {
  report_title: string;
  financial_year_start: string;
  period: { from: string; to: string };
  days_into_fy: number;
  generated_date?: string;
  generated_time?: string;
  income: { accounts: FyAccount[]; total: any };
  expenses: { accounts: FyAccount[]; total: any };
  grand_total: { account_count: number; period: any; ytd: any };
  net_profit_ytd: number;
  is_profit: boolean;
  currency?: string;
};

function currency(value: number) {
  return new Intl.NumberFormat("en-UG", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);
}

function fallbackYears() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => {
    const year = currentYear - index;
    return {
      id: `fallback-${year}`,
      label: `${year}`,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      isCurrent: index === 0,
    } satisfies FinancialYear;
  });
}

export default function ProfitLossFinancialYearPage() {
  const { data: session } = useSession();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<FyReport | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ income: false, expenses: false });
  const [filters, setFilters] = useState({
    branchId: "all",
    financialYearId: "",
    fyStart: "",
    periodFrom: "",
    periodTo: "",
  });

  const userRole = String((session?.user as any)?.role || "").toUpperCase();
  const userBranchId = (session?.user as any)?.branchId || "all";
  const isAdmin = userRole === "ADMIN";
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: !!session,
    intervalMs: 15000,
  });

  useEffect(() => {
    if (!isAdmin) setFilters((current) => ({ ...current, branchId: userBranchId }));
  }, [isAdmin, userBranchId]);

  useEffect(() => {
    async function loadMeta() {
      setLoadingYears(true);
      try {
        const [branchRes, fyRes] = await Promise.all([
          fetch("/api/v1/branches", { cache: "no-store" }),
          fetch("/api/v1/financial-years", { cache: "no-store" }),
        ]);

        if (branchRes.ok) {
          const branchJson = await branchRes.json();
          setBranches(Array.isArray(branchJson?.data) ? branchJson.data.map((branch: any) => ({ id: branch.id, name: branch.name })) : []);
        }

        if (fyRes.ok) {
          const fyJson = await fyRes.json();
          const years = Array.isArray(fyJson?.data) && fyJson.data.length > 0 ? fyJson.data : fallbackYears();
          setFinancialYears(years);
          const current = years.find((item: FinancialYear) => item.isCurrent) || years[0];
          if (current) {
            setFilters((prev) => ({
              ...prev,
              financialYearId: current.id,
              fyStart: current.startDate?.slice(0, 10) || prev.fyStart,
              periodFrom: current.startDate?.slice(0, 10) || prev.periodFrom,
              periodTo: format(new Date(), "yyyy-MM-dd"),
            }));
          }
        }
      } catch (error) {
        console.error("Failed to load FY metadata", error);
        const years = fallbackYears();
        setFinancialYears(years);
        const current = years[0];
        if (current) {
          setFilters((prev) => ({
            ...prev,
            financialYearId: current.id,
            fyStart: current.startDate,
            periodFrom: current.startDate,
            periodTo: format(new Date(), "yyyy-MM-dd"),
          }));
        }
      }
      setLoadingYears(false);
    }

    void loadMeta();
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.financialYearId) params.set("financialYearId", filters.financialYearId);
      if (filters.fyStart) params.set("fyStart", filters.fyStart);
      if (filters.periodFrom) params.set("fromDate", filters.periodFrom);
      if (filters.periodTo) params.set("toDate", filters.periodTo);
      if (isAdmin ? filters.branchId !== "all" : userBranchId) params.set("branchId", isAdmin ? filters.branchId : userBranchId);
      const response = await fetch(`/api/v1/reports/financial-year/profit-loss?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Failed to load report");
      setReport(json.data);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [filters.branchId, filters.financialYearId, filters.fyStart, filters.periodFrom, filters.periodTo, isAdmin, userBranchId]);

  useEffect(() => {
    if (filters.fyStart) void loadReport();
  }, [filters.fyStart, liveRefreshVersion, loadReport]);

  async function exportExcel() {
    if (!report) {
      toast.error("Generate the report first");
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.financialYearId) params.set("financialYearId", filters.financialYearId);
      if (filters.fyStart) params.set("fyStart", filters.fyStart);
      if (filters.periodFrom) params.set("fromDate", filters.periodFrom);
      if (filters.periodTo) params.set("toDate", filters.periodTo);
      if (isAdmin ? filters.branchId !== "all" : userBranchId) params.set("branchId", isAdmin ? filters.branchId : userBranchId);
      const response = await fetch(`/api/v1/reports/financial-year/profit-loss/export?${params.toString()}`, { cache: "no-store", credentials: "include" });
      if (!response.ok) throw new Error("Failed to export workbook");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `profit-loss-financial-year-${filters.fyStart || "report"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Excel export failed");
    } finally {
      setExporting(false);
    }
  }

  function printPdf() {
    if (!report) {
      toast.error("Generate the report first");
      return;
    }
    const win = window.open("", "_blank", "width=1400,height=1000");
    if (!win) {
      toast.error("Unable to open print window");
      return;
    }

    const renderRows = (accounts: FyAccount[]) =>
      accounts
        .map((account) => {
          if (account.is_group_header) {
            return `<tr style="background:#f1f5f9;font-weight:700"><td colspan="6" style="padding:8px 10px">${account.account_code} ${account.account_name}</td></tr>`;
          }
          return `
            <tr>
              <td style="padding:6px 10px">${account.account_code} ${account.account_name}</td>
              <td style="padding:6px 10px;text-align:right">${currency(account.period.debit)}</td>
              <td style="padding:6px 10px;text-align:right">${currency(account.period.credit)}</td>
              <td style="padding:6px 10px;text-align:right">${currency(account.period.net_change)}</td>
              <td style="padding:6px 10px;text-align:right">${currency(account.ytd.debit_balance)}</td>
              <td style="padding:6px 10px;text-align:right">${currency(account.ytd.credit_balance)}</td>
            </tr>
          `;
        })
        .join("");

    win.document.write(`
      <html>
        <head>
          <title>${report.report_title}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:24px;color:#111827}
            .letterhead{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1e1b4b;padding-bottom:12px;margin-bottom:12px}
            .letterhead img{height:64px;width:64px;object-fit:contain;border-radius:50%}
            .letterhead-name{font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;color:#1e1b4b;margin:0}
            .letterhead-sub{font-size:11px;color:#475569;margin:2px 0 0}
            h1,h2{text-align:center;margin:0}
            table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}
            th{background:#f8fafc;padding:8px;border-bottom:2px solid #cbd5e1;text-align:left}
            .section{background:#14532d;color:#fff;font-weight:800}
            .section.negative{background:#9f1239}
          </style>
        </head>
        <body>
          <div class="letterhead">
            <img src="${window.location.origin}/images/logo.jpg" alt="Logo" onerror="this.style.display='none'" />
            <div>
              <p class="letterhead-name">BUKONZO UNITED TEACHERS SACCO</p>
              <p class="letterhead-sub">KISINGA, Kasese District, Uganda</p>
            </div>
          </div>
          <h2>${report.report_title}</h2>
          <div style="text-align:center;margin-top:6px">Financial Year Start: ${report.financial_year_start}</div>
          <div style="text-align:center;margin-top:4px">Reporting Period: ${report.period.from} To ${report.period.to}</div>
          <div style="text-align:right;margin-top:4px">Generated: ${report.generated_date} ${report.generated_time}</div>
          <table>
            <thead>
              <tr>
                <th></th>
                <th colspan="3" style="text-align:center">TRANSACTIONS DURING A PERIOD</th>
                <th colspan="2" style="text-align:center">CUMMULATIVE BALANCE YEAR-TO-DATE</th>
              </tr>
              <tr>
                <th>A/C Name</th><th>Debit</th><th>Credit</th><th>Net Change</th><th>Debit Balance</th><th>Credit Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr class="section"><td colspan="6">Income</td></tr>
              ${renderRows(report.income.accounts)}
              <tr style="font-weight:700;background:#f8fafc"><td colspan="4">Total Income</td><td style="text-align:right">${currency(report.income.total.ytd?.debit_balance || report.income.total.ytd?.debit || 0)}</td><td style="text-align:right">${currency(report.income.total.ytd?.credit_balance || report.income.total.ytd?.credit || 0)}</td></tr>
              <tr class="section negative"><td colspan="6">Expenses</td></tr>
              ${renderRows(report.expenses.accounts)}
              <tr style="font-weight:700;background:#f8fafc"><td colspan="4">Total Expenses</td><td style="text-align:right">${currency(report.expenses.total.ytd?.debit_balance || report.expenses.total.ytd?.debit || 0)}</td><td style="text-align:right">${currency(report.expenses.total.ytd?.credit_balance || report.expenses.total.ytd?.credit || 0)}</td></tr>
              <tr style="font-weight:800;background:#111827;color:#fff"><td colspan="4">Profit/(-Loss):</td><td style="text-align:right">${currency(report.net_profit_ytd)}</td><td style="text-align:right">${currency(report.net_profit_ytd)}</td></tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.setTimeout(() => win.print(), 300);
  }

  const branchLabel = isAdmin
    ? filters.branchId === "all"
      ? "All Branches"
      : branches.find((branch) => branch.id === filters.branchId)?.name || filters.branchId
    : branches.find((branch) => branch.id === userBranchId)?.name || "Assigned Branch";

  return (
    <ReportPageLayout
      title="Profit & Loss Statement (Financial Year)"
      description="In-year management monitoring view with YTD balances."
      period={report ? `${report.period.from} to ${report.period.to}` : `${filters.periodFrom || ""} to ${filters.periodTo || ""}`}
      generatedAt={report ? `${report.generated_date || ""} ${report.generated_time || ""}` : undefined}
      summaryFirst
      fitContent
      onPrint={printPdf}
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
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <Label>Branch</Label>
            {isAdmin ? (
              <Select value={filters.branchId} onValueChange={(value) => setFilters((current) => ({ ...current, branchId: value }))}>
                <SelectTrigger><SelectValue placeholder="All Branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={branchLabel} disabled />
            )}
          </div>
          <div>
            <Label>Financial Year Start</Label>
            <Select
              value={filters.fyStart}
              onValueChange={(value) => {
                const selected = financialYears.find((fy) => fy.startDate?.slice(0, 10) === value);
                setFilters((current) => ({
                  ...current,
                  financialYearId: selected?.id || current.financialYearId,
                  fyStart: value,
                  periodFrom: value,
                }));
              }}
            >
              <SelectTrigger><SelectValue placeholder={loadingYears ? "Loading years..." : "Select FY"} /></SelectTrigger>
              <SelectContent>
                {financialYears.map((fy) => (
                  <SelectItem key={fy.id} value={fy.startDate?.slice(0, 10)}>
                    {fy.yearLabel || fy.label || `${fy.startDate?.slice(0, 10)} / ${fy.endDate?.slice(0, 10)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Period From</Label><Input type="date" value={filters.periodFrom} onChange={(e) => setFilters((current) => ({ ...current, periodFrom: e.target.value }))} /></div>
          <div><Label>Period To</Label><Input type="date" value={filters.periodTo} onChange={(e) => setFilters((current) => ({ ...current, periodTo: e.target.value }))} /></div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={() => setCollapsed({ income: !collapsed.income, expenses: !collapsed.expenses })}>
              {collapsed.income && collapsed.expenses ? "Expand All" : "Collapse All"}
            </Button>
          </div>
        </div>
      }
      summary={report ? (
        <>
          <ReportSummaryCard title="YTD Income" value={currency(report.income.total?.ytd?.credit_balance || 0)} />
          <ReportSummaryCard title="YTD Expenses" value={currency(report.expenses.total?.ytd?.debit_balance || 0)} />
          <ReportSummaryCard
            title="Net Profit (YTD)"
            value={currency(report.net_profit_ytd)}
            className={report.is_profit ? "border-emerald-200" : "border-red-200"}
          />
          <ReportSummaryCard title="Days into FY" value={report.days_into_fy} subValue={`Start: ${report.financial_year_start}`} />
        </>
      ) : null}
    >
      {report ? (
        <div className="space-y-4 pb-6">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-[minmax(20rem,2fr)_repeat(5,minmax(8rem,1fr))] border-b bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <div />
                <div className="text-center col-span-3 rounded-md border border-slate-200 bg-white py-2 text-[10px] tracking-[0.2em]">TRANSACTIONS DURING A PERIOD</div>
                <div className="text-center col-span-2 rounded-md border border-slate-200 bg-white py-2 text-[10px] tracking-[0.2em]">CUMMULATIVE BALANCE YEAR-TO-DATE</div>
              </div>
              <div className="grid grid-cols-[minmax(20rem,2fr)_repeat(5,minmax(8rem,1fr))] border-b bg-slate-50 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <div>A/C Name</div>
                <div className="text-right">Debit</div>
                <div className="text-right">Credit</div>
                <div className="text-right">Net Change</div>
                <div className="text-right">YTD Debit</div>
                <div className="text-right">YTD Credit</div>
              </div>

              {[{ key: "income", label: "Income", accounts: report.income.accounts, total: report.income.total, tone: "bg-emerald-900" }, { key: "expenses", label: "Expenses", accounts: report.expenses.accounts, total: report.expenses.total, tone: "bg-rose-900" }].map((section) => (
                <div key={section.key} className="border-b">
                  <button type="button" onClick={() => setCollapsed((current) => ({ ...current, [section.key]: !current[section.key] }))} className={`flex w-full items-center justify-between px-3 py-3 text-left text-white ${section.tone}`}>
                    <span className="text-sm font-bold uppercase tracking-[0.22em]">{section.label}</span>
                    {collapsed[section.key] ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {!collapsed[section.key] ? (
                    <div className="divide-y">
                      {section.accounts.map((account) => (
                        <div key={`${section.key}-${account.account_code}`} className={`grid grid-cols-[minmax(20rem,2fr)_repeat(5,minmax(8rem,1fr))] px-3 py-2 text-sm ${account.is_group_header ? "bg-slate-50 font-semibold" : ""}`}>
                          <div className="whitespace-normal break-words">
                            {account.account_code} {account.account_name}
                          </div>
                          <div className="text-right tabular-nums">{currency(account.period.debit)}</div>
                          <div className="text-right tabular-nums">{currency(account.period.credit)}</div>
                          <div className={`text-right tabular-nums ${account.period.net_change < 0 ? "text-red-700" : "text-emerald-700"}`}>{currency(account.period.net_change)}</div>
                          <div className="text-right tabular-nums">{currency(account.ytd.debit_balance)}</div>
                          <div className="text-right tabular-nums">{currency(account.ytd.credit_balance)}</div>
                        </div>
                      ))}
                      <div className="grid grid-cols-[minmax(20rem,2fr)_repeat(5,minmax(8rem,1fr))] bg-slate-950 px-3 py-3 text-sm font-bold text-white">
                        <div>Total {section.label}</div>
                        <div className="text-right tabular-nums">{currency(section.total?.period?.debit || 0)}</div>
                        <div className="text-right tabular-nums">{currency(section.total?.period?.credit || 0)}</div>
                        <div className="text-right tabular-nums">{currency(section.total?.period?.net_change || 0)}</div>
                        <div className="text-right tabular-nums">{currency(section.total?.ytd?.debit_balance || 0)}</div>
                        <div className="text-right tabular-nums">{currency(section.total?.ytd?.credit_balance || 0)}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}

              <div className="grid grid-cols-[minmax(20rem,2fr)_repeat(5,minmax(8rem,1fr))] bg-slate-100 px-3 py-3 text-sm font-extrabold">
                <div>Profit/(-Loss):</div>
                <div />
                <div />
                <div />
                <div />
                <div className={report.net_profit_ytd >= 0 ? "text-emerald-700" : "text-red-700"}>
                  {currency(report.net_profit_ytd)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground">Generate the report to view the financial year P&L statement.</div>
      )}
    </ReportPageLayout>
  );
}
