"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Search, Printer, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import axios from "axios";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
import { printReport } from "@/lib/reports/print-report";

interface GLPerformanceClientProps {
  userRole: string;
  userBranchId: string;
}

type CoaAccount = {
  id: string;
  accountCode: string;
  accountName: string;
  ledgerType: string;
};

const BROAD_CATEGORIES = [
  { value: "ASSETS", label: "Assets", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "LIABILITIES", label: "Liabilities", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "EQUITY", label: "Equity", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "INCOME", label: "Income", badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "EXPENDITURES", label: "Expenses", badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const BROAD_VALUES = new Set(["all", "ASSETS", "LIABILITIES", "EQUITY", "INCOME", "EXPENDITURES"]);

const LEDGER_TYPE_LABELS: Record<string, string> = {
  ASSETS: "Assets",
  LIABILITIES: "Liabilities",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENDITURES: "Expenses",
};

export default function GLPerformanceClient({ userRole, userBranchId }: GLPerformanceClientProps) {
  const liveRefreshVersion = useReportLiveRefresh({ enabled: true, intervalMs: 15000 });
  const hasLoadedRef = useRef(false);

  const [branches, setBranches] = useState<any[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<CoaAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [date, setDate] = useState<{ from: Date; to?: Date }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [selectedBranch, setSelectedBranch] = useState<string>(
    userRole === "ADMIN" ? "ALL" : userBranchId
  );
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [openCategory, setOpenCategory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Load branches and COA accounts on mount
  useEffect(() => {
    axios
      .get("/api/v1/branches")
      .then((res) => {
        const data = res.data?.success ? res.data.data : res.data;
        if (Array.isArray(data)) setBranches(data);
      })
      .catch((err) => console.error("Failed to fetch branches:", err));

    setLoadingAccounts(true);
    axios
      .get("/api/v1/chart-of-accounts", {
        params: { limit: 1000, isActive: true, numericOnly: true },
      })
      .then((res) => {
        const data: CoaAccount[] = res.data?.data || [];
        setCoaAccounts(data);
      })
      .catch((err) => console.error("Failed to fetch COA accounts:", err))
      .finally(() => setLoadingAccounts(false));
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    void handleGenerateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRefreshVersion]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);

  const handleGenerateReport = useCallback(async () => {
    if (!selectedValue) {
      toast.error("Please select a Ledger Category or Account");
      return;
    }
    if (!date.from || !date.to) {
      toast.error("Please select both start and end dates");
      return;
    }

    const isAccountCode = !BROAD_VALUES.has(selectedValue);

    try {
      setLoading(true);
      const res = await axios.get("/api/v1/reports/gl-performance", {
        headers: { "Cache-Control": "no-store" },
        params: {
          ...(isAccountCode
            ? { accountCode: selectedValue }
            : { category: selectedValue }),
          startDate: date.from.toISOString(),
          endDate: date.to.toISOString(),
          branchId: selectedBranch,
        },
      });

      if (res.data.success) {
        setReportData(res.data.data);
        hasLoadedRef.current = true;
        toast.success("Report generated successfully");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }, [date.from, date.to, selectedBranch, selectedValue]);

  const handlePrint = () => {
    if (!reportData) {
      toast.error("No report data to print. Generate a report first.");
      return;
    }

    const period = `${format(date.from, "PP")} to ${format(date.to as Date, "PP")}`;

    if (reportData.categories) {
      const rows = reportData.categories.map((cat: any) => [
        cat.name,
        cat.totalBalance,
        cat.accounts.length,
      ]);
      const grandTotal = reportData.categories.reduce(
        (sum: number, cat: any) => sum + cat.totalBalance,
        0,
      );

      printReport({
        title: "GL Account Performance",
        subtitle: "All Categories Summary",
        period,
        headers: ["Category", "Total Balance", "Accounts"],
        rows,
        totals: ["Grand Total", grandTotal, reportData.categories.length],
      });
    } else {
      const rows = reportData.transactions.map((tx: any) => [
        format(new Date(tx.entryDate), "dd MMM yyyy"),
        tx.entryNumber,
        `${tx.account?.accountCode ?? ""} — ${tx.account?.accountName ?? ""}`,
        tx.description,
        tx.debitAmount > 0 ? tx.debitAmount : "—",
        tx.creditAmount > 0 ? tx.creditAmount : "—",
        tx.effect,
        tx.transaction?.processedByUser?.name || tx.createdBy?.name || "System",
      ]);

      printReport({
        title: "GL Account Performance",
        subtitle: reportData.category.name,
        period,
        headers: ["Date", "Entry No", "Account", "Description", "Debit", "Credit", "Effect", "User"],
        rows,
        summary: {
          "Opening Balance": reportData.summary.openingBalance,
          "Total Debits": reportData.summary.totalPeriodDebit,
          "Total Credits": reportData.summary.totalPeriodCredit,
          "Closing Balance": reportData.summary.closingBalance,
        },
      });
    }
  };

  // Build display label for the selected value
  const getSelectedLabel = () => {
    if (!selectedValue) return null;
    if (selectedValue === "all") return "ALL — All Categories Summary";
    const broad = BROAD_CATEGORIES.find((c) => c.value === selectedValue);
    if (broad) return `${broad.value} — ${broad.label}`;
    const account = coaAccounts.find((a) => a.accountCode === selectedValue);
    if (account) return `${account.accountCode} — ${account.accountName}`;
    return selectedValue;
  };

  // Group specific accounts by ledger type for the dropdown
  const groupedAccounts = BROAD_CATEGORIES.map((cat) => ({
    ...cat,
    accounts: coaAccounts.filter((a) => a.ledgerType === cat.value),
  }));

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* FILTER CARD */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Select a broad category or search for a specific GL account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Category / Account Selector */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Ledger Category / Account</label>
              <Button
                variant="outline"
                role="combobox"
                onClick={() => setOpenCategory(true)}
                className="w-full justify-between font-normal"
              >
                <span className="truncate">
                  {getSelectedLabel() ?? (
                    <span className="text-muted-foreground">
                      {loadingAccounts ? "Loading accounts..." : "Select category or account..."}
                    </span>
                  )}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>

              <Dialog open={openCategory} onOpenChange={setOpenCategory}>
                <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
                  <DialogHeader className="px-4 pt-4 pb-2">
                    <DialogTitle>Select Ledger Category or Account</DialogTitle>
                  </DialogHeader>
                  <Command className="border-none">
                    <div className="px-3 pb-2">
                      <CommandInput
                        placeholder="Search by name or code (e.g. 'ordinary', '201003', 'fees')..."
                        className="h-9"
                      />
                    </div>
                    <CommandList className="max-h-[420px] overflow-y-auto px-1 pb-3">
                      <CommandEmpty>No account found.</CommandEmpty>

                      {/* Broad category options */}
                      <CommandGroup heading="Broad Categories">
                        <CommandItem
                          value="ALL All Categories Summary"
                          onSelect={() => { setSelectedValue("all"); setOpenCategory(false); }}
                          className="rounded-md"
                        >
                          <span className="font-bold text-primary mr-2">ALL</span>
                          <span className="text-muted-foreground">All Categories Summary</span>
                        </CommandItem>
                        {BROAD_CATEGORIES.map((cat) => (
                          <CommandItem
                            key={cat.value}
                            value={`${cat.value} ${cat.label}`}
                            onSelect={() => { setSelectedValue(cat.value); setOpenCategory(false); }}
                            className="rounded-md"
                          >
                            <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded mr-2", cat.badge)}>
                              {cat.value}
                            </span>
                            <span>{cat.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>

                      {/* Specific accounts grouped by ledger type */}
                      {groupedAccounts.map((group) =>
                        group.accounts.length === 0 ? null : (
                          <CommandGroup
                            key={group.value}
                            heading={`${group.label} — specific accounts`}
                          >
                            {group.accounts.map((account) => (
                              <CommandItem
                                key={account.id}
                                value={`${account.accountCode} ${account.accountName} ${group.label}`}
                                onSelect={() => {
                                  setSelectedValue(account.accountCode);
                                  setOpenCategory(false);
                                }}
                                className="rounded-md"
                              >
                                <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">
                                  {account.accountCode}
                                </span>
                                <span className="ml-2 truncate">{account.accountName}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )
                      )}
                    </CommandList>
                  </Command>
                </DialogContent>
              </Dialog>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>{format(date.from, "LLL dd, y")} &ndash; {format(date.to, "LLL dd, y")}</>
                      ) : (
                        format(date.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={(rng: any) => setDate(rng)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Branch Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Branch Filter</label>
              {userRole === "ADMIN" ? (
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {branches.find((b) => b.id === userBranchId)?.name || "Assigned Branch"}
                </div>
              )}
            </div>

            {/* Generate Button */}
            <div className="md:col-span-4 flex justify-end gap-2 mt-2">
              <Button onClick={handleGenerateReport} disabled={loading} className="w-full md:w-auto">
                {loading ? "Generating..." : "Generate Report"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* REPORT RESULTS */}
      {reportData && (
        <div className="space-y-6 print:block">
          {reportData.categories ? (
            /* ── ALL CATEGORIES SUMMARY VIEW ── */
            <>
              <div className="hidden print:block text-center mb-6">
                <h1 className="text-2xl font-bold uppercase tracking-wider">GL Account Performance Summary</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Period: {format(date.from, "PP")} to {format(date.to as Date, "PP")}
                </p>
              </div>

              <div className="flex justify-between items-center print:hidden">
                <h3 className="text-xl font-bold">All Accounts Performance Summary</h3>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
              </div>

              <div className="grid gap-6">
                {reportData.categories.map((category: any) => (
                  <Card key={category.name}>
                    <CardHeader className="bg-muted/30 pb-4">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg text-primary">{category.name}</CardTitle>
                        <span className="font-bold text-lg">{formatCurrency(category.totalBalance)}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-y">
                          <tr>
                            <th className="p-3 text-left font-medium text-muted-foreground w-32">Code</th>
                            <th className="p-3 text-left font-medium text-muted-foreground">Account Name</th>
                            <th className="p-3 text-right font-medium text-muted-foreground">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {category.accounts.map((acc: any) => (
                            <tr key={acc.id} className="hover:bg-muted/10">
                              <td className="p-3 font-mono text-xs">{acc.code}</td>
                              <td className="p-3 font-medium">{acc.name}</td>
                              <td className="p-3 text-right">{formatCurrency(acc.balance)}</td>
                            </tr>
                          ))}
                          {category.accounts.length === 0 && (
                            <tr>
                              <td colSpan={3} className="p-4 text-center text-muted-foreground italic">
                                No accounts with balance in this category
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-muted/20 font-semibold border-t">
                          <tr>
                            <td colSpan={2} className="p-3 text-right">Total {category.name}:</td>
                            <td className="p-3 text-right text-primary">{formatCurrency(category.totalBalance)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            /* ── SPECIFIC ACCOUNT / CATEGORY DETAIL VIEW ── */
            <>
              <div className="hidden print:block text-center mb-6">
                <h1 className="text-2xl font-bold uppercase tracking-wider">GL Category Performance Report</h1>
                <p className="text-lg mt-2">{reportData.category.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Period: {format(date.from, "PP")} to {format(date.to as Date, "PP")}
                </p>
              </div>

              <div className="flex justify-between items-center print:hidden">
                <h3 className="text-xl font-bold">{reportData.category.name}</h3>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
              </div>

              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Opening Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(reportData.summary.openingBalance)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-red-600">Total Debits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(reportData.summary.totalPeriodDebit)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-green-600">Total Credits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(reportData.summary.totalPeriodCredit)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-primary text-primary-foreground border-none">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-primary-foreground/80">Closing Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(reportData.summary.closingBalance)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Transaction Table */}
              <Card>
                <CardHeader className="print:hidden">
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>
                    {reportData.transactions.length} transaction{reportData.transactions.length !== 1 ? "s" : ""} in period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/50">
                        <tr className="text-left">
                          <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                          <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">Entry No</th>
                          <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">Account</th>
                          <th className="p-3 font-medium text-muted-foreground">Description</th>
                          <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">Received By</th>
                          <th className="p-3 font-medium text-muted-foreground whitespace-nowrap text-right">Debit (DR)</th>
                          <th className="p-3 font-medium text-muted-foreground whitespace-nowrap text-right">Credit (CR)</th>
                          <th className="p-3 font-medium text-muted-foreground whitespace-nowrap text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {/* Opening balance row */}
                        <tr className="bg-muted/10 font-medium">
                          <td className="p-3 text-muted-foreground">Prior to {format(date.from, "P")}</td>
                          <td className="p-3 text-muted-foreground">—</td>
                          <td className="p-3 text-muted-foreground">—</td>
                          <td className="p-3">Opening Balance</td>
                          <td className="p-3 text-muted-foreground">—</td>
                          <td className="p-3 text-right">—</td>
                          <td className="p-3 text-right">—</td>
                          <td className="p-3 text-right text-primary font-bold">
                            {formatCurrency(reportData.summary.openingBalance)}
                          </td>
                        </tr>

                        {reportData.transactions.map((tx: any, index: number) => {
                          const prevBalance =
                            index === 0
                              ? reportData.summary.openingBalance
                              : reportData.summary.openingBalance +
                                reportData.transactions
                                  .slice(0, index)
                                  .reduce((acc: number, curr: any) => acc + curr.effect, 0);
                          const runningBalance = prevBalance + tx.effect;

                          return (
                            <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                              <td className="p-3 whitespace-nowrap">
                                {format(new Date(tx.entryDate), "dd MMM yyyy")}
                              </td>
                              <td className="p-3 font-mono text-xs">{tx.entryNumber}</td>
                              <td className="p-3 text-sm text-primary font-medium">
                                {tx.account?.accountCode} — {tx.account?.accountName}
                              </td>
                              <td className="p-3">
                                <div className="font-medium">{tx.description}</div>
                                {(tx.transaction?.externalReference || tx.reference) && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Ref: {tx.transaction?.externalReference || tx.reference}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="text-sm font-medium">
                                  {tx.transaction?.processedByUser?.name || tx.createdBy?.name || "System"}
                                </div>
                                {tx.transaction?.member?.user?.name && (
                                  <div className="text-xs text-muted-foreground">
                                    {tx.transaction.member.user.name}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-right text-red-600">
                                {tx.debitAmount > 0 ? formatCurrency(tx.debitAmount) : "—"}
                              </td>
                              <td className="p-3 text-right text-green-600">
                                {tx.creditAmount > 0 ? formatCurrency(tx.creditAmount) : "—"}
                              </td>
                              <td className="p-3 text-right font-medium">{formatCurrency(runningBalance)}</td>
                            </tr>
                          );
                        })}

                        {reportData.transactions.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-6 text-center text-muted-foreground">
                              No transactions found for this period.
                            </td>
                          </tr>
                        )}
                      </tbody>

                      {/* Closing balance footer */}
                      <tfoot className="border-t bg-muted/30 font-semibold">
                        <tr>
                          <td colSpan={5} className="p-3 text-right">Closing Balance:</td>
                          <td className="p-3 text-right text-red-600">
                            {formatCurrency(reportData.summary.totalPeriodDebit)}
                          </td>
                          <td className="p-3 text-right text-green-600">
                            {formatCurrency(reportData.summary.totalPeriodCredit)}
                          </td>
                          <td className="p-3 text-right text-primary">
                            {formatCurrency(reportData.summary.closingBalance)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
