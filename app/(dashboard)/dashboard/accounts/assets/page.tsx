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
  FileText,
  Folder,
  Landmark,
  Loader2,
  Trash2,
} from "lucide-react";
import { AssetCreateForm } from "./components/AssetCreateForm";
import { CurrentAssetCreateForm } from "./components/CurrentAssetCreateForm";
import { CurrentAssetTransferForm } from "./components/CurrentAssetTransferForm";
import { AssetActionDialog } from "./components/AssetActionDialog";
import { type AssetDisposalTarget } from "./components/AssetDisposalForm";

// --- Real-source asset tree types (mirrors app/api/v1/accounts/assets response) ---
// Shared NodeRef convention across the Assets/Equity/Liabilities pages: every
// tree node carries a synthetic composite id so the UI can key state off it
// without needing a ChartOfAccount row to exist for each entry.
type AssetNodeSource =
  | "FIXED_ASSET_CATEGORY"
  | "CURRENT_ASSET_CATEGORY"
  | "LOAN_ASSET_BUCKET";

interface AssetCategoryNode {
  source: AssetNodeSource;
  key: string;
  id: string;
  isManualLedger: false;
  label: string;
  amount: number;
  count: number;
}

interface AssetsSummaryResponse {
  fixedAssets: { total: number; categories: AssetCategoryNode[] };
  currentAssets: { total: number; categories: AssetCategoryNode[] };
  loans: AssetCategoryNode;
  cashAtHand: { amount: number; count: number; label: string; isModeled: boolean };
  totalAssets: number;
}

interface AssetLedgerItem {
  id: string;
  name: string;
  code: string;
  date: string;
  amount: number;
  status?: string;
  details?: string;
  assetCode?: string;
  assetName?: string;
  assetType?: string;
  category?: string | null;
  approvalStatus?: string;
  receiptNo?: string | null;
  accountId?: string | null;
  currentValue?: number | null;
  purchasePrice?: number | null;
  branch?: { id: string; name: string } | null;
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

  const [assetsData, setAssetsData] = useState<AssetsSummaryResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
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
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(
    {},
  );
  const [nodeItems, setNodeItems] = useState<Record<string, AssetLedgerItem[]>>(
    {},
  );
  const [nodeItemsLoading, setNodeItemsLoading] = useState<
    Record<string, boolean>
  >({});

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
      void fetchAssetsSummary();
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

  const branchQueryString = () =>
    isAdmin && selectedBranchId !== "all"
      ? `?branchId=${encodeURIComponent(selectedBranchId)}`
      : "";

