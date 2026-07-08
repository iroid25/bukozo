"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";

type HealthStatus = "ok" | "warning" | "error";

interface HealthSection {
  status: HealthStatus;
  operationalTotal?: number;
  ledgerTotal?: number;
  difference?: number;
  poolBalance?: number;
  liabilityBalance?: number;
  netContributions?: number;
}

interface HealthData {
  summary: {
    generatedAt: string;
    overallStatus: HealthStatus;
  };
  savings: HealthSection & {
    products: Array<{
      accountTypeId: string;
      name: string;
      balance: number;
      accountCount: number;
    }>;
  };
  shares: HealthSection & {
    shareAccountCount: number;
  };
  insurance: HealthSection & {
    collectedTotal: number;
    paidOutTotal: number;
    poolVsLiabilityDifference: number;
    netVsLiabilityDifference: number;
  };
  loanLedger: {
    status: HealthStatus;
    totalPenaltyPaid: number;
    nativePenaltyTotal: number;
    difference: number;
    repaymentCount: number;
    nativeEntryCount: number;
    missingCount: number;
    missingPenaltyTotal: number;
    missing: Array<{
      repaymentId: string;
      loanId: string;
      memberName: string;
      memberNumber: string;
      penaltyPaid: number;
      repaymentDate: string;
      expectedVoucher: string;
    }>;
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount || 0);

const statusMeta: Record<
  HealthStatus,
  { label: string; className: string; icon: typeof ShieldCheck }
> = {
  ok: {
    label: "Healthy",
    className: "bg-green-100 text-green-800 border-green-200",
    icon: ShieldCheck,
  },
  warning: {
    label: "Needs Review",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    icon: ShieldAlert,
  },
  error: {
    label: "Out of Sync",
    className: "bg-red-100 text-red-800 border-red-200",
    icon: ShieldX,
  },
};

function StatusBadge({ status }: { status: HealthStatus }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;

  return (
    <Badge variant="outline" className={meta.className}>
      <Icon className="mr-1 h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  );
}

export default function AccountingIntegrationHealthPage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [remediating, setRemediating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HealthData | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/v1/accounting/integration-health", {
          cache: "no-store",
          credentials: "include",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Failed to load accounting integration health",
          );
        }

        setData(result.data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load accounting integration health",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please sign in to view accounting integration health.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertTitle>Unable to Load Health Check</AlertTitle>
          <AlertDescription>{error || "Unknown error"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 px-6 py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Accounting Integration Health
          </h1>
          <p className="text-lg text-muted-foreground">
            Reconcile operational balances against the general ledger.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <StatusBadge status={data.summary.overallStatus} />
          <p className="text-xs text-muted-foreground">
            Generated {new Date(data.summary.generatedAt).toLocaleString("en-UG")}
          </p>
        </div>
      </div>

      {data.summary.overallStatus !== "ok" && (
        <Alert variant="destructive">
          <AlertTitle>Reconciliation gaps detected</AlertTitle>
          <AlertDescription>
            Review the sections below and correct any operational vs ledger
            differences before relying on downstream reports.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle>Savings vs Liabilities</CardTitle>
              <StatusBadge status={data.savings.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Operational savings</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.savings.operationalTotal || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Liability GL total</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.savings.ledgerTotal || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Difference</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.savings.difference || 0)}
              </span>
            </div>
            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Savings Products
              </p>
              <div className="space-y-2">
                {data.savings.products.map((product) => (
                  <div key={product.accountTypeId} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.accountCount} active account
                        {product.accountCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="font-mono text-xs">
                      {formatCurrency(product.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle>Shares vs Equity</CardTitle>
              <StatusBadge status={data.shares.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Operational shares</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.shares.operationalTotal || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Share capital GL</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.shares.ledgerTotal || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Difference</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.shares.difference || 0)}
              </span>
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              {data.shares.shareAccountCount} active share account
              {data.shares.shareAccountCount === 1 ? "" : "s"} included in the
              operational total.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle>Insurance Pool vs Liability</CardTitle>
              <StatusBadge status={data.insurance.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Pool balance</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.insurance.poolBalance || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Liability GL</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.insurance.liabilityBalance || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Net contributions</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.insurance.netContributions || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Collected total</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.insurance.collectedTotal || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Paid out total</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.insurance.paidOutTotal || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle>Loan Ledger Penalties</CardTitle>
              <StatusBadge status={data.loanLedger.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Penalty paid in repayments</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.loanLedger.totalPenaltyPaid || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Native penalty ledger total</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.loanLedger.nativePenaltyTotal || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Difference</span>
              <span className="font-mono font-semibold">
                {formatCurrency(data.loanLedger.difference || 0)}
              </span>
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              {data.loanLedger.missingCount} repayment
              {data.loanLedger.missingCount === 1 ? "" : "s"} still missing native
              penalty ledger entries.
            </div>
            <Button
              className="w-full"
              variant={data.loanLedger.missingCount > 0 ? "default" : "outline"}
              disabled={remediating || data.loanLedger.missingCount === 0}
              onClick={async () => {
                try {
                  setRemediating(true);
                  const response = await fetch(
                    "/api/v1/accounting/remediate-loan-ledger-penalties",
                    {
                      method: "POST",
                      credentials: "include",
                    },
                  );
                  const result = await response.json();

                  if (!response.ok || !result.success) {
                    throw new Error(result.error || "Remediation failed");
                  }

                  const refresh = await fetch(
                    "/api/v1/accounting/integration-health",
                    {
                      cache: "no-store",
                      credentials: "include",
                    },
                  );
                  const refreshed = await refresh.json();

                  if (refresh.ok && refreshed.success) {
                    setData(refreshed.data);
                  }
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Failed to remediate loan ledger penalties",
                  );
                } finally {
                  setRemediating(false);
                }
              }}
            >
              {remediating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Remediating
                </>
              ) : (
                "Remediate Missing Penalty Entries"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {data.loanLedger.missingCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Missing Loan Ledger Penalty Samples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.loanLedger.missing.slice(0, 10).map((item) => (
              <div
                key={item.repaymentId}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="font-medium">{item.memberName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.memberNumber} · Voucher {item.expectedVoucher}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold">
                    {formatCurrency(item.penaltyPaid)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.repaymentDate).toLocaleDateString("en-UG")}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
