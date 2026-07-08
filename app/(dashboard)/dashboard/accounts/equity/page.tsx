"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Folder,
  Landmark,
  Layers,
  Loader2,
} from "lucide-react";
import { EquityCreateForm } from "./components/EquityCreateForm";

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
  description?: string;
  notes?: string | null;
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
  };
}

interface ShareCapitalGroupItem {
  id: string;
  sourceType: "SHARE_ACCOUNT_TYPE";
  accountTypeId: string;
  accountCode: string;
  name: string;
  rawName: string;
  amount: number;
  accountCount: number;
  numberOfShares: number;
  shareValue: number;
}

interface ShareCapitalSourcesPayload {
  sourceCount: number;
  sourceTotal: number;
  transactionCount: number;
  transactionTotal: number;
  sourceAccounts: Array<{
    accountId: string;
    accountNumber: string;
    ownerName: string;
    ownerNumber: string;
    branchName: string;
    numberOfShares: number;
    shareValue: number;
    totalValue: number;
    status: string;
  }>;
  transactions: Array<{
    id: string;
    accountId: string;
    accountNumber: string;
    ownerName: string;
    ownerNumber: string;
    branchName: string;
    transactionType: string;
    date: string;
    reference: string;
    description: string;
    shares: number;
    shareValue: number;
    amount: number;
    sharesBefore: number;
    sharesAfter: number;
  }>;
}

type EquityBucketCode = "300000" | "301000" | "302000" | "303000" | "304000";

const EQUITY_BUCKETS: Array<{
  code: EquityBucketCode;
  title: string;
  subtitle: string;
  accent: string;
}> = [
  {
    code: "300000",
    title: "Equity",
    subtitle: "Root equity control account",
    accent: "bg-slate-50/80 border-slate-200",
  },
  {
    code: "301000",
    title: "Statutory Reserves",
    subtitle: "Mandatory reserve allocations",
    accent: "bg-amber-50/70 border-amber-200",
  },
  {
    code: "302000",
    title: "Grants and Donations",
    subtitle: "Restricted and unrestricted grants",
    accent: "bg-violet-50/70 border-violet-200",
  },
  {
    code: "303000",
    title: "Retained Earnings",
    subtitle: "Accumulated operating surplus",
    accent: "bg-sky-50/70 border-sky-200",
  },
  {
    code: "304000",
    title: "Share Capital",
    subtitle: "Member contribution balances",
    accent: "bg-emerald-50/70 border-emerald-200",
  },
];

const FORCE_EXPANDABLE_CODES = new Set<EquityBucketCode>([
  "300000",
  "301000",
  "302000",
  "303000",
  "304000",
]);

