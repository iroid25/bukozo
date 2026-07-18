"use client";

export const dynamic = "force-dynamic";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  Printer,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { SaccoReportHeader } from "@/components/reports/SaccoReportHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { printReport } from "@/lib/reports/print-report";

type SearchResult = {
  accountNumber: string;
  accountTitle: string;
  product: string;
  nubanCode: string;
  phone: string;
  address: string;
  status: string;
  branchName: string | null;
};

type ShareTransactionRow = {
  id: string;
  trxDate: string;
  valueDate: string;
  trxNo: string;
  voucherNo: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balanceAfter: number;
  balanceType: "CR" | "DR";
  daysSincePrev: number;
  trxTypeCode: string;
  trxTypeLabel: string;
  processedBy: string;
  amount: number;
  shares: number;
  sharesBefore: number;
  sharesAfter: number;
  rawReference: string | null;
};

type ShareStatementReport = {
  saccoName: string;
  location: string;
  reportTitle: string;
  generatedDate: string;
  generatedTime: string;
  currency: "UGX";
  dateRange: { from: string; to: string };
  member: {
    accountTitle: string;
    accountNumber: string;
    product: string;
    nubanCode: string;
    passbookCount: number;
    phone: string;
    idCardType: string;
    address: string;
    status: string;
    nextOfKin: Array<{ name: string; relationship?: string | null; phone?: string | null; percentage: number }>;
    branchName: string | null;
    branchId: string | null;
  };
  openingBalance: { amount: number; type: "CR" | "DR" };
  transactions: ShareTransactionRow[];
  periodTotals: {
    transactionCount: number;
    totalDebits: number;
    totalCredits: number;
  };
  closingBalances: {
    totalClearedAndUncleared: { amount: number; type: "CR" | "DR" };
    unclearedBalance: { amount: number; type: "CR" | "DR" };
    clearedBalance: { amount: number; type: "CR" | "DR" };
    amountBlocked: number;
  };
  growth: Array<{ date: string; balance: number }>;
  reconciliation: {
    productCode: string;
    productName: string;
    equityAccountCode: string | null;
    systemBalance: number;
    ledgerBalance: number;
    difference: number;
    balanced: boolean;
  };
};

type BranchOption = { id: string; name: string };
type ShareProductType = { id: string; name: string; code: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function yearStartIso() {
  return `${new Date().getFullYear()}-01-01`;
}
const DEFAULT_FROM = yearStartIso();
const DEFAULT_TO = todayIso();
const CURRENCY = new Intl.NumberFormat("en-US");

const TRANSACTION_LEGEND = [
  ["A", "Savings Deposit"],
  ["B", "Savings Withdrawal"],
  ["C", "Shares Deposit"],
  ["D", "Shares Withdrawal"],
  ["E", "Income Entry"],
  ["F", "Expense Entry"],
  ["G", "General Journal"],
  ["H", "Error Correction"],
  ["I", "Loan Disbursement"],
  ["J", "Loan Repayment"],
  ["K", "Penalty"],
  ["L", "Write-offs"],
  ["M", "Reschedule a Loan"],
  ["N", "Fees & Charges"],
  ["O", "Member Transactions"],
  ["P", "Savings Interest"],
  ["Q", "Savings Transaction Fee"],
  ["R", "Minimum Balance Fee"],
  ["S", "Ledger Fee"],
  ["T", "Transfer Amount"],
  ["U", "Fixed Asset Depreciation"],
  ["V", "Provision"],
  ["W", "Penalty Calculation"],
  ["X", "Interest Due Capitalization"],
  ["Y", "Batch Transactions"],
];

function formatCurrency(value: number) {
  const amount = Math.round(Number(value || 0));
  return `UGX ${CURRENCY.format(amount)}`;
}

function formatBalance(value: number, type: "CR" | "DR") {
  return `${formatCurrency(value)} ${type}`;
}

function formatDate(value: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-GB");
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
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

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (!value) return;
    search.set(key, value);
  });
  return search.toString();
}

