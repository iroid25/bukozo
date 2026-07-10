"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  Search, 
  Plus, 
  Eye, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Info, 
  Layers, 
  ListFilter, 
  Network,
  Briefcase,
  CreditCard,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  History,
  RefreshCw,
  LayoutGrid
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { NewAccountForm } from "./components/NewAccountForm";
import { COATree } from "./components/COATree";
import { cn } from "@/lib/utils";
import { useAccountingSyncVersion } from "@/lib/hooks/useAccountingSync";

interface ChartOfAccount {
  id: string;
  accountCode: string;
  accountName: string;
  fullCode: string;
  ledgerType: string;
  level: number;
  balance: number;
  debitBalance: number;
  creditBalance: number;
  isActive: boolean;
  currency: string;
  category?: string;
  product?: string;
  description?: string;
  parent?: {
    id: string;
    accountCode: string;
    accountName: string;
    fullCode: string;
  };
  children?: Array<{
    id: string;
    accountCode: string;
    accountName: string;
    fullCode: string;
    level: number;
    balance: number;
  }>;
  _count?: {
    children: number;
    journalEntries: number;
    debitTransactions: number;
    creditTransactions: number;
  };
}

interface TrialBalance {
  accounts: Record<string, ChartOfAccount[]>;
  totals: {
    totalDebits: number;
    totalCredits: number;
    byLedgerType: Record<string, { debits: number; credits: number }>;
  };
  isBalanced: boolean;
  difference: number;
  asOfDate: string;
}

