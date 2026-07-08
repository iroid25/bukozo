"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { addDays, format, startOfMonth, startOfYear, subDays } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { SaccoReportHeader } from "@/components/reports/SaccoReportHeader";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  IncomeExpenseAccount,
  IncomeExpenseDrilldown,
  IncomeExpenseGroup,
  IncomeExpenseReport,
  IncomeExpenseSection,
} from "@/lib/reports/income-expense-types";

type BranchOption = { id: string; name: string };

type DrilldownState = {
  open: boolean;
  loading: boolean;
  data: IncomeExpenseDrilldown | null;
  accountCode?: string;
};

function currency(value: number) {
  const negative = value < 0;
  return `${negative ? "(" : ""}${new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value || 0))}${negative ? ")" : ""}`;
}

function isZero(value: number) {
  return Math.abs(value || 0) < 0.01;
}

function getDefaults() {
  const now = new Date();
  const currentStart = startOfMonth(now);
  const compareEnd = subDays(currentStart, 1);
  return {
    startDate: format(currentStart, "yyyy-MM-dd"),
    endDate: format(now, "yyyy-MM-dd"),
    compareStartDate: format(startOfYear(currentStart), "yyyy-MM-dd"),
    compareEndDate: format(compareEnd, "yyyy-MM-dd"),
  };
}

function LoadingState() {
  return (
    <div className="space-y-4 p-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <Card key={idx}>
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-[420px] rounded-2xl" />
    </div>
  );
}

function SectionSummary({ section }: { section: IncomeExpenseSection }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              {section.type}
            </div>
            <div className="text-lg font-black text-slate-950">{section.label}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Current Total
            </div>
            <div className={`text-2xl font-black tabular-nums ${section.type === "EXPENDITURES" ? "text-red-700" : "text-emerald-700"}`}>
              {currency(section.section_total.current_period)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
      {label}: {value}
    </div>
  );
}

