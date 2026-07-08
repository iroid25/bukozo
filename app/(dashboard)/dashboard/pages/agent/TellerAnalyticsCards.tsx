// components/dashboard/TellerAnalyticsCards.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wallet,
  ArrowUpDown,
  Clock,
  AlertCircle,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface TellerAnalyticsCardsProps {
  userId: string;
}

export async function TellerAnalyticsCards({
  userId,
}: TellerAnalyticsCardsProps) {
  const response = await fetch(
    `/api/v1/floats/users/${userId}`,
    { cache: "no-store" }
  );
  const payload = response.ok ? await response.json() : null;
  const userFloat = payload?.success ? payload.data?.userFloat : null;
  const openingBalance = payload?.success
    ? payload.data?.openingBalance
    : userFloat?.balance || 0;

  // Calculate transaction stats from float transactions
  const todayTransactions =
    payload?.success
      ? (payload.data?.floatTransactions || []).filter((t: any) => {
      const today = new Date();
      const txDate = new Date(t.transactionDate);
      return (
        txDate.getDate() === today.getDate() &&
        txDate.getMonth() === today.getMonth() &&
        txDate.getFullYear() === today.getFullYear()
      );
    }).length || 0
      : 0;

  const totalTransactions = payload?.success
    ? payload.data?.floatTransactions?.length || 0
    : 0;

  // Check reconciliation status
  const lastReconciliation = payload?.success
    ? payload.data?.floatReconciliations?.[0]
    : null;
  const hasUnbalancedReconciliation =
    lastReconciliation && !lastReconciliation.isBalanced;

  // Day status
  const dayStatus = userFloat?.isActiveForDay
    ? "Active"
    : userFloat?.pendingReconciliation
    ? "Pending Approval"
    : userFloat?.canStartNewDay
    ? "Ready to Start"
    : "Inactive";

  const dayStatusColor = userFloat?.isActiveForDay
    ? "bg-green-500"
    : userFloat?.pendingReconciliation
    ? "bg-yellow-500"
    : userFloat?.canStartNewDay
    ? "bg-blue-500"
    : "bg-gray-500";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Float Balance Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Float Balance</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            UGX {(userFloat?.balance ?? 0).toLocaleString()}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className={`h-2 w-2 rounded-full ${dayStatusColor}`} />
            <p className="text-xs text-muted-foreground">{dayStatus}</p>
          </div>
          {userFloat?.currentDayStarted && userFloat?.isActiveForDay && (
            <p className="text-xs text-muted-foreground mt-1">
              Started:{" "}
              {new Date(userFloat.currentDayStarted).toLocaleTimeString()}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Opening: UGX {Number(openingBalance || 0).toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* Today's Transactions Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Today's Transactions
          </CardTitle>
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayTransactions}</div>
          <p className="text-xs text-muted-foreground">
            Total: {totalTransactions} all-time
          </p>
          {userFloat?.isActiveForDay && (
            <Badge variant="outline" className="mt-2 text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              Day Active
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Last Reconciliation Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Last Reconciliation
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold">
            {lastReconciliation ? (
              <>
                {lastReconciliation.isBalanced ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Balanced
                  </div>
                ) : (
                  <div className="flex items-center text-yellow-600">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Variance
                  </div>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">No reconciliation</span>
            )}
          </div>
          {lastReconciliation && (
            <>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(lastReconciliation.reconciliationDate).toLocaleString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}
              </p>
              {hasUnbalancedReconciliation && (
                <p className="text-xs text-yellow-600 mt-1">
                  Diff: UGX{" "}
                  {Math.abs(lastReconciliation.difference).toLocaleString()}
                </p>
              )}
            </>
          )}
          <Badge
            variant={
              lastReconciliation?.status === "APPROVED"
                ? "default"
                : lastReconciliation?.status === "PENDING"
                ? "secondary"
                : "destructive"
            }
            className="mt-2 text-xs"
          >
            {lastReconciliation?.status || "N/A"}
          </Badge>
        </CardContent>
      </Card>

      {/* Quick Actions Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Link href="/dashboard/floats/my-float">
            <Button variant="outline" className="w-full" size="sm">
              <Wallet className="h-4 w-4 mr-2" />
              View My Float
            </Button>
          </Link>
          {userFloat?.pendingReconciliation && (
            <Badge variant="secondary" className="w-full justify-center">
              Reconciliation Pending
            </Badge>
          )}
          {!userFloat?.isActiveForDay &&
            userFloat?.canStartNewDay &&
            !userFloat?.pendingReconciliation && (
              <Badge variant="default" className="w-full justify-center">
                Ready for New Day
              </Badge>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