export default function ChartOfAccountsPage() {
  const { data: session, status } = useSession();
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const accountingSyncVersion = useAccountingSyncVersion({
    enabled: status === "authenticated",
  });
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [ledgerType, setLedgerType] = useState<string>("ALL");
  const [level, setLevel] = useState<string>("ALL");
  const [activeOnly, setActiveOnly] = useState(true);
  const [coreOnly, setCoreOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [accountItems, setAccountItems] = useState<any[]>([]);
  const [itemsType, setItemsType] = useState<string>("GENERIC");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [refreshingCoa, setRefreshingCoa] = useState(false);
  const [resetting, setResetting] = useState(false);
  const limit = 50;

  // React Query for the list view
  // For INCOME/EXPENDITURES, fetches from the same budgetCategory endpoints the type pages use.
  // For ASSETS/LIABILITIES/EQUITY/ALL, fetches from the COA endpoint.
  const isBudgetType = ledgerType === "INCOME" || ledgerType === "EXPENDITURES";

  const {
    data: unifiedData,
    isLoading: loading,
    isError,
    error: queryError,
    isFetching,
    refetch: fetchUnified
  } = useQuery({
    queryKey: ["chart-of-accounts-unified", page, ledgerType, level, search, activeOnly, coreOnly, accountingSyncVersion],
    queryFn: async () => {
      if (isBudgetType) {
        const endpoint = ledgerType === "INCOME" ? "/api/v1/income/categories" : "/api/v1/expenditure/categories";
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error("Failed to fetch categories");
        const result = await response.json();
        const categories = (result.data || []) as any[];
        const total = categories.length;
        const perPage = 50;
        const totalPages = Math.max(1, Math.ceil(total / perPage));
        const start = (page - 1) * perPage;
        const paged = categories.slice(start, start + perPage);
        const mapped = paged.map((cat: any) => ({
          id: cat.id,
          accountCode: cat.code || "",
          accountName: cat.name || "",
          fullCode: cat.code || "",
          ledgerType: ledgerType,
          level: cat.parentId ? 2 : 1,
          balance: 0,
          debitBalance: 0,
          creditBalance: 0,
          isActive: cat.isActive !== false,
          currency: "UGX",
          category: cat.kind,
          parent: cat.parent ? { id: cat.parent.id, accountCode: cat.parent.code, accountName: cat.parent.name, fullCode: cat.parent.code } : undefined,
          _count: { children: cat._count?.children || 0, journalEntries: cat._count?.incomeRecords || 0, debitTransactions: 0, creditTransactions: 0 },
        }));
        return { data: mapped, pagination: { page, limit: perPage, total, totalPages } };
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (ledgerType !== "ALL") params.append("ledgerType", ledgerType);
      if (level !== "ALL") params.append("level", level);
      if (search) params.append("search", search);
      if (activeOnly) params.append("isActive", "true");
      if (coreOnly) params.append("coreOnly", "true");

      const response = await fetch(`/api/v1/chart-of-accounts?${params}`);
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const result = await response.json();
      return result as { data: ChartOfAccount[], pagination: any };
    },
    enabled: status === "authenticated",
    refetchInterval: 15000,
  });

  // Separate query for pillar totals — fetched via unified endpoint
  const { 
    data: tbData, 
    isFetching: tbFetching 
  } = useQuery({
    queryKey: ["chart-of-accounts-totals", accountingSyncVersion],
    queryFn: async () => {
      const response = await fetch("/api/v1/chart-of-accounts/unified");
      if (!response.ok) throw new Error("Failed to fetch unified chart of accounts");
      const payload = await response.json();
      return payload.data;
    },
    enabled: status === "authenticated",
    refetchInterval: 15000,
  });

  const accounts = unifiedData?.data || [];
  const totalPages = unifiedData?.pagination?.totalPages || 1;
  const trialBalance = tbData ? {
    accounts: tbData.byLedgerType,
    totals: {
      totalDebits: tbData.summary.totalDebits,
      totalCredits: tbData.summary.totalCredits,
      byLedgerType: Object.fromEntries(
        Object.entries(tbData.totals || {}).map(([type, t]: [string, any]) => [
          type,
          { debits: t.debits, credits: t.credits }
        ])
      ),
    },
    isBalanced: tbData.summary.isBalanced,
    difference: tbData.summary.difference,
    asOfDate: new Date().toISOString(),
  } : null;

  const fetchAccountDetails = async (accountId: string) => {
    try {
      setDetailsLoading(true);
      setAccountItems([]);
      setItemsType("GENERIC");
      
      const response = await fetch(`/api/v1/chart-of-accounts/${accountId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.data) {
        setSelectedAccount(data.data);
        setDetailsOpen(true);
        setItemsLoading(true);
        try {
          const itemsResponse = await fetch(`/api/v1/chart-of-accounts/${accountId}/items`);
          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            setAccountItems(itemsData.items || []);
            setItemsType(itemsData.itemsType || "GENERIC");
          }
        } finally {
          setItemsLoading(false);
        }
      }
    } catch (error) {
      console.error("Error fetching account details:", error);
      toast.error("Failed to fetch account details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const getLevelBadge = (level: number) => {
    const colors = {
      0: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      2: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      3: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    const labels = {
      0: "Pillar",
      1: "Main",
      2: "Sub",
      3: "Account",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[level as keyof typeof colors]}`}>
        {labels[level as keyof typeof labels]}
      </span>
    );
  };

  const getLedgerTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      ASSETS: "Assets",
      LIABILITIES: "Liabilities",
      EQUITY: "Equity",
      INCOME: "Income",
      EXPENSES: "Expenditures",
    };
    const colors: Record<string, string> = {
      ASSETS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      LIABILITIES: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800",
      EQUITY: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800",
      INCOME: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      EXPENDITURES: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    };
    return (
      <span className={cn(
        "px-2.5 py-1 rounded-full text-xs font-bold border transition-all duration-300",
        colors[type] || "bg-gray-100 text-gray-800 border-gray-200"
      )}>
        {labels[type] || type}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const refreshChartOfAccounts = async () => {
    try {
      setRefreshingCoa(true);
      const response = await fetch("/api/v1/accounting/coa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload?.details || payload?.error || "Failed to refresh Chart of Accounts");
      }

      toast.success("Chart of Accounts refreshed");
      await fetchUnified();
    } catch (error) {
      console.error("Error refreshing Chart of Accounts:", error);
      toast.error(error instanceof Error ? error.message : "Failed to refresh Chart of Accounts");
    } finally {
      setRefreshingCoa(false);
    }
  };

  const resetChartOfAccounts = async () => {
    const firstConfirm = window.confirm(
      "This will delete all Chart of Accounts rows and rebuild the standard core structure. Continue?",
    );
    if (!firstConfirm) return;

    const confirmCode = window.prompt("Type RESET_COA to confirm the hard reset.");
    if (confirmCode !== "RESET_COA") {
      toast.error("Reset cancelled");
      return;
    }

    try {
      setRefreshingCoa(true);
      const response = await fetch("/api/v1/accounting/coa/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET_COA" }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload?.details || payload?.error || "Failed to reset Chart of Accounts");
      }

      toast.success("Chart of Accounts reset and rebuilt");
      await fetchUnified();
    } catch (error) {
      console.error("Error resetting Chart of Accounts:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reset Chart of Accounts");
    } finally {
      setRefreshingCoa(false);
    }
  };

  const resetFilters = async () => {
    try {
      setResetting(true);
      setSearch("");
      setLedgerType("ALL");
      setLevel("ALL");
      setActiveOnly(true);
      setCoreOnly(true);
      setPage(1);
      setSelectedAccount(null);
      setDetailsOpen(false);
      await fetchUnified();
      toast.success("Filters reset");
    } catch (error) {
      toast.error("Failed to reset filters");
    } finally {
      setResetting(false);
    }
  };

  const renderItemsTable = () => {
    if (itemsLoading) {
        return <div className="text-center py-4 text-muted-foreground">Loading underlying items...</div>;
    }

    if (!accountItems || accountItems.length === 0) {
        return <div className="text-center py-4 text-muted-foreground bg-muted/50 rounded text-sm p-4">No underlying items found.</div>;
    }

    return (
        <div className="border rounded-md overflow-hidden mt-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {accountItems.map((item: any) => (
                        <TableRow key={item.id}>
                            <TableCell className="text-xs">
                                {item.date ? new Date(item.date).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{item.code}</TableCell>
                            <TableCell className="text-sm font-medium">{item.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.details}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(item.amount)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
  };

  // Show loading while checking session
  if (status === "loading") {
    return (
      <div className="container mx-auto py-6 space-y-6 px-4">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2">Loading session...</span>
        </div>
      </div>
    );
  }

  // Show auth error
  if (status === "unauthenticated") {
    return (
      <div className="container mx-auto py-6 space-y-6 px-4">
        <Alert className="border-red-200 bg-red-50">
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please sign in to view the Chart of Accounts.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8 px-4 max-w-7xl pb-24">
      {/* Header with Live Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Chart of Accounts</h1>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all duration-500",
              isFetching || tbFetching 
                ? "bg-blue-50 text-blue-600 border-blue-200 animate-pulse" 
                : "bg-emerald-50 text-emerald-600 border-emerald-200"
            )}>
              <Activity className={cn("h-3 w-3", isFetching || tbFetching ? "animate-spin" : "")} />
              {isFetching || tbFetching ? "Syncing..." : "Live"}
            </div>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">Standardized Financial Structure & Real-time Tracking</p>
        </div>
        <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex gap-2 rounded-xl"
              onClick={refreshChartOfAccounts}
              disabled={refreshingCoa}
            >
                <RefreshCw className={cn("h-4 w-4", isFetching || refreshingCoa ? "animate-spin" : "")} />
                {refreshingCoa ? "Refreshing" : "Refresh COA"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="hidden md:flex gap-2 rounded-xl"
              onClick={resetFilters}
              disabled={resetting}
            >
                <Loader2 className={cn("h-4 w-4", resetting ? "animate-spin" : "")} />
                {resetting ? "Resetting" : "Reset"}
            </Button>
            {session?.user?.role === "ADMIN" && (
              <Button
                variant="destructive"
                size="sm"
                className="hidden md:flex gap-2 rounded-xl"
                onClick={resetChartOfAccounts}
                disabled={refreshingCoa}
              >
                {refreshingCoa ? "Resetting COA" : "Reset COA"}
              </Button>
            )}
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex border border-slate-200 dark:border-slate-700">
                <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0"><History className="h-4 w-4" /></Button>
            </div>
        </div>
      </div>

      {/* Modern Pillar Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Assets", type: "ASSETS", icon: Briefcase, color: "blue" },
          { label: "Liabilities", type: "LIABILITIES", icon: CreditCard, color: "rose" },
          { label: "Equity", type: "EQUITY", icon: Coins, color: "violet" },
          { label: "Income", type: "INCOME", icon: TrendingUp, color: "emerald" },
          { label: "Expenditures", type: "EXPENDITURES", icon: TrendingDown, color: "amber" },
        ].map((pillar) => {
          const stats = trialBalance?.totals?.byLedgerType[pillar.type] || { debits: 0, credits: 0 };
          const balance = pillar.type === 'ASSETS' || pillar.type === 'EXPENDITURES' 
            ? stats.debits - stats.credits 
            : stats.credits - stats.debits;
          
          return (
            <motion.div
              key={pillar.label}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group relative overflow-hidden rounded-3xl border p-5 cursor-pointer transition-all duration-300",
                ledgerType === pillar.type 
                  ? `border-${pillar.color}-400 bg-${pillar.color}-50/30 shadow-lg ring-2 ring-${pillar.color}-400/20`
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md"
              )}
              onClick={() => setLedgerType(ledgerType === pillar.type ? "ALL" : pillar.type)}
            >
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <pillar.icon size={100} />
              </div>
              
              <div className="flex justify-between items-start mb-4">
                <div className={cn(
                   "p-3 rounded-2xl transition-colors",
                   `bg-${pillar.color}-100 dark:bg-${pillar.color}-900/30 text-${pillar.color}-600 dark:text-${pillar.color}-400`
                )}>
                  <pillar.icon size={20} />
                </div>
                {ledgerType === pillar.type && (
                    <div className={cn(`h-2 w-2 rounded-full bg-${pillar.color}-500 animate-ping`)} />
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{pillar.label}</h3>
                <div className="text-2xl font-black tracking-tight font-mono">{formatCurrency(balance)}</div>
              </div>

              <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                <span>DR: {formatCurrency(stats.debits)}</span>
                <span>CR: {formatCurrency(stats.credits)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Trial Balance Status & Error Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trialBalance && (
            <Alert className={cn(
                "rounded-2xl border-2",
                trialBalance.isBalanced 
                    ? "bg-emerald-50/50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300" 
                    : "bg-rose-50/50 border-rose-100 text-rose-800 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300"
            )}>
                <Activity className="h-4 w-4" />
                <AlertTitle className="font-black text-sm uppercase tracking-widest">
                    Ledger Status: {trialBalance.isBalanced ? "Balanced" : "System Imbalance Detected"}
                </AlertTitle>
                <AlertDescription className="text-xs font-semibold opacity-80">
                    {trialBalance.isBalanced 
                        ? "The total debits match the total credits. Your accounting books are in equilibrium."
                        : `Warning: There is a discrepancy of ${formatCurrency(Math.abs(trialBalance.difference))}. Please review recent journal entries.`
                    }
                </AlertDescription>
            </Alert>
        )}

        {/* Info Alert */}
        <Alert className="rounded-2xl border bg-slate-50/50 border-slate-100 dark:bg-slate-900/20 dark:border-slate-800">
            <Info className="h-4 w-4" />
            <AlertTitle className="text-xs font-black uppercase tracking-widest">Automated Management</AlertTitle>
            <AlertDescription className="text-xs font-medium opacity-80">
                Accounts are managed via Income/Expense categories, Assets, and products. Direct creation is restricted for integrity.
            </AlertDescription>
        </Alert>
      </div>

      {(queryError || isError) && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>Network Error</AlertTitle>
          <AlertDescription>
            {((queryError as any)?.message) || "Failed to fetch accounts. Please check your connection."}
            <Button variant="link" onClick={() => fetchUnified()} className="ml-2 text-white p-0 h-auto">Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="visualizer" className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <ListFilter className="h-4 w-4 mr-2" />
              List View
            </TabsTrigger>
            <TabsTrigger value="visualizer" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Network className="h-4 w-4 mr-2" />
              Visualizer
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="space-y-6 pt-4">
          {/* Filters & Actions */}
          <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search accounts by name or code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Select value={ledgerType} onValueChange={setLedgerType}>
                    <SelectTrigger className="h-12 w-full md:w-[180px] rounded-2xl">
                        <ListFilter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                        <SelectItem value="ALL">All Categories</SelectItem>
                        <SelectItem value="ASSETS">Assets</SelectItem>
                        <SelectItem value="LIABILITIES">Liabilities</SelectItem>
                        <SelectItem value="EQUITY">Equity</SelectItem>
                        <SelectItem value="INCOME">Income</SelectItem>
                        <SelectItem value="EXPENDITURES">Expenditures</SelectItem>
                    </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant={activeOnly ? "default" : "outline"}
                      className="h-12 rounded-2xl"
                      onClick={() => {
                        setPage(1);
                        setActiveOnly((prev) => !prev);
                      }}
                    >
                      {activeOnly ? "Active Only" : "Include Inactive"}
                    </Button>

                    <Button
                      type="button"
                      variant={coreOnly ? "default" : "outline"}
                      className="h-12 rounded-2xl"
                      onClick={() => {
                        setPage(1);
                        setCoreOnly((prev) => !prev);
                      }}
                    >
                      {coreOnly ? "Core Only" : "Include Orphans"}
                    </Button>

                    <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger className="h-12 w-full md:w-[150px] rounded-2xl">
                        <Layers className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                        <SelectItem value="ALL">All Levels</SelectItem>
                        <SelectItem value="0">Pillars Only</SelectItem>
                        <SelectItem value="1">Main Only</SelectItem>
                        <SelectItem value="2">Sub Accounts</SelectItem>
                        <SelectItem value="3">Posting Items</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
          </div>

          {/* Accounts Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {queryError ? "Unable to load accounts" : "No accounts found"}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead className="text-right">Dr (Debit)</TableHead>
                          <TableHead className="text-right">Cr (Credit)</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map((account: ChartOfAccount) => (
                          <TableRow key={account.id}>
                            <TableCell className="font-mono font-medium">
                              {account.accountCode}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{account.accountName}</span>
                                {account._count && account._count.children > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {account._count.children} child account{account._count.children > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getLedgerTypeBadge(account.ledgerType)}</TableCell>
                            <TableCell>{getLevelBadge(account.level)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(account.debitBalance)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(account.creditBalance)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {formatCurrency(account.balance)}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                account.isActive 
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                              }`}>
                                {account.isActive ? "Active" : "Inactive"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => fetchAccountDetails(account.id)}
                                disabled={detailsLoading}
                              >
                                {detailsLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visualizer">
          <COATree onViewDetails={fetchAccountDetails} />
        </TabsContent>
      </Tabs>

      {/* Account Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Account Details</DialogTitle>
            <DialogDescription>
              Complete information about this account
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Code</label>
                  <p className="text-lg font-mono font-bold">{selectedAccount.accountCode}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Name</label>
                  <p className="text-lg font-semibold">{selectedAccount.accountName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Ledger Type</label>
                  <div className="mt-1">{getLedgerTypeBadge(selectedAccount.ledgerType)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Level</label>
                  <div className="mt-1">{getLevelBadge(selectedAccount.level)}</div>
                </div>
                {selectedAccount.category && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <p className="text-base">{selectedAccount.category}</p>
                  </div>
                )}
                {selectedAccount.product && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Product</label>
                    <p className="text-base">{selectedAccount.product}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Currency</label>
                  <p className="text-base">{selectedAccount.currency || 'UGX'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      selectedAccount.isActive 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {selectedAccount.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Drill-Down Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Underlying Items
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({itemsType.replace("_", " ")})
                    </span>
                  </h3>
                </div>
                {renderItemsTable()}
              </div>

              {/* Balances */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Balances</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Dr (Debit)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold">{formatCurrency(selectedAccount.debitBalance)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Cr (Credit)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold">{formatCurrency(selectedAccount.creditBalance)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Net Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold">{formatCurrency(selectedAccount.balance)}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Parent Account */}
              {selectedAccount.parent && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Parent Account</h3>
                  <div className="bg-muted p-3 rounded">
                    <p className="font-mono text-sm">{selectedAccount.parent.accountCode}</p>
                    <p className="font-medium">{selectedAccount.parent.accountName}</p>
                  </div>
                </div>
              )}

              {/* Child Accounts */}
              {selectedAccount.children && selectedAccount.children.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Child Accounts ({selectedAccount.children.length})</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedAccount.children.map((child) => (
                      <div key={child.id} className="bg-muted p-2 rounded flex justify-between items-center">
                        <div>
                          <p className="font-mono text-sm">{child.accountCode}</p>
                          <p className="text-sm">{child.accountName}</p>
                        </div>
                        <p className="font-mono text-sm">{formatCurrency(child.balance)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaction Counts */}
              {selectedAccount._count && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Activity</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted p-3 rounded">
                      <p className="text-sm text-muted-foreground">Journal Entries</p>
                      <p className="text-2xl font-bold">{selectedAccount._count.journalEntries}</p>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <p className="text-sm text-muted-foreground">Debit Transactions</p>
                      <p className="text-2xl font-bold">{selectedAccount._count.debitTransactions || 0}</p>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <p className="text-sm text-muted-foreground">Credit Transactions</p>
                      <p className="text-2xl font-bold">{selectedAccount._count.creditTransactions || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedAccount.description && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground">{selectedAccount.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
