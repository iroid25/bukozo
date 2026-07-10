"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Trash2,
} from "lucide-react";
import { AssetCreateForm } from "./components/AssetCreateForm";
import { CurrentAssetCreateForm } from "./components/CurrentAssetCreateForm";
import { CurrentAssetTransferForm } from "./components/CurrentAssetTransferForm";
import { AssetActionDialog } from "./components/AssetActionDialog";
import { type AssetDisposalTarget } from "./components/AssetDisposalForm";

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

interface AssetItem {
  id: string;
  name: string;
  code: string;
  date: string;
  amount: number;
  status: string;
  details?: string;
}

interface CurrentAssetRecord {
  id: string;
  assetCode: string;
  assetName: string;
  category: string;
  description?: string | null;
  officerName?: string | null;
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  invoiceNumber?: string | null;
  approvalStatus: string;
  status: string;
  branchId?: string | null;
  branch?: {
    id: string;
    name: string;
  } | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
}

interface CurrentAssetTransferRecord {
  id: string;
  transferCode: string;
  amount: number;
  transferDate: string;
  receiptNo?: string | null;
  officerName?: string | null;
  status: string;
  notes?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  branchId?: string | null;
  branch?: {
    id: string;
    name: string;
  } | null;
  sourceAsset?: {
    id: string;
    assetCode: string;
    assetName: string;
    currentValue: number;
  } | null;
  targetAsset?: {
    id: string;
    assetCode: string;
    assetName: string;
    currentValue: number;
  } | null;
}

interface DisposalAssetTarget extends AssetDisposalTarget {
  approvalStatus?: string;
  assetType?: string;
}

const ASSET_ROOT_CODE = "100000";
const FIXED_ASSETS_CODE = "101000";
const CURRENT_ASSETS_CODE = "102000";

const FORCE_EXPANDABLE_CODES = new Set([
  ASSET_ROOT_CODE,
  FIXED_ASSETS_CODE,
  CURRENT_ASSETS_CODE,
]);

const isLoanAssetAccount = (account: ChartOfAccount) =>
  account.accountCode.startsWith("107") ||
  account.accountName.toLowerCase().includes("loan");

const filterRetiredLoanAssetAccounts = <T extends ChartOfAccount>(
  accounts: T[],
) => accounts;

const getAssetBalanceLabel = (account: ChartOfAccount) =>
  isLoanAssetAccount(account) ? "Principal" : "Balance";

