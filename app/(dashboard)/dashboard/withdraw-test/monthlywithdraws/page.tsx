// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import WithdrawalListingTest from "../WithdrawListingTest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

function MonthlyWithdrawalsWithData() {
  const { data: session } = useSession();
  const [allWithdrawals, setAllWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/withdraw-test")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAllWithdrawals(json.data.withdrawals || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const user = session?.user as any;

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  // Get current and previous month dates
  const today = new Date();
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonthEnd = new Date(
    today.getFullYear(),
    today.getMonth(),
    0,
    23,
    59,
    59
  );

  // Filter withdrawals for current month
  const currentMonthWithdrawals = allWithdrawals.filter((withdrawal) => {
    const withdrawalDate = new Date(withdrawal.withdrawalDate);
    return withdrawalDate >= currentMonth;
  });

  // Filter withdrawals for previous month
  const previousMonthWithdrawals = allWithdrawals.filter((withdrawal) => {
    const withdrawalDate = new Date(withdrawal.withdrawalDate);
    return (
      withdrawalDate >= previousMonth && withdrawalDate <= previousMonthEnd
    );
  });

  // Calculate current month statistics
  const currentMonthAmount = currentMonthWithdrawals.reduce(
    (sum, withdrawal) => sum + withdrawal.amount,
    0
  );

  // Calculate previous month statistics
  const previousMonthAmount = previousMonthWithdrawals.reduce(
    (sum, withdrawal) => sum + withdrawal.amount,
    0
  );

  // Calculate percentage change
  const percentageChange =
    previousMonthAmount > 0
      ? ((currentMonthAmount - previousMonthAmount) / previousMonthAmount) * 100
      : 0;

  // Calculate average withdrawal
  const averageWithdrawal =
    currentMonthWithdrawals.length > 0
      ? currentMonthAmount / currentMonthWithdrawals.length
      : 0;

  // Get daily breakdown for current month
  const dailyBreakdown = currentMonthWithdrawals.reduce(
    (acc, withdrawal) => {
      const date = new Date(withdrawal.withdrawalDate).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { count: 0, amount: 0 };
      }
      acc[date].count += 1;
      acc[date].amount += withdrawal.amount;
      return acc;
    },
    {} as Record<string, { count: number; amount: number }>
  );

  const daysWithActivity = Object.keys(dailyBreakdown).length;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get month names
  const currentMonthName = today.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const previousMonthName = new Date(previousMonth).toLocaleString("en-US", {
    month: "long",
  });

  // Create month-focused statistics matching the expected structure
  const statistics = {
    today: {
      amount: 0,
      count: { id: 0 },
    },
    thisMonth: {
      amount: currentMonthAmount,
      count: { id: currentMonthWithdrawals.length },
    },
    total: {
      amount: 0,
      count: { id: 0 },
    },
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Monthly Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total This Month
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {formatCurrency(currentMonthAmount)}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              {percentageChange >= 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">
                    +{percentageChange.toFixed(1)}%
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">
                    {percentageChange.toFixed(1)}%
                  </span>
                </>
              )}
              <span className="ml-1">from {previousMonthName}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {currentMonthWithdrawals.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {currentMonthWithdrawals.length} withdrawals this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Withdrawal
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {formatCurrency(averageWithdrawal)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Days</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {daysWithActivity}
            </div>
            <p className="text-xs text-gray-500 mt-1">Days with withdrawals</p>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Month Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-500">{currentMonthName}</span>
              <span className="text-xl font-bold text-red-700">
                {formatCurrency(currentMonthAmount)}
              </span>
              <span className="text-sm text-gray-600">
                {currentMonthWithdrawals.length} transactions
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-500">{previousMonthName}</span>
              <span className="text-xl font-bold text-gray-700">
                {formatCurrency(previousMonthAmount)}
              </span>
              <span className="text-sm text-gray-600">
                {previousMonthWithdrawals.length} transactions
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Withdrawal Listing */}
      <WithdrawalListingTest
        withdrawals={currentMonthWithdrawals}
        title={`${currentMonthName} Withdrawals`}
        subtitle={`All withdrawal transactions for this month (${currentMonthWithdrawals.length} transactions)`}
        statistics={statistics}
        userRole={user?.role}
        currentUserId={user?.id || ""}
      />
    </div>
  );
}

export default function MonthlyWithdrawalsPage() {
  return (
    <div className="container mx-auto py-6">
      <MonthlyWithdrawalsWithData />
    </div>
  );
}
