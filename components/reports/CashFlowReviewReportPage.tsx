"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

type BranchOption = { id: string; name: string };

type ReviewAccount = {
  id: string;
  accountCode: string;
  accountName: string;
  parentId: string | null;
  ledgerType: string;
  period1Balance: number;
  period2Balance: number;
  netChange: number;
  growthPercent: number;
  displayPeriod1: number;
  displayPeriod2: number;
  displayNetChange: number;
  children: ReviewAccount[];
};

type ReviewSection = {
  section: string;
  label: string;
  accounts: ReviewAccount[];
  count: number;
  totalPeriod1: number;
  totalPeriod2: number;
  totalNetChange: number;
  growthPercent: number;
};

type ReviewReport = {
  saccoName: string;
  location: string;
  reportTitle: string;
  generatedDate: string;
  generatedTime: string;
  branch: { id: string | "all"; name: string };
  period1: { from: string; to: string; label: string };
  period2: { from: string; to: string; label: string };
  sections: ReviewSection[];
  grandTotal: {
    totalAccounts: number;
    totalPeriod1: number;
    totalPeriod2: number;
    totalNetChange: number;
    growthPercent: number;
  };
  profitLoss?: { profitLoss: number; label: string };
};

function currency(value: number) {
  const amount = Number(value || 0);
  const negative = amount < 0;
  return `${negative ? "(" : ""}${new Intl.NumberFormat("en-UG", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(amount))}${negative ? ")" : ""}`;
}

function flattenSectionRows(
  accounts: ReviewAccount[],
  depth = 0,
): Array<{ node: ReviewAccount; depth: number }> {
  return accounts.flatMap((account) => [
    { node: account, depth },
    ...flattenSectionRows(account.children || [], depth + 1),
  ]);
}

function defaultRange() {
  const now = new Date();
  const currentStart = new Date(now.getFullYear(), 0, 1);
  const previousStart = new Date(now.getFullYear() - 1, 0, 1);
  const previousEnd = new Date(now.getFullYear() - 1, 11, 31);
  return {
    period1Start: format(previousStart, "yyyy-MM-dd"),
    period1End: format(previousEnd, "yyyy-MM-dd"),
    period2Start: format(currentStart, "yyyy-MM-dd"),
    period2End: format(now, "yyyy-MM-dd"),
  };
}

