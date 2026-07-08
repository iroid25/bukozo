// app/(dashboard)/dashboard/member-details/deposit-details
"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowDownRight,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Plus,
} from "lucide-react";
import UniversalTransactionDialog from "../../loan-repayments/my-repayments/UniversalTransactionDialog";
import DataTable from "@/components/DataTableComponents/DataTable";
import {
  depositColumns,
  DepositTransaction,
} from "@/components/DataTableColumns/deposit-columns";

// =====================
// TypeScript Interfaces
// =====================

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface Summary {
  totalDeposits: number;
  depositCount: number;
  averageDeposit: number;
}

interface DepositsResponse {
  success: boolean;
  data: {
    deposits: DepositTransaction[];
    pagination: Pagination;
    summary: Summary;
  };
}

// =====================
// Helper Functions
// =====================

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// =====================
// Main Component
// =====================

export default function DepositDetailsPage() {
  const [deposits, setDeposits] = useState<DepositTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [summary, setSummary] = useState<Summary>({
    totalDeposits: 0,
    depositCount: 0,
    averageDeposit: 0,
  });

  // =====================
  // Fetch Deposits
  // =====================

  const fetchDeposits = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);
      else setLoading(true);

      console.log("📡 Fetching deposits from API...");

      const response = await fetch(
        "/api/v1/transactions/deposits/my-deposits",
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ API Error:", errorData);
        throw new Error(errorData.error || "Failed to fetch deposits");
      }

      const result: DepositsResponse = await response.json();
      console.log("✅ API Response:", result);

      if (result.success && result.data) {
        setDeposits(result.data.deposits);
        setSummary(result.data.summary);
        setError(null);
        console.log("✅ Deposits loaded:", result.data.deposits.length);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err: any) {
      console.error("❌ Error fetching deposits:", err);
      setError(err.message || "Failed to load deposits");
      setDeposits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeposits();
  }, []);

  const handleRefresh = () => {
    fetchDeposits(true);
  };

  const handleRepaymentSuccess = () => {
    console.log("✅ Deposit added successfully, refreshing data...");
    fetchDeposits(true);
  };

  // =====================
  // Loading State
  // =====================

  if (loading) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 text-emerald-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading deposits...</p>
          </div>
        </div>
      </div>
    );
  }

  // =====================
  // Error State
  // =====================

  if (error) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <ArrowDownRight className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <p className="text-red-600 font-medium text-lg mb-2">
              Error loading deposits
            </p>
            <p className="text-gray-600 text-sm mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================
  // Main Render
  // =====================

  return (
    <div className="flex h-full flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
              Deposit History
            </h1>
            <p className="text-gray-600 mt-1">
              Showing {deposits.length} deposit transaction
              {deposits.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add Deposit
            </button>

            <UniversalTransactionDialog
              isOpen={isDialogOpen}
              onClose={() => setIsDialogOpen(false)}
              onSuccess={handleRepaymentSuccess}
              transactionType="deposit"
            />

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Deposits */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Deposits</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(summary.totalDeposits)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  From {summary.depositCount} transaction
                  {summary.depositCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="p-4 bg-emerald-100 rounded-full">
                <DollarSign className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Average Deposit */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Average Deposit</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatCurrency(summary.averageDeposit)}
                </p>
                <p className="text-sm text-gray-500 mt-1">Per transaction</p>
              </div>
              <div className="p-4 bg-blue-100 rounded-full">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Count */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
                <p className="text-3xl font-bold text-purple-600">
                  {summary.depositCount}
                </p>
                <p className="text-sm text-gray-500 mt-1">Deposits recorded</p>
              </div>
              <div className="p-4 bg-purple-100 rounded-full">
                <ArrowDownRight className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DataTable */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <DataTable
          columns={depositColumns}
          data={deposits}
          model="deposits"
          searchPlaceholder="Search deposits..."
        />
      </div>
    </div>
  );
}
