// app/dashboard/accountant/vault/VaultDashboard.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Download,
  Plus,
  RefreshCw,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  Building,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import ReserveTransactionsList from "./components/ReserveTransactionsList";
import AddReserveFundsModal from "./components/AddReserveFundsModal";
import WithdrawReserveFundsModal from "./components/WithdrawReserveFundsModal";
import ReserveReconciliationModal from "./components/ReserveReconciliationModal";
import InitialFundingModal from "../../branches/components/InitialFundingModal";

interface VaultDashboardProps {
  vault: any;
  accountantId: string;
  userRole?: string;
  branches?: any[];
}

export default function VaultDashboard({
  vault,
  accountantId,
  userRole,
  branches = [],
}: VaultDashboardProps) {
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [isWithdrawFundsOpen, setIsWithdrawFundsOpen] = useState(false);
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);
  const [isBranchSelectorOpen, setIsBranchSelectorOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
    window.location.reload();
  };

  // Mock transaction data for charts (replace with real data from API)
  const transactionTrendData = [
    { date: "Mon", inflow: 5000000, outflow: 2000000 },
    { date: "Tue", inflow: 3000000, outflow: 4000000 },
    { date: "Wed", inflow: 7000000, outflow: 3500000 },
    { date: "Thu", inflow: 4500000, outflow: 2000000 },
    { date: "Fri", inflow: 6000000, outflow: 5000000 },
    { date: "Sat", inflow: 2500000, outflow: 1500000 },
    { date: "Sun", inflow: 1000000, outflow: 800000 },
  ];

  const transactionTypeData = [
    { name: "Float Allocations", value: 35 },
    { name: "Reconciliation Returns", value: 25 },
    { name: "Bank Deposits", value: 15 },
    { name: "Other", value: 25 },
  ];

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate total branch reserves
  const totalBranchReserves = branches.reduce((sum, branch) => {
    const branchVault = branch.activeVault ?? branch.vaults?.[0];
    return sum + (branchVault?.balance || 0);
  }, 0);

  if (!vault) {
    return (
      <div className="w-full space-y-6 p-6">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Vault not initialized</CardTitle>
            <CardDescription>
              The organizational reserve vault is missing. Initialize it first, then return here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Once the vault exists, this dashboard will show reserve balances and branch allocations.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            SACCO Reserve
          </h1>
          <p className="text-gray-600 mt-1">
            Central fund management and branch allocations
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Reserve Balance */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">
              Total Sacco Reserve Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">
              {formatCurrency(vault.balance)}
            </div>
            <p className="text-xs text-blue-700 mt-2">
              HQ Central Reserve
            </p>
          </CardContent>
        </Card>

        {/* Physical Cash */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">
              Physical Sacco Cash On Hand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">
              {formatCurrency(vault.physicalCash)}
            </div>
            <p className="text-xs text-purple-700 mt-2">
              Available for allocation
            </p>
          </CardContent>
        </Card>

        {/* Total Branch Reserves */}
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900">
              Total SACCO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-900">
              {formatCurrency(totalBranchReserves)}
            </div>
            <p className="text-xs text-emerald-700 mt-2">
              Across {branches.length} branches
            </p>
          </CardContent>
        </Card>

        {/* Action Card */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-900">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              onClick={() => setIsAddFundsOpen(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Add Funds
            </Button>

            {userRole === "ADMIN" && (
              <Button
                onClick={() => setIsBranchSelectorOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                size="sm"
              >
                <Building className="w-4 h-4" />
                Fund a Branch
              </Button>
            )}

            <Button
              onClick={() => setIsWithdrawFundsOpen(true)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2"
              size="sm"
            >
              <ArrowUpRight className="w-4 h-4" />
              Withdraw to Bank
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="branches">Branch Reserves</TabsTrigger>
          <TabsTrigger value="history">Allocation History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transaction Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Weekly Reserve Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={transactionTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="inflow"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Inflow"
                    />
                    <Line
                      type="monotone"
                      dataKey="outflow"
                      stroke="#ef4444"
                      strokeWidth={2}
                      name="Outflow"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Transaction Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Transaction Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={transactionTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {transactionTypeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest reserve movements and activities</CardDescription>
            </CardHeader>
            <CardContent>
              <ReserveTransactionsList 
                vaultId={vault.id} 
                transactions={vault.recentTransactions}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branch Reserves Tab */}
        <TabsContent value="branches" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Branch Reserve Overview</CardTitle>
              <CardDescription>
                Current reserve balances across all branches
              </CardDescription>
            </CardHeader>
            <CardContent>
              {branches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No branches found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Reserve Balance</TableHead>
                      <TableHead>Physical Cash</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((branch) => {
                      const branchVault = branch.activeVault ?? branch.vaults?.[0];
                      return (
                        <TableRow key={branch.id}>
                          <TableCell className="font-medium">
                            {branch.name}
                          </TableCell>
                          <TableCell>{branch.location}</TableCell>
                          <TableCell className="font-semibold text-blue-600">
                            {branchVault
                              ? formatCurrency(branchVault.balance)
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-purple-600">
                            {branchVault
                              ? formatCurrency(branchVault.physicalCash)
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {branchVault?.updatedAt
                              ? format(
                                  new Date(branchVault.updatedAt),
                                  "MMM dd, yyyy"
                                )
                              : "Never"}
                          </TableCell>
                          <TableCell className="text-right">
                            {userRole === "ADMIN" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedBranch(branch)}
                                className="gap-2"
                                >
                                <ArrowRight className="w-4 h-4" />
                                Fund
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Allocation History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reserve Allocation History</CardTitle>
              <CardDescription>
                Complete record of all fund movements between HQ and branches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Allocation history will appear here</p>
                <p className="text-sm mt-2">
                  This will show all allocations and returns with full audit trail
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddReserveFundsModal
        isOpen={isAddFundsOpen}
        onClose={() => setIsAddFundsOpen(false)}
        vaultId={vault.id}
        accountantId={accountantId}
        currentBalance={vault.balance}
      />

      <WithdrawReserveFundsModal
        isOpen={isWithdrawFundsOpen}
        onClose={() => setIsWithdrawFundsOpen(false)}
        vaultId={vault.id}
        accountantId={accountantId}
        currentBalance={vault.balance}
      />

      <ReserveReconciliationModal
        isOpen={isReconciliationOpen}
        onClose={() => setIsReconciliationOpen(false)}
        vaultId={vault.id}
        accountantId={accountantId}
        systemBalance={vault.balance}
        physicalCash={vault.physicalCash}
      />

      {/* Branch Selector Dialog */}
      <Dialog open={isBranchSelectorOpen} onOpenChange={setIsBranchSelectorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Branch to Fund</DialogTitle>
            <DialogDescription>
              Choose which branch you want to allocate funds to from the SACCO Reserve.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {branches.map((branch) => (
              <Button
                key={branch.id}
                variant="outline"
                className="w-full justify-between h-auto py-4"
                onClick={() => {
                  setSelectedBranch(branch);
                  setIsBranchSelectorOpen(false);
                }}
              >
                <div className="text-left">
                  <div className="font-semibold">{branch.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {branch.location}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-blue-600">
                    {branch.activeVault ?? branch.vaults?.[0]
                      ? formatCurrency((branch.activeVault ?? branch.vaults?.[0]).balance)
                      : "No vault"}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <InitialFundingModal
        isOpen={!!selectedBranch}
        onClose={() => setSelectedBranch(null)}
        branch={selectedBranch}
        redirectOnSuccess={false}
        maxAllocatableAmount={vault.balance}
      />
    </div>
  );
}