function daysBand(days: number) {
  if (days <= 30) return "bg-emerald-50 text-emerald-700";
  if (days <= 180) return "bg-amber-50 text-amber-700";
  if (days <= 365) return "bg-orange-50 text-orange-700";
  return "bg-red-50 text-red-700";
}

function amountTone(value: number, isCredit: boolean) {
  if (value >= 1_000_000) return "bg-amber-50 text-amber-900";
  return isCredit ? "text-emerald-700" : "text-red-700";
}

function buildChartPath(points: Array<{ date: string; balance: number }>) {
  if (points.length < 2) return "";
  const width = 760;
  const height = 180;
  const values = points.map((point) => point.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.balance - min) / spread) * (height - 20) - 10;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function ShareAccountStatementPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const didInitialLoad = useRef(false);

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [shareProducts, setShareProducts] = useState<ShareProductType[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ShareStatementReport | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedRow, setSelectedRow] = useState<ShareTransactionRow | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [filters, setFilters] = useState({
    branchId: "all",
    productCode: "all",
    accountNumber: "",
    search: "",
    dateFrom: DEFAULT_FROM,
    dateTo: DEFAULT_TO,
  });
  const filtersRef = useRef(filters);
  const [hasLoadedReport, setHasLoadedReport] = useState(false);
  const lastLoadedFiltersRef = useRef<typeof filters | null>(null);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: status === "authenticated",
    intervalMs: 20000,
  });

  const isAdmin = String((session?.user as any)?.role || "").toUpperCase() === "ADMIN";

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const sessionBranchId = (session?.user as any)?.branchId || "all";
    setFilters((current) => ({
      ...current,
      branchId: isAdmin ? "all" : sessionBranchId,
      accountNumber: searchParams.get("accountNumber") || searchParams.get("account_number") || current.accountNumber,
    }));
  }, [isAdmin, searchParams, session, status]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === filters.branchId) || null,
    [branches, filters.branchId],
  );

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (!filters.search.trim()) {
      setSearchResults([]);
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      void searchAccounts();
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  const chartPath = useMemo(() => buildChartPath(report?.growth || []), [report?.growth]);

  async function loadBranches() {
    if (status !== "authenticated") return;

    setLoadingBranches(true);
    try {
      const [branchRes, atRes] = await Promise.all([
        fetch("/api/v1/branches", { cache: "no-store" }),
        fetch("/api/v1/account-types?linkedOnly=true", { cache: "no-store" }),
      ]);
      const branchJson = await branchRes.json();
      if (!branchRes.ok) throw new Error(branchJson?.error || "Failed to load branches");
      setBranches(Array.isArray(branchJson?.data) ? branchJson.data.map((b: any) => ({ id: b.id, name: b.name })) : []);
      if (atRes.ok) {
        const atJson = await atRes.json();
        const types: ShareProductType[] = (atJson.data || [])
          .filter((t: any) => t.isShareAccount && t.ledgerAccount?.accountCode)
          .map((t: any) => ({ id: t.id, name: t.name, code: t.ledgerAccount.accountCode }));
        setShareProducts(types);
      }
    } catch (loadError) {
      console.error(loadError);
    } finally {
      setLoadingBranches(false);
    }
  }

  async function searchAccounts(term = filters.search) {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const query = buildQuery({
        search: term.trim(),
        productCode: filters.productCode === "all" ? undefined : filters.productCode,
        branchId: filters.branchId === "all" ? undefined : filters.branchId,
      });
      const response = await fetch(`/api/v1/reports/shares/account-statement/search?${query}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Failed to search accounts");
      setSearchResults(Array.isArray(json?.data) ? json.data : []);
    } catch (searchError) {
      console.error(searchError);
      toast.error(searchError instanceof Error ? searchError.message : "Failed to search accounts");
    } finally {
      setSearching(false);
    }
  }

  const loadReport = useCallback(async (override?: typeof filters) => {
    if (status !== "authenticated") return;

    const current = override || filtersRef.current;
    if (!current.accountNumber.trim()) {
      toast.error("Choose a share account first");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const query = buildQuery({
        accountNumber: current.accountNumber.trim(),
        productCode: current.productCode === "all" ? undefined : current.productCode,
        branchId: current.branchId === "all" ? undefined : current.branchId,
        dateFrom: current.dateFrom,
        dateTo: current.dateTo,
      });
      const response = await fetch(`/api/v1/reports/shares/account-statement?${query}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Failed to load share statement");
      setReport(json?.data || null);
      setSelectedRow(null);
      lastLoadedFiltersRef.current = current;
      setHasLoadedReport(true);
      toast.success("Share statement loaded");
    } catch (loadError) {
      console.error(loadError);
      const message = loadError instanceof Error ? loadError.message : "Failed to load share statement";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || didInitialLoad.current) return;
    didInitialLoad.current = true;
    void loadBranches();

    const accountNumber = searchParams.get("accountNumber") || searchParams.get("account_number") || "";
    if (accountNumber) {
      const sessionBranchId = (session?.user as any)?.branchId || "all";
      void loadReport({
        ...filters,
        accountNumber,
        branchId: isAdmin ? "all" : sessionBranchId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!hasLoadedReport) return;
    const lastLoaded = lastLoadedFiltersRef.current;
    if (!lastLoaded) return;
    void loadReport(lastLoaded);
  }, [hasLoadedReport, liveRefreshVersion, loadReport]);

  async function exportExcel() {
    if (!report) {
      toast.error("Generate the statement first");
      return;
    }

    setExporting(true);
    try {
      const current = filtersRef.current;
      const query = buildQuery({
        accountNumber: current.accountNumber.trim(),
        productCode: current.productCode === "all" ? undefined : current.productCode,
        branchId: current.branchId === "all" ? undefined : current.branchId,
        dateFrom: current.dateFrom,
        dateTo: current.dateTo,
      });
      const response = await fetch(`/api/v1/reports/shares/account-statement/export?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error || "Failed to export statement");
      }
      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `share-account-statement-${report.member.accountNumber}.xlsx`);
      toast.success("Excel export ready");
    } catch (exportError) {
      console.error(exportError);
      toast.error(exportError instanceof Error ? exportError.message : "Failed to export statement");
    } finally {
      setExporting(false);
    }
  }

  const totals = useMemo(() => {
    const closing = report?.closingBalances.totalClearedAndUncleared.amount || 0;
    const opening = report?.openingBalance.amount || 0;
    const net = (report?.periodTotals.totalCredits || 0) - (report?.periodTotals.totalDebits || 0);
    return { closing, opening, net };
  }, [report]);

  const overdrawn = report
    ? report.openingBalance.type === "DR" || report.closingBalances.totalClearedAndUncleared.type === "DR"
    : false;

  const branchLabel = filters.branchId === "all" ? "All branches" : selectedBranch?.name || "Selected branch";

  const data = report;

  const handlePrint = useCallback(() => {
    if (!data) {
      toast.error("Generate the report first before printing.");
      return;
    }
    printReport({
      title: "Share Account Statement",
      subtitle: `${data.member.accountTitle} - ${data.member.accountNumber}`,
      period: `${data.dateRange.from} to ${data.dateRange.to}`,
      filters: {
        Account: data.member.accountNumber,
        Holder: data.member.accountTitle,
        Product: data.member.product,
        Branch: data.member.branchName || "Main",
      },
      headers: ["Date", "Value Date", "Trx No", "Description", "Debit", "Credit", "Balance", "Processed By"],
      rows: data.transactions.map((tx) => [
        tx.trxDate,
        tx.valueDate,
        tx.trxNo,
        tx.description,
        tx.debitAmount > 0 ? tx.debitAmount : "-",
        tx.creditAmount > 0 ? tx.creditAmount : "-",
        tx.balanceAfter,
        tx.processedBy,
      ]),
      totals: [
        "TOTAL",
        "",
        "",
        "",
        data.periodTotals.totalDebits,
        data.periodTotals.totalCredits,
        data.closingBalances.totalClearedAndUncleared.amount,
        "",
      ],
      summary: {
        "Opening Balance": data.openingBalance.amount,
        "Total Debits": data.periodTotals.totalDebits,
        "Total Credits": data.periodTotals.totalCredits,
        "Closing Balance": data.closingBalances.totalClearedAndUncleared.amount,
      },
    });
  }, [data]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <SaccoReportHeader
        title="Account Statement"
        subtitle={`Reporting Date From: ${formatDate(filters.dateFrom)} To: ${formatDate(filters.dateTo)}`}
        branchLabel={branchLabel}
        periodLabel={report ? `${report.dateRange.from} - ${report.dateRange.to}` : undefined}
        generatedAt={report ? `${report.generatedDate} ${report.generatedTime}` : undefined}
      />

      {overdrawn ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          This account is overdrawn
        </div>
      ) : null}

      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Statement Controls</CardTitle>
          <CardDescription>Search a member account, choose the date range, then generate the statement.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="member-search">Member search</Label>
            <div className="flex gap-2">
              <Input
                id="member-search"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void searchAccounts();
                }}
                placeholder="Search by name, account number, or NUBAN"
              />
              <Button type="button" variant="secondary" onClick={() => void searchAccounts()} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {searchResults.length > 0 ? (
              <div className="max-h-52 overflow-auto rounded-lg border">
                {searchResults.map((item) => (
                  <button
                    key={item.accountNumber}
                    type="button"
                    className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                    onClick={() => {
                      const matchedProduct = shareProducts.find(
                        (p) => item.product.includes(p.code) || item.product.toLowerCase().includes(p.name.toLowerCase())
                      );
                      setFilters((current) => ({
                        ...current,
                        accountNumber: item.accountNumber,
                        search: item.accountTitle,
                        productCode: matchedProduct ? matchedProduct.code : current.productCode,
                      }));
                      setSearchResults([]);
                    }}
                  >
                    <div>
                      <div className="font-medium text-slate-900">{item.accountTitle}</div>
                      <div className="text-xs text-slate-500">
                        {item.accountNumber} | {item.product}
                      </div>
                    </div>
                    <Badge variant="outline">{item.status}</Badge>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-number">A/C No.</Label>
            <Input
              id="account-number"
              value={filters.accountNumber}
              onChange={(event) => setFilters((current) => ({ ...current, accountNumber: event.target.value }))}
              placeholder="300502.0021"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-from">From date</Label>
            <Input
              id="date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-to">To date</Label>
            <Input
              id="date-to"
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Product</Label>
            <Select
              value={filters.productCode}
              onValueChange={(value) => setFilters((current) => ({ ...current, productCode: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {shareProducts.map((p) => (
                  <SelectItem key={p.id} value={p.code}>
                    {p.code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Branch</Label>
            <Select
              value={filters.branchId}
              onValueChange={(value) => setFilters((current) => ({ ...current, branchId: value }))}
              disabled={!isAdmin}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingBranches ? "Loading branches..." : "Select branch"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-4">
            <Button type="button" onClick={() => void loadReport()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Statement
            </Button>
            <Button type="button" variant="outline" onClick={() => void exportExcel()} disabled={exporting || !report}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export to Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              disabled={!report}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href="/dashboard/member-details/accounts-details">
                <User className="mr-2 h-4 w-4" />
                Member Accounts
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">{error}</div>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Opening balance</div>
                <div className={`mt-2 text-xl font-semibold ${report.openingBalance.type === "DR" ? "text-red-700" : "text-slate-900"}`}>
                  {formatBalance(report.openingBalance.amount, report.openingBalance.type)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Total credits</div>
                <div className="mt-2 text-xl font-semibold text-emerald-700">{formatCurrency(report.periodTotals.totalCredits)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Total debits</div>
                <div className="mt-2 text-xl font-semibold text-red-700">{formatCurrency(report.periodTotals.totalDebits)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Closing balance</div>
                <div className={`mt-2 text-xl font-semibold ${report.closingBalances.totalClearedAndUncleared.type === "DR" ? "text-red-700" : "text-emerald-700"}`}>
                  {formatBalance(report.closingBalances.totalClearedAndUncleared.amount, report.closingBalances.totalClearedAndUncleared.type)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base">Member Header</CardTitle>
                  <CardDescription>
                    {report.member.accountTitle} | {report.member.accountNumber} | {report.member.product}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-800">{report.member.status}</Badge>
                  <Badge variant="outline">{report.member.passbookCount} passbook(s)</Badge>
                  <Badge variant="outline">{report.member.nubanCode}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">Account Title</span>
                  <span className="font-medium text-slate-900">{report.member.accountTitle}</span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">A/C No.</span>
                  <span className="font-medium text-slate-900">{report.member.accountNumber}</span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">Product</span>
                  <span className="font-medium text-slate-900">{report.member.product}</span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">Phone</span>
                  <span className="font-medium text-slate-900">{report.member.phone || "-"}</span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">Address</span>
                  <span className="font-medium text-slate-900">{report.member.address || "-"}</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">ID Card</span>
                  <span className="font-medium text-slate-900">{report.member.idCardType}</span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">Branch</span>
                  <span className="font-medium text-slate-900">{report.member.branchName || "Main"}</span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">NOK</span>
                  <span className="font-medium text-slate-900">
                    {report.member.nextOfKin.length > 0
                      ? report.member.nextOfKin.map((nok) => `${nok.name} (${nok.percentage.toFixed(2)}%)`).join(", ")
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">Reconciliation</span>
                  <span className={report.reconciliation.balanced ? "font-medium text-emerald-700" : "font-medium text-red-700"}>
                    {report.reconciliation.balanced ? "Balanced" : `Difference ${formatCurrency(report.reconciliation.difference)}`}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">Equity Account</span>
                  <span className="font-medium text-slate-900">{report.reconciliation.equityAccountCode || "-"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Transaction Statement</CardTitle>
              <CardDescription>
                Balance brought forward, transaction rows, running balance, and days since previous transaction.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <ScrollArea className="max-h-[720px]">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                      <tr>
                        <th className="px-3 py-3 text-left font-medium">Trx Date</th>
                        <th className="px-3 py-3 text-left font-medium">Value Date</th>
                        <th className="px-3 py-3 text-left font-medium">Trx No.</th>
                        <th className="px-3 py-3 text-left font-medium">Voucher</th>
                        <th className="px-3 py-3 text-left font-medium">Description</th>
                        <th className="px-3 py-3 text-right font-medium">Debit</th>
                        <th className="px-3 py-3 text-right font-medium">Credit</th>
                        <th className="px-3 py-3 text-right font-medium">Balance</th>
                        <th className="px-3 py-3 text-center font-medium">Days</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <tr className="bg-slate-50">
                        <td className="px-3 py-3 font-medium text-slate-500" colSpan={7}>
                          Balance Brought Forward
                        </td>
                        <td className={`px-3 py-3 text-right font-semibold ${report.openingBalance.type === "DR" ? "text-red-700" : "text-slate-900"}`}>
                          {formatBalance(report.openingBalance.amount, report.openingBalance.type)}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-500">-</td>
                      </tr>
                      {report.transactions.map((txn, index) => {
                        const largeTransaction = Math.max(txn.debitAmount, txn.creditAmount) >= 1_000_000;
                        const isCredit = txn.creditAmount > 0;
                        return (
                          <Fragment key={txn.id}>
                            <tr
                              className={[
                                "cursor-pointer border-t hover:bg-slate-50",
                                largeTransaction ? "bg-amber-50/50" : "",
                              ].join(" ")}
                              onClick={() => setSelectedRow(txn)}
                            >
                              <td className="px-3 py-3 whitespace-nowrap">{formatDate(txn.trxDate)}</td>
                              <td className="px-3 py-3 whitespace-nowrap">{formatDate(txn.valueDate)}</td>
                              <td className="px-3 py-3 font-mono text-xs">{txn.trxNo}</td>
                              <td className="px-3 py-3 font-mono text-xs">{txn.voucherNo}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <span>{txn.description}</span>
                                  {largeTransaction ? <Badge variant="outline" className="border-amber-300 text-amber-700">Large</Badge> : null}
                                  {txn.rawReference?.startsWith("LN-SHARE-") ? (
                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                                      Associate share deduction
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {txn.trxTypeLabel} | Processed by {txn.processedBy}
                                </div>
                              </td>
                              <td className={`px-3 py-3 text-right font-medium ${amountTone(txn.debitAmount, false)}`}>
                                {txn.debitAmount > 0 ? formatCurrency(txn.debitAmount) : "-"}
                              </td>
                              <td className={`px-3 py-3 text-right font-medium ${amountTone(txn.creditAmount, true)}`}>
                                {txn.creditAmount > 0 ? formatCurrency(txn.creditAmount) : "-"}
                              </td>
                              <td className={`px-3 py-3 text-right font-semibold ${txn.balanceType === "DR" ? "text-red-700" : "text-slate-900"}`}>
                                {formatBalance(txn.balanceAfter, txn.balanceType)}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${daysBand(txn.daysSincePrev)}`}>
                                  {txn.daysSincePrev}
                                </span>
                              </td>
                            </tr>
                            <tr className="h-2">
                              <td colSpan={9} />
                            </tr>
                          </Fragment>
                        );
                      })}
                      <tr className="border-t bg-slate-100 font-semibold">
                        <td className="px-3 py-3" colSpan={5}>
                          Total Transactions: {report.periodTotals.transactionCount}
                        </td>
                        <td className="px-3 py-3 text-right text-red-700">{formatCurrency(report.periodTotals.totalDebits)}</td>
                        <td className="px-3 py-3 text-right text-emerald-700">{formatCurrency(report.periodTotals.totalCredits)}</td>
                        <td className="px-3 py-3 text-right">{formatBalance(report.closingBalances.totalClearedAndUncleared.amount, report.closingBalances.totalClearedAndUncleared.type)}</td>
                        <td className="px-3 py-3 text-center">-</td>
                      </tr>
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Closing Balances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">Total (Cleared + Uncleared)</span>
                  <span className={report.closingBalances.totalClearedAndUncleared.type === "DR" ? "font-semibold text-red-700" : "font-semibold text-slate-900"}>
                    {formatBalance(report.closingBalances.totalClearedAndUncleared.amount, report.closingBalances.totalClearedAndUncleared.type)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">Uncleared Balance</span>
                  <span className={report.closingBalances.unclearedBalance.type === "DR" ? "font-semibold text-red-700" : "font-semibold text-slate-900"}>
                    {formatBalance(report.closingBalances.unclearedBalance.amount, report.closingBalances.unclearedBalance.type)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">Cleared Balance</span>
                  <span className={report.closingBalances.clearedBalance.type === "DR" ? "font-semibold text-red-700" : "font-semibold text-slate-900"}>
                    {formatBalance(report.closingBalances.clearedBalance.amount, report.closingBalances.clearedBalance.type)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-slate-500">Amount Blocked</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(report.closingBalances.amountBlocked)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Share Growth</CardTitle>
                <CardDescription>Running balance over time for the selected period.</CardDescription>
              </CardHeader>
              <CardContent>
                {report.growth.length > 1 ? (
                  <svg viewBox="0 0 760 200" className="h-48 w-full rounded-lg bg-slate-50">
                    <defs>
                      <linearGradient id="shareGrowthFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.04" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`${chartPath} L 760 190 L 0 190 Z`}
                      fill="url(#shareGrowthFill)"
                      stroke="none"
                    />
                    <path d={chartPath} fill="none" stroke="#059669" strokeWidth="3" />
                    {report.growth.map((point, index) => {
                      const width = 760;
                      const height = 180;
                      const values = report.growth.map((item) => item.balance);
                      const min = Math.min(...values);
                      const max = Math.max(...values);
                      const spread = max - min || 1;
                      const x = (index / (report.growth.length - 1)) * width;
                      const y = height - ((point.balance - min) / spread) * (height - 20) - 10;
                      return (
                        <circle key={`${point.date}-${index}`} cx={x} cy={y} r="4" fill="#047857">
                          <title>{`${formatDate(point.date)}: ${formatBalance(point.balance, point.balance >= 0 ? "CR" : "DR")}`}</title>
                        </circle>
                      );
                    })}
                  </svg>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                    Not enough transaction points to draw the chart.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <Collapsible open={legendOpen} onOpenChange={setLegendOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between px-6 py-4 text-left">
                  <div>
                    <CardTitle className="text-base">Transaction Type Legend</CardTitle>
                    <CardDescription>Finance Solutions reference map for transaction codes A through Y.</CardDescription>
                  </div>
                  {legendOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Separator />
                <CardContent className="grid gap-2 p-6 md:grid-cols-2 xl:grid-cols-3">
                  {TRANSACTION_LEGEND.map(([code, label]) => (
                    <div key={code} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="font-mono font-semibold text-slate-700">{code}</span>
                      <span className="text-slate-600">{label}</span>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-emerald-100 p-4 text-emerald-700">
              <Share2 className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Load a share account statement</h2>
              <p className="text-sm text-slate-500">
                Search for a member account, choose the period, and generate the statement from the API.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Sheet open={Boolean(selectedRow)} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Transaction Details</SheetTitle>
            <SheetDescription>
              {report?.member.accountTitle} | {report?.member.accountNumber}
            </SheetDescription>
          </SheetHeader>

          {selectedRow ? (
            <div className="mt-6 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Transaction summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Trx No.</span>
                    <span className="font-mono">{selectedRow.trxNo}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Trx Date</span>
                    <span>{formatDate(selectedRow.trxDate)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Value Date</span>
                    <span>{formatDate(selectedRow.valueDate)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Description</span>
                    <span>{selectedRow.description}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Processed by</span>
                    <span>{selectedRow.processedBy}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Type</span>
                    <span className="flex items-center gap-2">
                      <span>{selectedRow.trxTypeLabel}</span>
                      {selectedRow.rawReference?.startsWith("LN-SHARE-") ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                          Associate share deduction
                        </Badge>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Debit</span>
                    <span className="font-semibold text-red-700">
                      {selectedRow.debitAmount > 0 ? formatCurrency(selectedRow.debitAmount) : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Credit</span>
                    <span className="font-semibold text-emerald-700">
                      {selectedRow.creditAmount > 0 ? formatCurrency(selectedRow.creditAmount) : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Running balance</span>
                    <span className={selectedRow.balanceType === "DR" ? "font-semibold text-red-700" : "font-semibold text-slate-900"}>
                      {formatBalance(selectedRow.balanceAfter, selectedRow.balanceType)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Member quick links</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/member-details/accounts-details">
                      <FileText className="mr-2 h-4 w-4" />
                      View Full Account History
                    </Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link
                      href={`/dashboard/reports/savings/savings-listing?search=${encodeURIComponent(report?.member.accountNumber || "")}`}
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Open Savings Listing
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
