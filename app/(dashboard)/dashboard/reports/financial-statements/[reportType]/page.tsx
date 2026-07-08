"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import TrialBalancePage from "./TrialBalancePage";
import { useSession } from "next-auth/react";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { FinancialRecord } from "@/lib/reports/types";
import { Column } from "@/components/ui/data-table/data-table";
import {
  Scale,
  TrendingUp,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Equal,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { SaccoReportHeader } from "@/components/reports/SaccoReportHeader";

const tbColumns: Column<FinancialRecord>[] = [
  { header: "Account Code", accessorKey: "accountCode" },
  { header: "Account Name", accessorKey: "accountName" },
  { header: "Debit", accessorKey: "debit" },
  { header: "Credit", accessorKey: "credit" },
];

// Default columns for BS/PL
const statementColumns: Column<FinancialRecord>[] = [
    { header: "Category", accessorKey: "category", cell: (row: any) => row.category || row.type },
    { header: "Account", accessorKey: "accountName" },
    { header: "Balance", accessorKey: "balance" },
];

const reportConfig: Record<string, { title: string; endpoint: string; columns?: any[]; summaryType?: 'tb' | 'bs' | 'pl' }> = {
    "balance-sheet": {
        title: "Balance Sheet",
        endpoint: "/api/v1/reports/financial/balance-sheet",
        columns: statementColumns,
        summaryType: 'bs'
    },
    "trial-balance": {
      title: "Trial Balance",
      endpoint: "/api/v1/reports/financial-year/trial-balance",
      columns: tbColumns,
      summaryType: 'tb'
    },
    "income-statement": {
        title: "Income Statement",
        endpoint: "/api/v1/reports/financial/profit-loss",
        columns: statementColumns,
        summaryType: 'pl'
    },
    "cash-flow": {
        title: "Cash Flow Statement",
        endpoint: "/api/v1/reports/financial/cash-flow",
        columns: statementColumns
    },
    // Adding variations to catch links
    "profit-loss": {
        title: "Profit & Loss",
        endpoint: "/api/v1/reports/financial/profit-loss",
         columns: statementColumns,
         summaryType: 'pl'
    }
};

type StatementItem = {
  label: string;
  amount: number;
  accounts: Array<{
    code: string;
    name: string;
    balance: number;
  }>;
};

type StatementSection = {
  items: StatementItem[];
  total: number;
};

type BalanceSheetResponse = {
  reportType: string;
  asOfDate: string;
  summary: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    difference: number;
    balanced: boolean;
  };
  statement: {
    assets: {
      current: StatementSection;
      nonCurrent: StatementSection;
      total: number;
    };
    liabilities: {
      current: StatementSection;
      nonCurrent: StatementSection;
      total: number;
    };
    equity: {
      items: StatementItem[];
      total: number;
    };
    totalLiabilitiesAndEquity: number;
    difference: number;
    balanced: boolean;
  };
  analytics: {
    workingCapital: number;
    currentRatio: number | null;
    debtRatio: number | null;
    equityRatio: number | null;
    shareCapital: number;
    retainedEarnings: number;
    loanInsuranceLiability: number;
    accountsShown: number;
    branchApplied: string;
    sectionApplied: string;
    subSectionApplied: string;
    searchApplied: string;
    includeZeroBalances: boolean;
  };
};

type BranchOption = {
  id: string;
  name: string;
  location?: string;
  contactPhone?: string | null;
  email?: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(value || 0);
}

