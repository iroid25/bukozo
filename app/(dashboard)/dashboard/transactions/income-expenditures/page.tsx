"use client";
import React, { useMemo, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

type PeriodKey = "today" | "week" | "month" | "quarter" | "year";

type IncomeStat = {
  totalIncome: number;
  totalRecords: number;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    parentName?: string;
    count: number;
    amount: number;
  }>;
};

type ExpenditureStat = {
  totalExpenditure: number;
  totalRecords: number;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    amount: number;
  }>;
};

type IncomeRecord = {
  id: string;
  amount: number;
  recordDate: string;
  status: string;
  budgetCategory?: {
    name?: string;
    parent?: {
      name?: string;
    };
  } | null;
  member?: {
    user?: {
      name?: string;
    } | null;
  } | null;
  depositorName?: string | null;
};

type ExpenditureRecord = {
  id: string;
  amount: number;
  recordDate: string;
  status: string;
  budgetCategory?: {
    name?: string;
  } | null;
  payee?: string | null;
};

const CHART_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#ec4899",
];

const getDateRange = (period: PeriodKey) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (period === "today") return { startDate: start, endDate: end };

  if (period === "week") {
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    return { startDate: start, endDate: end };
  }

  if (period === "month") {
    start.setDate(1);
    return { startDate: start, endDate: end };
  }

  if (period === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
    return { startDate: start, endDate: end };
  }

  start.setMonth(0, 1);
  return { startDate: start, endDate: end };
};

const buildTrendData = (
  incomeRecords: IncomeRecord[],
  expenditureRecords: ExpenditureRecord[],
) => {
  const months = new Map<string, { month: string; income: number; expenditure: number }>();

  const ensureMonth = (value: string) => {
    const date = new Date(value);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!months.has(key)) {
      months.set(key, {
        month: date.toLocaleString("default", { month: "short", year: "2-digit" }),
        income: 0,
        expenditure: 0,
      });
    }
    return key;
  };

  incomeRecords.forEach((record) => {
    const key = ensureMonth(record.recordDate);
    months.get(key)!.income += Number(record.amount || 0);
  });

  expenditureRecords.forEach((record) => {
    const key = ensureMonth(record.recordDate);
    months.get(key)!.expenditure += Number(record.amount || 0);
  });

  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, value]) => value);
};