export default function StatementOfComprehensiveIncomeAndExpenditurePage() {
  const { data: session } = useSession();
  const defaults = useMemo(() => getDefaults(), []);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [compareStartDate, setCompareStartDate] = useState(defaults.compareStartDate);
  const [compareEndDate, setCompareEndDate] = useState(defaults.compareEndDate);
  const [search, setSearch] = useState("");
  const [hideZeroBalances, setHideZeroBalances] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<IncomeExpenseReport | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    INCOME: true,
    EXPENDITURES: true,
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [drilldown, setDrilldown] = useState<DrilldownState>({
    open: false,
    loading: false,
    data: null,
  });

  const userRole = (session?.user as any)?.role as string | undefined;
  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  const isAdmin = userRole === "ADMIN";

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/branches", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      setBranches((result.data || []).map((branch: any) => ({ id: branch.id, name: branch.name })));
    } catch (error) {
      console.error("Failed to fetch branches", error);
    }
  }, []);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (!isAdmin && userBranchId) {
      setBranchId(userBranchId);
    }
  }, [isAdmin, userBranchId]);

  const branchLabel = useMemo(() => {
    if (!isAdmin) {
      return branches.find((branch) => branch.id === userBranchId)?.name || "Assigned Branch";
    }
    if (branchId === "all") return "All Branches";
    return branches.find((branch) => branch.id === branchId)?.name || branchId;
  }, [branchId, branches, isAdmin, userBranchId]);

  const periodLabel = useMemo(() => {
    return `${format(new Date(startDate), "dd MMM yyyy")} to ${format(new Date(endDate), "dd MMM yyyy")}`;
  }, [endDate, startDate]);

  const compareLabel = useMemo(() => {
    return `${format(new Date(compareStartDate), "dd MMM yyyy")} to ${format(new Date(compareEndDate), "dd MMM yyyy")}`;
  }, [compareEndDate, compareStartDate]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const selectedBranchId = isAdmin ? (branchId === "all" ? undefined : branchId) : userBranchId;
      const params = new URLSearchParams();
      params.set("start_date", startDate);
      params.set("end_date", endDate);
      params.set("compare_start", compareStartDate);
      params.set("compare_end", compareEndDate);
      if (selectedBranchId) params.set("branchId", selectedBranchId);

      const response = await fetch(
        `/api/v1/reports/statement-of-comprehensive-income-and-expenditure?${params.toString()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Failed to load report");
      }

      const result = await response.json();
      setReport(result.data);
    } catch (error) {
      console.error("Income & Expenses report error:", error);
      toast.error("Failed to load statement of comprehensive income & expenses");
    } finally {
      setLoading(false);
    }
  }, [branchId, compareEndDate, compareStartDate, endDate, isAdmin, startDate, userBranchId]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const activeSections = useMemo(() => {
    if (!report) return [];
    const term = search.trim().toLowerCase();

    return report.sections
      .map((section) => ({
        ...section,
        groups: section.groups
          .map((group) => ({
            ...group,
            accounts: group.accounts.filter((account) => {
              if (hideZeroBalances && isZero(account.current_period) && isZero(account.prior_ytd) && isZero(account.closing)) {
                return false;
              }
              if (!term) return true;
              return `${account.code} ${account.name}`.toLowerCase().includes(term);
            }),
          }))
          .filter((group) => {
            if (!term) return group.accounts.length > 0;
            return (
              group.accounts.length > 0 ||
              `${group.code} ${group.name}`.toLowerCase().includes(term)
            );
          }),
      }))
      .filter((section) => {
        if (!term) return true;
        return (
          `${section.type} ${section.label}`.toLowerCase().includes(term) ||
          section.groups.length > 0
        );
      });
  }, [hideZeroBalances, report, search]);

  const toggleSection = (section: string) => {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const toggleGroup = (code: string) => {
    setExpandedGroups((current) => ({ ...current, [code]: !current[code] }));
  };

  const openDrilldown = useCallback(
    async (accountCode: string) => {
      try {
        setDrilldown({ open: true, loading: true, data: null, accountCode });
        const selectedBranchId = isAdmin ? (branchId === "all" ? undefined : branchId) : userBranchId;
        const params = new URLSearchParams({
          accountCode,
          startDate,
          endDate,
        });
        if (selectedBranchId) params.set("branchId", selectedBranchId);

        const response = await fetch(
          `/api/v1/reports/statement-of-comprehensive-income-and-expenditure/drilldown?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Failed");
        const result = await response.json();
        setDrilldown({ open: true, loading: false, data: result.data, accountCode });
      } catch (error) {
        console.error("Drilldown error:", error);
        toast.error("Failed to load account details");
        setDrilldown({ open: true, loading: false, data: null, accountCode });
      }
    },
    [branchId, endDate, isAdmin, startDate, userBranchId],
  );

  const exportExcel = useCallback(async () => {
    if (!report) {
      toast.error("Generate the report first.");
      return;
    }

    try {
      const selectedBranchId = isAdmin ? (branchId === "all" ? undefined : branchId) : userBranchId;
      const params = new URLSearchParams();
      params.set("start_date", startDate);
      params.set("end_date", endDate);
      params.set("compare_start", compareStartDate);
      params.set("compare_end", compareEndDate);
      if (selectedBranchId) params.set("branchId", selectedBranchId);

      const response = await fetch(
        `/api/v1/reports/statement-of-comprehensive-income-and-expenditure/export?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Failed to export");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `statement-of-comprehensive-income-and-expenditure-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Excel workbook");
    }
  }, [branchId, compareEndDate, compareStartDate, endDate, isAdmin, report, startDate, userBranchId]);

  const printPdf = useCallback(() => {
    if (!report) {
      toast.error("Generate the report first.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1400,height=1000");
    if (!printWindow) {
      toast.error("Unable to open print window");
      return;
    }

    const renderAccountRow = (account: IncomeExpenseAccount) => {
      if (hideZeroBalances && isZero(account.current_period) && isZero(account.prior_ytd) && isZero(account.closing)) {
        return "";
      }
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${account.code} ${account.name}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.current_period)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.prior_ytd)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.closing)}</td>
        </tr>
      `;
    };

    const renderGroup = (group: IncomeExpenseGroup) => `
      <tr style="background:#f3f4f6;font-weight:700">
        <td colspan="4" style="padding:8px 10px">${group.code} ${group.name}</td>
      </tr>
      ${group.accounts.map(renderAccountRow).join("")}
      <tr style="background:#eef2ff;font-weight:700">
        <td style="padding:8px 10px">${group.name} subtotal</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.group_total.current_period)}</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.group_total.prior_ytd)}</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.group_total.closing)}</td>
      </tr>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Statement of Comprehensive Income & Expenses</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .header { border-bottom: 2px solid #cbd5e1; padding-bottom: 16px; }
            .title { margin-top: 16px; border-top: 4px solid #1e3a8a; padding-top: 10px; text-align: center; }
            .title h1 { margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; }
            .meta { color: #475569; font-size: 12px; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th { position: sticky; top: 0; background: #f8fafc; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-align: left; }
            td { font-size: 12px; }
            .section-row { background: #0f172a; color: white; font-weight: 800; text-transform: uppercase; }
            .section-row td { padding: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="text-align:center">
              <img src="${window.location.origin}/images/logo.jpg" alt="logo" style="width:72px;height:72px;object-fit:contain" />
              <div style="font-weight:900;text-transform:uppercase">${report.sacco_name}</div>
              <div class="meta">${report.location}</div>
            </div>
            <div class="title">
              <h1>${report.report_title}</h1>
              <div class="meta">Branch: ${report.branch.name}</div>
              <div class="meta">Current: ${periodLabel}</div>
              <div class="meta">Compare: ${compareLabel}</div>
              <div class="meta">Generated: ${report.report_date} ${report.generated_time}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:46%">A/C Name</th>
                <th style="width:18%;text-align:right">Current Period</th>
                <th style="width:18%;text-align:right">Prior YTD</th>
                <th style="width:18%;text-align:right">Closing</th>
              </tr>
            </thead>
            <tbody>
              ${report.sections
                .map(
                  (section) => `
                    <tr class="section-row"><td colspan="4">${section.label}</td></tr>
                    ${section.groups.map(renderGroup).join("")}
                    <tr style="font-weight:800;background:#f8fafc">
                      <td style="padding:10px">Total ${section.label}</td>
                      <td style="padding:10px;text-align:right">${currency(section.section_total.current_period)}</td>
                      <td style="padding:10px;text-align:right">${currency(section.section_total.prior_ytd)}</td>
                      <td style="padding:10px;text-align:right">${currency(section.section_total.closing)}</td>
                    </tr>
                  `,
                )
                .join("")}
              <tr style="font-weight:900;border-top:2px solid #111827">
                <td style="padding:10px">${report.net_result.label}</td>
                <td style="padding:10px;text-align:right">${currency(report.net_result.current_period)}</td>
                <td style="padding:10px;text-align:right">${currency(report.net_result.prior_ytd)}</td>
                <td style="padding:10px;text-align:right">${currency(report.net_result.closing)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 400);
  }, [compareLabel, hideZeroBalances, periodLabel, report]);

  const summary = report?.net_result;

  return (
    <>
      <ReportPageLayout
        title="Statement of Comprehensive Income & Expenses"
        description="Comparative income and expenditure report with branch filtering and drill-down."
      period={periodLabel}
      generatedAt={report ? `${report.report_date} ${report.generated_time}` : undefined}
      fitContent
      summaryFirst
      onPrint={printPdf}
      actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={fetchReport} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={!report}>
              <Download className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button onClick={printPdf} disabled={!report}>
              <FileText className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>
          </div>
        }
        filters={
          <div className="grid w-full gap-4 xl:grid-cols-6">
            <div className="min-w-0 xl:col-span-2">
              <Label>Branch</Label>
              {isAdmin ? (
                <Select value={branchId} onValueChange={setBranchId}>
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
              ) : (
                <Input value={branchLabel} disabled />
              )}
            </div>
            <div className="min-w-0">
              <Label>From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="min-w-0">
              <Label>To</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="min-w-0">
              <Label>Compare From</Label>
              <Input type="date" value={compareStartDate} onChange={(e) => setCompareStartDate(e.target.value)} />
            </div>
            <div className="min-w-0">
              <Label>Compare To</Label>
              <Input type="date" value={compareEndDate} onChange={(e) => setCompareEndDate(e.target.value)} />
            </div>
            <div className="flex min-w-0 items-end gap-2">
              <Button
                variant={hideZeroBalances ? "default" : "outline"}
                onClick={() => setHideZeroBalances((current) => !current)}
              >
                {hideZeroBalances ? "Showing zeros" : "Hide zero balances"}
              </Button>
            </div>
            <div className="xl:col-span-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, account, or group"
                />
              </div>
            </div>
          </div>
        }
        summary={
          summary ? (
            <>
              <ReportSummaryCard
                title="Net Surplus / (Deficit)"
                value={currency(summary.current_period)}
                className={summary.is_surplus ? "border-emerald-200" : "border-red-200"}
              />
              <ReportSummaryCard
                title="Prior YTD Net"
                value={currency(summary.prior_ytd)}
              />
              <ReportSummaryCard title="Accounts" value={report?.account_count || 0} />
            </>
          ) : null
        }
      >
        {loading && !report ? (
          <LoadingState />
        ) : report ? (
          <div className="min-w-0 space-y-5 p-6">
            <SaccoReportHeader
              title={report.report_title}
              subtitle="Comparative report with current period, prior YTD, and closing figures."
              branchLabel={report.branch.name}
              periodLabel={`${report.current_period.label} | Compare ${report.compare_period.label}`}
              generatedAt={`${report.report_date} ${report.generated_time}`}
              className="w-full"
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {report.sections.map((section) => (
                <SectionSummary key={section.type} section={section} />
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))] gap-0 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                <div className="flex min-w-0 items-center gap-2">
                  <span>A/C Name</span>
                </div>
                <div className="text-right">Current Period</div>
                <div className="text-right">Prior YTD</div>
                <div className="text-right">Closing</div>
              </div>

              <div className="max-h-[70vh] overflow-auto">
                {activeSections.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No records match the selected filters.
                  </div>
                ) : (
                  activeSections.map((section) => (
                    <div key={section.type} className="border-b border-slate-100">
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.2em] text-white ${section.type === "INCOME" ? "bg-emerald-700" : "bg-rose-700"}`}
                        onClick={() => toggleSection(section.type)}
                      >
                        <span>{section.label}</span>
                        {expandedSections[section.type] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>

                      {expandedSections[section.type] && (
                        <div>
                          {section.groups.map((group) => {
                            const expanded = expandedGroups[group.code] ?? true;
                            return (
                              <Collapsible
                                key={group.code}
                                open={expanded}
                                onOpenChange={() => toggleGroup(group.code)}
                              >
                                <CollapsibleTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-900"
                                  >
                                    <span>
                                      {group.code} {group.name}
                                    </span>
                                    {expanded ? (
                                      <ChevronDown className="h-4 w-4 text-slate-500" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-slate-500" />
                                    )}
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  {group.accounts.map((account) => (
                                    <button
                                      key={account.code}
                                      type="button"
                                      onClick={() => void openDrilldown(account.code)}
                                      className="grid w-full grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))] gap-0 border-b border-slate-100 px-4 py-2 text-left text-sm hover:bg-slate-50"
                                    >
                                      <div className="min-w-0">
                                        <div className="font-medium text-slate-900">
                                          {account.code} {account.name}
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                          Journal lines: {account.journal_count}
                                        </div>
                                      </div>
                                      <div className={`min-w-0 text-right tabular-nums ${account.current_period < 0 ? "text-red-600" : "text-slate-700"}`}>
                                        {currency(account.current_period)}
                                      </div>
                                      <div className={`min-w-0 text-right tabular-nums ${account.prior_ytd < 0 ? "text-red-600" : "text-slate-700"}`}>
                                        {currency(account.prior_ytd)}
                                      </div>
                                      <div className={`min-w-0 text-right tabular-nums font-semibold ${account.closing < 0 ? "text-red-700" : "text-slate-950"}`}>
                                        {currency(account.closing)}
                                      </div>
                                    </button>
                                  ))}

                                  <div className="flex items-center justify-between bg-indigo-50 px-4 py-2 text-sm font-semibold">
                                    <span>{group.name} subtotal</span>
                                    <div className="grid grid-cols-3 gap-4 text-right tabular-nums">
                                      <span>{currency(group.group_total.current_period)}</span>
                                      <span>{currency(group.group_total.prior_ytd)}</span>
                                      <span>{currency(group.group_total.closing)}</span>
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}

                          <div className={`grid grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))] gap-0 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white ${section.type === "INCOME" ? "bg-emerald-900" : "bg-rose-900"}`}>
                            <span>Total {section.label}</span>
                            <span className="text-right tabular-nums">{currency(section.section_total.current_period)}</span>
                            <span className="text-right tabular-nums">{currency(section.section_total.prior_ytd)}</span>
                            <span className="text-right tabular-nums">{currency(section.section_total.closing)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SectionBadge label="Total" value={report.account_count} />
              <SectionBadge label="Expense Accounts" value={report.expense_account_count} />
              <SectionBadge label="Branch" value={report.branch.name} />
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            No report data available. Generate the report to view balances.
          </div>
        )}
      </ReportPageLayout>

      <Sheet
        open={drilldown.open}
        onOpenChange={(open) => setDrilldown((current) => ({ ...current, open }))}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Account Drill-down</SheetTitle>
            <SheetDescription>
              Individual journal lines for the selected account and reporting period.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {drilldown.loading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : drilldown.data ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    {drilldown.data.account.code} {drilldown.data.account.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {drilldown.data.period.label} | Branch: {drilldown.data.branch.name}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Debit</div>
                      <div className="font-semibold tabular-nums">{currency(drilldown.data.totals.debit)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Credit</div>
                      <div className="font-semibold tabular-nums">{currency(drilldown.data.totals.credit)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Balance</div>
                      <div className="font-semibold tabular-nums">{currency(drilldown.data.totals.balance)}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {drilldown.data.entries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-muted-foreground">
                      No journal lines were found for this account in the selected period.
                    </div>
                  ) : (
                    drilldown.data.entries.map((entry, index) => (
                      <div key={`${entry.date}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {entry.reference || "No reference"}
                            </div>
                            <div className="text-xs text-slate-500">{entry.date}</div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-semibold tabular-nums">Dr {currency(entry.debit)}</div>
                            <div className="font-semibold tabular-nums">Cr {currency(entry.credit)}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-slate-700">{entry.description}</div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-muted-foreground">
                Select an account row to view the journal entries.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
