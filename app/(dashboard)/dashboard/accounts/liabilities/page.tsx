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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Landmark,
  Folder,
} from "lucide-react";
import { toast } from "sonner";
import { LiabilityCreateForm } from "./components/LiabilityCreateForm";

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
  sourceType: "ACCOUNT_TYPE" | "INSURANCE_POOL";
  source?: "SAVINGS_ACCOUNT_TYPE" | "INSURANCE_POOL";
  accountTypeId?: string;
  ledgerAccountId?: string | null;
  accountId?: string;
  accountCode?: string | null;
  name: string;
  rawName?: string;
  amount: number;
  accountCount?: number;
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
  branchScoped?: boolean;
}

export default function LiabilitiesPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [linkedAccountTypes, setLinkedAccountTypes] = useState<LinkedAccountType[]>([]);
  const [liabilityGroups, setLiabilityGroups] = useState<LiabilityGroups | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [expandedProductRows, setExpandedProductRows] = useState<Record<string, boolean>>({});
  const [savingsSources, setSavingsSources] = useState<Record<string, SavingsSourcesPayload>>({});
  const [savingsSourcesLoading, setSavingsSourcesLoading] = useState<Record<string, boolean>>({});
  const insuranceBranchKey = isAdmin && selectedBranchId !== "all" ? selectedBranchId : "all";
  const [insuranceSources, setInsuranceSources] = useState<Record<string, InsuranceSourcesPayload>>({});
  const [insuranceSourcesLoading, setInsuranceSourcesLoading] = useState<Record<string, boolean>>({});

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

      const params = new URLSearchParams();
      if (isAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      }

      const accountsResponse = await fetch(`/api/v1/accounts/liabilities${params.toString() ? `?${params}` : ""}`, {
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
      setLinkedAccountTypes(data.linkedAccountTypes || []);
      setLiabilityGroups(data.groups || null);
    } catch (error) {
      console.error("Error fetching liabilities:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch liabilities";
      setError(errorMessage);
      toast.error(errorMessage);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

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
    const branchKey = insuranceBranchKey;
    if (insuranceSources[branchKey] || insuranceSourcesLoading[branchKey]) {
      return;
    }

    try {
      setInsuranceSourcesLoading((prev) => ({ ...prev, [branchKey]: true }));
      const params = new URLSearchParams();
      if (isAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      }
      const response = await fetch(
        `/api/v1/accounts/liabilities/loan-insurance-sources${params.toString() ? `?${params}` : ""}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch insurance pool sources");
      }

      setInsuranceSources((prev) => ({ ...prev, [branchKey]: result.data }));
    } catch (loadError) {
      console.error("Error loading insurance pool sources:", loadError);
      toast.error(
        loadError instanceof Error
          ? loadError.message
          : "Failed to fetch insurance pool sources",
      );
    } finally {
      setInsuranceSourcesLoading((prev) => ({ ...prev, [branchKey]: false }));
    }
  };

  const renderLiabilityGroupItem = (item: LiabilityGroupItem) => {
    if (item.sourceType === "ACCOUNT_TYPE") {
      const rowKey = `product-${item.id}`;
      const isExpanded = expandedProductRows[rowKey] ?? false;
      const sourcesPayload = item.accountTypeId
        ? savingsSources[item.accountTypeId]
        : undefined;
      const isSourcesLoading = item.accountTypeId
        ? !!savingsSourcesLoading[item.accountTypeId]
        : false;

      const linkedLedgerAccount = linkedAccountTypes.find(
        (at) => at.id === item.accountTypeId,
      )?.ledgerAccount;

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
      const insuranceSourcesPayload = insuranceSources[insuranceBranchKey];
      const isInsuranceSourcesLoading = !!insuranceSourcesLoading[insuranceBranchKey];
      const isBranchFiltered = isAdmin && selectedBranchId !== "all";

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

              {isBranchFiltered && (
                <div className="mb-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  The pool balance above is SACCO-wide (the insurance pool is a
                  single shared account and cannot be split by branch). The
                  contributions listed below are filtered to the selected
                  branch, so their total will usually be less than the pool
                  balance.
                </div>
              )}

              <div className="border-t border-slate-200 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Source of Amount
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {insuranceSourcesPayload?.sourceCount ?? 0} contribution
                      {(insuranceSourcesPayload?.sourceCount ?? 0) === 1 ? "" : "s"}{" "}
                      recorded
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Contribution Total
                    </p>
                    <p className="font-mono text-sm font-bold text-foreground">
                      {formatCurrency(insuranceSourcesPayload?.sourceTotal ?? 0)}
                    </p>
                  </div>
                </div>

                {isInsuranceSourcesLoading ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading insurance contribution sources...
                  </div>
                ) : insuranceSourcesPayload && insuranceSourcesPayload.sources.length > 0 ? (
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
                        {insuranceSourcesPayload.sources.map((source) => (
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

    return null;
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

  const totals = liabilityGroups
    ? {
        current: liabilityGroups.summary.currentTotal,
        nonCurrent: liabilityGroups.summary.nonCurrentTotal,
      }
    : { current: 0, nonCurrent: 0 };

  const totalLiabilities = totals.current + totals.nonCurrent;

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
            View and manage savings, insurance pool, and other liability accounts
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
            Review savings products and insurance pool balances sourced from real transaction tables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !liabilityGroups ? (
            <div className="text-center py-12 text-muted-foreground">
              {error ? "Unable to load liabilities" : "No liability data found"}
            </div>
          ) : (
            <div className="space-y-4">
              {([
                {
                  key: "current" as const,
                  title: "Current Liabilities",
                  subtitle: "Short-term obligations, savings balances, and payable items",
                  total: totals.current,
                },
                {
                  key: "nonCurrent" as const,
                  title: "Non-current Liabilities",
                  subtitle: "Long-term liabilities and deferred obligations",
                  total: totals.nonCurrent,
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
                        <p className="font-mono text-xl font-bold">
                          {formatCurrency(group.total)}
                        </p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t bg-muted/5 px-6 py-5">
                        {group.key === "current" ? (
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
                            {liabilityGroups.current.other.items.length > 0 &&
                              renderGroupedSection(
                                "current-other",
                                liabilityGroups.current.other.title,
                                liabilityGroups.current.other.items,
                                liabilityGroups.current.other.total,
                                "No other current liabilities found.",
                              )}
                          </div>
                        ) : (
                          liabilityGroups.nonCurrent.other.items.length > 0 &&
                          renderGroupedSection(
                            "nonCurrent-other",
                            liabilityGroups.nonCurrent.other.title,
                            liabilityGroups.nonCurrent.other.items,
                            liabilityGroups.nonCurrent.other.total,
                            "No non-current liabilities found.",
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
