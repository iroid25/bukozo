"use client";

export const dynamic = "force-dynamic";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  Printer,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { printReport } from "@/lib/reports/print-report";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type ReportRow = {
  id: string;
  accountNumber: string;
  memberName: string;
  passbookCount: number;
  trxNo: string;
  sessionDate: string;
  trxDate: string;
  debitAmount: number;
  creditAmount: number;
  netAmount: number;
  transactionTypeLabel: string;
  processedBy: string;
  accountType: string;
  productCode: string;
  productName: string;
  branchName: string | null;
  status: string;
  openingDate: string | null;
  lastTransactionDate: string | null;
  runningBalance: number;
  largeTransactionFlag: boolean;
  groupAccountFlag: boolean;
  mixedFlowFlag: boolean;
  reversalFlag: boolean;
  description: string | null;
  valueDate: string | null;
};

type TellerSummaryRow = {
  tellerName: string;
  transactionCount: number;
  debits: number;
  credits: number;
  netMovement: number;
};

type TransactionSummary = {
  transactionCount: number;
  memberCount: number;
  totalDebits: number;
  totalCredits: number;
  netMovement: number;
  largestDeposit: ReportRow | null;
  largestWithdrawal: ReportRow | null;
};

type ReportPayload = {
  saccoName: string;
  location: string;
  reportTitle: string;
  generatedDate: string;
  generatedTime: string;
  dateRange: {
    from: string;
    to: string;
  };
  product: {
    code: string;
    name: string;
  } | {
    code: "all";
    name: "All Savings Products";
  };
  branchScope: string;
  summary: TransactionSummary;
  tellerSummary: TellerSummaryRow[];
  transactions: ReportRow[];
  footer: {
    totalDebits: number;
    totalCredits: number;
    netMovement: number;
  };
};

type MemberDetailPayload = ReportPayload & {
  member: null | {
    accountNumber: string;
    memberName: string;
    passbookCount: number;
    openingDate: string | null;
    lastTransactionDate: string | null;
    accountType: string;
    productCode: string;
    productName: string;
    branchName: string | null;
    branchId: string | null;
    status: string;
    runningBalance: number;
    tellerNames: string[];
  };
};

type BranchOption = {
  id: string;
  name: string;
};

const DEFAULT_DATE = (() => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "2026";
  const month = parts.find((part) => part.type === "month")?.value || "06";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
})();
const DEFAULT_FROM_DATE = (() => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return new Date(year, month, 1).toISOString().slice(0, 10);
})();
const FALLBACK_PRODUCT_OPTIONS = [
  { value: "all", label: "All Products" },
  { value: "201001", label: "201001 - Fixed Deposit Savings" },
  { value: "201002", label: "201002 - Junior Savings A/C" },
  { value: "201003", label: "201003 - Voluntary Savings" },
  { value: "201004", label: "201004 - Compulsory Savings" },
  { value: "200600", label: "200600 - Loan Insurance" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "deposit", label: "Deposits Only" },
  { value: "withdrawal", label: "Withdrawals Only" },
];

const CURRENCY = new Intl.NumberFormat("en-US");

function formatCurrency(value: number) {
  return `UGX ${CURRENCY.format(Math.round(value || 0))}`;
}

function normalizeDateDisplay(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-GB");
}

function reportDateInput(value: string) {
  return value || DEFAULT_DATE;
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    search.set(key, String(value));
  });
  return search.toString();
}