export default function AssetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const actionQuery = searchParams.get("action");
  const isAdmin = session?.user?.role === "ADMIN";
  const canApproveAssets =
    isAdmin ||
    session?.user?.role === "ACCOUNTANT" ||
    session?.user?.role === "BRANCHMANAGER";
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [accountItems, setAccountItems] = useState<AssetItem[]>([]);
  const [itemsType, setItemsType] = useState<string>("GENERIC");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCurrentCreateOpen, setIsCurrentCreateOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAssetActionsOpen, setIsAssetActionsOpen] = useState(false);
  const [assetActionsTab, setAssetActionsTab] = useState<
    "transfer" | "dispose"
  >("transfer");
  const [selectedDisposalAsset, setSelectedDisposalAsset] =
    useState<DisposalAssetTarget | null>(null);
  const [currentAssets, setCurrentAssets] = useState<CurrentAssetRecord[]>([]);
  const [currentTransfers, setCurrentTransfers] = useState<
    CurrentAssetTransferRecord[]
  >([]);
  const [currentAssetsLoading, setCurrentAssetsLoading] = useState(false);
  const [currentTransfersLoading, setCurrentTransfersLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [branchOptions, setBranchOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    [ASSET_ROOT_CODE]: true,
  });
  const [nodeChildren, setNodeChildren] = useState<
    Record<string, ChartOfAccount[]>
  >({});
  const [nodeLoading, setNodeLoading] = useState<Record<string, boolean>>({});
  const [nodeItems, setNodeItems] = useState<Record<string, any[]>>({});
  const [nodeItemsLoading, setNodeItemsLoading] = useState<
    Record<string, boolean>
  >({});
  const loanPrincipalTotal = useMemo(
    () =>
      selectedAccount && isLoanAssetAccount(selectedAccount)
        ? accountItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)
        : 0,
    [accountItems, selectedAccount],
  );

  const closeAssetDialogs = () => {
    setIsCreateOpen(false);
    setIsCurrentCreateOpen(false);
    setIsTransferOpen(false);
    router.replace("/dashboard/accounts/assets");
  };

  const openAssetDialog = (action: "fixed" | "current" | "transfer") => {
    router.push(`/dashboard/accounts/assets?action=${action}`);
  };

  useEffect(() => {
    if (status === "authenticated") {
      void fetchAccounts();
      void fetchCurrentAssetLedger();
    }
  }, [status, selectedBranchId]);

  useEffect(() => {
    setIsCreateOpen(actionQuery === "fixed");
    setIsCurrentCreateOpen(actionQuery === "current");
    setIsTransferOpen(actionQuery === "transfer");
  }, [actionQuery]);

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

  const getCurrentAssetAmount = (asset: CurrentAssetRecord) =>
    Number(asset.currentValue || asset.purchasePrice || 0);

  const getLevelBadge = (level: number) => {
    const colors: Record<number, string> = {
      0: "bg-slate-100 text-slate-700",
      1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      2: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      3: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    const labels: Record<number, string> = {
      0: "Control",
      1: "Main",
      2: "Sub",
      3: "Account",
    };

    return (
      <span
        className={cn(
          "rounded px-2 py-1 text-xs font-medium",
          colors[level] || colors[3],
        )}
      >
        {labels[level] || "Detail"}
      </span>
    );
  };

  const sortChartAccounts = (items: ChartOfAccount[]) =>
    [...items].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.accountCode.localeCompare(b.accountCode);
    });

  const fetchAccounts = async () => {
    if (status !== "authenticated") return;

    try {
      setLoading(true);
      setError(null);
      setNodeChildren({});
      setNodeLoading({});
      setNodeItems({});
      setNodeItemsLoading({});
      setExpandedNodes({ [ASSET_ROOT_CODE]: true });

      const params = new URLSearchParams({
        page: "1",
        limit: "200",
        isActive: "true",
      });

      if (isAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      }

      const assetsResponse = await fetch(
        `/api/v1/accounts/assets?${params.toString()}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );

      if (!assetsResponse.ok) {
        const errorData = await assetsResponse.json().catch(() => null);
        throw new Error(
          errorData?.details ||
            errorData?.error ||
            `HTTP ${assetsResponse.status}`,
        );
      }

      const data = await assetsResponse.json();

      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error("Invalid response format");
      }

      setAccounts(
        sortChartAccounts(filterRetiredLoanAssetAccounts(data.data)),
      );
    } catch (err) {
      console.error("Error fetching assets:", err);
      const message =
        err instanceof Error ? err.message : "Failed to fetch assets";
      setError(message);
      setAccounts([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentAssetLedger = async () => {
    if (status !== "authenticated") return;

    try {
      setCurrentAssetsLoading(true);
      setCurrentTransfersLoading(true);

      const branchQuery =
        isAdmin && selectedBranchId !== "all"
          ? `?branchId=${encodeURIComponent(selectedBranchId)}`
          : "";

      const [assetsResponse, transfersResponse] = await Promise.all([
        fetch(`/api/v1/current-assets${branchQuery}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }),
        fetch(`/api/v1/current-asset-transfers${branchQuery}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }),
      ]);

      if (assetsResponse.ok) {
        const assetsData = await assetsResponse.json();
        setCurrentAssets(
          Array.isArray(assetsData?.data) ? assetsData.data : [],
        );
      } else {
        setCurrentAssets([]);
      }

      if (transfersResponse.ok) {
        const transfersData = await transfersResponse.json();
        setCurrentTransfers(
          Array.isArray(transfersData?.data) ? transfersData.data : [],
        );
      } else {
        setCurrentTransfers([]);
      }
    } catch (err) {
      console.error("Error fetching current asset ledger:", err);
      setCurrentAssets([]);
      setCurrentTransfers([]);
    } finally {
      setCurrentAssetsLoading(false);
      setCurrentTransfersLoading(false);
    }
  };

  const approveCurrentAsset = async (assetId: string) => {
    try {
      const response = await fetch(
        `/api/v1/current-assets/${assetId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result?.details || result?.error || "Failed to approve current asset",
        );
      }

      toast.success("Current asset approved");
      void fetchCurrentAssetLedger();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to approve current asset";
      toast.error(message);
    }
  };

  const rejectCurrentAsset = async (assetId: string) => {
    const rejectionReason = window.prompt("Enter rejection reason");
    if (rejectionReason === null) return;

    try {
      const response = await fetch(`/api/v1/current-assets/${assetId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rejectionReason }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result?.details || result?.error || "Failed to reject current asset",
        );
      }

      toast.success("Current asset rejected");
      void fetchCurrentAssetLedger();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to reject current asset";
      toast.error(message);
    }
  };

  const approveTransfer = async (transferId: string) => {
    try {
      const response = await fetch(
        `/api/v1/current-asset-transfers/${transferId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result?.details || result?.error || "Failed to approve transfer",
        );
      }
      toast.success("Transfer approved and posted");
      void fetchCurrentAssetLedger();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to approve transfer";
      toast.error(message);
    }
  };

  const rejectTransfer = async (transferId: string) => {
    const rejectionReason = window.prompt("Enter rejection reason");
    if (rejectionReason === null) return;

    try {
      const response = await fetch(
        `/api/v1/current-asset-transfers/${transferId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ rejectionReason }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result?.details || result?.error || "Failed to reject transfer",
        );
      }
      toast.success("Transfer rejected");
      void fetchCurrentAssetLedger();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reject transfer";
      toast.error(message);
    }
  };

  const accountChildrenMap = useMemo(() => {
    const map = new Map<string, ChartOfAccount[]>();
    filterRetiredLoanAssetAccounts(accounts).forEach((account) => {
      const parentId = account.parent?.id;
      if (!parentId) return;
      const siblings = map.get(parentId) || [];
      siblings.push(account);
      map.set(parentId, siblings);
    });
    return map;
  }, [accounts]);

  const fetchNodeDetails = async (accountId: string) => {
    try {
      setNodeLoading((prev) => ({ ...prev, [accountId]: true }));
      const branchQuery =
        isAdmin && selectedBranchId !== "all"
          ? `?branchId=${encodeURIComponent(selectedBranchId)}`
          : "";
      const response = await fetch(
        `/api/v1/chart-of-accounts/${accountId}${branchQuery}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );

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
            _count: child._count || {
              children: 0,
              journalEntries: 0,
              debitTransactions: 0,
              creditTransactions: 0,
            },
          }))
        : [];

      setNodeChildren((prev) => ({
        ...prev,
        [accountId]: sortChartAccounts(
          filterRetiredLoanAssetAccounts(children),
        ),
      }));

      setNodeItemsLoading((prev) => ({ ...prev, [accountId]: true }));
      try {
        const itemsResponse = await fetch(
          `/api/v1/chart-of-accounts/${accountId}/items${branchQuery}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        );

        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          setNodeItems((prev) => ({
            ...prev,
            [accountId]: Array.isArray(itemsData.items) ? itemsData.items : [],
          }));
        } else {
          setNodeItems((prev) => ({ ...prev, [accountId]: [] }));
        }
      } finally {
        setNodeItemsLoading((prev) => ({ ...prev, [accountId]: false }));
      }
    } catch (err) {
      console.error("Error fetching node details:", err);
      toast.error("Failed to expand asset category");
    } finally {
      setNodeLoading((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const fetchAccountDetails = async (accountId: string) => {
    try {
      setDetailsLoading(true);
      setAccountItems([]);
      setItemsType("GENERIC");
      setSelectedDisposalAsset(null);
      const branchQuery =
        isAdmin && selectedBranchId !== "all"
          ? `?branchId=${encodeURIComponent(selectedBranchId)}`
          : "";

      const response = await fetch(
        `/api/v1/chart-of-accounts/${accountId}${branchQuery}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data?.data) throw new Error("Invalid response format");

      setSelectedAccount(data.data);
      setDetailsOpen(true);

      setItemsLoading(true);
      try {
        const itemsResponse = await fetch(
          `/api/v1/chart-of-accounts/${accountId}/items${branchQuery}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        );

        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          setAccountItems(
            Array.isArray(itemsData.items) ? itemsData.items : [],
          );
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

  const getDirectChildren = (account: ChartOfAccount) => {
    const fromCache = nodeChildren[account.id] || [];
    const fromTree = accountChildrenMap.get(account.id) || [];
    const combined = [...fromTree, ...fromCache];
    return filterRetiredLoanAssetAccounts(combined).filter(
      (child, index, list) =>
      list.findIndex((item) => item.id === child.id) === index,
    );
  };

  const getLoanPrincipalTotal = (items: any[] = []) =>
    items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const getDisplayAccountTotal = (account: ChartOfAccount) => {
    if (isLoanAssetAccount(account)) {
      const loadedLoanItems = nodeItems[account.id] || [];
      const principalTotal = getLoanPrincipalTotal(loadedLoanItems);

      if (principalTotal !== 0) {
        return principalTotal;
      }
    }

    return getAccountBranchTotal(account);
  };

  const getAccountBranchTotal = (
    account: ChartOfAccount,
    visited = new Set<string>(),
  ): number => {
    if (visited.has(account.id)) return 0;
    visited.add(account.id);

    const descendants = getDirectChildren(account);
    if (descendants.length === 0) {
      return Number(account.balance || 0);
    }

    const childrenTotal = descendants.reduce(
      (sum, child) => sum + getAccountBranchTotal(child, new Set(visited)),
      0,
    );

    return childrenTotal !== 0 ? childrenTotal : Number(account.balance || 0);
  };

  const toggleNode = async (account: ChartOfAccount) => {
    const nextExpanded = !expandedNodes[account.id];
    setExpandedNodes((prev) => ({ ...prev, [account.id]: nextExpanded }));

    if (
      nextExpanded &&
      !nodeChildren[account.id] &&
      !nodeItems[account.id] &&
      (FORCE_EXPANDABLE_CODES.has(account.accountCode) ||
        (account._count?.children || 0) > 0 ||
        account.level >= 2)
    ) {
      await fetchNodeDetails(account.id);
    }
  };

  const renderNodeItems = (account: ChartOfAccount, depth: number) => {
    const items = nodeItems[account.id] || [];
    const isNodeItemsLoading = !!nodeItemsLoading[account.id];

    if (isNodeItemsLoading) {
      return (
        <div
          className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground"
          style={{ marginLeft: `${depth * 24}px` }}
        >
          Loading underlying items...
        </div>
      );
    }

    if (items.length === 0) return null;

    return (
      <div
        className="rounded-xl border border-slate-200 bg-white px-4 py-3"
        style={{ marginLeft: `${depth * 24}px` }}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Underlying Items</p>
          <span className="text-xs text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border">
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
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs">
                    {item.date ? new Date(item.date).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.code || "-"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {item.name || "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.details || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(Number(item.amount || 0))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderTreeNode = (account: ChartOfAccount, depth = 0) => {
    const children = getDirectChildren(account);
    const isExpandable =
      children.length > 0 ||
      (account._count?.children || 0) > 0 ||
      FORCE_EXPANDABLE_CODES.has(account.accountCode) ||
      account.level >= 2;
    const isExpanded = !!expandedNodes[account.id];
    const isNodeLoading = !!nodeLoading[account.id];

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
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3",
              isExpandable && "cursor-pointer",
            )}
            onClick={() => isExpandable && toggleNode(account)}
          >
            {isExpandable ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleNode(account);
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
                {account.accountCode === ASSET_ROOT_CODE && (
                  <span>Control account</span>
                )}
                {children.length > 0 && (
                  <span>
                    {children.length} child account
                    {children.length === 1 ? "" : "s"}
                  </span>
                )}
                <span>{account.isActive ? "Active" : "Inactive"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {getAssetBalanceLabel(account)}
              </p>
              <p className="font-mono text-lg font-bold text-foreground">
                {formatCurrency(getDisplayAccountTotal(account))}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void fetchAccountDetails(account.id)}
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
            {!isNodeLoading && children.length === 0 && (
                <div
                  className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground"
                  style={{ marginLeft: `${(depth + 1) * 24}px` }}
                >
                  No child accounts available yet. Open this node to review its
                  items or sub-accounts.
                </div>
              )}
          </div>
        )}
      </div>
    );
  };

  const assetRootAccount = useMemo(
    () =>
      filterRetiredLoanAssetAccounts(accounts).find(
        (account) => account.accountCode === ASSET_ROOT_CODE,
      ) ||
      null,
    [accounts],
  );

  const totals = useMemo(() => {
    const byCode = (code: string) => {
      const account = filterRetiredLoanAssetAccounts(accounts).find(
        (item) => item.accountCode === code,
      );
      return account ? getAccountBranchTotal(account) : 0;
    };

    return {
      totalAssets: byCode(ASSET_ROOT_CODE),
      current: byCode(CURRENT_ASSETS_CODE),
      fixed: byCode(FIXED_ASSETS_CODE),
    };
  }, [accounts, nodeChildren, nodeItems]);

  const visibleAccounts = filterRetiredLoanAssetAccounts(accounts);

  const activeAccountsCount = visibleAccounts.filter(
    (account) => account.isActive,
  ).length;
  const detailAccountsCount = visibleAccounts.filter(
    (account) => account.level >= 2,
  ).length;

  const largestBucket = [
    { code: CURRENT_ASSETS_CODE, title: "Current Assets" },
    { code: FIXED_ASSETS_CODE, title: "Fixed Assets" },
  ]
    .map((bucket) => {
      const account = visibleAccounts.find(
        (item) => item.accountCode === bucket.code,
      );
      return account
        ? { ...bucket, account, total: getAccountBranchTotal(account) }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b?.total || 0) - Math.abs(a?.total || 0))[0] as
    | { title: string; total: number; account: ChartOfAccount }
    | undefined;

  const currentAssetTotals = useMemo(() => {
    const approved = currentAssets.filter(
      (asset) => asset.approvalStatus === "APPROVED",
    );
    const pending = currentAssets.filter(
      (asset) => asset.approvalStatus === "PENDING_APPROVAL",
    );

    return {
      approvedCount: approved.length,
      pendingCount: pending.length,
      approvedValue: approved.reduce(
        (sum, asset) =>
          sum + getCurrentAssetAmount(asset),
        0,
      ),
    };
  }, [currentAssets]);

  const currentAssetQueued = useMemo(
    () =>
      [...currentAssets].sort(
        (a, b) =>
          Number(new Date(b.purchaseDate || 0)) -
          Number(new Date(a.purchaseDate || 0)),
      ),
    [currentAssets],
  );

  const currentTransferQueued = useMemo(
    () =>
      [...currentTransfers].sort(
        (a, b) =>
          Number(new Date(b.transferDate || 0)) -
          Number(new Date(a.transferDate || 0)),
      ),
    [currentTransfers],
  );

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
        <AlertDescription>Please sign in to view Assets.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto space-y-8 px-6 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-4xl font-extrabold tracking-tight">
            <Landmark className="h-9 w-9 text-primary" />
            Assets
          </h1>
          <p className="text-lg text-muted-foreground">
            View and manage approved current and fixed asset classifications
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-muted-foreground/20 bg-background px-4 py-3 md:flex-row md:items-center">
            <Select
              value={selectedBranchId}
              onValueChange={setSelectedBranchId}
            >
              <SelectTrigger className="w-full md:w-[320px]">
                <SelectValue
                  placeholder={
                    branchLoading ? "Loading branches..." : "All Branches"
                  }
                />
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
        <div className="flex w-full flex-wrap gap-2 lg:justify-end">
          <Button
            onClick={() => openAssetDialog("fixed")}
            size="lg"
            className="shadow-lg transition-all hover:shadow-xl"
          >
            Register Fixed Asset
          </Button>
          <Button
            onClick={() => openAssetDialog("current")}
            size="lg"
            variant="secondary"
          >
            Register Current Asset
          </Button>
          <Button
            onClick={() => openAssetDialog("transfer")}
            size="lg"
            variant="outline"
          >
            Transfer Asset
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            {error}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchAccounts()}
              className="ml-4"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-primary/15 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary">
              Total Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(totals.totalAssets)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              100000 asset control account
            </p>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-sky-50/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-sky-800">
              Current Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-sky-900">
              {formatCurrency(totals.current)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              102000 current assets
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">
              Fixed Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-900">
              {formatCurrency(totals.fixed)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              101000 fixed assets
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Active Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeAccountsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Detail Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{detailAccountsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Largest Bucket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-lg font-bold">
              {largestBucket?.account?.accountName || "None"}
            </p>
            <p className="text-xs text-muted-foreground">
              {largestBucket
                ? formatCurrency(largestBucket.total)
                : "No asset accounts"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-muted/60 shadow-sm">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle>Current Asset Approvals</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review current assets and keep the amount visible before it lands
            in the registered assets view.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {currentAssetsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : currentAssetQueued.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No current assets found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentAssetQueued.map((asset) => {
                    const amount = getCurrentAssetAmount(asset);
                    const isApproved = asset.approvalStatus === "APPROVED";
                    const isPending =
                      asset.approvalStatus === "PENDING_APPROVAL";

                    return (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <div className="font-medium">{asset.assetName}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {asset.assetCode}
                          </div>
                        </TableCell>
                        <TableCell>{asset.category}</TableCell>
                        <TableCell>{asset.branch?.name || "-"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              isApproved
                                ? "default"
                                : asset.approvalStatus === "REJECTED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {asset.approvalStatus.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {isPending && canApproveAssets ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => void approveCurrentAsset(asset.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                                onClick={() => void rejectCurrentAsset(asset.id)}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : isApproved ? (
                            <span className="text-xs text-muted-foreground">
                              Approved
                              {asset.approvedAt
                                ? ` on ${new Date(asset.approvedAt).toLocaleDateString()}`
                                : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {asset.rejectionReason || "-"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-muted/60 shadow-sm">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle>Current Asset Transfers</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review current asset transfers such as advances, Wendi, bank
            accounts, and cash-at-hand movements before they are posted.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {currentTransfersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : currentTransferQueued.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No current asset transfers found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transfer</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Transfer To</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentTransferQueued.map((transfer) => {
                    const isApproved = transfer.status === "APPROVED";
                    const isPending = transfer.status === "PENDING_APPROVAL";

                    return (
                      <TableRow key={transfer.id}>
                        <TableCell>
                          <div className="font-medium">{transfer.transferCode}</div>
                          <div className="text-xs text-muted-foreground">
                            {transfer.transferDate
                              ? new Date(transfer.transferDate).toLocaleDateString()
                              : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {transfer.sourceAsset?.assetName || "-"}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {transfer.sourceAsset?.assetCode || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {transfer.targetAsset?.assetName || "-"}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {transfer.targetAsset?.assetCode || "-"}
                          </div>
                        </TableCell>
                        <TableCell>{transfer.branch?.name || transfer.branchId || "-"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(Number(transfer.amount || 0))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              isApproved
                                ? "default"
                                : transfer.status === "REJECTED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {transfer.status.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {isPending && canApproveAssets ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => void approveTransfer(transfer.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                                onClick={() => void rejectTransfer(transfer.id)}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : isApproved ? (
                            <span className="text-xs text-muted-foreground">
                              Approved
                              {transfer.approvedAt
                                ? ` on ${new Date(transfer.approvedAt).toLocaleDateString()}`
                                : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {transfer.rejectionReason || "-"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-none shadow-md">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle>Asset Structure</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review the asset control account and its main buckets.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No asset accounts found
            </div>
          ) : (
            <div className="space-y-4">
              {assetRootAccount ? (
                renderTreeNode(assetRootAccount)
              ) : (
                <div className="rounded-2xl border border-dashed border-muted-foreground/20 bg-background px-6 py-8 text-sm text-muted-foreground">
                  No asset buckets found in the chart of accounts.
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
              Comprehensive breakdown of asset ledger status
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-8 py-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="rounded-lg bg-muted/30 p-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Account Code
                  </label>
                  <p className="font-mono text-2xl font-black text-primary">
                    {selectedAccount.accountCode}
                  </p>
                </div>
                  <div className="col-span-2 rounded-lg bg-muted/30 p-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Account Name
                    </label>
                    <p className="text-2xl font-bold">
                      {selectedAccount.accountName}
                    </p>
                  </div>
                </div>

              {isLoanAssetAccount(selectedAccount) && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card className="border-none bg-primary/10">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs font-extrabold uppercase tracking-wider">
                        Principal
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-mono font-black text-primary">
                        {formatCurrency(
                          loanPrincipalTotal || selectedAccount.balance,
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {itemsType === "FIXED_ASSET" && (
                <div className="flex flex-col gap-3 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-destructive">
                        Asset action
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Open the asset action popup to transfer or record a
                      disposal.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setAssetActionsTab("dispose");
                      setIsAssetActionsOpen(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Open Asset Actions
                  </Button>
                </div>
              )}

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
                  {itemsLoading ? (
                    <div className="py-4 text-center text-muted-foreground">
                      Loading underlying items...
                    </div>
                  ) : !accountItems || accountItems.length === 0 ? (
                    <div className="rounded border border-dashed bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                      No underlying items found.
                    </div>
                  ) : (
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
                            <TableRow
                              key={item.id}
                              className="transition-colors hover:bg-muted/50"
                            >
                              <TableCell className="text-xs">
                                {item.date
                                  ? new Date(item.date).toLocaleDateString()
                                  : "-"}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-primary">
                                {item.code || "-"}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {item.name || "-"}
                              </TableCell>
                              <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                                {item.details || "-"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm font-semibold">
                                {formatCurrency(Number(item.amount || 0))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-extrabold">
                  {isLoanAssetAccount(selectedAccount)
                    ? "Principal Analysis"
                    : "Balance Analysis"}
                </h3>
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
                        {isLoanAssetAccount(selectedAccount)
                          ? "Principal"
                          : "Net Asset Value"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-mono font-black text-primary">
                        {formatCurrency(
                          isLoanAssetAccount(selectedAccount)
                            ? loanPrincipalTotal || selectedAccount.balance
                            : selectedAccount.balance,
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {selectedAccount.children &&
                selectedAccount.children.length > 0 && (
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
                            <span className="text-sm font-semibold">
                              {child.accountName}
                            </span>
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

      <AssetCreateForm
        isOpen={isCreateOpen}
        onClose={closeAssetDialogs}
        onSuccess={() => {
          void fetchAccounts();
          closeAssetDialogs();
        }}
      />

      <CurrentAssetCreateForm
        isOpen={isCurrentCreateOpen}
        onClose={closeAssetDialogs}
        onSuccess={() => {
          void fetchCurrentAssetLedger();
          void fetchAccounts();
          closeAssetDialogs();
        }}
      />

      <CurrentAssetTransferForm
        isOpen={isTransferOpen}
        onClose={closeAssetDialogs}
        onSuccess={() => {
          void fetchCurrentAssetLedger();
          closeAssetDialogs();
        }}
      />

      <AssetActionDialog
        isOpen={isAssetActionsOpen}
        initialTab={assetActionsTab}
        disposalAsset={selectedDisposalAsset}
        onClose={() => {
          setIsAssetActionsOpen(false);
          router.replace("/dashboard/accounts/assets");
        }}
        onSuccess={() => {
          void fetchCurrentAssetLedger();
          void fetchAccounts();
          setDetailsOpen(false);
          setIsAssetActionsOpen(false);
          setSelectedDisposalAsset(null);
        }}
      />
    </div>
  );
}
