"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { format, startOfYear } from "date-fns";
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

type GroupItem = {
  itemName: string;
  amount: number;
  date?: string;
  description?: string;
};

type Group = {
  code: string;
  name: string;
  amount: number;
  items: GroupItem[];
};

type ProfitLossReport = {
  reportType: string;
  period: { startDate: string; endDate: string };
  income: { categories: Group[]; total: number };
  expenses: { categories: Group[]; total: number };
  netProfit: number;
  profitMargin: number;
  generatedAt?: string;
};

function currency(value: number) {
  return new Intl.NumberFormat("en-UG", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);
}

function groupTotal(items: GroupItem[]) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

export default function ProfitLossPage() {
  const { data: session } = useSession();
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: !!session,
    intervalMs: 15000,
  });
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ income: false, expenses: false });
  const [summaryMode, setSummaryMode] = useState(false);
  const [filters, setFilters] = useState({
    branchId: "all",
    startDate: format(startOfYear(new Date()), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });

  const userRole = String((session?.user as any)?.role || "").toUpperCase();
  const userBranchId = (session?.user as any)?.branchId || "all";
  const isAdmin = userRole === "ADMIN";

  useEffect(() => {
    if (!isAdmin) setFilters((current) => ({ ...current, branchId: userBranchId }));
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
    void loadBranches();
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("startDate", filters.startDate);
      params.set("endDate", filters.endDate);
      if (isAdmin ? filters.branchId !== "all" : userBranchId) params.set("branchId", isAdmin ? filters.branchId : userBranchId);

      const response = await fetch(`/api/v1/reports/financial/profit-loss?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Failed to load report");
      setReport(json.data);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [filters.branchId, filters.endDate, filters.startDate, isAdmin, userBranchId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport, liveRefreshVersion]);

  async function exportExcel() {
    if (!report) {
      toast.error("Generate the report first");
      return;
    }
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("startDate", filters.startDate);
      params.set("endDate", filters.endDate);
      if (isAdmin ? filters.branchId !== "all" : userBranchId) params.set("branchId", isAdmin ? filters.branchId : userBranchId);
      const response = await fetch(`/api/v1/reports/financial/profit-loss/export?${params.toString()}`, { cache: "no-store", credentials: "include" });
      if (!response.ok) throw new Error("Failed to export workbook");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `profit-loss-${filters.startDate}_to_${filters.endDate}.xlsx`;
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

    const win = window.open("", "_blank", "width=1200,height=1000");
    if (!win) {
      toast.error("Unable to open print window");
      return;
    }

    const renderGroup = (group: Group) => `
      <tr style="background:#f8fafc;font-weight:700">
        <td style="padding:8px 10px" colspan="2">${group.code} ${group.name}</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.amount)}</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.amount)}</td>
      </tr>
      ${summaryMode ? "" : group.items
        .map(
          (item) => `
          <tr>
            <td style="padding:6px 10px" colspan="2">${item.itemName}</td>
            <td style="padding:6px 10px;text-align:right">${currency(item.amount)}</td>
            <td style="padding:6px 10px;text-align:right">${currency(item.amount)}</td>
          </tr>
        `,
        )
        .join("")}
      ${summaryMode ? "" : `<tr style="font-weight:700;border-top:1px solid #e5e7eb">
        <td style="padding:8px 10px" colspan="2">${group.name} subtotal</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.amount)}</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.amount)}</td>
      </tr>`}
    `;

    win.document.write(`
      <html>
        <head>
          <title>Profit & Loss</title>
          <style>
            body{font-family:Arial,sans-serif;padding:24px;color:#111827}
            .letterhead{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1e1b4b;padding-bottom:12px;margin-bottom:12px}
            .letterhead img{height:64px;width:64px;object-fit:contain;border-radius:50%}
            .letterhead-name{font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;color:#1e1b4b;margin:0}
            .letterhead-sub{font-size:11px;color:#475569;margin:2px 0 0}
            h1,h2{margin:0;text-align:center}
            table{width:100%;border-collapse:collapse;margin-top:18px}
            th{background:#f1f5f9;padding:8px;text-align:left;border-bottom:2px solid #cbd5e1}
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
          <h2>${report.reportType}</h2>
          <div style="text-align:center;margin-top:6px">Reporting Date From: ${report.period.startDate} To: ${report.period.endDate}</div>
          <div style="text-align:right;margin-top:4px">Generated: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}</div>
          <table>
            <thead>
              <tr><th>A/C Name</th><th>From Balance</th><th>Debit</th><th>To Balance</th></tr>
            </thead>
            <tbody>
              <tr style="background:#0f766e;color:#fff;font-weight:700"><td colspan="4">Income</td></tr>
              ${report.income.categories.map(renderGroup).join("")}
              <tr style="background:#f8fafc;font-weight:800"><td colspan="2">Total Income</td><td style="text-align:right">${currency(report.income.total)}</td><td style="text-align:right">${currency(report.income.total)}</td></tr>
              <tr style="background:#b91c1c;color:#fff;font-weight:700"><td colspan="4">Expenses</td></tr>
              ${report.expenses.categories.map(renderGroup).join("")}
              <tr style="background:#f8fafc;font-weight:800"><td colspan="2">Total Expenses</td><td style="text-align:right">${currency(report.expenses.total)}</td><td style="text-align:right">${currency(report.expenses.total)}</td></tr>
              <tr style="background:#111827;color:#fff;font-weight:800"><td colspan="2">Net Profit</td><td style="text-align:right">${currency(report.netProfit)}</td><td style="text-align:right">${currency(report.netProfit)}</td></tr>
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
      title="Profit & Loss (P&L) Statement"
      description="Annual income versus expenditure statement with live API filters."
      period={report ? `${report.period.startDate} to ${report.period.endDate}` : `${filters.startDate} to ${filters.endDate}`}
      generatedAt={report ? `${report.generatedAt || ""}` : undefined}
      summaryFirst
      fitContent
      onPrint={printPdf}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadReport()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Generate P&L
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
          <div><Label>From</Label><Input type="date" value={filters.startDate} onChange={(e) => setFilters((current) => ({ ...current, startDate: e.target.value }))} /></div>
          <div><Label>To</Label><Input type="date" value={filters.endDate} onChange={(e) => setFilters((current) => ({ ...current, endDate: e.target.value }))} /></div>
          <div className="md:col-span-2 xl:col-span-2 flex items-end gap-2">
            <Button variant="outline" onClick={() => setCollapsed({ income: !collapsed.income, expenses: !collapsed.expenses })}>
              {collapsed.income && collapsed.expenses ? "Expand All" : "Collapse All"}
            </Button>
            <Button variant={summaryMode ? "default" : "outline"} onClick={() => setSummaryMode((prev) => !prev)}>
              {summaryMode ? "Detailed" : "Summary"}
            </Button>
          </div>
        </div>
      }
      summary={report ? (
        <>
          <ReportSummaryCard title="Total Income" value={currency(report.income.total)} />
          <ReportSummaryCard title="Total Expenses" value={currency(report.expenses.total)} />
          <ReportSummaryCard
            title="Net Profit"
            value={currency(report.netProfit)}
            className={report.netProfit >= 0 ? "border-emerald-200" : "border-red-200"}
          />
          <ReportSummaryCard title="Profit Margin" value={`${report.profitMargin.toFixed(1)}%`} />
        </>
      ) : null}
    >
      {report ? (
        <div className="space-y-4 pb-6">
          <Card>
            <CardContent className="space-y-3 p-0">
              <div className="grid grid-cols-[minmax(18rem,2fr)_repeat(3,minmax(10rem,1fr))] border-b bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <div>A/C Name</div>
                <div className="text-right">From Balance</div>
                <div className="text-right">Debit</div>
                <div className="text-right">To Balance</div>
              </div>

              {[{ key: "income", label: "Income", groups: report.income.categories, total: report.income.total, tone: "bg-emerald-900" }, { key: "expenses", label: "Expenses", groups: report.expenses.categories, total: report.expenses.total, tone: "bg-rose-900" }].map((section) => {
                const isCollapsed = collapsed[section.key];
                return (
                  <div key={section.key} className="border-b">
                    <button type="button" onClick={() => setCollapsed((current) => ({ ...current, [section.key]: !current[section.key] }))} className={`flex w-full items-center justify-between px-3 py-3 text-left text-white ${section.tone}`}>
                      <span className="text-sm font-bold uppercase tracking-[0.22em]">{section.label}</span>
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {!isCollapsed ? (
                      <div className="divide-y">
                        {section.groups.map((group) => (
                          <div key={group.code} className="bg-white">
                            <div className="grid grid-cols-[minmax(18rem,2fr)_repeat(3,minmax(10rem,1fr))] px-3 py-3 text-sm font-semibold">
                              <div>{group.code} {group.name}</div>
                              <div className="text-right">-</div>
                              <div className="text-right tabular-nums">{currency(groupTotal(group.items))}</div>
                              <div className="text-right tabular-nums">{currency(group.amount)}</div>
                            </div>
                            {!summaryMode && group.items.map((item, idx) => (
                              <div key={`${group.code}-${idx}`} className="grid grid-cols-[minmax(18rem,2fr)_repeat(3,minmax(10rem,1fr))] px-3 py-2 text-sm text-slate-700">
                                <div className="pl-6">{item.itemName}</div>
                                <div className="text-right">-</div>
                                <div className="text-right tabular-nums">{currency(item.amount)}</div>
                                <div className="text-right tabular-nums">{currency(item.amount)}</div>
                              </div>
                            ))}
                            {!summaryMode && (
                              <div className="grid grid-cols-[minmax(18rem,2fr)_repeat(3,minmax(10rem,1fr))] bg-slate-50 px-3 py-3 text-sm font-bold">
                                <div>{group.name} subtotal</div>
                                <div />
                                <div className="text-right tabular-nums">{currency(group.amount)}</div>
                                <div className="text-right tabular-nums">{currency(group.amount)}</div>
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="grid grid-cols-[minmax(18rem,2fr)_repeat(3,minmax(10rem,1fr))] bg-slate-950 px-3 py-3 text-sm font-bold text-white">
                          <div>Total {section.label}</div>
                          <div />
                          <div className="text-right tabular-nums">{currency(section.total)}</div>
                          <div className="text-right tabular-nums">{currency(section.total)}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <div className="grid grid-cols-[minmax(18rem,2fr)_repeat(3,minmax(10rem,1fr))] bg-slate-100 px-3 py-3 text-sm font-extrabold">
                <div>Profit / (Loss)</div>
                <div />
                <div className="text-right tabular-nums">{currency(report.netProfit)}</div>
                <div className={`text-right tabular-nums ${report.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{currency(report.netProfit)}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground">Generate the report to view the P&L statement.</div>
      )}
    </ReportPageLayout>
  );
}