export default function SavingsTransactionsReportPage() {
  const { data: session, status } = useSession();
  const didInitialLoad = useRef(false);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: status === "authenticated",
    intervalMs: 15000,
  });

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [memberDetail, setMemberDetail] = useState<MemberDetailPayload | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [showTellerSummary, setShowTellerSummary] = useState(true);
  const [productOptions, setProductOptions] = useState(FALLBACK_PRODUCT_OPTIONS);

  useEffect(() => {
    fetch("/api/v1/account-types?linkedOnly=true")
      .then((r) => r.json())
      .then((result) => {
        const types = (result.data || []).filter(
          (t: any) => t.isShareAccount === false && t.ledgerAccount
        );
        if (types.length > 0) {
          const options = [
            { value: "all", label: "All Products" },
            ...types.map((t: any) => ({
              value: t.ledgerAccount.accountCode,
              label: `${t.ledgerAccount.accountCode} - ${t.name}`,
            })),
          ];
          setProductOptions(options);
        }
      })
      .catch(() => {});
  }, []);

  const [filters, setFilters] = useState({
    branchId: "all",
    productCode: "all",
    dateFrom: DEFAULT_FROM_DATE,
    dateTo: DEFAULT_DATE,
    type: "all",
    teller: "all",
    search: "",
    minAmount: "",
    maxAmount: "",
  });

  const isAdmin = String((session?.user as any)?.role || "").toUpperCase() === "ADMIN";

  const tellerOptions = useMemo(() => {
    const base = new Set(["all"]);
    report?.tellerSummary.forEach((row) => base.add(row.tellerName));
    return Array.from(base);
  }, [report?.tellerSummary]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const sessionBranchId = (session?.user as any)?.branchId || "all";
    setFilters((current) => ({
      ...current,
      branchId: isAdmin ? "all" : sessionBranchId,
    }));
  }, [isAdmin, session, status]);

  useEffect(() => {
    if (status !== "authenticated" || didInitialLoad.current) return;
    didInitialLoad.current = true;
    const sessionBranchId = (session?.user as any)?.branchId || "all";
    void loadBranches();
    void loadReport({
      ...filters,
      branchId: isAdmin ? "all" : sessionBranchId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || !didInitialLoad.current) return;
    void loadReportRef.current?.();
  }, [liveRefreshVersion, status]);

  useEffect(() => {
    if (status !== "authenticated" || !didInitialLoad.current) return;

    const timeout = window.setTimeout(() => {
      void loadReportRef.current?.();
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [
    filters.branchId,
    filters.productCode,
    filters.dateFrom,
    filters.dateTo,
    filters.type,
    filters.teller,
    filters.search,
    filters.minAmount,
    filters.maxAmount,
    status,
  ]);

  async function loadBranches() {
    if (status !== "authenticated") return;

    setLoadingBranches(true);
    try {
      const response = await fetch("/api/v1/branches", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Failed to load branches");
      setBranches(Array.isArray(json?.data) ? json.data.map((branch: any) => ({ id: branch.id, name: branch.name })) : []);
    } catch (loadError) {
      console.error(loadError);
      toast.error("Failed to load branches");
    } finally {
      setLoadingBranches(false);
    }
  }

  async function loadReport(overrideFilters = filters) {
    if (status !== "authenticated") return;
    setLoading(true);
    setError(null);

    try {
      const params = buildQuery({
        branchId: overrideFilters.branchId === "all" ? undefined : overrideFilters.branchId,
        productCode: overrideFilters.productCode,
        dateFrom: overrideFilters.dateFrom,
        dateTo: overrideFilters.dateTo,
        memberName: overrideFilters.search || undefined,
        teller: overrideFilters.teller === "all" ? undefined : overrideFilters.teller,
        type: overrideFilters.type,
        minAmount: overrideFilters.minAmount ? Number(overrideFilters.minAmount) : undefined,
        maxAmount: overrideFilters.maxAmount ? Number(overrideFilters.maxAmount) : undefined,
      });

      const response = await fetch(`/api/v1/reports/savings/transactions?${params}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Failed to load report");

      setReport(json.data as ReportPayload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load report";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const loadReportRef = useRef(loadReport);

  useEffect(() => {
    loadReportRef.current = loadReport;
  }, [loadReport]);

  async function handleExport() {
    if (status !== "authenticated") return;
    setExporting(true);
    try {
      const params = buildQuery({
        branchId: filters.branchId === "all" ? undefined : filters.branchId,
        productCode: filters.productCode,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        memberName: filters.search || undefined,
        teller: filters.teller === "all" ? undefined : filters.teller,
        type: filters.type,
        minAmount: filters.minAmount ? Number(filters.minAmount) : undefined,
        maxAmount: filters.maxAmount ? Number(filters.maxAmount) : undefined,
      });

      const response = await fetch(`/api/v1/reports/savings/transactions/export?${params}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const json = await response.json();
        throw new Error(json?.error || "Failed to export report");
      }

      const buffer = await response.arrayBuffer();
      downloadBuffer(
        buffer,
        `savings-transactions-${reportDateInput(filters.dateFrom)}_to_${reportDateInput(filters.dateTo)}.xlsx`,
      );
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : "Failed to export report";
      toast.error(message);
    } finally {
      setExporting(false);
    }
  }

  async function openMemberDetail(row: ReportRow) {
    if (status !== "authenticated") return;
    setMemberOpen(true);
    setMemberLoading(true);
    setMemberDetail(null);

    try {
      const params = buildQuery({
        branchId: filters.branchId === "all" ? undefined : filters.branchId,
        productCode: filters.productCode,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        teller: filters.teller === "all" ? undefined : filters.teller,
        type: filters.type,
        minAmount: filters.minAmount ? Number(filters.minAmount) : undefined,
        maxAmount: filters.maxAmount ? Number(filters.maxAmount) : undefined,
      });

      const response = await fetch(
        `/api/v1/reports/savings/transactions/member/${encodeURIComponent(row.accountNumber)}?${params}`,
        { cache: "no-store" },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Failed to load account history");
      setMemberDetail(json.data as MemberDetailPayload);
    } catch (memberError) {
      const message = memberError instanceof Error ? memberError.message : "Failed to load account history";
      toast.error(message);
    } finally {
      setMemberLoading(false);
    }
  }

  function handlePrint() {
    if (!report?.transactions?.length) {
      toast.error("No data to print. Please generate a report first.");
      return;
    }

    const title = report.reportTitle || "Savings Transactions Report";
    const headers = [
      "A/C No.",
      "Member Name",
      "Ref. No.",
      "Trx No.",
      "Session Date",
      "Trx Date",
      "Debit (UGX)",
      "Credit (UGX)",
      "Processed By",
    ];

    const rows = report.transactions.map((row) => [
      row.accountNumber,
      row.memberName,
      row.passbookCount,
      row.trxNo,
      normalizeDateDisplay(row.sessionDate),
      normalizeDateDisplay(row.trxDate),
      row.debitAmount,
      row.creditAmount,
      row.processedBy,
    ]);

    const totals: (string | number)[] = [
      "",
      "TOTAL",
      "",
      "",
      "",
      "",
      report.footer.totalDebits,
      report.footer.totalCredits,
      "",
    ];

    printReport({
      title,
      subtitle: `${report.saccoName} — ${report.location}`,
      period: `${normalizeDateDisplay(report.dateRange.from)} to ${normalizeDateDisplay(report.dateRange.to)}`,
      filters: {
        Branch: report.branchScope,
        Product: report.product.name,
      },
      headers,
      rows,
      totals,
      summary: {
        "Total Transactions": report.summary.transactionCount,
        "Member Accounts": report.summary.memberCount,
        "Total Debits": report.summary.totalDebits,
        "Total Credits": report.summary.totalCredits,
        "Net Movement": report.summary.netMovement,
      },
    });
  }

  const summary = report?.summary;
  const footer = report?.footer;

  return (
    <div className="h-full min-h-0 w-full print:bg-white print:p-0">
      <div className="flex w-full min-w-0 flex-col gap-4">
        <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm backdrop-blur print:border-0 print:shadow-none">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                    {report?.saccoName || "BUKONZO UNITED TEACHERS SACCO"}
                  </h1>
                  <p className="text-sm font-medium text-slate-600">
                    {report?.location || "KISINGA, Kasese District, Uganda"}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-900 md:text-2xl">
                  {report?.reportTitle || "Savings Transactions Report"}
                </h2>
                <p className="text-sm text-slate-600">
                  Selected Date Range: {normalizeDateDisplay(report?.dateRange.from)} to {normalizeDateDisplay(report?.dateRange.to)}
                </p>
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-700">
                  API-only report powered by live savings transactions
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[360px]">
              <Card className="border-emerald-100">
                <CardContent className="p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Report Date</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{report?.generatedDate || "—"}</div>
                </CardContent>
              </Card>
              <Card className="border-emerald-100">
                <CardContent className="p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Generated Time</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{report?.generatedTime || "--:--:--"}</div>
                </CardContent>
              </Card>
              <Card className="border-emerald-100">
                <CardContent className="p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Branch Scope</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {isAdmin
                      ? filters.branchId === "all"
                        ? "All Branches"
                        : branches.find((branch) => branch.id === filters.branchId)?.name || "Selected Branch"
                      : branches[0]?.name || "My Branch"}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  Report Controls
                </CardTitle>
                <CardDescription>
                  Filter the live ledger, then generate, export, or print the result.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button onClick={() => void loadReport()} disabled={loading} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Report
                </Button>
                <Button variant="outline" onClick={handleExport} disabled={exporting} className="gap-2">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export to Excel
                </Button>
                <Button variant="outline" onClick={handlePrint} className="gap-2">
                  <Printer className="h-4 w-4" />
                  Print / PDF
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">From Date</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">To Date</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product</label>
                <Select value={filters.productCode} onValueChange={(value) => setFilters((current) => ({ ...current, productCode: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction Type</label>
                <Select value={filters.type} onValueChange={(value) => setFilters((current) => ({ ...current, type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teller</label>
                <Select value={filters.teller} onValueChange={(value) => setFilters((current) => ({ ...current, teller: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingBranches ? "Loading..." : "All Tellers"} />
                  </SelectTrigger>
                  <SelectContent>
                    {tellerOptions.map((teller) => (
                      <SelectItem key={teller} value={teller}>
                        {teller === "all" ? "All Tellers" : teller}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Min Amount</label>
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={filters.minAmount}
                  onChange={(event) => setFilters((current) => ({ ...current, minAmount: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Max Amount</label>
                <Input
                  inputMode="numeric"
                  placeholder="No limit"
                  value={filters.maxAmount}
                  onChange={(event) => setFilters((current) => ({ ...current, maxAmount: event.target.value }))}
                />
              </div>
              <div className="space-y-2 lg:col-span-2 xl:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Member Search</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="pl-9"
                      placeholder="Search by member name or account number"
                      value={filters.search}
                      onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    />
                  </div>
                  {isAdmin && (
                    <div className="min-w-[220px]">
                      <Select value={filters.branchId} onValueChange={(value) => setFilters((current) => ({ ...current, branchId: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingBranches ? "Loading branches..." : "All Branches"} />
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
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Unable to load savings transactions</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid min-w-0 gap-4 xl:grid-cols-5">
          <Card className="border-emerald-100 xl:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary</CardTitle>
              <CardDescription>Daily cash control snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Transactions</div>
                <div className="mt-1 text-2xl font-black text-slate-950">{summary?.transactionCount ?? 0}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Member Accounts</div>
                <div className="mt-1 text-2xl font-black text-slate-950">{summary?.memberCount ?? 0}</div>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                <div className="text-xs uppercase tracking-wide text-red-700">Total Debits</div>
                <div className="mt-1 text-xl font-black text-red-700">{formatCurrency(summary?.totalDebits ?? 0)}</div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <div className="text-xs uppercase tracking-wide text-emerald-700">Total Credits</div>
                <div className="mt-1 text-xl font-black text-emerald-700">{formatCurrency(summary?.totalCredits ?? 0)}</div>
              </div>
              <div className={`rounded-xl border p-3 ${summary && summary.netMovement >= 0 ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"}`}>
                <div className={`text-xs uppercase tracking-wide ${summary && summary.netMovement >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  Net Movement
                </div>
                <div className={`mt-1 text-xl font-black ${summary && summary.netMovement >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {formatCurrency(summary?.netMovement ?? 0)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-slate-200/80 xl:col-span-4">
            <CardHeader className="border-b border-slate-200/80 pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">Transaction Ledger</CardTitle>
                  <CardDescription>
                    {loading ? "Loading the live ledger..." : `${report?.transactions.length ?? 0} rows returned from the API`}
                  </CardDescription>
                </div>
                {footer && (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {formatCurrency(footer.totalDebits)}
                    </Badge>
                    <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {formatCurrency(footer.totalCredits)}
                    </Badge>
                    <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-50 text-slate-700">
                      <Wallet className="h-3.5 w-3.5" />
                      {formatCurrency(footer.netMovement)}
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex min-h-[420px] items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading savings transactions...
                  </div>
                </div>
              ) : (
                <ScrollArea className="max-h-[calc(100vh-520px)] min-h-[420px]">
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-xs">
                      <thead className="sticky top-0 z-20 bg-slate-950 text-white">
                        <tr>
                          <th className="w-[10%] border-b border-slate-800 px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">A/C No.</th>
                          <th className="w-[22%] border-b border-slate-800 px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Name</th>
                          <th className="w-[8%] border-b border-slate-800 px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Ref. No.</th>
                          <th className="w-[8%] border-b border-slate-800 px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Trx No.</th>
                          <th className="w-[10%] border-b border-slate-800 px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Transaction Date</th>
                          <th className="w-[10%] border-b border-slate-800 px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Trx Date</th>
                          <th className="w-[11%] border-b border-slate-800 px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-wider">Debit (UGX)</th>
                          <th className="w-[11%] border-b border-slate-800 px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-wider">Credit (UGX)</th>
                          <th className="w-[10%] border-b border-slate-800 px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">User Name</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {(report?.transactions || []).map((row, index) => (
                          <Fragment key={row.id}>
                            <tr
                              onClick={() => void openMemberDetail(row)}
                              className={`cursor-pointer transition-colors hover:bg-emerald-50 ${
                                row.largeTransactionFlag
                                  ? "bg-amber-50/80"
                                  : row.mixedFlowFlag
                                    ? "bg-sky-50/70"
                                    : index % 2 === 0
                                      ? "bg-white"
                                      : "bg-slate-50/60"
                              }`}
                            >
                              <td className="whitespace-nowrap truncate max-w-0 border-b border-slate-100 px-2.5 py-1.5 font-mono font-medium text-slate-900" title={row.accountNumber}>{row.accountNumber}</td>
                              <td className="border-b border-slate-100 px-2.5 py-1.5 max-w-0">
                                <div className="flex items-center gap-1.5">
                                  {row.groupAccountFlag ? <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                                  <div className="min-w-0 flex-1">
                                    <div className={`truncate font-semibold text-[11px] ${row.mixedFlowFlag ? "text-sky-800" : "text-slate-900"}`} title={row.memberName}>
                                      {row.memberName}
                                    </div>
                                    <div className="truncate text-[10px] text-slate-500" title={row.productName}>{row.productName}</div>
                                  </div>
                                  {row.largeTransactionFlag && (
                                    <Badge className="ml-auto bg-amber-500 px-1 py-0 text-[9px] text-white hover:bg-amber-500 shrink-0">
                                      Lg
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="whitespace-nowrap truncate max-w-0 border-b border-slate-100 px-2.5 py-1.5 font-mono text-slate-650" title={String(row.passbookCount)}>{row.passbookCount}</td>
                              <td className="whitespace-nowrap truncate max-w-0 border-b border-slate-100 px-2.5 py-1.5 font-mono text-slate-650" title={row.trxNo}>{row.trxNo}</td>
                              <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-1.5 text-slate-650">{normalizeDateDisplay(row.sessionDate)}</td>
                              <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-1.5 text-slate-650">{normalizeDateDisplay(row.trxDate)}</td>
                              <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-1.5 text-right font-semibold text-red-700">
                                {row.debitAmount > 0 ? formatCurrency(row.debitAmount) : "-"}
                              </td>
                              <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-1.5 text-right font-semibold text-emerald-700">
                                {row.creditAmount > 0 ? formatCurrency(row.creditAmount) : "-"}
                              </td>
                              <td className="whitespace-nowrap truncate max-w-0 border-b border-slate-100 px-2.5 py-1.5 text-slate-650" title={row.processedBy}>{row.processedBy}</td>
                            </tr>
                            <tr aria-hidden="true" className="h-2 bg-transparent">
                              <td colSpan={9} />
                            </tr>
                          </Fragment>
                        ))}
                        {!report?.transactions.length && (
                          <tr>
                            <td colSpan={9} className="px-3 py-12 text-center text-slate-500">
                              No transactions found for the selected filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200/80">
          <Collapsible open={showTellerSummary} onOpenChange={setShowTellerSummary}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50">
                <span className="flex items-center gap-2 font-semibold text-slate-900">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  Teller Summary
                </span>
                {showTellerSummary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Separator />
              <CardContent className="p-4">
                 <div className="w-full min-w-0 overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-xs">
                    <thead>
                      <tr className="border-b text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/50">
                        <th className="w-[30%] px-2.5 py-2">Teller</th>
                        <th className="w-[15%] px-2.5 py-2">Transactions</th>
                        <th className="w-[15%] px-2.5 py-2">Debits</th>
                        <th className="w-[15%] px-2.5 py-2">Credits</th>
                        <th className="w-[25%] px-2.5 py-2">Net Movement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report?.tellerSummary || []).map((row) => (
                        <tr key={row.tellerName} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="px-2.5 py-1.5 font-medium text-slate-900 truncate max-w-0" title={row.tellerName}>{row.tellerName}</td>
                          <td className="px-2.5 py-1.5 text-slate-700">{row.transactionCount}</td>
                          <td className="px-2.5 py-1.5 text-red-700 font-semibold">{formatCurrency(row.debits)}</td>
                          <td className="px-2.5 py-1.5 text-emerald-700 font-semibold">{formatCurrency(row.credits)}</td>
                          <td className={`px-2.5 py-1.5 font-bold ${row.netMovement >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {formatCurrency(row.netMovement)}
                          </td>
                        </tr>
                      ))}
                      {!report?.tellerSummary.length && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                            No teller breakdown available yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 text-xs text-slate-500 print:hidden">
          <div>
            Generated from the API at {report?.generatedDate || "—"} {report?.generatedTime || "--:--:--"}.
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/member-details/accounts-details" className="font-semibold text-emerald-700 hover:underline">
              View Member Account History
            </Link>
            <span>Finance Solutions 08.45.u style output</span>
          </div>
        </div>
      </div>

      <Sheet open={memberOpen} onOpenChange={setMemberOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Transaction Drill-Down</SheetTitle>
            <SheetDescription>
              Member history for the selected savings account within the current date range.
            </SheetDescription>
          </SheetHeader>

          {memberLoading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading account history...
            </div>
          ) : memberDetail?.member ? (
            <div className="mt-6 space-y-4">
              <Card>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Member</div>
                      <div className="text-lg font-bold text-slate-950">{memberDetail.member.memberName}</div>
                      <div className="text-sm text-slate-600">{memberDetail.member.accountNumber}</div>
                    </div>
                    <Badge variant="outline">{memberDetail.member.status}</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Product</div>
                      <div className="font-medium">{memberDetail.member.productCode} - {memberDetail.member.productName}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Branch</div>
                      <div className="font-medium">{memberDetail.member.branchName || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Passbook Count</div>
                      <div className="font-medium">{memberDetail.member.passbookCount}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Opening Date</div>
                      <div className="font-medium">{normalizeDateDisplay(memberDetail.member.openingDate)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Last Transaction</div>
                      <div className="font-medium">{normalizeDateDisplay(memberDetail.member.lastTransactionDate)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Running Balance</div>
                      <div className="font-semibold text-emerald-700">{formatCurrency(memberDetail.member.runningBalance)}</div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    Teller activity: {memberDetail.member.tellerNames.length ? memberDetail.member.tellerNames.join(", ") : "System"}
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/dashboard/member-details/accounts-details">View Full Account History</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Transaction History</CardTitle>
                  <CardDescription>All transactions for this account in the selected range.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full min-w-0 overflow-x-auto">
                    <table className="w-full table-fixed border-collapse text-xs">
                      <thead className="bg-slate-950 text-white">
                        <tr>
                          <th className="w-[20%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Date</th>
                          <th className="w-[15%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Trx No.</th>
                          <th className="w-[25%] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Type</th>
                          <th className="w-[13%] px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-wider">Debit</th>
                          <th className="w-[13%] px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-wider">Credit</th>
                          <th className="w-[14%] px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-wider">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberDetail.transactions.map((tx) => (
                          <tr key={tx.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                            <td className="px-2.5 py-1.5 text-slate-700">{normalizeDateDisplay(tx.trxDate)}</td>
                            <td className="px-2.5 py-1.5 font-mono text-slate-600 truncate max-w-0" title={tx.trxNo}>{tx.trxNo}</td>
                            <td className="px-2.5 py-1.5 text-slate-800 truncate max-w-0" title={tx.transactionTypeLabel}>{tx.transactionTypeLabel}</td>
                            <td className="px-2.5 py-1.5 text-right text-red-700 font-semibold">{tx.debitAmount > 0 ? formatCurrency(tx.debitAmount) : "-"}</td>
                            <td className="px-2.5 py-1.5 text-right text-emerald-700 font-semibold">{tx.creditAmount > 0 ? formatCurrency(tx.creditAmount) : "-"}</td>
                            <td className="px-2.5 py-1.5 text-right font-bold text-slate-900">{formatCurrency(tx.runningBalance)}</td>
                          </tr>
                        ))}
                        {!memberDetail.transactions.length && (
                          <tr>
                            <td colSpan={6} className="px-2.5 py-8 text-center text-slate-500">
                              No transactions found for this account in the selected date range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Click any transaction row to inspect the member history.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
