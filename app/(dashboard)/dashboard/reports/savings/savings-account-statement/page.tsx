"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, Download, Printer, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { SaccoReportHeader } from "@/components/reports/SaccoReportHeader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Branch = { id: string; name: string };
type AccountOption = {
  id: string;
  accountNumber: string;
  memberName: string;
  memberPhone: string;
  accountType: string;
  balance: number;
  isActive: boolean;
};

type StatementReport = {
  saccoName: string;
  location: string;
  reportTitle: string;
  generatedDate: string;
  generatedTime: string;
  dateRange: { from: string; to: string };
  branchLabel: string;
  member: {
    name: string;
    accountNumber: string;
    productType: string;
    productCode: string;
    referenceNumber: string;
    phone: string;
    idCardNumber: string;
    physicalPostalAddress: string;
    accountStatus: string;
    nextOfKin: Array<{ name: string; relationship?: string | null; phone?: string | null; percentage: number }>;
  };
  openingBalance: number;
  transactions: Array<{
    date: string;
    valueDate: string;
    reference: string;
    description: string;
    fee: number;
    debit: number;
    credit: number;
    balance: number;
    teller: string;
  }>;
  footer: {
    totalDebits: number;
    totalCredits: number;
    closingBalance: number;
  };
};

const today = new Date();
const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
const defaultTo = today.toISOString().split("T")[0];

function formatCurrency(value: number) {
  return `UGX ${new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(Math.round(value || 0))}`;
}

function formatBalance(value: number) {
  const amount = Math.abs(Math.round(value || 0));
  if (!amount) return "UGX 0";
  return `UGX ${new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(amount)} ${value < 0 ? "DR" : "CR"}`;
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function printableDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}

