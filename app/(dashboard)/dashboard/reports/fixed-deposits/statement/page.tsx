"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, ChevronDown, FileText, Printer, RefreshCw, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { printReport } from "@/lib/reports/print-report";

interface FdSearchResult {
  id: string;
  accountNumber: string;
  memberName: string;
  memberPhone: string;
  principalAmount: number;
  maturityAmount: number;
  interestRate: number;
  termMonths: number;
  startDate: string;
  maturityDate: string;
  status: string;
  branch: string;
}

interface AccountInfo {
  accountNumber: string;
  memberName: string;
  accountType: string;
  openedDate: string;
  maturityDate: string;
  interestRate: number;
  currentBalance: number;
  status: string;
  branch: string;
}

interface StatementEntry {
  date: string;
  transactionRef: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

function ugx(n: number) {
  return new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(n);
}

export default function FixedDepositStatementPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FdSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedFd, setSelectedFd] = useState<FdSearchResult | null>(null);

  const [startDate, setStartDate] = useState(format(new Date(new Date().setFullYear(new Date().getFullYear() - 1)), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [transactions, setTransactions] = useState<StatementEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({ q });
      const response = await fetch(`/api/v1/reports/fixed-deposits/search?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      setSearchResults(json.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSelectedFd(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => void fetchSearch(value), 300);
  }, [fetchSearch]);

  const handleSelect = useCallback((fd: FdSearchResult) => {
    setSelectedFd(fd);
    setSearchQuery(fd.accountNumber);
    setSearchOpen(false);
  }, []);

  const fetchStatement = useCallback(async () => {
    const fdId = selectedFd?.id;
    if (!fdId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ accountId: fdId, startDate, endDate });
      const response = await fetch(`/api/v1/reports/fixed-deposits/statement?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load statement");
      setAccountInfo(result.accountInfo);
      setTransactions(result.transactions || []);
      setGeneratedAt(new Date().toLocaleString("en-UG"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load statement");
      setAccountInfo(null);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedFd, startDate, endDate]);

  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, []);

  const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);

  const handlePrint = useCallback(() => {
    if (!accountInfo || transactions.length === 0) {
      toast.error("No statement data to print. Load a statement first.");
      return;
    }
    const rows = transactions.map((t) => [
      new Date(t.date).toLocaleDateString("en-UG"),
      t.transactionRef,
      t.description,
      t.debit > 0 ? t.debit : "-",
      t.credit > 0 ? t.credit : "-",
      t.balance,
    ]);
    printReport({
      title: "Fixed Deposit Statement",
      subtitle: `Account: ${accountInfo.accountNumber} - ${accountInfo.memberName}`,
      period: `From: ${startDate} To: ${endDate}`,
      filters: {
        "Account No.": accountInfo.accountNumber,
        Member: accountInfo.memberName,
        Branch: accountInfo.branch,
        Rate: `${accountInfo.interestRate}%`,
        Status: accountInfo.status,
      },
      headers: ["Date", "Ref No.", "Description", "Debit (UGX)", "Credit (UGX)", "Balance (UGX)"],
      rows,
      totals: ["Total", "", `${transactions.length} entries`, totalDebits, totalCredits, accountInfo.currentBalance],
    });
  }, [accountInfo, transactions, totalDebits, totalCredits, startDate, endDate]);

  const selectedLabel = selectedFd
    ? `${selectedFd.accountNumber} - ${selectedFd.memberName}`
    : "Search by account number, member name, or phone...";

  return (
    <ReportPageLayout
      title="Fixed Deposit Statement"
      description="Transaction history for a fixed deposit account."
      generatedAt={generatedAt || undefined}
      filters={
        <div className="grid w-full gap-4 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Fixed Deposit Account</Label>
            <Popover
              open={searchOpen}
              onOpenChange={(open) => {
                setSearchOpen(open);
                if (open) {
                  setSearchQuery(selectedFd?.accountNumber || "");
                  void fetchSearch(selectedFd?.accountNumber || "");
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={searchOpen} className="w-full justify-between font-normal">
                  <span className="truncate">{selectedLabel}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by account, name, or phone..."
                    value={searchQuery}
                    onValueChange={handleSearchChange}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {searchLoading ? "Searching..." : "No matching accounts."}
                    </CommandEmpty>
                    <CommandGroup heading="Fixed Deposit Accounts">
                      {searchResults.map((fd) => {
                        const isSelected = selectedFd?.id === fd.id;
                        return (
                          <CommandItem key={fd.id} value={`${fd.accountNumber} ${fd.memberName} ${fd.memberPhone}`} onSelect={() => handleSelect(fd)}>
                            <Check className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                            <div className="flex w-full flex-col">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{fd.accountNumber}</span>
                                <Badge variant={fd.status === "ACTIVE" ? "secondary" : "destructive"} className="text-xs">{fd.status}</Badge>
                              </div>
                              <span className="text-sm text-slate-600">{fd.memberName}</span>
                              <span className="text-xs text-slate-500">
                                {fd.termMonths} months at {fd.interestRate}%
                                {fd.memberPhone ? ` \u2022 ${fd.memberPhone}` : ""}
                                {" \u2022 "}
                                {ugx(fd.principalAmount)}
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
            <p className="mt-1 text-xs text-slate-500">Search and select a fixed deposit account.</p>
          </div>
          <div className="space-y-2">
            <Label>From Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end gap-2 lg:col-span-4">
            <Button onClick={fetchStatement} disabled={loading || !selectedFd} icon={RefreshCw} iconPosition="left" variant="outline">
              {loading ? "Loading..." : "Refresh"}
            </Button>
            <Button onClick={handlePrint} disabled={!accountInfo || transactions.length === 0} icon={Printer} iconPosition="left" variant="outline">
              Print
            </Button>
          </div>
        </div>
      }
      summary={
        accountInfo ? (
          <>
            <ReportSummaryCard title="Transactions" value={transactions.length.toString()} icon={FileText} />
            <ReportSummaryCard title="Total Debits" value={ugx(totalDebits)} icon={TrendingDown} className="border-rose-200 bg-rose-50/50" />
            <ReportSummaryCard title="Total Credits" value={ugx(totalCredits)} icon={TrendingUp} className="border-emerald-200 bg-emerald-50/50" />
            <ReportSummaryCard title="Current Balance" value={ugx(accountInfo.currentBalance)} icon={Wallet} />
          </>
        ) : null
      }
    >
      <div className="space-y-4 p-4">
        {accountInfo && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><span className="text-muted-foreground">Account No.:</span> <span className="font-medium">{accountInfo.accountNumber}</span></div>
              <div><span className="text-muted-foreground">Member:</span> <span className="font-medium">{accountInfo.memberName}</span></div>
              <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{accountInfo.accountType}</span></div>
              <div><span className="text-muted-foreground">Branch:</span> <span className="font-medium">{accountInfo.branch}</span></div>
              <div><span className="text-muted-foreground">Opened:</span> <span className="font-medium">{new Date(accountInfo.openedDate).toLocaleDateString("en-UG")}</span></div>
              <div><span className="text-muted-foreground">Maturity:</span> <span className="font-medium">{new Date(accountInfo.maturityDate).toLocaleDateString("en-UG")}</span></div>
              <div><span className="text-muted-foreground">Rate:</span> <span className="font-medium">{accountInfo.interestRate}%</span></div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <Badge variant={accountInfo.status === "ACTIVE" ? "secondary" : "destructive"} className="text-xs">
                  {accountInfo.status}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {!accountInfo && !loading && (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Search and select a fixed deposit account above to view its statement.
          </div>
        )}

        {transactions.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Ref No.</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Debit (UGX)</th>
                  <th className="px-3 py-2 text-right font-semibold">Credit (UGX)</th>
                  <th className="px-3 py-2 text-right font-semibold">Balance (UGX)</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((row, index) => (
                  <tr key={`${row.transactionRef}-${index}`} className={`border-b ${index % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                    <td className="px-3 py-2">{new Date(row.date).toLocaleDateString("en-UG")}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.transactionRef}</td>
                    <td className="px-3 py-2">{row.description}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={row.debit > 0 ? "text-rose-600 font-medium" : "text-muted-foreground"}>
                        {row.debit > 0 ? ugx(row.debit) : "\u2014"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={row.credit > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                        {row.credit > 0 ? ugx(row.credit) : "\u2014"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      <span className={row.balance < 0 ? "text-destructive" : ""}>{ugx(row.balance)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40">
                <tr className="border-t-2 font-semibold">
                  <td className="px-3 py-3" colSpan={3}>Total ({transactions.length} entries)</td>
                  <td className="px-3 py-3 text-right text-rose-600">{ugx(totalDebits)}</td>
                  <td className="px-3 py-3 text-right text-emerald-600">{ugx(totalCredits)}</td>
                  <td className="px-3 py-3 text-right">{accountInfo ? ugx(accountInfo.currentBalance) : ""}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </ReportPageLayout>
  );
}