export function CashFlowReviewReportPage({
  title,
  description,
  endpoint,
  reportTitle,
}: {
  title: string;
  description: string;
  endpoint: string;
  reportTitle: string;
}) {
  const { data: session } = useSession();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [filters, setFilters] = useState({
    branchId: "all",
    ...defaultRange(),
  });

  const userRole = String((session?.user as any)?.role || "").toUpperCase();
  const userBranchId = (session?.user as any)?.branchId || "all";
  const isAdmin = userRole === "ADMIN";
  const exportEndpoint = `${endpoint.replace(/\/$/, "")}/export`;

  useEffect(() => {
    if (!isAdmin) {
      setFilters((current) => ({ ...current, branchId: userBranchId }));
    }
  }, [isAdmin, userBranchId]);

  useEffect(() => {
    async function loadBranches() {
      try {
        const response = await fetch("/api/v1/branches", { cache: "no-store" });
        if (!response.ok) return;
        const json = await response.json();
        setBranches(
          Array.isArray(json?.data)
            ? json.data.map((branch: any) => ({
                id: branch.id,
                name: branch.name,
              }))
            : [],
        );
      } catch (error) {
        console.error("Failed to load branches", error);
      }
    }

    void loadBranches();
  }, []);

  async function fetchReportData(active: typeof filters) {
    const params = new URLSearchParams();
    params.set("period1Start", active.period1Start);
    params.set("period1End", active.period1End);
    params.set("period2Start", active.period2Start);
    params.set("period2End", active.period2End);
    if (isAdmin ? active.branchId !== "all" : userBranchId) {
      params.set("branchId", isAdmin ? active.branchId : userBranchId);
    }

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error || "Failed to load report");
    return json.data as ReviewReport;
  }

  async function loadReport(override?: typeof filters) {
    const active = override || filters;
    setLoading(true);
    try {
      const data = await fetchReportData(active);
      setReport(data);
      setCollapsedSections({});
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load report",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exportExcel() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("period1Start", filters.period1Start);
      params.set("period1End", filters.period1End);
      params.set("period2Start", filters.period2Start);
      params.set("period2End", filters.period2End);
      if (isAdmin ? filters.branchId !== "all" : userBranchId) {
        params.set("branchId", isAdmin ? filters.branchId : userBranchId);
      }

      const response = await fetch(`${exportEndpoint}?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error || "Excel export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${reportTitle.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export cash flow review report", error);
      toast.error(error instanceof Error ? error.message : "Excel export failed");
    } finally {
      setExporting(false);
    }
  }

  function printPdf() {
    const openPrintWindow = (activeReport: ReviewReport) => {
      const win = window.open("", "_blank", "width=1200,height=1000");
      if (!win) {
        toast.error("Unable to open print window");
        return;
      }

      const renderRows = (accounts: ReviewAccount[], depth = 0): string =>
        accounts
          .map(
            (account) => `
          <tr>
            <td style="padding:6px 8px 6px ${12 + depth * 18}px;border-bottom:1px solid #e5e7eb">${account.accountCode} ${account.accountName}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.displayPeriod1)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.displayPeriod2)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(account.displayNetChange)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${account.growthPercent.toFixed(2)}%</td>
          </tr>
          ${renderRows(account.children || [], depth + 1)}
        `,
          )
          .join("");

      win.document.write(`
      <html>
        <head>
          <title>${activeReport.reportTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .header { text-align: center; margin-bottom: 16px; }
            .header h1 { margin: 8px 0; font-size: 22px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #0f172a; color: white; padding: 8px; text-align: left; }
            .section td { background: #14532d; color: white; font-weight: 700; padding: 8px 10px; }
            .total td { font-weight: 700; background: #f8fafc; }
            .grand td { font-weight: 800; border-top: 2px solid #111827; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>${activeReport.saccoName}</div>
            <div>${activeReport.location}</div>
            <h1>${activeReport.reportTitle}</h1>
            <div>Branch: ${activeReport.branch.name}</div>
            <div>Period 1: ${activeReport.period1.label}</div>
            <div>Period 2: ${activeReport.period2.label}</div>
            <div>Generated: ${activeReport.generatedDate} ${activeReport.generatedTime}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Account code and name</th>
                <th style="text-align:right">Period 1 balance</th>
                <th style="text-align:right">Period 2 balance</th>
                <th style="text-align:right">Net Change</th>
                <th style="text-align:right">% Growth</th>
              </tr>
            </thead>
            <tbody>
              ${activeReport.sections
                .map(
                  (section) => `
                    <tr class="section"><td colspan="5">${section.label}</td></tr>
                    ${renderRows(section.accounts)}
                    <tr class="total">
                      <td style="padding:8px 10px">Total - ${section.label}: ${section.count}</td>
                      <td style="padding:8px 10px;text-align:right">${currency(section.totalPeriod1)}</td>
                      <td style="padding:8px 10px;text-align:right">${currency(section.totalPeriod2)}</td>
                      <td style="padding:8px 10px;text-align:right">${currency(section.totalNetChange)}</td>
                      <td style="padding:8px 10px;text-align:right">${section.growthPercent.toFixed(2)}%</td>
                    </tr>
                  `,
                )
                .join("")}
              <tr class="grand">
                <td style="padding:8px 10px">Grand Total</td>
                <td style="padding:8px 10px;text-align:right">${currency(activeReport.grandTotal.totalPeriod1)}</td>
                <td style="padding:8px 10px;text-align:right">${currency(activeReport.grandTotal.totalPeriod2)}</td>
                <td style="padding:8px 10px;text-align:right">${currency(activeReport.grandTotal.totalNetChange)}</td>
                <td style="padding:8px 10px;text-align:right">${activeReport.grandTotal.growthPercent.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
      win.document.close();
      win.focus();
      win.setTimeout(() => win.print(), 300);
    };

    if (report) {
      openPrintWindow(report);
      return;
    }

    void (async () => {
      try {
        const fresh = await fetchReportData(filters);
        setReport(fresh);
        openPrintWindow(fresh);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Failed to prepare print view");
      }
    })();
  }

  const summaryCards = report
    ? [
        {
          title: "Accounts",
          value: report.grandTotal.totalAccounts.toLocaleString(),
        },
        { title: "Period 1", value: currency(report.grandTotal.totalPeriod1) },
        { title: "Period 2", value: currency(report.grandTotal.totalPeriod2) },
        {
          title: "Net Change",
          value: currency(report.grandTotal.totalNetChange),
        },
      ]
    : [];

  return (
    <ReportPageLayout
      title={title}
      description={description}
      period={
        report
          ? `${report.period1.label} vs ${report.period2.label}`
          : `${filters.period1Start} vs ${filters.period2Start}`
      }
      generatedAt={
        report ? `${report.generatedDate} ${report.generatedTime}` : undefined
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void loadReport()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Generate Report
          </Button>
          <Button
            variant="outline"
            onClick={exportExcel}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
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
            <Label>Period 1 Start</Label>
            <Input
              value={filters.period1Start}
              type="date"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  period1Start: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label>Period 1 End</Label>
            <Input
              value={filters.period1End}
              type="date"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  period1End: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label>Period 2 Start</Label>
            <Input
              value={filters.period2Start}
              type="date"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  period2Start: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label>Period 2 End</Label>
            <Input
              value={filters.period2End}
              type="date"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  period2End: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label>Branch</Label>
            <Select
              value={filters.branchId}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, branchId: value }))
              }
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
      summary={
        report ? (
          <>
            {summaryCards.map((card) => (
              <ReportSummaryCard key={card.title} title={card.title} value={card.value} className="h-full" />
            ))}
          </>
        ) : null
      }
      fitContent
    >
      {report ? (
        <div className="space-y-4 pb-6">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-[minmax(10rem,1.3fr)_minmax(11rem,1fr)_minmax(11rem,1fr)_minmax(11rem,0.9fr)_minmax(7rem,0.7fr)] border-b bg-slate-50 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:px-4 sm:text-xs">
                <div>Account code and name</div>
                <div className="text-right">Period 1 balance</div>
                <div className="text-right">Period 2 balance</div>
                <div className="text-right">Net Change</div>
                <div className="text-right">% Growth</div>
              </div>
            </CardContent>
          </Card>

          {!report.grandTotal.totalAccounts ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              No accounts were found for the selected periods.
            </div>
          ) : null}

          {report.sections.map((section) => (
            <Card
              key={section.section}
              className="overflow-hidden border-slate-200"
            >
              <Collapsible
                open={!collapsedSections[section.section]}
                onOpenChange={() =>
                  setCollapsedSections((current) => ({
                    ...current,
                    [section.section]: !current[section.section],
                  }))
                }
              >
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center justify-between gap-3 bg-emerald-950 px-3 py-3 text-left text-white sm:px-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200">
                        {section.section}
                      </div>
                      <div className="text-base font-black sm:text-lg">
                        {section.label}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                        Total Net Change
                      </span>
                      <span className="text-sm font-semibold text-emerald-100 sm:text-base">
                        {currency(section.totalNetChange)}
                      </span>
                      {collapsedSections[section.section] ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {flattenSectionRows(section.accounts).map(
                        ({ node, depth }) => {
                          const isGroup = node.children.length > 0;
                          return (
                            <div
                              key={node.id}
                              className={`grid grid-cols-[minmax(10rem,1.3fr)_minmax(11rem,1fr)_minmax(11rem,1fr)_minmax(11rem,0.9fr)_minmax(7rem,0.7fr)] items-center px-3 py-2 text-xs sm:px-4 sm:text-sm ${
                                isGroup ? "bg-slate-50/80 font-semibold" : ""
                              }`}
                            >
                              <div
                                style={{ paddingLeft: `${depth * 10}px` }}
                                className="flex min-w-0 items-start gap-2"
                              >
                                <span className="mt-0.5 w-4 shrink-0 text-slate-400">
                                  {isGroup ? "+" : "-"}
                                </span>
                                <span className="min-w-0 max-w-full whitespace-normal break-words leading-snug">
                                  <span className="font-medium text-slate-900">
                                    {node.accountCode}
                                  </span>{" "}
                                  <span className="text-slate-700">
                                    {node.accountName}
                                  </span>
                                </span>
                              </div>
                              <div className="text-right tabular-nums">
                                {isGroup ? "-" : currency(node.displayPeriod1)}
                              </div>
                              <div className="text-right tabular-nums">
                                {isGroup ? "-" : currency(node.displayPeriod2)}
                              </div>
                              <div className="text-right tabular-nums">
                                {isGroup
                                  ? "-"
                                  : currency(node.displayNetChange)}
                              </div>
                              <div className="text-right tabular-nums">
                                {isGroup
                                  ? "-"
                                  : `${node.growthPercent.toFixed(2)}%`}
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>

              <div className="grid grid-cols-[minmax(10rem,1.3fr)_minmax(11rem,1fr)_minmax(11rem,1fr)_minmax(11rem,0.9fr)_minmax(7rem,0.7fr)] border-t bg-slate-50 px-3 py-3 text-xs font-semibold sm:px-4">
                <div>
                  Total - {section.label}: {section.count}
                </div>
                <div className="text-right tabular-nums">
                  {currency(section.totalPeriod1)}
                </div>
                <div className="text-right tabular-nums">
                  {currency(section.totalPeriod2)}
                </div>
                <div className="text-right tabular-nums">
                  {currency(section.totalNetChange)}
                </div>
                <div className="text-right tabular-nums">
                  {section.growthPercent.toFixed(2)}%
                </div>
              </div>
            </Card>
          ))}

          <Card className="overflow-hidden border-slate-200">
            <CardContent className="p-0">
              <div className="grid grid-cols-[minmax(10rem,1.3fr)_minmax(11rem,1fr)_minmax(11rem,1fr)_minmax(11rem,0.9fr)_minmax(7rem,0.7fr)] items-center border-t bg-slate-950 px-3 py-3 text-xs font-semibold text-white sm:px-4">
                <div>Grand Total</div>
                <div className="text-right tabular-nums">
                  {currency(report.grandTotal.totalPeriod1)}
                </div>
                <div className="text-right tabular-nums">
                  {currency(report.grandTotal.totalPeriod2)}
                </div>
                <div className="text-right tabular-nums">
                  {currency(report.grandTotal.totalNetChange)}
                </div>
                <div className="text-right tabular-nums">
                  {report.grandTotal.growthPercent.toFixed(2)}%
                </div>
              </div>
              {report.profitLoss ? (
                <div className="flex items-center justify-between bg-slate-50 px-3 py-3 text-sm font-semibold sm:px-4">
                  <span>{report.profitLoss.label}</span>
                  <span
                    className={
                      report.profitLoss.profitLoss >= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                    }
                  >
                    {currency(report.profitLoss.profitLoss)}
                  </span>
                </div>
              ) : null}
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
