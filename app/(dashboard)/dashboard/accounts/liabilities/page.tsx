"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Eye,
  Layers,
  ChevronDown,
  ChevronRight,
  Landmark,
  Folder,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { LiabilityCreateForm } from "./components/LiabilityCreateForm";
import { cn } from "@/lib/utils";

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

interface LinkedAccountType {
  id: string;
  name: string;
  ledgerAccountId?: string | null;
  isDefault?: boolean;
  isLoanEligible?: boolean;
  ledgerAccount?: {
    id: string;
    accountCode: string;
    accountName: string;
    parentId?: string | null;
    parent?: {
      id: string;
      accountCode: string;
      accountName: string;
    } | null;
  } | null;
}

interface LiabilityGroupItem {
  id: string;
  sourceType: "ACCOUNT_TYPE" | "GL_ACCOUNT" | "INSURANCE_POOL";
  accountTypeId?: string;
  ledgerAccountId?: string | null;
  accountId?: string;
  accountCode?: string | null;
  name: string;
  rawName?: string;
  amount: number;
  accountCount?: number;
  level?: number;
  isActive?: boolean;
}

interface LiabilityGroups {
  current: {
    savings: {
      title: string;
      items: LiabilityGroupItem[];
      total: number;
    };
    loanInsurance: {
      title: string;
      items: LiabilityGroupItem[];
      total: number;
    };
    other: {
      title: string;
      items: LiabilityGroupItem[];
      total: number;
    };
  };
  nonCurrent: {
    other: {
      title: string;
      items: LiabilityGroupItem[];
      total: number;
    };
  };
  summary: {
    currentTotal: number;
    nonCurrentTotal: number;
    savingsTotal: number;
    loanInsuranceTotal: number;
  };
}

interface IntegrationHealthSnapshot {
  summary: {
    overallStatus: "ok" | "warning" | "error";
  };
  savings: {
    status: "ok" | "warning" | "error";
    difference: number;
  };
  insurance: {
    status: "ok" | "warning" | "error";
    poolVsLiabilityDifference: number;
  };
}

interface SavingsSourceRow {
  accountId: string;
  accountNumber: string;
  ownerName: string;
  ownerNumber: string;
  branchName: string;
  balance: number;
  status: string;
}

interface SavingsSourcesPayload {
  sourceCount: number;
  sourceTotal: number;
  sources: SavingsSourceRow[];
}

interface InsuranceSourceRow {
  id: string;
  memberName: string;
  memberNumber: string;
  amount: number;
  date: string;
  reference: string;
  description: string;
}

interface InsuranceSourcesPayload {
  sourceCount: number;
  sourceTotal: number;
  sources: InsuranceSourceRow[];
}

