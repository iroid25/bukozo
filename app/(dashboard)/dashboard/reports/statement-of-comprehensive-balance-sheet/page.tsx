"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  RefreshCw,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";

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
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import type {
  ComprehensiveBalanceSheetAccount,
  ComprehensiveBalanceSheetGroup,
  ComprehensiveBalanceSheetReport,
  ComprehensiveBalanceSheetSection,
  ComprehensiveBalanceSheetDrilldown,
} from "@/lib/reports/statement-of-comprehensive-balance-sheet";

type BranchOption = { id: string; name: string };

type DrilldownState = {
  open: boolean;
  loading: boolean;
  data: ComprehensiveBalanceSheetDrilldown | null;
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

function getCurrentPeriodDefaults() {
  const now = new Date();
  const currentStart = startOfMonth(now);
  const currentEnd = now;
  const compareEnd = subMonths(currentStart, 1);
  return {
    startDate: format(currentStart, "yyyy-MM-dd"),
    endDate: format(currentEnd, "yyyy-MM-dd"),
    compareStartDate: format(startOfMonth(compareEnd), "yyyy-MM-dd"),
    compareEndDate: format(endOfMonth(compareEnd), "yyyy-MM-dd"),
  };
}

function LoadingState() {
  return (
    <div className="space-y-4 p-6">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
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

function SectionSummary({ section }: { section: ComprehensiveBalanceSheetSection }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              {section.section}
            </div>
            <div className="text-lg font-black text-slate-950">{section.label}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Section Total
            </div>
            <div className="text-2xl font-black tabular-nums text-slate-950">
              {currency(section.section_total)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StatementOfComprehensiveBalanceSheetPage() {
  const { data: session } = useSession();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [startDate, setStartDate] = useState(getCurrentPeriodDefaults().startDate);
  const [endDate, setEndDate] = useState(getCurrentPeriodDefaults().endDate);
  const [compareStartDate, setCompareStartDate] = useState(
    getCurrentPeriodDefaults().compareStartDate,
  );
  const [compareEndDate, setCompareEndDate] = useState(
    getCurrentPeriodDefaults().compareEndDate,
  );
  const [search, setSearch] = useState("");
  const [hideZeroBalances, setHideZeroBalances] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ComprehensiveBalanceSheetReport | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ASSET: true,
    LIABILITY: true,
    EQUITY: true,
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
      setBranches((result.data || []).map((branch: any) => ({
        id: branch.id,
        name: branch.name,
      })));
    } catch (error) {
      console.error("Failed to fetch branches", error);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
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
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${format(start, "dd MMM yyyy")} to ${format(end, "dd MMM yyyy")}`;
  }, [endDate, startDate]);

  const compareLabel = useMemo(() => {
    const start = new Date(compareStartDate);
    const end = new Date(compareEndDate);
    return `${format(start, "dd MMM yyyy")} to ${format(end, "dd MMM yyyy")}`;
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

      const response = await fetch(`/api/v1/reports/statement-of-comprehensive-balance-sheet?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load report");
      }

      const result = await response.json();
      setReport(result.data);
    } catch (error) {
      console.error("Balance sheet report error:", error);
      toast.error("Failed to load statement of comprehensive balance sheet");
    } finally {
      setLoading(false);
    }
  }, [branchId, compareEndDate, compareStartDate, endDate, isAdmin, startDate, userBranchId]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const activeSections = useMemo(() => {
    if (!report) return [];
    return report.sections.filter((section) => {
      if (!search.trim()) return true;
      const term = search.trim().toLowerCase();
      return (
        section.label.toLowerCase().includes(term) ||
        section.groups.some((group) =>
          group.name.toLowerCase().includes(term) ||
          group.accounts.some((account) =>
            `${account.code} ${account.name}`.toLowerCase().includes(term),
          ),
        )
      );
    });
  }, [report, search]);

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

        const response = await fetch(`/api/v1/reports/statement-of-comprehensive-balance-sheet/drilldown?${params.toString()}`, {
          cache: "no-store",
        });
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

  const exportExcel = useCallback(() => {
    if (!report) {
      toast.error("Generate the report first.");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const rows: any[] = [];
    rows.push([REPORT_HEADER_DETAILS.institutionName]);
    rows.push([REPORT_HEADER_DETAILS.registrationNumber]);
    rows.push([REPORT_HEADER_DETAILS.postalAddress.join(", ")]);
    rows.push([REPORT_HEADER_DETAILS.contacts.join(" / "), REPORT_HEADER_DETAILS.email]);
    rows.push([]);
    rows.push(["Statement of Comprehensive Balance Sheet"]);
    rows.push([`Branch: ${branchLabel}`]);
    rows.push([`Current Period: ${periodLabel}`]);
    rows.push([`Compare Period: ${compareLabel}`]);
    rows.push([]);
    rows.push(["A/C Name", `${report.compare_period.label} Balance`, `${report.current_period.label} Movement`, `${report.current_period.label} Closing`]);

    report.sections.forEach((section) => {
      rows.push([section.label]);
      section.groups.forEach((group) => {
        rows.push([`${group.code} ${group.name}`]);
        group.accounts.forEach((account) => {
          if (hideZeroBalances && isZero(account.compare_balance) && isZero(account.movement) && isZero(account.closing_balance)) {
            return;
          }
          rows.push([
            `${account.code} ${account.name}`,
            account.compare_balance,
            account.movement,
            account.closing_balance,
          ]);
        });
        rows.push([`${group.name} subtotal`, group.group_total.compare_balance, group.group_total.movement, group.group_total.closing_balance]);
      });
      rows.push([`${section.label} total`, section.section_total_compare, section.section_total_movement, section.section_total]);
      rows.push([]);
    });

    rows.push(["Grand Total", report.grand_total.total_assets, report.grand_total.total_liabilities, report.grand_total.total_equity, report.grand_total.net_balance]);

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 3 } },
    ];

    XLSX.utils.book_append_sheet(workbook, sheet, "Balance Sheet");
    XLSX.writeFile(
      workbook,
      `statement-of-comprehensive-balance-sheet-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`,
    );
  }, [branchLabel, compareLabel, hideZeroBalances, periodLabel, report]);

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

    const renderAccountRow = (account: ComprehensiveBalanceSheetAccount) => {
      if (hideZeroBalances && isZero(account.compare_balance) && isZero(account.movement) && isZero(account.closing_balance)) {
        return "";
      }
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${account.code} ${account.name}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.compare_balance)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.movement)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.closing_balance)}</td>
        </tr>
      `;
    };

    const renderGroup = (group: ComprehensiveBalanceSheetGroup) => `
      <tr style="background:#f3f4f6;font-weight:700">
        <td colspan="4" style="padding:8px 10px">${group.code} ${group.name}</td>
      </tr>
      ${group.accounts.map(renderAccountRow).join("")}
      <tr style="background:#eef2ff;font-weight:700">
        <td style="padding:8px 10px">${group.name} subtotal</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.group_total.compare_balance)}</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.group_total.movement)}</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.group_total.closing_balance)}</td>
      </tr>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Statement of Comprehensive Balance Sheet</title>
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
              <img src="${window.location.origin}${REPORT_HEADER_DETAILS.logoPath}" alt="logo" style="width:72px;height:72px;object-fit:contain" />
              <div style="font-weight:900;text-transform:uppercase">${REPORT_HEADER_DETAILS.institutionName}</div>
              <div class="meta">${REPORT_HEADER_DETAILS.registrationNumber}</div>
              <div class="meta">${REPORT_HEADER_DETAILS.postalAddress.join(", ")}</div>
              <div class="meta">${REPORT_HEADER_DETAILS.contacts.join(" / ")} | ${REPORT_HEADER_DETAILS.email}</div>
            </div>
            <div class="title">
              <h1>Statement of Comprehensive Balance Sheet</h1>
              <div class="meta">Branch: ${branchLabel}</div>
              <div class="meta">Current: ${periodLabel}</div>
              <div class="meta">Compare: ${compareLabel}</div>
              <div class="meta">Generated: ${format(new Date(report.generated_at), "dd MMM yyyy, HH:mm")}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:55%">A/C Name</th>
                <th style="width:15%;text-align:right">${report.compare_period.label} Balance</th>
                <th style="width:15%;text-align:right">${report.current_period.label} Movement</th>
                <th style="width:15%;text-align:right">${report.current_period.label} Closing</th>
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
                      <td style="padding:10px;text-align:right">${currency(section.section_total_compare)}</td>
                      <td style="padding:10px;text-align:right">${currency(section.section_total_movement)}</td>
                      <td style="padding:10px;text-align:right">${currency(section.section_total)}</td>
                    </tr>
                  `,
                )
                .join("")}
              <tr style="font-weight:900;border-top:2px solid #111827">
                <td style="padding:10px">Grand Total</td>
                <td style="padding:10px;text-align:right">${currency(report.grand_total.total_assets)}</td>
                <td style="padding:10px;text-align:right">${currency(report.grand_total.total_liabilities)}</td>
                <td style="padding:10px;text-align:right">${currency(report.grand_total.net_balance)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 400);
  }, [branchLabel, compareLabel, hideZeroBalances, periodLabel, report]);

  const summary = report?.grand_total;

  return (
    <>
      <ReportPageLayout
        title="Statement of Comprehensive Balance Sheet"
      description="Comparative balance sheet with branch filtering, collapsible hierarchy, and journal drill-down."
      period={periodLabel}
      generatedAt={report ? format(new Date(report.generated_at), "dd MMM yyyy, HH:mm") : undefined}
      fitContent
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
              <Button variant={hideZeroBalances ? "default" : "outline"} onClick={() => setHideZeroBalances((current) => !current)}>
                {hideZeroBalances ? "Showing zeros" : "Hide zero balances"}
              </Button>
            </div>
            <div className="min-w-0 xl:col-span-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code or account name"
                />
              </div>
            </div>
          </div>
        }
        summary={
          summary ? (
            <>
              <ReportSummaryCard title="Total Assets" value={currency(summary.total_assets)} />
              <ReportSummaryCard title="Total Liabilities" value={currency(summary.total_liabilities)} />
              <ReportSummaryCard title="Total Equity" value={currency(summary.total_equity)} />
              <ReportSummaryCard title="Net Balance" value={currency(summary.net_balance)} />
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
              subtitle="Comparative report with prior month closing, current movement, and current closing."
              branchLabel={report.branch.name}
              periodLabel={`${report.current_period.label} | Compare ${report.compare_period.label}`}
              generatedAt={format(new Date(report.generated_at), "dd MMM yyyy, HH:mm")}
              className="w-full"
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {report.sections.map((section) => (
                <SectionSummary key={section.section} section={section} />
              ))}
            </div>

            <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-0 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                <div className="flex min-w-0 items-center gap-2">
                  <span>A/C Name</span>
                </div>
                <div className="text-right">{report.compare_period.label} Balance</div>
                <div className="text-right">{report.current_period.label} Movement</div>
                <div className="text-right">{report.current_period.label} Closing</div>
              </div>

              <div className="max-h-[70vh] overflow-auto">
                {activeSections.map((section) => (
                  <div key={section.section} className="border-b border-slate-100">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between bg-emerald-700 px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.2em] text-white"
                      onClick={() => toggleSection(section.section)}
                    >
                      <span>{section.label}</span>
                      {expandedSections[section.section] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    {expandedSections[section.section] && (
                      <div>
                        {section.groups.map((group) => (
                          <Collapsible
                            key={group.code}
                            open={expandedGroups[group.code] ?? true}
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
                                {(expandedGroups[group.code] ?? true) ? (
                                  <ChevronDown className="h-4 w-4 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-500" />
                                )}
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              {group.accounts
                                .filter((account) => {
                                  if (!search.trim()) return true;
                                  const term = search.trim().toLowerCase();
                                  return `${account.code} ${account.name}`.toLowerCase().includes(term);
                                })
                                .filter((account) => {
                                  if (!hideZeroBalances) return true;
                                  return !(
                                    isZero(account.compare_balance) &&
                                    isZero(account.movement) &&
                                    isZero(account.closing_balance)
                                  );
                                })
                                .map((account) => (
                                  <button
                                    key={account.code}
                                    type="button"
                                    onClick={() => openDrilldown(account.code)}
                                    className="grid w-full grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-0 border-b border-slate-100 px-4 py-2 text-left text-sm hover:bg-slate-50"
                                  >
                                    <div className="min-w-0">
                                      <div className="font-medium text-slate-900">
                                        {account.code} {account.name}
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        Journal lines: {account.journal_count}
                                      </div>
                                    </div>
                                    <div className={`min-w-0 text-right tabular-nums ${account.compare_balance < 0 ? "text-red-600" : "text-slate-700"}`}>
                                      {currency(account.compare_balance)}
                                    </div>
                                    <div className={`min-w-0 text-right tabular-nums ${account.movement < 0 ? "text-red-600" : "text-slate-700"}`}>
                                      {currency(account.movement)}
                                    </div>
                                    <div className={`min-w-0 text-right tabular-nums font-semibold ${account.closing_balance < 0 ? "text-red-700" : "text-slate-950"}`}>
                                      {currency(account.closing_balance)}
                                    </div>
                                  </button>
                                ))}
                              <div className="grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-0 bg-indigo-50 px-4 py-2 text-sm font-semibold">
                                <span>{group.name} subtotal</span>
                                <span className="text-right tabular-nums">{currency(group.group_total.compare_balance)}</span>
                                <span className="text-right tabular-nums">{currency(group.group_total.movement)}</span>
                                <span className="text-right tabular-nums">{currency(group.group_total.closing_balance)}</span>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                        <div className="grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-0 bg-slate-950 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white">
                          <span>Total {section.label}</span>
                          <span className="text-right tabular-nums">{currency(section.section_total_compare)}</span>
                          <span className="text-right tabular-nums">{currency(section.section_total_movement)}</span>
                          <span className="text-right tabular-nums">{currency(section.section_total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            No report data available. Generate the report to view balances.
          </div>
        )}
      </ReportPageLayout>

      <Sheet open={drilldown.open} onOpenChange={(open) => setDrilldown((current) => ({ ...current, open }))}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
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
                            <div className="text-sm font-semibold text-slate-900">{entry.reference || "No reference"}</div>
                            <div className="text-xs text-slate-500">{entry.date}</div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-semibold tabular-nums">Dr {currency(entry.debit)}</div>
                            <div className="font-semibold tabular-nums">Cr {currency(entry.credit)}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-slate-700">{entry.description}</div>
                        <div className="mt-1 text-xs text-slate-500">{entry.narration}</div>
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
