"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building, 
  ArrowLeftRight, 
  History, 
  Info,
  RefreshCw
} from "lucide-react";
import ReserveTransactionsList from "./components/ReserveTransactionsList";
import ProposeReturnModal from "./components/ProposeReturnModal";

interface BranchVaultDashboardProps {
  vault: any;
  orgReserveId: string;
}

export default function BranchVaultDashboard({
  vault,
  orgReserveId,
}: BranchVaultDashboardProps) {
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!vault) {
    return (
      <div className="w-full space-y-6 p-6">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Branch vault missing</CardTitle>
            <CardDescription>
              This branch does not have an active reserve vault yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ask an administrator to initialize the branch reserve before continuing.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Branch Reserve
          </h1>
          <p className="text-gray-600 mt-1">
            {vault.branch?.name || "Your Branch"} Reserve Management
          </p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">
              Total Reserve Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">
              {formatCurrency(vault.balance)}
            </div>
            <p className="text-xs text-blue-700 mt-2">
              Allocated from Main Office
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">
              Physical Cash On Hand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">
              {formatCurrency(vault.physicalCash)}
            </div>
            <p className="text-xs text-purple-700 mt-2">
              Available for branch operations
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900">
              Branch Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">
              {vault.branch?.name || "N/A"}
            </div>
            <p className="text-xs text-emerald-700 mt-2">
              {vault.location || "Branch Office"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold">Reserve Management Policy</p>
          <p>
            Funds in this reserve are allocated by the Head Office. If your current balance 
            exceeds operational requirements, please use the <strong>Propose Return</strong> 
            action to notify HQ. Funds will remain in your custody until HQ confirms the return.
          </p>
        </div>
      </div>

      {/* Transactions Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Reserve Transactions
          </CardTitle>
          <CardDescription>
            Latest movements in your branch reserve
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReserveTransactionsList 
            vaultId={vault.id} 
            transactions={vault.recentTransactions}
          />
        </CardContent>
      </Card>

      <ProposeReturnModal 
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        branchVault={vault}
        orgReserveId={orgReserveId}
      />
    </div>
  );
}