export default function EquityPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [accountItems, setAccountItems] = useState<any[]>([]);
  const [itemsType, setItemsType] = useState<string>("GENERIC");
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "300000": true,
  });
  const [nodeChildren, setNodeChildren] = useState<Record<string, ChartOfAccount[]>>({});
  const [nodeLoading, setNodeLoading] = useState<Record<string, boolean>>({});
  const [shareCapitalGroups, setShareCapitalGroups] = useState<ShareCapitalGroupItem[]>([]);
  const [expandedShareRows, setExpandedShareRows] = useState<Record<string, boolean>>({});
  const [shareSources, setShareSources] = useState<Record<string, ShareCapitalSourcesPayload>>({});
  const [shareSourcesLoading, setShareSourcesLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (status === "authenticated") {
      void fetchAccounts();
    }
  }, [status, selectedBranchId]);

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin) return;

    const loadBranches = async () => {
      try {
        setBranchLoading(true);
        const response = await fetch("/api/v1/branches", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        setBranchOptions(Array.isArray(payload?.data) ? payload.data : []);
      } finally {
        setBranchLoading(false);
      }
    };

    void loadBranches();
  }, [status, isAdmin]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(Number(amount || 0));

  const getLevelBadge = (level: number) => {
    const colors = {
      1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      2: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      3: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    };
    const labels = { 1: "Main", 2: "Group", 3: "Account" };

    return (
      <span
        className={cn(
          "rounded px-2 py-1 text-xs font-medium",
          colors[level as keyof typeof colors] || colors[3],
        )}
      >
        {labels[level as keyof typeof labels] || "Detail"}
      </span>
    );
  };

  const fetchAccounts = async () => {
    if (status !== "authenticated") return;

    try {
      setLoading(true);
      setError(null);
      setNodeChildren({});
      setNodeLoading({});
      setShareCapitalGroups([]);
      setExpandedShareRows({});
      setShareSources({});
      setShareSourcesLoading({});
      setExpandedNodes({ "300000": true });

      const params = new URLSearchParams({
        page: "1",
        limit: "200",
        isActive: "true",
      });
      if (isAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      }

      const response = await fetch(`/api/v1/equity?${params}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.details || payload?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error("Invalid response format");
      }

      setAccounts(
        data.data.filter((account: ChartOfAccount) => account.accountCode !== "301004"),
      );
      setShareCapitalGroups(
        Array.isArray(data.groups?.shareCapital?.items)
          ? data.groups.shareCapital.items
          : [],
      );
    } catch (err) {
      console.error("Error fetching equity accounts:", err);
      const message = err instanceof Error ? err.message : "Failed to fetch equity accounts";
      setError(message);
      setAccounts([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNodeDetails = async (accountId: string) => {
    try {
      setNodeLoading((prev) => ({ ...prev, [accountId]: true }));
      const branchQuery = isAdmin && selectedBranchId !== "all"
        ? `?branchId=${encodeURIComponent(selectedBranchId)}`
        : "";
      const response = await fetch(`/api/v1/chart-of-accounts/${accountId}${branchQuery}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const children = Array.isArray(data?.data?.children)
        ? data.data.children.map((child: any) => ({
            ...child,
            ledgerType: data.data.ledgerType,
            debitBalance: child.debitBalance || 0,
            creditBalance: child.creditBalance || 0,
            isActive: child.isActive ?? true,
            currency: child.currency || data.data.currency || "UGX",
            _count: child._count || { children: 0, journalEntries: 0 },
          }))
        : [];

      setNodeChildren((prev) => ({ ...prev, [accountId]: children }));
    } catch (err) {
      console.error("Error fetching node details:", err);
      toast.error("Failed to expand equity category");
    } finally {
      setNodeLoading((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const loadShareCapitalSources = async (accountTypeId: string) => {
    if (shareSources[accountTypeId] || shareSourcesLoading[accountTypeId]) {
      return;
    }

    try {
      setShareSourcesLoading((prev) => ({ ...prev, [accountTypeId]: true }));
      const params = new URLSearchParams({ accountTypeId });
      if (isAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      }

      const response = await fetch(`/api/v1/equity/share-capital-sources?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch share capital sources");
      }

      setShareSources((prev) => ({
        ...prev,
        [accountTypeId]: result.data,
      }));
    } catch (err) {
      console.error("Error loading share capital sources:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch share capital sources",
      );
    } finally {
      setShareSourcesLoading((prev) => ({ ...prev, [accountTypeId]: false }));
    }
  };

  const accountChildrenMap = useMemo(() => {
    const map = new Map<string, ChartOfAccount[]>();
    accounts.forEach((account) => {
      const parentId = account.parent?.id;
      if (!parentId) return;
      const siblings = map.get(parentId) || [];
      siblings.push(account);
      map.set(parentId, siblings);
    });
    return map;
  }, [accounts]);

  const getNodeChildren = (account: ChartOfAccount) => nodeChildren[account.id] || [];
  const getDirectChildren = (account: ChartOfAccount) =>
    [...(accountChildrenMap.get(account.id) || []), ...getNodeChildren(account)].filter(
      (child, index, list) => list.findIndex((item) => item.id === child.id) === index,
    );

  const getBranchTotal = (account: ChartOfAccount, visited = new Set<string>()): number => {
    if (visited.has(account.id)) return 0;
    visited.add(account.id);

    const children = getDirectChildren(account);
    if (children.length === 0) {
      if (account.accountCode === "304000") {
        const sourceTotal = shareCapitalGroups.reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0,
        );
        return sourceTotal > 0 ? sourceTotal : Number(account.balance || 0);
      }

      return Number(account.balance || 0);
    }

    const childTotal = children.reduce(
      (sum, child) => sum + getBranchTotal(child, new Set(visited)),
      0,
    );

    return childTotal !== 0 ? childTotal : Number(account.balance || 0);
  };

  const fetchAccountDetails = async (accountId: string) => {
    try {
      setDetailsLoading(true);
      setAccountItems([]);
      setItemsType("GENERIC");

      const branchQuery = isAdmin && selectedBranchId !== "all"
        ? `?branchId=${encodeURIComponent(selectedBranchId)}`
        : "";
      const response = await fetch(`/api/v1/chart-of-accounts/${accountId}${branchQuery}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data?.data) throw new Error("Invalid response format");

      setSelectedAccount(data.data);
      setDetailsOpen(true);

      setItemsLoading(true);
      try {
        const itemsResponse = await fetch(`/api/v1/chart-of-accounts/${accountId}/items${branchQuery}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          setAccountItems(Array.isArray(itemsData.items) ? itemsData.items : []);
          setItemsType(itemsData.itemsType || "GENERIC");
        }
      } finally {
        setItemsLoading(false);
      }
    } catch (err) {
      console.error("Error fetching account details:", err);
      toast.error("Failed to fetch account details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const toggleNode = async (account: ChartOfAccount) => {
    const nextExpanded = !expandedNodes[account.id];
    setExpandedNodes((prev) => ({ ...prev, [account.id]: nextExpanded }));

    if (
      nextExpanded &&
      !nodeChildren[account.id] &&
      ((account._count?.children || 0) > 0 || FORCE_EXPANDABLE_CODES.has(account.accountCode as EquityBucketCode))
    ) {
      await fetchNodeDetails(account.id);
    }

  };

  const renderItemsTable = () => {
    if (itemsLoading) {
      return (
        <div className="py-4 text-center text-muted-foreground">
          Loading underlying items...
        </div>
      );
    }

    if (!accountItems || accountItems.length === 0) {
      return (
        <div className="rounded border border-dashed bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          No underlying items found.
        </div>
      );
    }

    return (
      <div className="mt-2 overflow-hidden rounded-lg border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accountItems.map((item) => (
              <TableRow key={item.id} className="transition-colors hover:bg-muted/50">
                <TableCell className="text-xs">
                  {item.date ? new Date(item.date).toLocaleDateString() : "-"}
                </TableCell>
                <TableCell className="font-mono text-xs text-primary">
                  {item.code || "-"}
                </TableCell>
                <TableCell className="text-sm font-medium">{item.name || "-"}</TableCell>
                <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                  {item.details || "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {formatCurrency(item.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderNodeItems = (account: ChartOfAccount, depth: number) => {
    if (account.accountCode !== "304000") return null;

    if (shareCapitalGroups.length === 0) {
      return (
        <div
          className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-muted-foreground"
          style={{ marginLeft: `${depth * 24}px` }}
        >
          No share account types found.
        </div>
      );
    }

    return (
      <div className="space-y-3" style={{ marginLeft: `${depth * 24}px` }}>
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-emerald-800">Share Capital Products</p>
            <p className="text-xs text-emerald-700">
              {shareCapitalGroups.length} share type
              {shareCapitalGroups.length === 1 ? "" : "s"}
            </p>
          </div>
          <p className="font-mono text-sm font-bold text-emerald-800">
            {formatCurrency(
              shareCapitalGroups.reduce(
                (sum, item) => sum + Number(item.amount || 0),
                0,
              ),
            )}
          </p>
        </div>
        <div className="space-y-2">
          {shareCapitalGroups.map((item) => {
            const isExpanded = expandedShareRows[item.accountTypeId] ?? false;
            const sourcesPayload = shareSources[item.accountTypeId];
            const isSourcesLoading = !!shareSourcesLoading[item.accountTypeId];

            return (
              <div key={item.accountTypeId} className="space-y-2">
                <div className="group flex items-center justify-between rounded-2xl border bg-background px-4 py-3 shadow-sm transition-all">
                  <div
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                    onClick={() => {
                      if (!isExpanded) {
                        void loadShareCapitalSources(item.accountTypeId);
                      }
                      setExpandedShareRows((prev) => ({
                        ...prev,
                        [item.accountTypeId]: !isExpanded,
                      }));
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!isExpanded) {
                          void loadShareCapitalSources(item.accountTypeId);
                        }
                        setExpandedShareRows((prev) => ({
                          ...prev,
                          [item.accountTypeId]: !isExpanded,
                        }));
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <Folder className="h-4 w-4 text-blue-500" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                          {item.accountCode}
                        </span>
                        <span className="truncate text-sm font-semibold text-foreground">
                          {item.name}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Share Product</span>
                        <span>
                          {item.accountCount} active account
                          {item.accountCount === 1 ? "" : "s"}
                        </span>
                        <span>
                          {item.numberOfShares} share
                          {item.numberOfShares === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Share Value
                    </p>
                    <p className="font-mono text-lg font-bold text-foreground">
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Source Accounts
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {sourcesPayload?.sourceCount ?? item.accountCount} account
                          {(sourcesPayload?.sourceCount ?? item.accountCount) === 1
                            ? ""
                            : "s"}{" "}
                          and {sourcesPayload?.transactionCount ?? 0} transaction
                          {(sourcesPayload?.transactionCount ?? 0) === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Source Total
                        </p>
                        <p className="font-mono text-sm font-bold text-foreground">
                          {formatCurrency(sourcesPayload?.sourceTotal ?? item.amount)}
                        </p>
                      </div>
                    </div>

                    {isSourcesLoading ? (
                      <div className="flex items-center justify-center py-6 text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading share sources...
                      </div>
                    ) : sourcesPayload && sourcesPayload.sourceAccounts.length > 0 ? (
                      <div className="space-y-4">
                        <div className="overflow-hidden rounded-md border bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Account Number</TableHead>
                                <TableHead>Owner</TableHead>
                                <TableHead>No.</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead className="text-right">Shares</TableHead>
                                <TableHead className="text-right">Total Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sourcesPayload.sourceAccounts.map((source) => (
                                <TableRow key={source.accountId}>
                                  <TableCell className="font-mono text-xs">
                                    {source.accountNumber}
                                  </TableCell>
                                  <TableCell className="text-sm font-medium">
                                    {source.ownerName}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {source.ownerNumber}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {source.branchName}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {source.numberOfShares}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {formatCurrency(source.totalValue)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {sourcesPayload.transactions.length > 0 && (
                          <div className="overflow-hidden rounded-md border bg-background">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Member</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Reference</TableHead>
                                  <TableHead className="text-right">Shares</TableHead>
                                  <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sourcesPayload.transactions.map((transaction) => (
                                  <TableRow key={transaction.id}>
                                    <TableCell className="text-xs">
                                      {new Date(transaction.date).toLocaleDateString("en-UG")}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">
                                      {transaction.ownerName}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {transaction.transactionType.replaceAll("_", " ")}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                      {transaction.reference}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {transaction.shares}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatCurrency(transaction.amount)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed bg-background px-4 py-4 text-xs text-muted-foreground">
                        No active share accounts found for this share product.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTreeNode = (account: ChartOfAccount, depth = 0) => {
    const children = getDirectChildren(account);
    const isExpandable =
      children.length > 0 ||
      (account._count?.children || 0) > 0 ||
      FORCE_EXPANDABLE_CODES.has(account.accountCode as EquityBucketCode);
    const isExpanded = !!expandedNodes[account.id];
    const isNodeLoading = !!nodeLoading[account.id];
    const isRootControl = account.accountCode === "300000";
    const branchTotal = getBranchTotal(account);

    return (
      <div key={account.id} className="space-y-2">
        <div
          className={cn(
            "group flex items-center justify-between rounded-2xl border bg-background px-4 py-3 shadow-sm transition-all",
            depth === 0 && "border-slate-200",
            depth > 0 && "border-slate-100 bg-slate-50/60",
          )}
          style={{ marginLeft: `${depth * 24}px` }}
        >
          <div
            className={cn("flex min-w-0 flex-1 items-center gap-3", isExpandable && "cursor-pointer")}
            onClick={() => isExpandable && toggleNode(account)}
          >
            {isExpandable ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleNode(account);
                }}
              >
                {isNodeLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-7" />
            )}

            {isExpandable ? (
              <Folder className="h-4 w-4 text-blue-500" />
            ) : (
              <FileText className="h-4 w-4 text-emerald-500" />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                  {account.accountCode}
                </span>
                <span className="truncate text-sm font-semibold text-foreground">
                  {account.accountName}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {getLevelBadge(account.level)}
                {isRootControl && <span>Control account</span>}
                {children.length > 0 && (
                  <span>
                    {children.length} child account{children.length === 1 ? "" : "s"}
                  </span>
                )}
                <span>{account.isActive ? "Active" : "Inactive"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Balance
              </p>
              <p className="font-mono text-lg font-bold text-foreground">
                {formatCurrency(branchTotal)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchAccountDetails(account.id)}
              disabled={detailsLoading}
              className="bg-primary/5 hover:bg-primary/15"
            >
              {detailsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {isExpandable && isExpanded && (
          <div className="space-y-2">
            {children.map((child) => renderTreeNode(child, depth + 1))}
            {renderNodeItems(account, depth + 1)}
            {!isNodeLoading && children.length === 0 && account.accountCode !== "304000" && (
              <div
                className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground"
                style={{ marginLeft: `${(depth + 1) * 24}px` }}
              >
                No child accounts available yet.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const equityRootAccount = useMemo(
    () => accounts.find((account) => account.accountCode === "300000") || null,
    [accounts],
  );

  const totals = useMemo(() => {
    const byCode = (code: EquityBucketCode) => {
      const account = accounts.find((item) => item.accountCode === code);
      return account ? getBranchTotal(account) : 0;
    };

    return {
      totalEquity: byCode("300000"),
      reserves: byCode("301000"),
      grants: byCode("302000"),
      retained: byCode("303000"),
      shareCapital: byCode("304000"),
    };
  }, [accounts, shareCapitalGroups]);

  const activeAccountsCount = accounts.filter((account) => account.isActive).length;
  const detailAccountsCount = accounts.filter((account) => account.level >= 3).length;
  const largestBucket = [...EQUITY_BUCKETS]
    .map((bucket) => {
      const account = accounts.find((item) => item.accountCode === bucket.code);
      return account ? { ...bucket, account, total: getBranchTotal(account) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs((b?.total || 0)) - Math.abs((a?.total || 0)))[0] as
    | { title: string; total: number; account: ChartOfAccount }
    | undefined;

  if (status === "loading") {
    return (
      <div className="flex h-[400px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>
          Please sign in to view and manage Equity accounts.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto space-y-8 px-6 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-4xl font-extrabold tracking-tight">
            <Landmark className="h-9 w-9 text-primary" />
            Equity
          </h1>
          <p className="text-lg text-muted-foreground">
            Ownership interest, reserves, grants, retained earnings, and share capital
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          size="lg"
          className="shadow-lg transition-all hover:shadow-xl"
        >
          + Add Equity Item
        </Button>
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-muted-foreground/20 bg-background px-4 py-3 md:flex-row md:items-center">
          <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger className="w-full md:w-[320px]">
              <SelectValue placeholder={branchLoading ? "Loading branches..." : "All Branches"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branchOptions.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setSelectedBranchId("all")}
            disabled={selectedBranchId === "all"}
          >
            Reset Scope
          </Button>
        </div>
      )}

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" onClick={fetchAccounts} className="ml-4">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Card className="border-primary/15 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary">Total Equity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totals.totalEquity)}</p>
            <p className="text-xs text-muted-foreground mt-1">300000 equity control account</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">Statutory Reserves</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-900">{formatCurrency(totals.reserves)}</p>
            <p className="text-xs text-muted-foreground mt-1">301000 statutory reserves</p>
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-violet-800">Grants & Donations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-violet-900">{formatCurrency(totals.grants)}</p>
            <p className="text-xs text-muted-foreground mt-1">302000 grants and donations</p>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-sky-50/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-sky-800">Retained Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-sky-900">{formatCurrency(totals.retained)}</p>
            <p className="text-xs text-muted-foreground mt-1">303000 retained earnings</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Share Capital</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-900">{formatCurrency(totals.shareCapital)}</p>
            <p className="text-xs text-muted-foreground mt-1">304000 share capital</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeAccountsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Detail Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{detailAccountsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Largest Bucket</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-lg font-bold">
              {largestBucket?.account?.accountName || "None"}
            </p>
            <p className="text-xs text-muted-foreground">
              {largestBucket ? formatCurrency(largestBucket.total) : "No equity accounts"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-none shadow-md">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle>Equity Structure</CardTitle>
          <CardDescription>
            Review the equity control account and its core buckets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No equity accounts found
            </div>
          ) : (
            <div className="space-y-4">
              {equityRootAccount ? (
                renderTreeNode(equityRootAccount)
              ) : (
                <div className="rounded-2xl border border-dashed border-muted-foreground/20 bg-background px-6 py-8 text-sm text-muted-foreground">
                  No equity buckets found in the chart of accounts.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <Eye className="h-6 w-6 text-primary" />
              Account Details
            </DialogTitle>
            <DialogDescription className="text-base">
              Comprehensive breakdown of equity ledger status
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-8 py-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="rounded-lg bg-muted/30 p-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Account Code
                  </label>
                  <p className="text-2xl font-black font-mono text-primary">
                    {selectedAccount.accountCode}
                  </p>
                </div>
                <div className="col-span-2 rounded-lg bg-muted/30 p-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Account Name
                  </label>
                  <p className="text-2xl font-bold">{selectedAccount.accountName}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xl font-extrabold">
                    <Layers className="h-5 w-5 text-primary" />
                    Underlying Items
                    <span className="ml-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      {itemsType.replace("_", " ")}
                    </span>
                  </h3>
                </div>
                <div
                  className={cn(
                    "min-h-[200px] transition-opacity duration-300",
                    detailsLoading ? "opacity-50" : "opacity-100",
                  )}
                >
                  {renderItemsTable()}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-extrabold">Balance Analysis</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card className="border-none bg-emerald-50/50 dark:bg-emerald-900/10">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs uppercase tracking-wider">
                        Debit Total
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(selectedAccount.debitBalance)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-none bg-amber-50/50 dark:bg-amber-900/10">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs uppercase tracking-wider">
                        Credit Total
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-mono font-bold text-amber-700 dark:text-amber-400">
                        {formatCurrency(selectedAccount.creditBalance)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-none bg-primary/10">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs font-extrabold uppercase tracking-wider">
                        Net Equity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-mono font-black text-primary">
                        {formatCurrency(selectedAccount.balance)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {selectedAccount.children && selectedAccount.children.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-extrabold">
                    Sub-Accounts ({selectedAccount.children.length})
                  </h3>
                  <div className="grid max-h-60 grid-cols-1 gap-3 overflow-y-auto pr-2 md:grid-cols-2">
                    {selectedAccount.children.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between rounded-lg border border-muted-foreground/10 bg-muted/40 p-3"
                      >
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-primary">
                            {child.accountCode}
                          </span>
                          <span className="text-sm font-semibold">{child.accountName}</span>
                        </div>
                        <span className="font-mono text-sm font-black">
                          {formatCurrency(child.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EquityCreateForm
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          fetchAccounts();
          setIsCreateOpen(false);
        }}
      />
    </div>
  );
}
