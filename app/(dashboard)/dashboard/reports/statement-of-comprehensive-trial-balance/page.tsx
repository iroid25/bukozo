"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { format, startOfMonth, subDays } from "date-fns";
import { ChevronDown, ChevronRight, Download, FileText, RefreshCw, Search } from "lucide-react";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { TrialBalanceAccount, TrialBalanceReport, TrialBalanceSection, TrialBalanceGroup } from "@/lib/reports/trial-balance-report";

type BranchOption = { id: string; name: string };

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
  const start = startOfMonth(now);
  const compareEnd = subDays(start, 1);
  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(now, "yyyy-MM-dd"),
    compareLabel: format(compareEnd, "MMMM-yyyy"),
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

function SectionSummary({ section }: { section: TrialBalanceSection }) {
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
              Closing
            </div>
            <div className="text-2xl font-black tabular-nums text-slate-950">
              {currency(section.total.current_closing)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StatementOfComprehensiveTrialBalancePage() {
  const { data: session } = useSession();
  const defaults = useMemo(() => getDefaults(), []);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [search, setSearch] = useState("");
  const [hideZeroBalances, setHideZeroBalances] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ASSETS: true,
    LIABILITIES: true,
    EQUITY: true,
    INCOME: true,
    EXPENDITURES: true,
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const selectedBranchId = isAdmin ? (branchId === "all" ? undefined : branchId) : userBranchId;
      const params = new URLSearchParams();
      params.set("start_date", startDate);
      params.set("end_date", endDate);
      if (selectedBranchId) params.set("branchId", selectedBranchId);

      const response = await fetch(
        `/api/v1/reports/statement-of-comprehensive-trial-balance?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error("Failed to load report");
      }

      const result = await response.json();
      setReport(result.data);
    } catch (error) {
      console.error("Trial balance report error:", error);
      toast.error("Failed to load statement of comprehensive trial balance");
    } finally {
      setLoading(false);
    }
  }, [branchId, endDate, isAdmin, startDate, userBranchId]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const filteredSections = useMemo(() => {
    if (!report) return [];
    const term = search.trim().toLowerCase();
    return report.sections
      .map((section) => ({
        ...section,
        groups: section.groups
          .map((group) => ({
            ...group,
            accounts: group.accounts.filter((account) => {
              if (hideZeroBalances && isZero(account.prior_closing) && isZero(account.current_movement) && isZero(account.current_closing)) {
                return false;
              }
              if (!term) return true;
              return `${account.code} ${account.name} ${account.group_name}`.toLowerCase().includes(term);
            }),
          }))
          .filter((group) => group.accounts.length > 0 || !term ? true : `${group.code} ${group.name}`.toLowerCase().includes(term)),
      }))
      .filter((section) => section.groups.length > 0 || !term ? true : `${section.label} ${section.section}`.toLowerCase().includes(term));
  }, [hideZeroBalances, report, search]);

  const toggleSection = (section: string) => {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const toggleGroup = (code: string) => {
    setExpandedGroups((current) => ({ ...current, [code]: !current[code] }));
  };

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
      if (selectedBranchId) params.set("branchId", selectedBranchId);

      const response = await fetch(
        `/api/v1/reports/statement-of-comprehensive-trial-balance/export?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Failed to export");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `statement-of-comprehensive-trial-balance-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Excel workbook");
    }
  }, [branchId, endDate, isAdmin, report, startDate, userBranchId]);

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

    const renderAccountRow = (account: TrialBalanceAccount) => {
      if (hideZeroBalances && isZero(account.prior_closing) && isZero(account.current_movement) && isZero(account.current_closing)) {
        return "";
      }
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${account.code} ${account.name}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.prior_closing)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.current_movement)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.current_closing)}</td>
        </tr>
      `;
    };

    const renderGroup = (group: TrialBalanceGroup) => `
      <tr style="background:#f3f4f6;font-weight:700">
        <td colspan="4" style="padding:8px 10px">${group.code} ${group.name}</td>
      </tr>
      ${group.accounts.map(renderAccountRow).join("")}
      <tr style="background:#eef2ff;font-weight:700">
        <td style="padding:8px 10px">${group.name} subtotal</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.total.prior_closing)}</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.total.current_movement)}</td>
        <td style="padding:8px 10px;text-align:right">${currency(group.total.current_closing)}</td>
      </tr>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Statement of Comprehensive Trial Balance</title>
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
              <div class="meta">Period: ${periodLabel}</div>
              <div class="meta">Generated: ${report.report_date} ${report.generated_time}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:46%">A/C Name</th>
                <th style="width:18%;text-align:right">${report.prior_period.label}</th>
                <th style="width:18%;text-align:right">${report.current_period.label}</th>
                <th style="width:18%;text-align:right">${report.current_period.label} Closing</th>
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
                      <td style="padding:10px;text-align:right">${currency(section.total.prior_closing)}</td>
                      <td style="padding:10px;text-align:right">${currency(section.total.current_movement)}</td>
                      <td style="padding:10px;text-align:right">${currency(section.total.current_closing)}</td>
                    </tr>
                  `,
                )
                .join("")}
              <tr style="font-weight:900;border-top:2px solid #111827">
                <td style="padding:10px">Proof</td>
                <td style="padding:10px;text-align:right">${currency(report.proof.debits_total)}</td>
                <td style="padding:10px;text-align:right">${currency(report.proof.credits_total)}</td>
                <td style="padding:10px;text-align:right">${currency(report.proof.difference)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 400);
  }, [hideZeroBalances, periodLabel, report]);

  const proof = report?.proof;

  return (
    <ReportPageLayout
      title="Statement of Comprehensive Trial Balance"
      description="Master verification report across assets, liabilities, equity, income, and expenses."
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
        <div className="grid w-full gap-4 xl:grid-cols-5">
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
          <div className="flex min-w-0 items-end gap-2">
            <Button
              variant={hideZeroBalances ? "default" : "outline"}
              onClick={() => setHideZeroBalances((current) => !current)}
            >
              {hideZeroBalances ? "Showing zeros" : "Hide zero balances"}
            </Button>
          </div>
          <div className="xl:col-span-1">
            <Label>Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or account"
              />
            </div>
          </div>
        </div>
      }
      summary={
        proof ? (
          <>
            <ReportSummaryCard title="Debits" value={currency(proof.debits_total)} />
            <ReportSummaryCard title="Credits" value={currency(proof.credits_total)} />
            <ReportSummaryCard
              title="Proof"
              value={currency(proof.difference)}
              className={proof.is_balanced ? "border-emerald-200" : "border-red-200"}
              subValue={proof.is_balanced ? "Balanced" : "Not balanced"}
            />
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
            subtitle="Master verification report across all account classes."
            branchLabel={report.branch.name}
            periodLabel={report.current_period.label}
            generatedAt={`${report.report_date} ${report.generated_time}`}
            className="w-full"
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {report.sections.map((section) => (
              <SectionSummary key={section.section} section={section} />
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))] gap-0 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
              <div className="flex min-w-0 items-center gap-2">
                <span>A/C Name</span>
              </div>
              <div className="text-right">{report.prior_period.label}</div>
              <div className="text-right">{report.current_period.label}</div>
              <div className="text-right">{report.current_period.label} Closing</div>
            </div>

            <div className="max-h-[70vh] overflow-auto">
              {filteredSections.map((section) => (
                <div key={section.section} className="border-b border-slate-100">
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.2em] text-white ${section.section === "ASSETS" ? "bg-blue-700" : section.section === "LIABILITIES" ? "bg-orange-700" : section.section === "EQUITY" ? "bg-violet-700" : section.section === "INCOME" ? "bg-emerald-700" : "bg-rose-700"}`}
                    onClick={() => toggleSection(section.section)}
                  >
                    <span>{section.label}</span>
                    {expandedSections[section.section] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {expandedSections[section.section] && (
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
                                  <div className={`min-w-0 text-right tabular-nums ${account.prior_closing < 0 ? "text-red-600" : "text-slate-700"}`}>
                                    {currency(account.prior_closing)}
                                  </div>
                                  <div className={`min-w-0 text-right tabular-nums ${account.current_movement < 0 ? "text-red-600" : "text-slate-700"}`}>
                                    {currency(account.current_movement)}
                                  </div>
                                  <div className={`min-w-0 text-right tabular-nums font-semibold ${account.current_closing < 0 ? "text-red-700" : "text-slate-950"}`}>
                                    {currency(account.current_closing)}
                                  </div>
                                </button>
                              ))}

                              <div className="flex items-center justify-between bg-indigo-50 px-4 py-2 text-sm font-semibold">
                                <span>{group.name} subtotal</span>
                                <div className="grid grid-cols-3 gap-4 text-right tabular-nums">
                                  <span>{currency(group.total.prior_closing)}</span>
                                  <span>{currency(group.total.current_movement)}</span>
                                  <span>{currency(group.total.current_closing)}</span>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}

                      <div className="grid grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))] gap-0 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white bg-slate-950">
                        <span>Total {section.label}</span>
                        <span className="text-right tabular-nums">{currency(section.total.prior_closing)}</span>
                        <span className="text-right tabular-nums">{currency(section.total.current_movement)}</span>
                        <span className="text-right tabular-nums">{currency(section.total.current_closing)}</span>
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
  );
}