export default function LiabilitiesPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [linkedAccountTypes, setLinkedAccountTypes] = useState<LinkedAccountType[]>([]);
  const [liabilityGroups, setLiabilityGroups] = useState<LiabilityGroups | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [accountItems, setAccountItems] = useState<any[]>([]);
  const [itemsType, setItemsType] = useState<string>("GENERIC");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<IntegrationHealthSnapshot | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    current: true,
    nonCurrent: true,
  });
  const [expandedSubgroups, setExpandedSubgroups] = useState<Record<string, boolean>>({
    "current-savings": true,
    "current-loanInsurance": true,
    "current-other": true,
    "nonCurrent-other": true,
  });
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [expandedProductRows, setExpandedProductRows] = useState<Record<string, boolean>>({});
  const [savingsSources, setSavingsSources] = useState<Record<string, SavingsSourcesPayload>>({});
  const [savingsSourcesLoading, setSavingsSourcesLoading] = useState<Record<string, boolean>>({});
  const [insuranceSources, setInsuranceSources] = useState<InsuranceSourcesPayload | null>(null);
  const [insuranceSourcesLoading, setInsuranceSourcesLoading] = useState(false);

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

  const fetchAccounts = async () => {
    if (status !== "authenticated") return;

    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: "1",
        limit: "200",
        isActive: "true",
      });
      if (isAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      }

      const accountsResponse = await fetch(`/api/v1/accounts/liabilities?${params}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      
      if (!accountsResponse.ok) {
        const errorData = await accountsResponse.json().catch(() => null);
        throw new Error(
          errorData?.details ||
            errorData?.error ||
            `HTTP ${accountsResponse.status}`,
        );
      }

      const data = await accountsResponse.json();

      if (data.data) {
        setAccounts(data.data);
        setLinkedAccountTypes(data.linkedAccountTypes || []);
        setLiabilityGroups(data.groups || null);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("❌ Error fetching liabilities:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch liabilities";
      setError(errorMessage);
      toast.error(errorMessage);
      setAccounts([]);
      setLinkedAccountTypes([]);
      setLiabilityGroups(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;

    const loadHealth = async () => {
      try {
        const response = await fetch("/api/v1/accounting/integration-health", {
          credentials: "include",
          cache: "no-store",
        });
        const result = await response.json();
        if (response.ok && result.success) {
          setHealth(result.data);
        }
      } catch (healthError) {
        console.error("Error loading accounting health snapshot:", healthError);
      }
    };

    loadHealth();
  }, [status]);

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

      if (data.data) {
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
            setAccountItems(itemsData.items || []);
            setItemsType(itemsData.itemsType || "GENERIC");
          }
        } catch (err) {
          console.error("Error fetching items:", err);
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
      1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      2: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      3: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    const labels = { 1: "Main", 2: "Sub", 3: "Account" };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[level as keyof typeof colors] || colors[3]}`}>
        {labels[level as keyof typeof labels] || "Detail"}
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

  const getLiabilityGroupKey = (account: ChartOfAccount) => {
    const accountName = account.accountName.toLowerCase();

    if (
      account.accountCode.startsWith("202") ||
      account.fullCode?.startsWith("202") ||
      account.parent?.accountCode?.startsWith("202") ||
      accountName.includes("non-current liabil") ||
      accountName.includes("non current liabil")
    ) {
      return "nonCurrent";
    }

    if (
      account.accountCode.startsWith("201") ||
      account.fullCode?.startsWith("201") ||
      account.parent?.accountCode?.startsWith("201") ||
      accountName.includes("current liabil")
    ) {
      return "current";
    }

    return account.accountCode.startsWith("2") ? "current" : "nonCurrent";
  };

  const isStructuralAccount = (account: ChartOfAccount) => {
    const normalizedName = account.accountName.trim().toLowerCase();

    if (account.accountCode === "200000" || normalizedName === "liabilities") {
      return true;
    }

    return false;
  };

  const sortGroupedAccounts = (groupAccounts: ChartOfAccount[]) =>
    [...groupAccounts].sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }

      return a.accountCode.localeCompare(b.accountCode);
    });

  const normalizeAccountName = (accountName: string) =>
    accountName.trim().toLowerCase().replace(/\s+/g, " ");

  const LIABILITY_COLLAPSIBLE_CODES = new Set([
    "201001",
    "201002",
    "201003",
    "201004",
    "201005",
    "200600",
    "202001",
    "202002",
    "202003",
    "202004",
  ]);

  const visibleAccounts = (() => {
    const currentNames = new Set(
      accounts
        .filter(
          (account) =>
            getLiabilityGroupKey(account) === "current" && !isStructuralAccount(account),
        )
        .map((account) => normalizeAccountName(account.accountName)),
    );

    return accounts.filter((account) => {
      if (isStructuralAccount(account)) return false;

      const groupKey = getLiabilityGroupKey(account);
      const normalizedName = normalizeAccountName(account.accountName);

      // Prefer the short-term/current liability definition when an account
      // name has been duplicated across both liability sections.
      if (groupKey === "nonCurrent" && currentNames.has(normalizedName)) {
        return false;
      }

      return true;
    });
  })();

  const groupedAccounts = {
    current: sortGroupedAccounts(
      visibleAccounts.filter(
        (account) => getLiabilityGroupKey(account) === "current",
      ),
    ),
    nonCurrent: sortGroupedAccounts(
      visibleAccounts.filter(
        (account) => getLiabilityGroupKey(account) === "nonCurrent",
      ),
    ),
  };

  const groupedAccountTrees = {
    current: buildGroupTree(groupedAccounts.current, "201000"),
    nonCurrent: buildGroupTree(groupedAccounts.nonCurrent, "202000"),
  };

  const accountTypesByAccountId = linkedAccountTypes.reduce<Record<string, LinkedAccountType[]>>(
    (acc, accountType) => {
      if (accountType.ledgerAccountId) {
        acc[accountType.ledgerAccountId] = [
          ...(acc[accountType.ledgerAccountId] || []),
          accountType,
        ];
      }

      const parentId = accountType.ledgerAccount?.parentId;
      if (parentId && parentId !== accountType.ledgerAccountId) {
        acc[parentId] = [...(acc[parentId] || []), accountType];
      }

      return acc;
    },
    {},
  );

  const totals = liabilityGroups
    ? {
        current: liabilityGroups.summary.currentTotal,
        nonCurrent: liabilityGroups.summary.nonCurrentTotal,
      }
    : {
        current: groupedAccounts.current.reduce(
          (sum, account) => sum + Number(account.balance || 0),
          0,
        ),
        nonCurrent: groupedAccounts.nonCurrent.reduce(
          (sum, account) => sum + Number(account.balance || 0),
          0,
        ),
      };

  const totalLiabilities = totals.current + totals.nonCurrent;

  const toggleGroup = (groupKey: "current" | "nonCurrent") => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const toggleSubgroup = (subgroupKey: string) => {
    setExpandedSubgroups((prev) => ({
      ...prev,
      [subgroupKey]: !prev[subgroupKey],
    }));
  };

  const toggleRow = (rowKey: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  };

  const toggleProductRow = (rowKey: string) => {
    setExpandedProductRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  };

  const loadSavingsSources = async (accountTypeId: string) => {
    if (savingsSources[accountTypeId] || savingsSourcesLoading[accountTypeId]) {
      return;
    }

    try {
      setSavingsSourcesLoading((prev) => ({ ...prev, [accountTypeId]: true }));
      const response = await fetch(
        `/api/v1/accounts/liabilities/savings-sources?accountTypeId=${accountTypeId}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch savings sources");
      }

      setSavingsSources((prev) => ({
        ...prev,
        [accountTypeId]: result.data,
      }));
    } catch (loadError) {
      console.error("Error loading savings sources:", loadError);
      toast.error(
        loadError instanceof Error
          ? loadError.message
          : "Failed to fetch savings sources",
      );
    } finally {
      setSavingsSourcesLoading((prev) => ({ ...prev, [accountTypeId]: false }));
    }
  };

  const loadInsuranceSources = async () => {
    if (insuranceSources || insuranceSourcesLoading) {
      return;
    }

    try {
      setInsuranceSourcesLoading(true);
      const response = await fetch(
        "/api/v1/accounts/liabilities/loan-insurance-sources",
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch insurance pool sources");
      }

      setInsuranceSources(result.data);
    } catch (loadError) {
      console.error("Error loading insurance pool sources:", loadError);
      toast.error(
        loadError instanceof Error
          ? loadError.message
          : "Failed to fetch insurance pool sources",
      );
    } finally {
      setInsuranceSourcesLoading(false);
    }
  };

  const renderLiabilityGroupItem = (item: LiabilityGroupItem) => {
    if (item.sourceType === "ACCOUNT_TYPE") {
      const rowKey = `product-${item.id}`;
      const isExpanded = expandedProductRows[rowKey] ?? false;
      const linkedLedgerAccount = item.ledgerAccountId
        ? accounts.find((account) => account.id === item.ledgerAccountId)
        : null;
      const sourcesPayload = item.accountTypeId
        ? savingsSources[item.accountTypeId]
        : undefined;
      const isSourcesLoading = item.accountTypeId
        ? !!savingsSourcesLoading[item.accountTypeId]
        : false;

      return (
        <div key={item.id} className="space-y-2">
          <div className="group flex items-center justify-between rounded-2xl border bg-background px-4 py-3 shadow-sm transition-all">
            <div
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
              onClick={() => {
                if (!isExpanded && item.accountTypeId) {
                  void loadSavingsSources(item.accountTypeId);
                }
                toggleProductRow(rowKey);
              }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isExpanded && item.accountTypeId) {
                    void loadSavingsSources(item.accountTypeId);
                  }
                  toggleProductRow(rowKey);
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
                  {item.accountCode ? (
                    <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                      {item.accountCode}
                    </span>
                  ) : null}
                  <span className="truncate text-sm font-semibold text-foreground">
                    {item.name}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Savings Product</span>
                  <span>
                    {item.accountCount || 0} active account
                    {item.accountCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Saved Amount
              </p>
              <p className="font-mono text-lg font-bold text-foreground">
                {formatCurrency(item.amount)}
              </p>
            </div>
          </div>

          {isExpanded && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Product Type
                  </p>
                  <p className="mt-1 font-medium text-foreground">Savings Product</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Active Accounts
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {item.accountCount || 0}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Linked Ledger
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {linkedLedgerAccount
                      ? `${linkedLedgerAccount.accountCode} ${linkedLedgerAccount.accountName}`
                      : "No linked ledger account"}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Source of Amount
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {sourcesPayload?.sourceCount ?? item.accountCount ?? 0} account
                      {(sourcesPayload?.sourceCount ?? item.accountCount ?? 0) === 1
                        ? ""
                        : "s"}{" "}
                      contributing to this total
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
                    Loading source accounts...
                  </div>
                ) : sourcesPayload && sourcesPayload.sources.length > 0 ? (
                  <div className="overflow-hidden rounded-md border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account Number</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>No.</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sourcesPayload.sources.map((source) => (
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
                            <TableCell className="text-xs text-muted-foreground">
                              {source.status}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(source.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed bg-background px-4 py-4 text-xs text-muted-foreground">
                    No active source accounts found for this savings product.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (item.sourceType === "INSURANCE_POOL") {
      const rowKey = `insurance-${item.id}`;
      const isExpanded = expandedProductRows[rowKey] ?? false;

      return (
        <div key={item.id} className="space-y-2">
          <div className="group flex items-center justify-between rounded-2xl border bg-background px-4 py-3 shadow-sm transition-all">
            <div
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
              onClick={() => {
                if (!isExpanded) {
                  void loadInsuranceSources();
                }
                toggleProductRow(rowKey);
              }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isExpanded) {
                    void loadInsuranceSources();
                  }
                  toggleProductRow(rowKey);
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
                  {item.accountCode ? (
                    <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                      {item.accountCode}
                    </span>
                  ) : null}
                  <span className="truncate text-sm font-semibold text-foreground">
                    {item.name}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Central Insurance Pool</span>
                  <span>Member contributions tracked separately</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Pool Amount
              </p>
              <p className="font-mono text-lg font-bold text-foreground">
                {formatCurrency(item.amount)}
              </p>
            </div>
          </div>

          {isExpanded && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Pool Account
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    SACCO_LOAN_INSURANCE_POOL
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Source Type
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    Insurance Contributions
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Pool Balance
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Source of Amount
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {insuranceSources?.sourceCount ?? 0} contribution
                      {(insuranceSources?.sourceCount ?? 0) === 1 ? "" : "s"}{" "}
                      recorded
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Contribution Total
                    </p>
                    <p className="font-mono text-sm font-bold text-foreground">
                      {formatCurrency(insuranceSources?.sourceTotal ?? 0)}
                    </p>
                  </div>
                </div>

                {insuranceSourcesLoading ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading insurance contribution sources...
                  </div>
                ) : insuranceSources && insuranceSources.sources.length > 0 ? (
                  <div className="overflow-hidden rounded-md border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Member No.</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {insuranceSources.sources.map((source) => (
                          <TableRow key={source.id}>
                            <TableCell className="text-sm font-medium">
                              {source.memberName}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {source.memberNumber}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {source.reference}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(source.date).toLocaleDateString("en-UG")}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {source.description}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(source.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed bg-background px-4 py-4 text-xs text-muted-foreground">
                    No insurance contribution sources found.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    const sourceAccount = accounts.find((account) => account.id === item.accountId);

    if (sourceAccount) {
      return renderAccountCard(sourceAccount);
    }

    return (
      <div
        key={item.id}
        className="rounded-2xl border bg-background px-5 py-4 shadow-sm transition-colors"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {item.accountCode ? (
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                  {item.accountCode}
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {item.name}
                </p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Balance
            </p>
            <p className="font-mono text-lg font-bold text-foreground">
              {formatCurrency(item.amount)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  const renderLiabilityAccountNode = (
    item: LiabilityGroupItem,
    subgroupItems: LiabilityGroupItem[],
    depth = 0,
  ) => {
    const sourceAccount = item.accountId ? accountsById.get(item.accountId) : undefined;

    if (!sourceAccount) {
      return renderLiabilityGroupItem(item);
    }

    const childItems = subgroupItems
      .filter(
        (candidate) =>
          candidate.sourceType === "GL_ACCOUNT" &&
          candidate.accountId &&
          accountsById.get(candidate.accountId)?.parent?.id === sourceAccount.id,
      )
      .sort((a, b) => (a.accountCode || "").localeCompare(b.accountCode || ""));

    const isStructuralLiabilityNode = LIABILITY_COLLAPSIBLE_CODES.has(sourceAccount.accountCode);
    const mappedAccountTypes = accountTypesByAccountId[sourceAccount.id] || [];
    const hasChildren =
      isStructuralLiabilityNode || childItems.length > 0 || mappedAccountTypes.length > 0;
    const isExpanded = expandedRows[sourceAccount.id] ?? false;

    return (
      <div key={sourceAccount.id} className="space-y-2">
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
              hasChildren && "cursor-pointer",
            )}
            onClick={() => hasChildren && toggleRow(sourceAccount.id)}
          >
            {hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleRow(sourceAccount.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-7" />
            )}

            {hasChildren ? (
              <Folder className="h-4 w-4 text-blue-500" />
            ) : (
              <FileText className="h-4 w-4 text-emerald-500" />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                  {sourceAccount.accountCode}
                </span>
                <span className="truncate text-sm font-semibold text-foreground">
                  {sourceAccount.accountName}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {getLevelBadge(sourceAccount.level)}
                {hasChildren && (
                  <span>
                    {childItems.length} child account{childItems.length === 1 ? "" : "s"}
                  </span>
                )}
                {mappedAccountTypes.length > 0 && (
                  <span>
                    {mappedAccountTypes.length} linked account type
                    {mappedAccountTypes.length === 1 ? "" : "s"}
                  </span>
                )}
                <span>{sourceAccount.isActive ? "Active" : "Inactive"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Balance
              </p>
              <p className="font-mono text-lg font-bold text-foreground">
                {formatCurrency(sourceAccount.balance)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchAccountDetails(sourceAccount.id)}
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

        {hasChildren && isExpanded && (
          <div className="space-y-2">
            {childItems.map((child) =>
              renderLiabilityAccountNode(child, subgroupItems, depth + 1),
            )}
            {childItems.length === 0 && isStructuralLiabilityNode && (
              <div
                className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground"
                style={{ marginLeft: `${(depth + 1) * 24}px` }}
              >
                No child items available yet.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGroupedSection = (
    subgroupKey: string,
    title: string,
    items: LiabilityGroupItem[],
    total: number,
    emptyMessage: string,
  ) => {
    const isExpanded = expandedSubgroups[subgroupKey] ?? true;
    const savingsItems = items.filter((item) => item.sourceType === "ACCOUNT_TYPE");
    const insurancePoolItems = items.filter(
      (item) => item.sourceType === "INSURANCE_POOL",
    );
    const glItems = items.filter((item) => item.sourceType === "GL_ACCOUNT");
    const glItemIds = new Set(
      glItems
        .map((item) => item.accountId)
        .filter((value): value is string => !!value),
    );
    const glRoots = glItems
      .filter((item) => {
        const parentId = item.accountId
          ? accountsById.get(item.accountId)?.parent?.id
          : undefined;
        return !parentId || !glItemIds.has(parentId);
      })
      .sort((a, b) => (a.accountCode || "").localeCompare(b.accountCode || ""));

    return (
      <div className="rounded-3xl border bg-card shadow-sm">
        <button
          type="button"
          onClick={() => toggleSubgroup(subgroupKey)}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-xl font-bold">{title}</p>
              <p className="text-sm text-muted-foreground">
                {items.length} line item{items.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Section Total
            </p>
            <p className="font-mono text-xl font-bold">{formatCurrency(total)}</p>
          </div>
        </button>

        {isExpanded && (
          <div className="border-t bg-muted/5 px-6 py-5">
            {items.length > 0 ? (
              <div className="space-y-3">
                {savingsItems.map(renderLiabilityGroupItem)}
                {insurancePoolItems.map(renderLiabilityGroupItem)}
                {glRoots.map((item) => renderLiabilityAccountNode(item, glItems))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-muted-foreground/20 bg-background px-6 py-8 text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  function buildGroupTree(
    groupAccounts: ChartOfAccount[],
    rootCode: string,
  ) {
    const root = groupAccounts.find((account) => account.accountCode === rootCode) || null;

    const childrenByParent = new Map<string, ChartOfAccount[]>();

    for (const account of groupAccounts) {
      const parentId = account.parent?.id;
      if (!parentId) continue;

      const siblings = childrenByParent.get(parentId) || [];
      siblings.push(account);
      childrenByParent.set(parentId, siblings);
    }

    for (const siblings of childrenByParent.values()) {
      siblings.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    }

    const nestedRootChildren = root ? childrenByParent.get(root.id) || [] : [];
    const ungrouped = groupAccounts.filter((account) => {
      if (root && account.id === root.id) return false;
      if (!account.parent?.id) return !root;
      if (root && account.parent.id === root.id) return false;
      return !childrenByParent.has(account.parent.id);
    });

    return {
      root,
      nestedRootChildren,
      childrenByParent,
      ungrouped: sortGroupedAccounts(ungrouped),
    };
  }

  const renderAccountCard = (account: ChartOfAccount, nested = false) => {
    const mappedAccountTypes = accountTypesByAccountId[account.id] || [];

    return (
      <div
        key={account.id}
        className={cn(
          "rounded-2xl border bg-background px-5 py-4 shadow-sm transition-colors",
          account.level === 1 && "bg-muted/20",
          account.level === 2 && "border-primary/15 bg-primary/5",
          account.level >= 3 && "border-l-4 border-l-primary/20",
          nested && "ml-6",
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                {account.accountCode}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {account.accountName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {getLevelBadge(account.level)}
                  {account._count && account._count.children > 0 && (
                    <span>
                      {account._count.children} child account{account._count.children > 1 ? "s" : ""}
                    </span>
                  )}
                  {mappedAccountTypes.length > 0 && (
                    <span>
                      {mappedAccountTypes.length} linked account type{mappedAccountTypes.length > 1 ? "s" : ""}
                    </span>
                  )}
                  <span>{account.isActive ? "Active" : "Inactive"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Balance
              </p>
              <p className="font-mono text-lg font-bold text-foreground">
                {formatCurrency(account.balance)}
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

        {mappedAccountTypes.length > 0 && (
          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Linked Account Types
            </p>
            <div className="flex flex-wrap gap-2">
              {mappedAccountTypes.map((accountType) => (
                <span
                  key={accountType.id}
                  className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {accountType.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLiabilityTreeNode = (
    account: ChartOfAccount,
    tree: ReturnType<typeof buildGroupTree>,
    depth = 0,
  ) => {
    const children = tree.childrenByParent.get(account.id) || [];
    const mappedAccountTypes = accountTypesByAccountId[account.id] || [];
    const hasChildren =
      children.length > 0 || mappedAccountTypes.length > 0 || LIABILITY_COLLAPSIBLE_CODES.has(account.accountCode);
    const isExpanded = expandedRows[account.id] ?? false;

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
              hasChildren && "cursor-pointer",
            )}
            onClick={() => hasChildren && toggleRow(account.id)}
          >
            {hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleRow(account.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-7" />
            )}

            {hasChildren ? (
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
                {children.length > 0 && (
                  <span>
                    {children.length} child account{children.length === 1 ? "" : "s"}
                  </span>
                )}
                {mappedAccountTypes.length > 0 && (
                  <span>
                    {mappedAccountTypes.length} linked account type
                    {mappedAccountTypes.length === 1 ? "" : "s"}
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
                {formatCurrency(account.balance)}
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

        {hasChildren && isExpanded && (
          <div className="space-y-2">
            {mappedAccountTypes.length > 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Linked Account Types
                </p>
                <div className="flex flex-wrap gap-2">
                  {mappedAccountTypes.map((accountType) => (
                    <span
                      key={accountType.id}
                      className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {accountType.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {children.map((child) => renderLiabilityTreeNode(child, tree, depth + 1))}

            {!mappedAccountTypes.length && children.length === 0 && (
              <div
                className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground"
                style={{ marginLeft: `${(depth + 1) * 24}px` }}
              >
                No child items available yet.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGroupedAccounts = (groupKey: "current" | "nonCurrent") => {
    const items = groupedAccounts[groupKey];
    const tree = groupedAccountTrees[groupKey];

    if (items.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-muted-foreground/20 bg-background px-6 py-8 text-sm text-muted-foreground">
          No accounts found in this category.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {tree.root && (
          <div className="space-y-3">
            {renderAccountCard(tree.root)}
            {tree.nestedRootChildren.map((account) =>
              renderLiabilityTreeNode(account, tree, 0),
            )}
          </div>
        )}

        {tree.ungrouped.length > 0 && (
          <div className="space-y-3">
            {tree.ungrouped.map((account) => renderAccountCard(account))}
          </div>
        )}
      </div>
    );
  };

  const renderItemsTable = () => {
    if (itemsLoading) return <div className="text-center py-4 text-muted-foreground">Loading underlying items...</div>;

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
                    {accountItems.map((item) => (
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

  if (status === "loading") {
    return (
      <div className="container mx-auto py-6 space-y-6 px-4 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="container mx-auto py-6 space-y-6 px-4">
        <Alert className="border-red-200 bg-red-50">
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>Please sign in to view Liabilities.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 px-6 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-4xl font-extrabold tracking-tight">
            <Landmark className="h-9 w-9 text-primary" />
            Liabilities
          </h1>
          <p className="text-lg text-muted-foreground">
            View and manage liability accounts in current and non-current categories
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} size="lg">
            + New Liability
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card className="border-primary/15 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary">Total Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totalLiabilities)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totals.current)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Non-current Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totals.nonCurrent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(liabilityGroups?.summary.savingsTotal || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Insurance Pool</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(liabilityGroups?.summary.loanInsuranceTotal || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" onClick={fetchAccounts} className="ml-4">Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {health &&
        (health.savings.status !== "ok" || health.insurance.status !== "ok") && (
          <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-950">
            <AlertTitle>Liability integration warning</AlertTitle>
            <AlertDescription>
              Savings difference: {formatCurrency(health.savings.difference || 0)}.
              Loan insurance difference:{" "}
              {formatCurrency(health.insurance.poolVsLiabilityDifference || 0)}.
              Review{" "}
              <a
                href="/dashboard/accounting/integration-health"
                className="font-semibold underline underline-offset-4"
              >
                Accounting Integration Health
              </a>{" "}
              before relying on liability totals.
            </AlertDescription>
          </Alert>
        )}

      <Card className="overflow-hidden border-none shadow-md">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle>Liability Structure</CardTitle>
          <CardDescription>
            Review the liability accounts grouped under current and non-current liabilities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {error ? "Unable to load liabilities" : "No liability accounts found"}
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {([
                  {
                    key: "current" as const,
                    title: "Current Liabilities",
                    subtitle: "Short-term obligations, savings balances, and payable items",
                    total: totals.current,
                    count: groupedAccounts.current.length,
                  },
                  {
                    key: "nonCurrent" as const,
                    title: "Non-current Liabilities",
                    subtitle: "Long-term liabilities and deferred obligations",
                    total: totals.nonCurrent,
                    count: groupedAccounts.nonCurrent.length,
                  },
                ]).map((group) => {
                  const isExpanded = expandedGroups[group.key];

                  return (
                    <div key={group.key} className="rounded-3xl border bg-card shadow-sm">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="rounded-xl bg-primary/10 p-2 text-primary">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="text-xl font-bold">{group.title}</p>
                            <p className="text-sm text-muted-foreground">{group.subtitle}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-widest text-muted-foreground">
                            {group.count} account{group.count === 1 ? "" : "s"}
                          </p>
                          <p className="font-mono text-xl font-bold">
                            {formatCurrency(group.total)}
                          </p>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t bg-muted/5 px-6 py-5">
                          {group.key === "current" && liabilityGroups ? (
                            <div className="space-y-4">
                              {renderGroupedSection(
                                "current-savings",
                                liabilityGroups.current.savings.title,
                                liabilityGroups.current.savings.items,
                                liabilityGroups.current.savings.total,
                                "No savings liability products found.",
                              )}
                              {renderGroupedSection(
                                "current-loanInsurance",
                                liabilityGroups.current.loanInsurance.title,
                                liabilityGroups.current.loanInsurance.items,
                                liabilityGroups.current.loanInsurance.total,
                                "No insurance pool liability accounts found.",
                              )}
                              {renderGroupedSection(
                                "current-other",
                                liabilityGroups.current.other.title,
                                liabilityGroups.current.other.items,
                                liabilityGroups.current.other.total,
                                "No other current liabilities found.",
                              )}
                            </div>
                          ) : group.key === "nonCurrent" && liabilityGroups ? (
                            renderGroupedSection(
                              "nonCurrent-other",
                              liabilityGroups.nonCurrent.other.title,
                              liabilityGroups.nonCurrent.other.items,
                              liabilityGroups.nonCurrent.other.total,
                              "No non-current liabilities found.",
                            )
                          ) : (
                            renderGroupedAccounts(group.key)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Account Details Dialog (Reused Logic) */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Account Details</DialogTitle>
            <DialogDescription>Complete information about this liability account</DialogDescription>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-6">
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
                    <label className="text-sm font-medium text-muted-foreground">Level</label>
                    <div className="mt-1">{getLevelBadge(selectedAccount.level)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Currency</label>
                  <p className="text-base">{selectedAccount.currency || 'UGX'}</p>
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
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Dr</CardTitle></CardHeader>
                    <CardContent><p className="text-xl font-bold">{formatCurrency(selectedAccount.debitBalance)}</p></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Cr</CardTitle></CardHeader>
                    <CardContent><p className="text-xl font-bold">{formatCurrency(selectedAccount.creditBalance)}</p></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Net</CardTitle></CardHeader>
                    <CardContent><p className="text-xl font-bold">{formatCurrency(selectedAccount.balance)}</p></CardContent>
                  </Card>
                </div>
              </div>

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
            </div>
          )}
        </DialogContent>
      </Dialog>
      <LiabilityCreateForm 
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