export default function SavingsAccountStatementPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountQuery, setAccountQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<StatementReport | null>(null);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  const [hasLoadedReport, setHasLoadedReport] = useState(false);

  const [filters, setFilters] = useState({
    branchId: "all",
    accountId: searchParams.get("accountId") || "",
    accountNumber: searchParams.get("accountNumber") || "",
    dateFrom: searchParams.get("dateFrom") || defaultFrom,
    dateTo: searchParams.get("dateTo") || defaultTo,
  });
  const filtersRef = useRef(filters);
  const lastLoadedFiltersRef = useRef<typeof filters | null>(null);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: status === "authenticated",
    intervalMs: 20000,
  });

  const isAdmin = String((session?.user as any)?.role || "").toUpperCase() === "ADMIN";
  const userBranchId = (session?.user as any)?.branchId as string | undefined;

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const activeBranchName = useMemo(() => {
    if (!isAdmin) return branches.find((branch) => branch.id === userBranchId)?.name || "Assigned Branch";
    if (filters.branchId === "all") return "All Branches";
    return branches.find((branch) => branch.id === filters.branchId)?.name || filters.branchId;
  }, [branches, filters.branchId, isAdmin, userBranchId]);

  const selectedAccountLabel = useMemo(() => {
    if (selectedAccount) {
      return `${selectedAccount.accountNumber} - ${selectedAccount.memberName}`;
    }
    if (filters.accountNumber) {
      return `Selected: ${filters.accountNumber}`;
    }
    return "Select Account";
  }, [filters.accountNumber, selectedAccount]);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/branches", { cache: "no-store" });
      if (!response.ok) return;
      const json = await response.json();
      setBranches((json.data || []).map((branch: any) => ({ id: branch.id, name: branch.name })));
    } catch {
      toast.error("Failed to load branches");
    }
  }, []);

  const fetchAccounts = useCallback(async (query: string, options?: { initial?: boolean }) => {
    if (status !== "authenticated") return;
    const trimmed = query.trim();
    const initial = options?.initial ?? false;
    if (!initial && trimmed.length < 2) {
      setAccounts([]);
      setAccountLoading(false);
      return;
    }

    setAccountLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("includeInactive", "true");
      params.set("savingsOnly", "true");
      if (initial) {
        params.set("initial", "true");
      } else {
        params.set("q", trimmed);
      }
      const response = await fetch(`/api/v1/accounts/search?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Failed to fetch accounts");
      setAccounts((json.data || []).map((account: any) => ({
        id: account.id,
        accountNumber: account.accountNumber,
        memberName: account.memberName || "Unknown",
        memberPhone: account.memberPhone || "",
        accountType: account.accountType || "Unknown",
        balance: Number(account.balance || 0),
        isActive: Boolean(account.isActive),
      })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch accounts");
    } finally {
      setAccountLoading(false);
    }
  }, [status]);

  const loadReport = useCallback(async (override?: typeof filters) => {
    if (status !== "authenticated") return;
    setLoading(true);
    try {
      const current = override || filtersRef.current;
      const params = new URLSearchParams();
      if (isAdmin && current.branchId !== "all") params.set("branchId", current.branchId);
      if (!isAdmin && userBranchId) params.set("branchId", userBranchId);
      if (current.accountId) params.set("accountId", current.accountId);
      if (current.accountNumber) params.set("accountNumber", current.accountNumber);
      if (current.dateFrom) params.set("dateFrom", current.dateFrom);
      if (current.dateTo) params.set("dateTo", current.dateTo);

      const response = await fetch(`/api/v1/reports/savings/account-statement?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Failed to load savings account statement");
      setReport(json?.data?.data || json?.data || null);
      lastLoadedFiltersRef.current = current;
      setHasLoadedReport(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load savings account statement");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, status, userBranchId]);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (status !== "authenticated" || !accountOpen) return;
    const timer = setTimeout(() => {
      void fetchAccounts(accountQuery, { initial: true });
    }, 250);
    return () => clearTimeout(timer);
  }, [accountOpen, accountQuery, fetchAccounts, status]);

  useEffect(() => {
    if (!isAdmin && userBranchId) {
      setFilters((current) => ({ ...current, branchId: userBranchId }));
    }
  }, [isAdmin, userBranchId]);

  useEffect(() => {
    if (status === "authenticated" && !hasAutoLoaded && (filters.accountId || filters.accountNumber)) {
      setHasAutoLoaded(true);
      void loadReport();
    }
  }, [filters.accountId, filters.accountNumber, hasAutoLoaded, loadReport, status]);

  useEffect(() => {
    if (!hasLoadedReport) return;
    const lastLoaded = lastLoadedFiltersRef.current;
    if (!lastLoaded) return;
    void loadReport(lastLoaded);
  }, [hasLoadedReport, liveRefreshVersion, loadReport]);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      const current = filtersRef.current;
      if (isAdmin && current.branchId !== "all") params.set("branchId", current.branchId);
      if (!isAdmin && userBranchId) params.set("branchId", userBranchId);
      if (current.accountId) params.set("accountId", current.accountId);
      if (current.accountNumber) params.set("accountNumber", current.accountNumber);
      if (current.dateFrom) params.set("dateFrom", current.dateFrom);
      if (current.dateTo) params.set("dateTo", current.dateTo);
      params.set("format", "xlsx");

      const response = await fetch(`/api/v1/reports/savings/account-statement?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to export statement");
      const buffer = await response.arrayBuffer();
      downloadBuffer(buffer, `savings-account-statement-${current.accountNumber || "account"}.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export statement");
    } finally {
      setExporting(false);
    }
  }, [filters.accountId, filters.accountNumber, filters.branchId, filters.dateFrom, filters.dateTo, isAdmin, userBranchId]);

  const handlePrint = useCallback(() => window.print(), []);

  const handleAccountSelect = useCallback((account: AccountOption) => {
    setSelectedAccount(account);
    setAccountQuery("");
    setAccountOpen(false);
    setFilters((current) => ({
      ...current,
      accountId: account.id,
      accountNumber: account.accountNumber,
    }));
    setHasAutoLoaded(true);
    void loadReport({
      ...filtersRef.current,
      accountId: account.id,
      accountNumber: account.accountNumber,
    });
  }, [loadReport]);

  const txs = report?.transactions || [];
  const data = report;

  return (
    <ReportPageLayout
      title="Savings Account Statement"
      description="Single-account statement with transactions, balances, and account details."
      fitContent
      summaryFirst
      summary={
        data ? (
          <>
            <Card className="border-emerald-100">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Opening Balance</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{formatBalance(data.openingBalance)}</div>
              </CardContent>
            </Card>
            <Card className="border-emerald-100">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Total Debits</div>
                <div className="mt-1 text-lg font-bold text-red-700">{formatCurrency(data.footer.totalDebits)}</div>
              </CardContent>
            </Card>
            <Card className="border-emerald-100">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Total Credits</div>
                <div className="mt-1 text-lg font-bold text-emerald-700">{formatCurrency(data.footer.totalCredits)}</div>
              </CardContent>
            </Card>
            <Card className="border-emerald-100">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Closing Balance</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(data.footer.closingBalance)}</div>
              </CardContent>
            </Card>
          </>
        ) : null
      }
      filters={
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label>Account Number</Label>
            <Input
              value={filters.accountNumber}
              onChange={(e) => {
                const nextValue = e.target.value;
                setSelectedAccount(null);
                setFilters((c) => ({
                  ...c,
                  accountId: "",
                  accountNumber: nextValue,
                }));
              }}
              placeholder="e.g. 200200.0590"
            />
          </div>
          <div className="lg:col-span-2">
            <Label>Select Account</Label>
            <Popover
              open={accountOpen}
              onOpenChange={(open) => {
                setAccountOpen(open);
                if (open) {
                  setAccountQuery(filters.accountNumber || selectedAccount?.accountNumber || "");
                  void fetchAccounts(filters.accountNumber || selectedAccount?.accountNumber || "", { initial: true });
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={accountOpen} className="w-full justify-between font-normal">
                  <span className="truncate">{selectedAccountLabel}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by account, name, or phone..."
                    value={accountQuery}
                    onValueChange={setAccountQuery}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {accountLoading ? "Loading accounts..." : "No matching accounts."}
                    </CommandEmpty>
                    <CommandGroup heading="Matched accounts">
                      {accounts.map((account) => {
                        const isSelected = selectedAccount?.id === account.id;
                        return (
                          <CommandItem
                            key={account.id}
                            value={`${account.accountNumber} ${account.memberName} ${account.memberPhone}`}
                            onSelect={() => handleAccountSelect(account)}
                          >
                            <Check className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                            <div className="flex w-full flex-col">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{account.accountNumber}</span>
                                <span className="text-xs text-slate-500">{account.isActive ? "ACTIVE" : "INACTIVE"}</span>
                              </div>
                              <span className="text-sm text-slate-600">{account.memberName}</span>
                              <span className="text-xs text-slate-500">
                                {account.accountType}
                                {account.memberPhone ? ` • ${account.memberPhone}` : ""}
                                {" • "}
                                {formatCurrency(account.balance)}
                              </span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="mt-1 text-xs text-slate-500">Search and select an exact account. You can also type the account number manually.</p>
          </div>
          <div>
            <Label>From</Label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters((c) => ({ ...c, dateFrom: e.target.value }))} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={filters.dateTo} onChange={(e) => setFilters((c) => ({ ...c, dateTo: e.target.value }))} />
          </div>
          <div className="lg:col-span-2">
            <Label>Branch</Label>
            {isAdmin ? (
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filters.branchId}
                onChange={(e) => setFilters((c) => ({ ...c, branchId: e.target.value }))}
              >
                <option value="all">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            ) : (
              <Input value={activeBranchName} disabled />
            )}
          </div>
          <div className="flex items-end gap-2 lg:col-span-4">
            <Button className="flex-1" onClick={() => void loadReport()} disabled={loading}>
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Report
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleExport} disabled={exporting || !data}>
              {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export to Excel
            </Button>
            <Button variant="outline" className="flex-1" onClick={handlePrint} disabled={!data}>
              <Printer className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Card className="border-none shadow-none">
          <CardHeader className="px-0 pb-3">
            <SaccoReportHeader
              title="Account Statement"
              subtitle="Single-account savings history"
              branchLabel={data?.branchLabel || activeBranchName}
              periodLabel={data ? `${data.dateRange.from} to ${data.dateRange.to}` : `${filters.dateFrom} to ${filters.dateTo}`}
              generatedAt={data ? `${data.generatedDate} ${data.generatedTime}` : undefined}
            />
          </CardHeader>
          <CardContent className="px-0">
            {data ? (
              <div className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="rounded-xl border p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Account Holder</div>
                    <div className="mt-1 text-lg font-bold">{data.member.name}</div>
                    <div className="text-sm text-slate-600">{data.member.accountNumber}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Product</div>
                    <div className="mt-1 text-lg font-bold">{data.member.productType}</div>
                    <div className="text-sm text-slate-600">{data.member.referenceNumber}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                    <Badge className="mt-2">{data.member.accountStatus}</Badge>
                    <div className="mt-2 text-sm text-slate-600">{data.member.phone || "-"}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Selected Account</div>
                      <div className="mt-1 font-semibold">{selectedAccountLabel}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Statement Scope</div>
                      <div className="mt-1 font-medium">{data.dateRange.from} to {data.dateRange.to}</div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-950 text-white">
                      <tr>
                        {["Date", "Value Date", "Reference", "Description/Narration", "Fee", "Debit", "Credit", "Balance"].map((header) => (
                          <th key={header} className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-3 py-2" colSpan={7}>Opening Balance</td>
                        <td className="px-3 py-2 text-right">{formatBalance(data.openingBalance)}</td>
                      </tr>
                      {txs.map((tx) => (
                        <tr key={`${tx.date}-${tx.reference}`} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="px-3 py-2 whitespace-nowrap">{printableDate(tx.date)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{printableDate(tx.valueDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{tx.reference}</td>
                          <td className="px-3 py-2">{tx.description}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{tx.fee > 0 ? formatCurrency(tx.fee) : "-"}</td>
                          <td className="px-3 py-2 text-right text-red-700">{tx.debit > 0 ? formatCurrency(tx.debit) : "-"}</td>
                          <td className="px-3 py-2 text-right text-emerald-700">{tx.credit > 0 ? formatCurrency(tx.credit) : "-"}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatBalance(tx.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Opening Balance</div>
                    <div className="mt-1 text-lg font-bold">{formatBalance(data.openingBalance)}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Total Debits</div>
                    <div className="mt-1 text-lg font-bold text-red-700">{formatCurrency(data.footer.totalDebits)}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Closing Balance</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{formatBalance(data.footer.closingBalance)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-10 text-center text-slate-500">
                Select an account, then generate the statement.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ReportPageLayout>
  );
}
