// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import WithdrawalListingTest from "../WithdrawListingTest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingDown,
  Calendar,
  DollarSign,
  Users,
  CreditCard,
  Activity,
  Banknote,
  TrendingUp,
} from "lucide-react";

function TotalWithdrawalsWithData() {
  const { data: session } = useSession();
  const [allWithdrawals, setAllWithdrawals] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>({
    today: { amount: 0, count: { id: 0 } },
    thisMonth: { amount: 0, count: { id: 0 } },
    total: { amount: 0, count: { id: 0 } },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/withdraw-test")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setAllWithdrawals(json.data.withdrawals || []);
          setStatistics(json.data.statistics);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const user = session?.user as any;

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  // Calculate comprehensive statistics
  const totalAmount = statistics.total.amount;
  const totalCount = statistics.total.count.id;

  // Calculate average withdrawal
  const averageWithdrawal = totalCount > 0 ? totalAmount / totalCount : 0;

  // Get unique members who have made withdrawals
  const uniqueMembers = new Set(allWithdrawals.map((w) => w.memberId)).size;

  // Get unique accounts
  const uniqueAccounts = new Set(allWithdrawals.map((w) => w.accountId)).size;

  // Channel breakdown
  const channelBreakdown = allWithdrawals.reduce(
    (acc, withdrawal) => {
      if (!acc[withdrawal.channel]) {
        acc[withdrawal.channel] = { count: 0, amount: 0 };
      }
      acc[withdrawal.channel].count += 1;
      acc[withdrawal.channel].amount += withdrawal.amount;
      return acc;
    },
    {} as Record<string, { count: number; amount: number }>
  );

  // Get largest and smallest withdrawals
  const sortedByAmount = [...allWithdrawals].sort(
    (a, b) => b.amount - a.amount
  );
  const largestWithdrawal = sortedByAmount[0]?.amount || 0;
  const smallestWithdrawal =
    sortedByAmount[sortedByAmount.length - 1]?.amount || 0;

  // Calculate monthly trend (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentWithdrawals = allWithdrawals.filter(
    (w) => new Date(w.withdrawalDate) >= sixMonthsAgo
  );

  const monthlyTrend = recentWithdrawals.reduce(
    (acc, withdrawal) => {
      const date = new Date(withdrawal.withdrawalDate);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      if (!acc[monthKey]) {
        acc[monthKey] = { count: 0, amount: 0 };
      }
      acc[monthKey].count += 1;
      acc[monthKey].amount += withdrawal.amount;
      return acc;
    },
    {} as Record<string, { count: number; amount: number }>
  );

  // Get this year's total
  const currentYear = new Date().getFullYear();
  const thisYearWithdrawals = allWithdrawals.filter(
    (w) => new Date(w.withdrawalDate).getFullYear() === currentYear
  );
  const thisYearAmount = thisYearWithdrawals.reduce(
    (sum, w) => sum + w.amount,
    0
  );

  // Calculate today's percentage of total
  const todayPercentage =
    totalAmount > 0 ? (statistics.today.amount / totalAmount) * 100 : 0;

  // Calculate this month's percentage of total
  const monthPercentage =
    totalAmount > 0 ? (statistics.thisMonth.amount / totalAmount) * 100 : 0;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Create total-focused statistics
  const totalStats = {
    today: {
      amount: 0,
      count: { id: 0 },
    },
    thisMonth: {
      amount: 0,
      count: { id: 0 },
    },
    total: statistics.total,
  };

  return (
    <div className="space-y-6">
      {/* Main Total Card - Hero Section */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-purple-600" />
            Total Withdrawals - All Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Total Amount Withdrawn
              </p>
              <p className="text-4xl font-bold text-purple-700">
                {formatCurrency(totalAmount)}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-purple-200">
              <div>
                <p className="text-xs text-gray-500">Total Transactions</p>
                <p className="text-xl font-semibold text-purple-600">
                  {totalCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Average Withdrawal</p>
                <p className="text-xl font-semibold text-purple-600">
                  {formatCurrency(averageWithdrawal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Active Members</p>
                <p className="text-xl font-semibold text-purple-600">
                  {uniqueMembers}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Activity
            </CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(statistics.today.amount)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {statistics.today.count.id} transactions (
              {todayPercentage.toFixed(2)}% of total)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(statistics.thisMonth.amount)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {statistics.thisMonth.count.id} transactions (
              {monthPercentage.toFixed(2)}% of total)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              This Year ({currentYear})
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {formatCurrency(thisYearAmount)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {thisYearWithdrawals.length} transactions this year
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Accounts
            </CardTitle>
            <CreditCard className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-700">
              {uniqueAccounts}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Accounts with withdrawals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Range and Channel Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Withdrawal Range
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Largest Withdrawal</p>
              <p className="text-2xl font-bold text-red-700">
                {formatCurrency(largestWithdrawal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Smallest Withdrawal</p>
              <p className="text-xl font-semibold text-gray-700">
                {formatCurrency(smallestWithdrawal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Average Withdrawal</p>
              <p className="text-xl font-semibold text-blue-700">
                {formatCurrency(averageWithdrawal)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-600" />
              Channel Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(channelBreakdown).map(([channel, data]) => (
              <div
                key={channel}
                className="flex justify-between items-center border-b pb-2"
              >
                <div>
                  <p className="font-medium text-gray-700">{channel}</p>
                  <p className="text-xs text-gray-500">
                    {data.count} transactions
                  </p>
                </div>
                <p className="font-semibold text-green-700">
                  {formatCurrency(data.amount)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Member Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Member Activity Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Unique Members</p>
              <p className="text-3xl font-bold text-blue-700">
                {uniqueMembers}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Members with withdrawals
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Avg per Member</p>
              <p className="text-3xl font-bold text-green-700">
                {formatCurrency(
                  uniqueMembers > 0 ? totalAmount / uniqueMembers : 0
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Total withdrawn per member
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                Transactions per Member
              </p>
              <p className="text-3xl font-bold text-purple-700">
                {uniqueMembers > 0
                  ? (totalCount / uniqueMembers).toFixed(1)
                  : 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Average transactions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Withdrawal Listing */}
      <WithdrawalListingTest
        withdrawals={allWithdrawals}
        title="Complete Withdrawal History"
        subtitle={`All withdrawal transactions from inception (${totalCount} total transactions • ${formatCurrency(
          totalAmount
        )} total amount)`}
        statistics={totalStats}
        userRole={user?.role}
        currentUserId={user?.id || ""}
      />
    </div>
  );
}

export default function TotalWithdrawalsPage() {
  return (
    <div className="container mx-auto py-6">
      <TotalWithdrawalsWithData />
    </div>
  );
}