function TreeRow({
  label,
  amount,
  expanded,
  onToggle,
  depth = 0,
  bold = false,
  collapsible = false,
  className = "",
}: {
  label: string;
  amount: number;
  expanded?: boolean;
  onToggle?: () => void;
  depth?: number;
  bold?: boolean;
  collapsible?: boolean;
  className?: string;
}) {
  const Icon = expanded ? ChevronDown : ChevronRight;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!collapsible}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left ${collapsible ? "hover:bg-muted/50" : ""} ${className}`}
      style={{ paddingLeft: `${depth * 18 + 12}px` }}
    >
      <span className={`flex min-w-0 items-center gap-2 ${bold ? "font-semibold" : ""}`}>
        {collapsible ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : <span className="w-4 shrink-0 text-muted-foreground">•</span>}
        <span className="truncate">{label}</span>
      </span>
      <span className={`shrink-0 whitespace-nowrap pl-2 tabular-nums ${bold ? "font-semibold" : ""}`}>{formatCurrency(amount)}</span>
    </button>
  );
}

function SkeletonRow({ wide = false, indent = 0 }: { wide?: boolean; indent?: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-2" style={{ paddingLeft: `${indent * 18 + 12}px` }}>
      <Skeleton className={`h-4 rounded ${wide ? "w-2/3" : "w-1/2"}`} />
      <Skeleton className="h-4 w-24 rounded" />
    </div>
  );
}

function BalanceSheetSkeleton() {
  return (
    <div className="space-y-4 p-6 animate-pulse">
      {/* Summary cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-6 w-32 rounded" />
          </div>
        ))}
      </div>
      {/* Tree skeleton */}
      <div className="rounded-md border bg-card p-4 space-y-1">
        {/* Header placeholder */}
        <div className="border-b pb-4 mb-4 space-y-2">
          <Skeleton className="h-8 w-48 mx-auto rounded" />
          <Skeleton className="h-4 w-36 mx-auto rounded" />
        </div>
        {/* Assets */}
        <SkeletonRow wide indent={0} />
        <SkeletonRow indent={1} />
        <SkeletonRow indent={2} />
        <SkeletonRow indent={2} />
        <SkeletonRow indent={2} />
        <SkeletonRow indent={1} />
        <SkeletonRow indent={2} />
        <SkeletonRow indent={2} />
        <SkeletonRow wide indent={0} />
        {/* Liabilities */}
        <SkeletonRow wide indent={0} />
        <SkeletonRow indent={1} />
        <SkeletonRow indent={2} />
        <SkeletonRow indent={2} />
        <SkeletonRow indent={2} />
        <SkeletonRow wide indent={0} />
        {/* Equity */}
        <SkeletonRow wide indent={0} />
        <SkeletonRow indent={1} />
        <SkeletonRow indent={1} />
        <SkeletonRow wide indent={0} />
      </div>
    </div>
  );
}

function BalanceSheetTreePage({ title, endpoint }: { title: string; endpoint: string }) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<BalanceSheetResponse | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [branchId, setBranchId] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [subSectionFilter, setSubSectionFilter] = useState("all");
  const [includeZeroBalances, setIncludeZeroBalances] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    assets: true,
    assetsCurrent: true,
    assetsNonCurrent: true,
    liabilities: true,
    liabilitiesCurrent: true,
    liabilitiesNonCurrent: true,
    equity: true,
  });
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: !!session,
    intervalMs: 15000,
  });

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/branches", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = await response.json();
      setBranches((result.data || []).map((branch: any) => ({
        id: branch.id,
        name: branch.name,
        location: branch.location,
        contactPhone: branch.contactPhone,
        email: branch.email,
      })));
    } catch (error) {
      console.error("Failed to fetch branches", error);
    }
  }, []);

  const userRole = (session?.user as any)?.role as string | undefined;
  const userBranchId = (session?.user as any)?.branchId as string | undefined;
  const isAdmin = userRole === "ADMIN";

  const fetchBalanceSheet = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
          branchId: isAdmin ? (branchId === "all" ? undefined : branchId) : userBranchId,
          section: sectionFilter,
          subSection: subSectionFilter,
          includeZeroBalances,
          search,
          format: "JSON",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch balance sheet");
      }

      const result = await response.json();
      setReport(result.data);
    } catch (error) {
      console.error("Balance sheet fetch error:", error);
      toast.error("Failed to load balance sheet");
    } finally {
      setLoading(false);
    }
  }, [branchId, dateRange?.to, endpoint, includeZeroBalances, isAdmin, search, sectionFilter, subSectionFilter, userBranchId]);

  useEffect(() => {
    fetchBranches();
    fetchBalanceSheet();
  }, [fetchBalanceSheet, fetchBranches]);

  useEffect(() => {
    if (!report) return;
    void fetchBalanceSheet();
  }, [fetchBalanceSheet, liveRefreshVersion, report]);

  useEffect(() => {
    if (!isAdmin && userBranchId) {
      setBranchId(userBranchId);
    }
  }, [isAdmin, userBranchId]);

  const toggle = useCallback((key: string) => {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const summary = report?.summary;
  const statement = report?.statement;
  const analytics = report?.analytics;
  const activeBranch = useMemo(() => {
    const appliedId =
      analytics?.branchApplied && analytics.branchApplied !== "all"
        ? analytics.branchApplied
        : !isAdmin
          ? userBranchId
          : branchId !== "all"
            ? branchId
            : undefined;

    return branches.find((branch) => branch.id === appliedId) || null;
  }, [analytics?.branchApplied, branchId, branches, isAdmin, userBranchId]);
  const asOfLabel = useMemo(() => {
    if (!report?.asOfDate) return "";
    const date = new Date(report.asOfDate);
    return date.toLocaleDateString("en-UG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [report?.asOfDate]);

  const renderItemGroup = (items: StatementItem[], depth: number) =>
    items.map((item) => (
      <div key={`${item.label}-${depth}`}>
        <TreeRow label={item.label} amount={item.amount} depth={depth} />
      </div>
    ));

  const formatRatio = (value: number | null | undefined) =>
    value === null || value === undefined ? "N/A" : `${(value * 100).toFixed(1)}%`;

  const handleExportPdf = useCallback(() => {
    if (!report) {
      toast.error("Generate the report first before exporting.");
      return;
    }

    const branchName =
      (isAdmin ? branchId : userBranchId) === "all"
        ? "All Branches"
        : branches.find((branch) => branch.id === (isAdmin ? branchId : userBranchId))?.name || "Selected Branch";

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
      toast.error("Unable to open print window.");
      return;
    }

    const sectionHtml = (title: string, items: StatementItem[], totalLabel: string, total: number) => `
      <div class="section">
        <div class="row heading"><span>${title}</span><span>${formatCurrency(total)}</span></div>
        ${items
          .map(
            (item) => `
              <div class="row child"><span>${item.label}</span><span>${formatCurrency(item.amount)}</span></div>
            `,
          )
          .join("")}
        <div class="row total"><span>${totalLabel}</span><span>${formatCurrency(total)}</span></div>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Balance Sheet</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1, h2, h3 { margin: 0; }
            .muted { color: #6b7280; font-size: 12px; margin: 2px 0; }
            .section { margin: 18px 0; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; }
            .heading { font-weight: 700; border-bottom: 1px solid #d1d5db; }
            .child { padding-left: 24px; }
            .total { font-weight: 700; border-top: 1px solid #d1d5db; }
            .final { font-weight: 700; border-top: 2px solid #111827; border-bottom: 2px solid #111827; margin-top: 16px; }
            .report-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
            .header-grid { display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; gap: 16px; }
            .logo-wrap { display: flex; justify-content: center; }
            .logo { width: 104px; height: 104px; object-fit: contain; }
            .header-center { text-align: center; }
            .header-center .main { font-size: 34px; font-weight: 900; text-transform: uppercase; color: #0f7ea4; letter-spacing: 0.5px; }
            .header-center .sub { font-size: 24px; font-weight: 900; text-transform: uppercase; color: #0f7ea4; letter-spacing: 0.4px; }
            .header-center .reg { margin-top: 8px; font-size: 18px; font-weight: 800; color: #1f2937; }
            .header-center .email { margin-top: 4px; font-size: 16px; font-style: italic; color: #9f1239; }
            .header-center .contacts { font-size: 16px; font-weight: 700; color: #1f2937; }
            .header-address { visibility: hidden; }
            .title-block { margin-top: 16px; border-top: 4px solid #312e81; padding-top: 14px; text-align: center; }
            .title-block .report-title { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.6px; }
            .title-block .asof { margin-top: 4px; font-size: 13px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div class="header-grid">
              <div class="logo-wrap">
                <img class="logo" src="${window.location.origin}${REPORT_HEADER_DETAILS.logoPath}" alt="Bukonzo United Teachers SACCO logo" />
              </div>
              <div class="header-center">
                <div class="main">${REPORT_HEADER_DETAILS.institutionName}</div>
                <div class="reg">${REPORT_HEADER_DETAILS.registrationNumber}</div>
                <div class="email">Email: ${REPORT_HEADER_DETAILS.email}</div>
                <div class="contacts">Contacts: ${REPORT_HEADER_DETAILS.contacts.join(" / ")}</div>
                ${REPORT_HEADER_DETAILS.postalAddress.map((line) => `<div class="contacts">${line}</div>`).join("")}
                <div class="asof">Branch: ${activeBranch?.name || branchName}</div>
              </div>
              <div class="header-address">.</div>
            </div>
            <div class="title-block">
              <div class="report-title">Balance Sheet</div>
              <div class="asof">As at ${asOfLabel || "Selected Date"}</div>
              <div class="asof">In UGX</div>
            </div>
          </div>
          <div class="muted">Branch: ${branchName}</div>
          <div class="muted">Filters: Section ${sectionFilter}, Sub-section ${subSectionFilter}, Search "${search || "None"}", Include Zeros ${includeZeroBalances ? "Yes" : "No"}</div>
          ${statement ? `
            ${sectionHtml("Current Assets", statement.assets.current.items, "Total Current Assets", statement.assets.current.total)}
            ${sectionHtml("Non-Current Assets", statement.assets.nonCurrent.items, "Total Non-Current Assets", statement.assets.nonCurrent.total)}
            <div class="row final"><span>Total Assets</span><span>${formatCurrency(statement.assets.total)}</span></div>
            ${sectionHtml("Current Liabilities", statement.liabilities.current.items, "Total Current Liabilities", statement.liabilities.current.total)}
            ${sectionHtml("Long-Term Liabilities", statement.liabilities.nonCurrent.items, "Total Long-Term Liabilities", statement.liabilities.nonCurrent.total)}
            <div class="row final"><span>Total Liabilities</span><span>${formatCurrency(statement.liabilities.total)}</span></div>
            ${sectionHtml("Equity", statement.equity.items, "Total Equity", statement.equity.total)}
            <div class="row final"><span>Total Liabilities and Equity</span><span>${formatCurrency(statement.totalLiabilitiesAndEquity)}</span></div>
          ` : ""}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 400);
  }, [
    report,
    branchId,
    branches,
    asOfLabel,
    activeBranch,
    isAdmin,
    sectionFilter,
    subSectionFilter,
    search,
    includeZeroBalances,
    statement,
    summary,
    userBranchId,
  ]);

  return (
    <ReportPageLayout
      title={title}
      description="Financial report with expandable balance-sheet hierarchy"
      summaryFirst
      fitContent
      onPrint={handleExportPdf}
      filters={
        <div className="grid w-full gap-4 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label>Date Range</Label>
            <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
          </div>
          {isAdmin ? (
            <div>
              <Label>Branch</Label>
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
            </div>
          ) : (
            <div>
              <Label>Branch</Label>
              <Input
                value={
                  branches.find((branch) => branch.id === userBranchId)?.name ||
                  "Assigned Branch"
                }
                disabled
              />
            </div>
          )}
          <div>
            <Label>Section</Label>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                <SelectItem value="assets">Assets</SelectItem>
                <SelectItem value="liabilities">Liabilities</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sub-section</Label>
            <Select value={subSectionFilter} onValueChange={setSubSectionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sub-sections</SelectItem>
                <SelectItem value="current-assets">Current Assets</SelectItem>
                <SelectItem value="non-current-assets">Non-Current Assets</SelectItem>
                <SelectItem value="current-liabilities">Current Liabilities</SelectItem>
                <SelectItem value="long-term-liabilities">Long-Term Liabilities</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Search</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code or account name" />
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant={includeZeroBalances ? "default" : "outline"}
              onClick={() => setIncludeZeroBalances((current) => !current)}
            >
              {includeZeroBalances ? "Showing Zeros" : "Hide Zeros"}
            </Button>
            <Button onClick={fetchBalanceSheet} disabled={loading}>
              {loading ? "Loading..." : "Generate"}
            </Button>
            <Button variant="outline" onClick={handleExportPdf} disabled={!report}>
              Export PDF
            </Button>
          </div>
        </div>
      }
      summary={
        summary ? (
          <>
            <ReportSummaryCard title="Total Assets" value={formatCurrency(summary.totalAssets)} icon={DollarSign} />
            <ReportSummaryCard title="Total Liabilities" value={formatCurrency(summary.totalLiabilities)} icon={TrendingUp} />
            <ReportSummaryCard title="Total Equity" value={formatCurrency(summary.totalEquity)} />
            <ReportSummaryCard
              title="Balance Check"
              value={summary.balanced ? "Balanced" : "Unbalanced"}
              icon={Equal}
              subValue={`Difference: ${formatCurrency(summary.difference)}`}
              className={summary.balanced ? "border-green-200 text-green-700" : "border-red-200 text-red-700"}
            />
            <ReportSummaryCard title="Working Capital" value={formatCurrency(analytics?.workingCapital || 0)} />
            <ReportSummaryCard title="Current Ratio" value={formatRatio(analytics?.currentRatio)} />
            <ReportSummaryCard title="Debt Ratio" value={formatRatio(analytics?.debtRatio)} />
            <ReportSummaryCard title="Equity Ratio" value={formatRatio(analytics?.equityRatio)} />
            <ReportSummaryCard title="Share Capital" value={formatCurrency(analytics?.shareCapital || 0)} />
            <ReportSummaryCard title="Retained Earnings" value={formatCurrency(analytics?.retainedEarnings || 0)} />
            <ReportSummaryCard title="Loan Insurance Liability" value={formatCurrency(analytics?.loanInsuranceLiability || 0)} />
            <ReportSummaryCard title="Accounts Shown" value={analytics?.accountsShown || 0} />
          </>
        ) : null
      }
    >
      {loading && !report ? (
        <BalanceSheetSkeleton />
      ) : (
        <div className="space-y-4 p-6">
          <Card className="border-none shadow-none">
            <CardContent className="space-y-2 p-0">
              <SaccoReportHeader
                title="Balance Sheet"
                subtitle="Expandable balance-sheet hierarchy"
                branchLabel={activeBranch?.name || (branchId === "all" ? "All Branches" : branchId)}
                periodLabel={asOfLabel || "Selected Date"}
              />
              <div className="flex justify-end pt-2 print:hidden">
                <Button variant="outline" onClick={handleExportPdf} disabled={!report}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print detailed report
                </Button>
              </div>
            <div>
              {analytics && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">Branch: {analytics.branchApplied === "all" ? "All" : branches.find((branch) => branch.id === analytics.branchApplied)?.name || analytics.branchApplied}</Badge>
                  <Badge variant="secondary">Section: {analytics.sectionApplied}</Badge>
                  <Badge variant="secondary">Sub-section: {analytics.subSectionApplied}</Badge>
                  <Badge variant="secondary">Search: {analytics.searchApplied || "None"}</Badge>
                  <Badge variant="secondary">Zero Balances: {analytics.includeZeroBalances ? "Included" : "Hidden"}</Badge>
                </div>
              )}
            </div>

            {statement && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <TreeRow
                    label="Assets"
                    amount={statement.assets.total}
                    expanded={expanded.assets}
                    onToggle={() => toggle("assets")}
                    depth={0}
                    bold
                    collapsible
                  />
                  {expanded.assets && (
                    <div className="space-y-1">
                      <TreeRow
                        label="Current Assets"
                        amount={statement.assets.current.total}
                        expanded={expanded.assetsCurrent}
                        onToggle={() => toggle("assetsCurrent")}
                        depth={1}
                        bold
                        collapsible
                      />
                      {expanded.assetsCurrent && (
                        <div className="space-y-1">
                          {renderItemGroup(statement.assets.current.items, 2)}
                          <TreeRow
                            label="Total Current Assets"
                            amount={statement.assets.current.total}
                            depth={2}
                            bold
                            className="border-t"
                          />
                        </div>
                      )}

                      <TreeRow
                        label="Non-Current Assets"
                        amount={statement.assets.nonCurrent.total}
                        expanded={expanded.assetsNonCurrent}
                        onToggle={() => toggle("assetsNonCurrent")}
                        depth={1}
                        bold
                        collapsible
                      />
                      {expanded.assetsNonCurrent && (
                        <div className="space-y-1">
                          {renderItemGroup(statement.assets.nonCurrent.items, 2)}
                          <TreeRow
                            label="Total Non-Current Assets"
                            amount={statement.assets.nonCurrent.total}
                            depth={2}
                            bold
                            className="border-t"
                          />
                        </div>
                      )}

                      <TreeRow label="Total Assets" amount={statement.assets.total} depth={1} bold className="border-y bg-muted/30" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <TreeRow
                    label="Liabilities"
                    amount={statement.liabilities.total}
                    expanded={expanded.liabilities}
                    onToggle={() => toggle("liabilities")}
                    depth={0}
                    bold
                    collapsible
                  />
                  {expanded.liabilities && (
                    <div className="space-y-1">
                      <TreeRow
                        label="Current Liabilities"
                        amount={statement.liabilities.current.total}
                        expanded={expanded.liabilitiesCurrent}
                        onToggle={() => toggle("liabilitiesCurrent")}
                        depth={1}
                        bold
                        collapsible
                      />
                      {expanded.liabilitiesCurrent && (
                        <div className="space-y-1">
                          {renderItemGroup(statement.liabilities.current.items, 2)}
                          <TreeRow
                            label="Total Current Liabilities"
                            amount={statement.liabilities.current.total}
                            depth={2}
                            bold
                            className="border-t"
                          />
                        </div>
                      )}

                      <TreeRow
                        label="Long-Term Liabilities"
                        amount={statement.liabilities.nonCurrent.total}
                        expanded={expanded.liabilitiesNonCurrent}
                        onToggle={() => toggle("liabilitiesNonCurrent")}
                        depth={1}
                        bold
                        collapsible
                      />
                      {expanded.liabilitiesNonCurrent && (
                        <div className="space-y-1">
                          {renderItemGroup(statement.liabilities.nonCurrent.items, 2)}
                          <TreeRow
                            label="Total Long-Term Liabilities"
                            amount={statement.liabilities.nonCurrent.total}
                            depth={2}
                            bold
                            className="border-t"
                          />
                        </div>
                      )}

                      <TreeRow
                        label="Total Liabilities"
                        amount={statement.liabilities.total}
                        depth={1}
                        bold
                        className="border-y bg-muted/30"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <TreeRow
                    label="Equity"
                    amount={statement.equity.total}
                    expanded={expanded.equity}
                    onToggle={() => toggle("equity")}
                    depth={0}
                    bold
                    collapsible
                  />
                  {expanded.equity && (
                    <div className="space-y-1">
                      {renderItemGroup(statement.equity.items, 1)}
                      <TreeRow
                        label="Total Equity"
                        amount={statement.equity.total}
                        depth={1}
                        bold
                        className="border-y bg-muted/30"
                      />
                    </div>
                  )}
                </div>

                <TreeRow
                  label="Total Liabilities and Equity"
                  amount={statement.totalLiabilitiesAndEquity}
                  depth={0}
                  bold
                  className="border-y-2 border-primary bg-primary/5"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </ReportPageLayout>
  );
}

export default function DynamicFinancialReportPage() {
  const params = useParams();
  const reportType = params?.reportType as string;
  const config = reportConfig[reportType];

  if (!config) {
     return <div className="p-8">Report type not found: {reportType}</div>;
  }

  if (reportType === "balance-sheet") {
    return <BalanceSheetTreePage title={config.title} endpoint={config.endpoint} />;
  }

  if (reportType === "trial-balance") {
    return <TrialBalancePage />;
  }

  return (
    <GenericReportPage
      title={config.title}
      description={`Financial report: ${config.title}`}
      endpoint={config.endpoint}
      method="POST"
      extraParams={{ format: 'JSON' }}
      columns={config.columns || statementColumns}
      keyField="accountCode" // or accountName if code missing
      summaryFormatter={(summary) => {
          if (config.summaryType === 'tb') {
               return (
                  <>
                    <ReportSummaryCard title="Total Debits" value={summary.totalDebits} icon={Scale} />
                    <ReportSummaryCard title="Total Credits" value={summary.totalCredits} icon={Scale} />
                    <ReportSummaryCard 
                        title="Status" 
                        value={summary.balanced ? "Balanced" : "Unbalanced"} 
                        className={summary.balanced ? "text-green-600 border-green-200" : "text-red-600 border-red-200"}
                    />
                  </>
              );
          }
          if (config.summaryType === 'bs') {
              return (
                   <>
                    <ReportSummaryCard title="Total Assets" value={summary.totalAssets} icon={DollarSign} />
                    <ReportSummaryCard title="Total Liabilities" value={summary.totalLiabilities} icon={TrendingUp} />
                    <ReportSummaryCard title="Equity" value={summary.totalEquity} />
                  </>
              );
          }
          if (config.summaryType === 'pl') {
               return (
                   <>
                    <ReportSummaryCard title="Total Income" value={summary.totalIncome} icon={DollarSign} />
                    <ReportSummaryCard title="Total Expenses" value={summary.totalExpenses} icon={TrendingUp} />
                    <ReportSummaryCard 
                        title="Net Profit" 
                        value={summary.netProfit} 
                        className={parseFloat(String(summary.netProfit || "0").replace(/,/g, '')) >= 0 ? "text-green-600" : "text-red-600"}
                    />
                  </>
              );
          }
          return null;
      }}
    />
  );
}