export default function IncomeExpenditurePage() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incomeStats, setIncomeStats] = useState<IncomeStat | null>(null);
  const [expenditureStats, setExpenditureStats] = useState<ExpenditureStat | null>(null);
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [expenditureRecords, setExpenditureRecords] = useState<ExpenditureRecord[]>([]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRange(selectedPeriod);
      const params = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      const [incomeStatsRes, expenditureStatsRes, incomeRes, expenditureRes] =
        await Promise.all([
          axios.get("/api/v1/income/statistics", { params }),
          axios.get("/api/v1/expenditure/statistics", { params }),
          axios.get("/api/v1/income"),
          axios.get("/api/v1/expenditure"),
        ]);

      setIncomeStats(incomeStatsRes.data?.data || null);
      setExpenditureStats(expenditureStatsRes.data?.data || null);
      setIncomeRecords(incomeRes.data?.data || []);
      setExpenditureRecords(expenditureRes.data?.data || []);
    } catch (err: any) {
      console.error("Error fetching income and expenditure data:", err);
      setError(err.response?.data?.error || "Failed to load income and expenditure data");
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const incomeData = useMemo(
    () =>
      (incomeStats?.categoryBreakdown || []).map((item, index) => ({
        category: item.parentName
          ? `${item.parentName} - ${item.categoryName}`
          : item.categoryName,
        amount: Number(item.amount || 0),
        count: Number(item.count || 0),
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [incomeStats],
  );

  const expenditureData = useMemo(
    () =>
      (expenditureStats?.categoryBreakdown || []).map((item, index) => ({
        category: item.categoryName,
        amount: Number(item.amount || 0),
        count: Number(item.count || 0),
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [expenditureStats],
  );

  const totalIncome = Number(incomeStats?.totalIncome || 0);
  const totalExpenditure = Number(expenditureStats?.totalExpenditure || 0);
  const netPosition = totalIncome - totalExpenditure;
  const netPercentage = totalIncome > 0 ? ((netPosition / totalIncome) * 100).toFixed(1) : "0.0";

  const formatCurrency = (amount: any) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const trendData = useMemo(
    () => buildTrendData(incomeRecords, expenditureRecords),
    [incomeRecords, expenditureRecords],
  );

  const recentTransactions = useMemo(() => {
    const incomes = incomeRecords.map((record) => ({
      id: `income-${record.id}`,
      type: "INCOME",
      category: record.budgetCategory?.name || "Uncategorized Income",
      party:
        record.member?.user?.name ||
        record.depositorName ||
        "General Income",
      amount: Number(record.amount || 0),
      date: record.recordDate,
      status: record.status,
    }));

    const expenditures = expenditureRecords.map((record) => ({
      id: `expenditure-${record.id}`,
      type: "EXPENDITURE",
      category: record.budgetCategory?.name || "Uncategorized Expenditure",
      party: record.payee || "General Expenditure",
      amount: Number(record.amount || 0),
      date: record.recordDate,
      status: record.status,
    }));

    return [...incomes, ...expenditures]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [incomeRecords, expenditureRecords]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
          <p className="text-gray-500 font-medium">Analyzing financial data...</p>
        </div>
      </div>
    );
  }

  if (error || !incomeStats || !expenditureStats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="h-16 w-16 text-red-500" />
        <h2 className="text-xl font-bold">Failed to load data</h2>
        <p className="text-gray-500">{error || "Statistics unavailable."}</p>
        <button onClick={() => fetchData()} className="px-6 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
          <RefreshCw size={18} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Income & Expenditure
            </h1>
            <p className="text-gray-600 mt-1">
              Financial overview and analysis
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as PeriodKey)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Download size={18} />
              Export Report
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Income</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalIncome)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="text-green-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {incomeStats.totalRecords} income record{incomeStats.totalRecords === 1 ? "" : "s"}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Expenditure</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalExpenditure)}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <TrendingDown className="text-red-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {expenditureStats.totalRecords} expenditure record{expenditureStats.totalRecords === 1 ? "" : "s"}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Net Position</p>
                <p
                  className={`text-2xl font-bold ${
                    netPosition >= 0 ? "text-blue-600" : "text-orange-600"
                  }`}
                >
                  {formatCurrency(netPosition)}
                </p>
              </div>
              <div
                className={`p-3 ${
                  netPosition >= 0 ? "bg-blue-100" : "bg-orange-100"
                } rounded-lg`}
              >
                <DollarSign
                  className={
                    netPosition >= 0 ? "text-blue-600" : "text-orange-600"
                  }
                  size={24}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {netPercentage}% of income
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Reporting Period</p>
                <p className="text-2xl font-bold text-gray-900">
                  {selectedPeriod === "today"
                    ? "Today"
                    : selectedPeriod === "week"
                      ? "This Week"
                      : selectedPeriod === "month"
                        ? "This Month"
                        : selectedPeriod === "quarter"
                          ? "This Quarter"
                          : "This Year"}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Calendar className="text-purple-600" size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Filtered from exact records</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income Breakdown */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Income Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={incomeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {incomeData.map((entry, index) => (
                    <Cell key={`income-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {incomeData.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-gray-700">{item.category}</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              Expenditure Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={expenditureData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="amount"
                >
                  {expenditureData.map((entry, index) => (
                    <Cell key={`expense-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {expenditureData.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-gray-700">{item.category}</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            6-Month Trend Analysis
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis
                tickFormatter={(value: number) => `${(value / 1000000).toFixed(0)}M`}
              />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                strokeWidth={3}
                name="Income"
              />
              <Line
                type="monotone"
                dataKey="expenditure"
                stroke="#ef4444"
                strokeWidth={3}
                name="Expenditure"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Income & Expenditure Records
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Party
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          txn.type === "INCOME"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {txn.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {txn.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {txn.party}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-sm font-semibold ${
                          txn.type === "INCOME" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(txn.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {txn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
