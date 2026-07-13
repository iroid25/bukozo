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
  Folder,
  Landmark,
  Loader2,
} from "lucide-react";
import { EquityCreateForm } from "./components/EquityCreateForm";

// A single real record backing Statutory Reserves / Grants and Donations
// (one row per reserve allocation / grant received).
interface EquityManualEntryNode {
  source: "EQUITY_MANUAL_ENTRY";
  id: string;
  key: string;
  isManualLedger: false;
  entryId: string;
  type: "STATUTORY_RESERVE" | "GRANT_DONATION";
  amount: number;
  description: string;
  donorOrSource: string | null;
  reference: string | null;
  date: string;
  branchId: string | null;
  recordedByUserId: string;
}

// Flat bucket of EquityManualEntryNode rows (Statutory Reserves / Grants
// and Donations) — no tree, no drill-down, just a list + total.
interface EquityManualBucket {
  title: string;
  items: EquityManualEntryNode[];
  total: number;
}

// Retained Earnings is now a computed rollup (Income minus Expenditure),
// not a list of records.
interface RetainedEarningsBucket {
  title: string;
  amount: number;
  totalIncome: number;
  totalExpenditure: number;
  isComputed: true;
}

// Share capital product, fully derived from ShareAccount/AccountType.
interface ShareCapitalNode {
  source: "SHARE_ACCOUNT_TYPE";
  id: string;
  key: string;
  isManualLedger: false;
  accountTypeId: string;
  name: string;
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

interface ShareCapitalTransactionNode {
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
}

const ROOT_NODE_ID = "EQUITY_ROOT";
const SHARE_CAPITAL_BUCKET_ID = "SHARE_CAPITAL_BUCKET";
const STATUTORY_RESERVES_BUCKET_ID = "STATUTORY_RESERVES_BUCKET";
const GRANTS_AND_DONATIONS_BUCKET_ID = "GRANTS_AND_DONATIONS_BUCKET";
// Statutory Reserves, Grants and Donations, Retained Earnings, Share Capital.
const EQUITY_CHILD_BUCKET_COUNT = 4;

const EMPTY_MANUAL_BUCKET = (title: string): EquityManualBucket => ({
  title,
  items: [],
  total: 0,
});

const EMPTY_RETAINED_EARNINGS: RetainedEarningsBucket = {
  title: "Retained Earnings",
  amount: 0,
  totalIncome: 0,
  totalExpenditure: 0,
  isComputed: true,
};

export default function EquityPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [statutoryReserves, setStatutoryReserves] = useState<EquityManualBucket>(
    EMPTY_MANUAL_BUCKET("Statutory Reserves"),
  );
  const [grantsAndDonations, setGrantsAndDonations] = useState<EquityManualBucket>(
    EMPTY_MANUAL_BUCKET("Grants and Donations"),
  );
  const [retainedEarnings, setRetainedEarnings] = useState<RetainedEarningsBucket>(
    EMPTY_RETAINED_EARNINGS,
  );
  const [shareCapitalItems, setShareCapitalItems] = useState<ShareCapitalNode[]>([]);
  const [shareCapitalTotal, setShareCapitalTotal] = useState<number>(0);
  const [shareCapitalTransactions, setShareCapitalTransactions] = useState<ShareCapitalTransactionNode[]>([]);
  const [shareCapitalTransactionTotal, setShareCapitalTransactionTotal] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    [ROOT_NODE_ID]: true,
  });

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

  const fetchAccounts = async () => {
    if (status !== "authenticated") return;

    try {
      setLoading(true);
      setError(null);
      setExpandedShareRows({});
      setShareSources({});
      setShareSourcesLoading({});
      setExpandedNodes({ [ROOT_NODE_ID]: true });

      const params = new URLSearchParams();
      if (isAdmin && selectedBranchId !== "all") {
        params.set("branchId", selectedBranchId);
      }

      const query = params.toString();
      const response = await fetch(`/api/v1/equity${query ? `?${query}` : ""}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.details || payload?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data?.success) {
        throw new Error(data?.error || "Invalid response format");
      }

      setStatutoryReserves(data.statutoryReserves ?? EMPTY_MANUAL_BUCKET("Statutory Reserves"));
      setGrantsAndDonations(
        data.grantsAndDonations ?? EMPTY_MANUAL_BUCKET("Grants and Donations"),
      );
      setRetainedEarnings(data.retainedEarnings ?? EMPTY_RETAINED_EARNINGS);
      setShareCapitalItems(
        Array.isArray(data.shareCapital?.items) ? data.shareCapital.items : [],
      );
      setShareCapitalTotal(Number(data.shareCapital?.total || 0));
      setShareCapitalTransactions(
        Array.isArray(data.shareCapital?.transactions) ? data.shareCapital.transactions : [],
      );
      setShareCapitalTransactionTotal(Number(data.shareCapital?.transactionTotal || 0));
    } catch (err) {
      console.error("Error fetching equity accounts:", err);
      const message = err instanceof Error ? err.message : "Failed to fetch equity accounts";
      setError(message);
      setStatutoryReserves(EMPTY_MANUAL_BUCKET("Statutory Reserves"));
      setGrantsAndDonations(EMPTY_MANUAL_BUCKET("Grants and Donations"));
      setRetainedEarnings(EMPTY_RETAINED_EARNINGS);
      setShareCapitalItems([]);
      setShareCapitalTotal(0);
      setShareCapitalTransactions([]);
      setShareCapitalTransactionTotal(0);
      toast.error(message);
    } finally {
      setLoading(false);
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

  const toggleRoot = () => {
    setExpandedNodes((prev) => ({ ...prev, [ROOT_NODE_ID]: !prev[ROOT_NODE_ID] }));
  };

  const toggleShareCapitalBucket = () => {
    setExpandedNodes((prev) => ({
      ...prev,
      [SHARE_CAPITAL_BUCKET_ID]: !prev[SHARE_CAPITAL_BUCKET_ID],
    }));
  };

  // Flat table of real EquityManualEntry rows (Statutory Reserves / Grants
  // and Donations) — nothing to expand, just a list of entries.
  const renderManualEntryRows = (items: EquityManualEntryNode[]) => {
    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
          No entries recorded yet.
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-lg border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Source / Donor</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((entry) => (
              <TableRow key={entry.id} className="transition-colors hover:bg-muted/50">
                <TableCell className="text-xs">
                  {entry.date ? new Date(entry.date).toLocaleDateString("en-UG") : "-"}
                </TableCell>
                <TableCell className="text-sm font-medium">{entry.description || "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {entry.donorOrSource || "-"}
                </TableCell>
                <TableCell className="font-mono text-xs text-primary">
                  {entry.reference || "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {formatCurrency(entry.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // Statutory Reserves / Grants and Donations bucket: a header row (with
  // running total) that expands to the flat entry table above. There is no
  // sub-account tree anymore — each entry is already the real record.
  const renderManualEntryBucket = (
    bucket: EquityManualBucket,
    depth: number,
    bucketId: string,
    code: string,
    badgeLabel: string,
  ) => {
    const isExpanded = !!expandedNodes[bucketId];
    const toggle = () => setExpandedNodes((prev) => ({ ...prev, [bucketId]: !prev[bucketId] }));

    return (
      <div key={bucketId} className="space-y-2">
        <div
          className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 shadow-sm transition-all"
          style={{ marginLeft: `${depth * 24}px` }}
        >
          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
            onClick={toggle}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={(event) => {
                event.stopPropagation();
                toggle();
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
                  {code}
                </span>
                <span className="truncate text-sm font-semibold text-foreground">
                  {bucket.title}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {badgeLabel}
                </span>
                <span>
                  {bucket.items.length} entr{bucket.items.length === 1 ? "y" : "ies"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Total
            </p>
            <p className="font-mono text-lg font-bold text-foreground">
              {formatCurrency(bucket.total)}
            </p>
          </div>
        </div>

        {isExpanded && (
          <div style={{ marginLeft: `${(depth + 1) * 24}px` }}>
            {renderManualEntryRows(bucket.items)}
          </div>
        )}
      </div>
    );
  };

  // Retained Earnings is a computed rollup (Income minus Expenditure), not
  // a list of records — headline figure plus the income/expenditure
  // breakdown, no expand/drill-down.
  const renderRetainedEarningsBucket = (depth: number) => {
    const isDeficit = retainedEarnings.amount < 0;

    return (
      <div key="RETAINED_EARNINGS_BUCKET" className="space-y-2">
        <div
          className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 shadow-sm transition-all"
          style={{ marginLeft: `${depth * 24}px` }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="w-7" />
            <Folder className="h-4 w-4 text-blue-500" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                  303000
                </span>
                <span className="truncate text-sm font-semibold text-foreground">
                  {retainedEarnings.title}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Computed — Income minus Expenditure
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Amount
            </p>
            <p
              className={cn(
                "font-mono text-lg font-bold",
                isDeficit ? "text-red-600 dark:text-red-400" : "text-foreground",
              )}
            >
              {isDeficit
                ? `(${formatCurrency(Math.abs(retainedEarnings.amount))})`
                : formatCurrency(retainedEarnings.amount)}
            </p>
          </div>
        </div>

        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          style={{ marginLeft: `${(depth + 1) * 24}px` }}
        >
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Total Income
            </p>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatCurrency(retainedEarnings.totalIncome)}
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Total Expenditure
            </p>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatCurrency(retainedEarnings.totalExpenditure)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderShareCapitalProduct = (item: ShareCapitalNode) => {
    const isExpanded = expandedShareRows[item.accountTypeId] ?? false;
    const sourcesPayload = shareSources[item.accountTypeId];
    const isSourcesLoading = !!shareSourcesLoading[item.accountTypeId];

    const toggleExpand = () => {
      if (!isExpanded) {
        void loadShareCapitalSources(item.accountTypeId);
      }
      setExpandedShareRows((prev) => ({
        ...prev,
        [item.accountTypeId]: !isExpanded,
      }));
    };

    return (
      <div key={item.accountTypeId} className="space-y-2">
        <div className="group flex items-center justify-between rounded-2xl border bg-background px-4 py-3 shadow-sm transition-all">
          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
            onClick={toggleExpand}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpand();
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
              <span className="truncate text-sm font-semibold text-foreground">
                {item.name}
              </span>
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
                  {(sourcesPayload?.sourceCount ?? item.accountCount) === 1 ? "" : "s"}{" "}
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
  };

  const renderShareCapitalTransactions = () => {
    if (shareCapitalTransactions.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-muted-foreground">
          No share transactions found for 304000 Share Capital.
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
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
            {shareCapitalTransactions.map((transaction) => (
              <TableRow key={transaction.id} className="transition-colors hover:bg-muted/50">
                <TableCell className="text-xs">
                  {transaction.date ? new Date(transaction.date).toLocaleDateString("en-UG") : "-"}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {transaction.ownerName}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {transaction.transactionType.replaceAll("_", " ")}
                </TableCell>
                <TableCell className="font-mono text-xs text-primary">
                  {transaction.reference}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {transaction.shares}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {formatCurrency(transaction.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderShareCapitalBucket = (depth: number) => {
    const isExpanded = !!expandedNodes[SHARE_CAPITAL_BUCKET_ID];

    return (
      <div key={SHARE_CAPITAL_BUCKET_ID} className="space-y-2">
        <div
          className="group flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 shadow-sm transition-all"
          style={{ marginLeft: `${depth * 24}px` }}
        >
          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
            onClick={toggleShareCapitalBucket}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={(event) => {
                event.stopPropagation();
                toggleShareCapitalBucket();
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <Folder className="h-4 w-4 text-emerald-600" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                  304000
                </span>
                <span className="truncate text-sm font-semibold text-foreground">
                  Share Capital
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  Real ledger — ShareAccount/ShareTransaction
                </span>
                <span>
                  {shareCapitalTransactions.length} transaction
                  {shareCapitalTransactions.length === 1 ? "" : "s"}
                </span>
                <span>
                  {shareCapitalItems.length} share type{shareCapitalItems.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Balance
            </p>
            <p className="font-mono text-lg font-bold text-foreground">
              {formatCurrency(shareCapitalTotal)}
            </p>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-2" style={{ marginLeft: `${(depth + 1) * 24}px` }}>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Share Transactions
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {shareCapitalTransactions.length} transaction
                    {shareCapitalTransactions.length === 1 ? "" : "s"} recorded
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Transaction Total
                  </p>
                  <p className="font-mono text-sm font-bold text-foreground">
                    {formatCurrency(shareCapitalTransactionTotal)}
                  </p>
                </div>
              </div>
              {renderShareCapitalTransactions()}
            </div>
            {shareCapitalItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-muted-foreground">
                No share account types found.
              </div>
            ) : (
              shareCapitalItems.map((item) => renderShareCapitalProduct(item))
            )}
          </div>
        )}
      </div>
    );
  };

  const totals = useMemo(() => {
    const reserves = statutoryReserves.total;
    const grants = grantsAndDonations.total;
    const retained = retainedEarnings.amount;

    return {
      totalEquity: reserves + grants + retained + shareCapitalTotal,
      reserves,
      grants,
      retained,
      shareCapital: shareCapitalTotal,
    };
  }, [statutoryReserves, grantsAndDonations, retainedEarnings, shareCapitalTotal]);

  const recordedEntriesCount =
    statutoryReserves.items.length +
    grantsAndDonations.items.length;
  const shareAccountsCount =
    shareCapitalItems.reduce((sum, item) => sum + item.accountCount, 0);

  const largestBucket = useMemo(() => {
    const candidates = [
      { title: statutoryReserves.title, total: statutoryReserves.total },
      { title: grantsAndDonations.title, total: grantsAndDonations.total },
      { title: retainedEarnings.title, total: retainedEarnings.amount },
      { title: "Share Capital", total: totals.shareCapital },
    ];
    return candidates.sort((a, b) => Math.abs(b.total) - Math.abs(a.total))[0];
  }, [statutoryReserves, grantsAndDonations, retainedEarnings, totals.shareCapital]);

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

  const hasAnyData =
    statutoryReserves.items.length > 0 ||
    grantsAndDonations.items.length > 0 ||
    retainedEarnings.totalIncome !== 0 ||
    retainedEarnings.totalExpenditure !== 0 ||
    shareCapitalItems.length > 0;
  const isRootExpanded = !!expandedNodes[ROOT_NODE_ID];

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
            <p className="text-xs text-muted-foreground mt-1">304000 share capital (real ledger)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recorded Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{recordedEntriesCount}</p>
            <p className="text-xs text-muted-foreground">Reserves and grants entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Share Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{shareAccountsCount}</p>
            <p className="text-xs text-muted-foreground">Active member share holdings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Largest Bucket</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-lg font-bold">
              {largestBucket?.title || "None"}
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
          ) : !hasAnyData ? (
            <div className="py-12 text-center text-muted-foreground">
              No equity accounts found
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-background px-4 py-3 shadow-sm transition-all">
                  <div
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                    onClick={toggleRoot}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleRoot();
                      }}
                    >
                      {isRootExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <Folder className="h-4 w-4 text-blue-500" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                          300000
                        </span>
                        <span className="truncate text-sm font-semibold text-foreground">
                          Equity
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Control account</span>
                        <span>{EQUITY_CHILD_BUCKET_COUNT} child buckets</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Balance
                    </p>
                    <p className="font-mono text-lg font-bold text-foreground">
                      {formatCurrency(totals.totalEquity)}
                    </p>
                  </div>
                </div>

                {isRootExpanded && (
                  <div className="space-y-2">
                    {renderManualEntryBucket(
                      statutoryReserves,
                      1,
                      STATUTORY_RESERVES_BUCKET_ID,
                      "301000",
                      "Reserve allocation",
                    )}
                    {renderManualEntryBucket(
                      grantsAndDonations,
                      1,
                      GRANTS_AND_DONATIONS_BUCKET_ID,
                      "302000",
                      "Grant / donation received",
                    )}
                    {renderRetainedEarningsBucket(1)}
                    {renderShareCapitalBucket(1)}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
