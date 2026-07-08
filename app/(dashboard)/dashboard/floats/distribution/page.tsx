import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import { serverFetch } from "@/lib/server-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wallet,
  Users2,
  AlertCircle,
  Clock,
  TrendingUp,
  DollarSign,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default async function AccountantDashboard() {
  const user = await getAuthUser();
  if (!user || user.role !== "ACCOUNTANT") redirect("/login");

  const res = await serverFetch("/api/v1/accountant/float-dashboard");
  const json = res.ok ? await res.json() : { data: null };
  const statistics = json.data?.statistics ?? {
    totalBalance: 0,
    activeFloats: 0,
    todayAllocations: 0,
    pendingReconciliations: 0,
    unreconciledTellersCount: 0,
    reconciliationStatus: { balanced: 0, unbalanced: 0 },
  };
  const { recentAllocations = [], pendingReconciliations = [], unreconciledTellers = [] } =
    json.data?.recent ?? {};

  const cards = [
    {
      title: "Total Float Allocated",
      value: formatCurrency(statistics.totalBalance),
      icon: Wallet,
      change: "Across all tellers/agents",
      color: "text-blue-700",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "Active Floats",
      value: statistics.activeFloats,
      icon: Users2,
      change: "Tellers and agents",
      color: "text-green-700",
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      title: "Today's Allocations",
      value: statistics.todayAllocations,
      icon: TrendingUp,
      change: "Floats distributed today",
      color: "text-purple-700",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      title: "Pending Reconciliations",
      value: statistics.pendingReconciliations,
      icon: Clock,
      change: "Awaiting approval",
      color: "text-orange-700",
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
    },
  ];

  const recentFive = recentAllocations.slice(0, 5);

  return (
    <main className="p-8 space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Accountant Dashboard</h1>
        <p className="text-gray-600">
          Manage float allocations, reconciliations, and financial oversight.
        </p>
      </div>

      {/* Analytics Cards */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, index) => (
            <Card key={index} className={card.bgColor}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Balanced Reconciliations</p>
                    <p className="text-xs text-gray-500">Last 30 days</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">
                    {statistics.reconciliationStatus.balanced}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm font-medium">Unbalanced Reconciliations</p>
                    <p className="text-xs text-gray-500">Last 30 days</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600">
                    {statistics.reconciliationStatus.unbalanced}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users2 className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium">Unreconciled Tellers</p>
                    <p className="text-xs text-gray-500">Need EOD review</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-600">
                    {statistics.unreconciledTellersCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Accountant Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/dashboard/floats">
                <Button className="w-full" variant="default">
                  <Wallet className="mr-2 h-4 w-4" />
                  Allocate Float
                </Button>
              </Link>
              <Link href="/dashboard/floats/distribution/reconciliations">
                <Button className="w-full" variant="outline">
                  <Clock className="mr-2 h-4 w-4" />
                  View Reconciliations
                </Button>
              </Link>
              <Link href="/dashboard/floats">
                <Button className="w-full" variant="outline">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Float Overview
                </Button>
              </Link>
              <Link href="/dashboard/reports/financial-dashboard">
                <Button className="w-full" variant="outline">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Financial Reports
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Float Allocations</CardTitle>
              <Link href="/dashboard/floats">
                <Button size="sm" variant="ghost">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentFive.length > 0 ? (
                recentFive.map((allocation: any) => (
                  <div
                    key={allocation.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                        <Users2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{allocation.tellerAgent.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {allocation.branch.name} - {allocation.tellerAgent.role}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-blue-600">
                        {formatCurrency(allocation.amount)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(allocation.allocationDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No allocations yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Pending Reconciliations
                {pendingReconciliations.length > 0 && (
                  <Badge variant="destructive">{pendingReconciliations.length}</Badge>
                )}
              </CardTitle>
              <Link href="/dashboard/accountant/reconciliations">
                <Button size="sm" variant="ghost">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingReconciliations.length > 0 ? (
                pendingReconciliations.slice(0, 5).map((rec: any) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                        <AlertCircle className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium">{rec.float.user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Difference: {formatCurrency(Math.abs(rec.difference))}
                        </p>
                      </div>
                    </div>
                    <Badge variant={rec.isBalanced ? "default" : "destructive"}>
                      {rec.isBalanced ? "Balanced" : "Unbalanced"}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No pending reconciliations
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