  const fetchAssetsSummary = async () => {
    if (status !== "authenticated") return;

    try {
      setLoading(true);
      setError(null);
      setExpandedNodes({});
      setNodeItems({});
      setNodeItemsLoading({});

      const params = new URLSearchParams();
      if (isAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      }
      const query = params.toString();

      const response = await fetch(
        `/api/v1/accounts/assets${query ? `?${query}` : ""}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.details || errorData?.error || `HTTP ${response.status}`,
        );
      }

      const data = await response.json();

      if (!data || !data.fixedAssets || !data.currentAssets) {
        throw new Error("Invalid response format");
      }

      setAssetsData({
        fixedAssets: data.fixedAssets,
        currentAssets: data.currentAssets,
        loans: data.loans,
        cashAtHand: data.cashAtHand,
        totalAssets: Number(data.totalAssets || 0),
      });
    } catch (err) {
      console.error("Error fetching assets:", err);
      const message =
        err instanceof Error ? err.message : "Failed to fetch assets";
      setError(message);
      setAssetsData(null);
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

      const branchQuery = branchQueryString();

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

  // --- Drill-down fetchers, keyed by NodeRef.id ---

  const fetchCategoryItems = async (
    node: AssetCategoryNode,
    assetType: "FIXED" | "CURRENT",
  ) => {
    try {
      setNodeItemsLoading((prev) => ({ ...prev, [node.id]: true }));
      const params = new URLSearchParams({ assetType, category: node.key });
      if (isAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      }

      const response = await fetch(
        `/api/v1/accounts/assets/items?${params.toString()}`,
        { method: "GET", credentials: "include" },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setNodeItems((prev) => ({
        ...prev,
        [node.id]: Array.isArray(payload.items) ? payload.items : [],
      }));
    } catch (err) {
      console.error("Error fetching asset category items:", err);
      toast.error("Failed to load underlying items");
      setNodeItems((prev) => ({ ...prev, [node.id]: [] }));
    } finally {
      setNodeItemsLoading((prev) => ({ ...prev, [node.id]: false }));
    }
  };

  const fetchLoanBackedItems = async (nodeId: string) => {
    try {
      setNodeItemsLoading((prev) => ({ ...prev, [nodeId]: true }));
      const params = new URLSearchParams();
      if (isAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      }
      const query = params.toString();

      const response = await fetch(
        `/api/v1/accounts/assets/loans-items${query ? `?${query}` : ""}`,
        { method: "GET", credentials: "include" },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setNodeItems((prev) => ({
        ...prev,
        [nodeId]: Array.isArray(payload.items) ? payload.items : [],
      }));
    } catch (err) {
      console.error("Error fetching loan-backed items:", err);
      toast.error("Failed to load underlying items");
      setNodeItems((prev) => ({ ...prev, [nodeId]: [] }));
    } finally {
      setNodeItemsLoading((prev) => ({ ...prev, [nodeId]: false }));
    }
  };

  const toggleCategoryNode = (
    node: AssetCategoryNode,
    assetType: "FIXED" | "CURRENT",
  ) => {
    const willExpand = !expandedNodes[node.id];
    setExpandedNodes((prev) => ({ ...prev, [node.id]: willExpand }));

    if (willExpand && !nodeItems[node.id]) {
      if (node.source === "LOAN_ASSET_BUCKET") {
        void fetchLoanBackedItems(node.id);
      } else {
        void fetchCategoryItems(node, assetType);
      }
    }
  };

  const toggleCashAtHandNode = () => {
    const nodeId = "cash-at-hand";
    const willExpand = !expandedNodes[nodeId];
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: willExpand }));

    if (willExpand && !nodeItems[nodeId]) {
      void fetchLoanBackedItems(nodeId);
    }
  };

  const openDisposeFromItem = (item: AssetLedgerItem) => {
    setSelectedDisposalAsset({
      id: item.id,
      assetCode: item.assetCode || item.code,
      assetName: item.assetName || item.name,
      status: item.status || "ACTIVE",
      assetType: item.assetType,
      category: item.category,
      approvalStatus: item.approvalStatus,
      receiptNo: item.receiptNo,
      accountId: item.accountId,
      currentValue: item.currentValue,
      purchasePrice: item.purchasePrice,
      branch: item.branch,
    });
    setAssetActionsTab("dispose");
    setIsAssetActionsOpen(true);
  };

  // --- Derived totals ---

  const totals = useMemo(() => {
    if (!assetsData) return { totalAssets: 0, current: 0, fixed: 0 };
    return {
      totalAssets: assetsData.totalAssets,
      current:
        assetsData.currentAssets.total +
        assetsData.loans.amount +
        assetsData.cashAtHand.amount,
      fixed: assetsData.fixedAssets.total,
    };
  }, [assetsData]);

  const categoryCount = useMemo(() => {
    if (!assetsData) return 0;
    return (
      assetsData.fixedAssets.categories.length +
      assetsData.currentAssets.categories.length +
      2 // Loans + Cash at hand
    );
  }, [assetsData]);

  const recordCount = useMemo(() => {
    if (!assetsData) return 0;
    const fixedCount = assetsData.fixedAssets.categories.reduce(
      (sum, node) => sum + node.count,
      0,
    );
    const currentCount = assetsData.currentAssets.categories.reduce(
      (sum, node) => sum + node.count,
      0,
    );
    return (
      fixedCount + currentCount + assetsData.loans.count + assetsData.cashAtHand.count
    );
  }, [assetsData]);

  const largestBucket = useMemo(() => {
    if (!assetsData) return undefined;
    const buckets = [
      {
        title: "Current Assets",
        total:
          assetsData.currentAssets.total +
          assetsData.loans.amount +
          assetsData.cashAtHand.amount,
      },
      { title: "Fixed Assets", total: assetsData.fixedAssets.total },
    ];
    return buckets.sort((a, b) => Math.abs(b.total) - Math.abs(a.total))[0];
  }, [assetsData]);

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

  // --- Tree rendering ---

  const renderItemsTable = (nodeId: string, amountLabel = "Amount") => {
    const items = nodeItems[nodeId] || [];
    const isLoadingItems = !!nodeItemsLoading[nodeId];

    if (isLoadingItems) {
      return (
        <div className="ml-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
          Loading underlying items...
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="ml-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
          No underlying items found.
        </div>
      );
    }

    const showDisposeAction = items.some(
      (item) => item.assetType === "FIXED" && item.assetCode,
    );

    return (
      <div className="ml-8 rounded-xl border border-slate-200 bg-white px-4 py-3">
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
                <TableHead className="text-right">{amountLabel}</TableHead>
                {showDisposeAction && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
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
                  {showDisposeAction && (
                    <TableCell className="text-right">
                      {item.assetType === "FIXED" && item.assetCode ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => openDisposeFromItem(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderCategoryNode = (
    node: AssetCategoryNode,
    assetType: "FIXED" | "CURRENT",
    amountLabel = "Balance",
    subtitle?: string,
  ) => {
    const isExpanded = !!expandedNodes[node.id];
    const isLoadingItems = !!nodeItemsLoading[node.id];

    return (
      <div key={node.id} className="space-y-2">
        <div className="group ml-6 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 shadow-sm">
          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
            onClick={() => toggleCategoryNode(node, assetType)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={(event) => {
                event.stopPropagation();
                toggleCategoryNode(node, assetType);
              }}
            >
              {isLoadingItems ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <FileText className="h-4 w-4 text-emerald-500" />
            <div className="min-w-0">
              <span className="truncate text-sm font-semibold text-foreground">
                {node.label}
              </span>
              <div className="mt-1 text-xs text-muted-foreground">
                {subtitle ||
                  `${node.count} record${node.count === 1 ? "" : "s"}`}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {amountLabel}
            </p>
            <p className="font-mono text-lg font-bold text-foreground">
              {formatCurrency(node.amount)}
            </p>
          </div>
        </div>
        {isExpanded && renderItemsTable(node.id, amountLabel)}
      </div>
    );
  };

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
              onClick={() => void fetchAssetsSummary()}
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
              Fixed Assets + Current Assets + Loans + Cash at hand
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
              Current asset categories, Loans, Cash at hand
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
              Land, Motor Vehicle, Furniture and fittings, etc.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Asset Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{categoryCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Underlying Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{recordCount}</p>
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
              {largestBucket?.title || "None"}
            </p>
            <p className="text-xs text-muted-foreground">
              {largestBucket
                ? formatCurrency(largestBucket.total)
                : "No asset data"}
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
            Fixed and Current Asset totals sourced directly from registered
            assets and loan balances (no Chart of Accounts lookups).
          </p>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !assetsData ? (
            <div className="py-12 text-center text-muted-foreground">
              No asset data found
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-background px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <Folder className="h-4 w-4 text-blue-500" />
                  <div>
                    <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                      Assets
                    </span>
                    <span className="ml-2 text-sm font-semibold text-foreground">
                      Control total
                    </span>
                  </div>
                </div>
                <p className="font-mono text-lg font-bold text-foreground">
                  {formatCurrency(assetsData.totalAssets)}
                </p>
              </div>

              <div className="ml-2 space-y-2">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-amber-50/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Folder className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold">Fixed Assets</span>
                  </div>
                  <p className="font-mono text-base font-bold">
                    {formatCurrency(assetsData.fixedAssets.total)}
                  </p>
                </div>
                {assetsData.fixedAssets.categories.length === 0 ? (
                  <div className="ml-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
                    No fixed asset categories found.
                  </div>
                ) : (
                  assetsData.fixedAssets.categories.map((node) =>
                    renderCategoryNode(node, "FIXED"),
                  )
                )}
              </div>

              <div className="ml-2 space-y-2">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-sky-50/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Folder className="h-4 w-4 text-sky-500" />
                    <span className="text-sm font-semibold">Current Assets</span>
                  </div>
                  <p className="font-mono text-base font-bold">
                    {formatCurrency(totals.current)}
                  </p>
                </div>

                {assetsData.currentAssets.categories.map((node) =>
                  renderCategoryNode(node, "CURRENT"),
                )}

                {/* Cash at hand - not a FixedAsset category; modeled from
                    LoanRepayment.principalPaid, drill-down reuses the
                    loans-items endpoint since it is the same underlying data. */}
                <div className="space-y-2">
                  <div className="ml-6 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <div
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                      onClick={toggleCashAtHandNode}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleCashAtHandNode();
                        }}
                      >
                        {nodeItemsLoading["cash-at-hand"] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : expandedNodes["cash-at-hand"] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <FileText className="h-4 w-4 text-emerald-500" />
                      <div className="min-w-0">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {assetsData.cashAtHand.label}
                        </span>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Modeled from loan-repayment principal collected — not
                          literal till cash.
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        Principal
                      </p>
                      <p className="font-mono text-lg font-bold text-foreground">
                        {formatCurrency(assetsData.cashAtHand.amount)}
                      </p>
                    </div>
                  </div>
                  {expandedNodes["cash-at-hand"] &&
                    renderItemsTable("cash-at-hand", "Principal")}
                </div>

                {renderCategoryNode(
                  assetsData.loans,
                  "CURRENT",
                  "Principal",
                  `${assetsData.loans.count} active loan${assetsData.loans.count === 1 ? "" : "s"}`,
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AssetCreateForm
        isOpen={isCreateOpen}
        onClose={closeAssetDialogs}
        onSuccess={() => {
          void fetchAssetsSummary();
          closeAssetDialogs();
        }}
      />

      <CurrentAssetCreateForm
        isOpen={isCurrentCreateOpen}
        onClose={closeAssetDialogs}
        onSuccess={() => {
          void fetchCurrentAssetLedger();
          void fetchAssetsSummary();
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
          void fetchAssetsSummary();
          setIsAssetActionsOpen(false);
          setSelectedDisposalAsset(null);
        }}
      />
    </div>
  );
}
