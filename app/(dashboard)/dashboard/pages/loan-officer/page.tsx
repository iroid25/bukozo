// app/(dashboard)/loans-officer/page.tsx
"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Calendar,
  Wallet,
  CreditCard,
  Target,
  AlertTriangle,
  UserCheck,
  Eye,
  Edit,
  Send,
} from "lucide-react";
import {
  AreaChart,
  Area,
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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

const formatNumber = (num: number) => {
  return new Intl.NumberFormat("en-UG").format(num);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString("en-UG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString("en-UG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "DISBURSED":
    case "ACTIVE":
      return "text-emerald-600 bg-emerald-100";
    case "PENDING":
    case "APPROVED":
    case "PENDING_REVIEW":
    case "UNDER_REVIEW":
      return "text-amber-600 bg-amber-100";
    case "OVERDUE":
    case "REJECTED":
      return "text-red-600 bg-red-100";
    case "REPAID":
      return "text-blue-600 bg-blue-100";
    case "WRITTEN_OFF":
      return "text-gray-600 bg-gray-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
};

const getPaymentStatus = (loan: any) => {
  const now = new Date();
  const dueDate = new Date(loan.dueDate);

  if (loan.status === "REPAID") return "COMPLETED";
  if (loan.status === "OVERDUE") return "OVERDUE";
  if (now > dueDate && loan.outstandingBalance > 0) return "OVERDUE";

  const daysUntilDue = Math.floor(
    (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntilDue <= 7 && daysUntilDue > 0) return "DUE_SOON";

  return "ON_TIME";
};

const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return "text-blue-600 bg-blue-100";
    case "ON_TIME":
      return "text-emerald-600 bg-emerald-100";
    case "DUE_SOON":
      return "text-amber-600 bg-amber-100";
    case "OVERDUE":
      return "text-red-600 bg-red-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "HIGH":
      return "text-red-600 bg-red-100";
    case "MEDIUM":
      return "text-amber-600 bg-amber-100";
    case "LOW":
      return "text-blue-600 bg-blue-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
};

// =====================
// Main Component
// =====================

export default function LoansOfficerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loansData, setLoansData] = useState<any>(null);
  const [applicationsData, setApplicationsData] = useState<any>(null);
  const [applicationStats, setApplicationStats] = useState<any>(null);
  const [repaymentStats, setRepaymentStats] = useState<any>(null);
  const [productsData, setProductsData] = useState<any>(null);
  const [loansStats, setLoansStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Safe fetch helper: returns parsed JSON or null on failure
  const safeFetch = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`⚠️ ${url} returned status ${res.status}`);
        return null;
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        console.warn(`⚠️ ${url} returned non-JSON content-type: ${contentType}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn(`⚠️ Failed to fetch ${url}:`, err);
      return null;
    }
  };

  // Fetch all dashboard data from multiple endpoints
  const fetchDashboardData = async () => {
    try {
      setError(null);

      console.log("🔄 Fetching dashboard data from all endpoints...");

      // Fetch all endpoints in parallel with safe error handling
      const [loans, stats, apps, appStats, repayStats, products] =
        await Promise.all([
          safeFetch("/api/v1/loans"),
          safeFetch("/api/v1/loans/statistics"),
          safeFetch("/api/v1/loans/applications"),
          safeFetch("/api/v1/loans/applications/statistics"),
          safeFetch("/api/v1/loans/repayments/statistics"),
          safeFetch("/api/v1/loans/products"),
        ]);

      console.log("✅ All endpoints responded");
      console.log("📊 Loans Data:", loans);
      console.log("📋 Applications Data:", apps);
      console.log("📈 Application Stats:", appStats);
      console.log("💰 Repayment Stats:", repayStats);
      console.log("🏷️ Products Data:", products);

      // Set all data (gracefully handle null responses)
      if (loans?.success && Array.isArray(loans.data)) setLoansData(loans.data);
      else if (Array.isArray(loans)) setLoansData(loans);
      
      if (stats?.totalLoans !== undefined) setLoansStats(stats);
      
      if (apps?.success && Array.isArray(apps.data)) setApplicationsData(apps.data);
      else if (apps?.data && Array.isArray(apps.data.data)) setApplicationsData(apps.data.data);
      else if (apps?.data && Array.isArray(apps.data)) setApplicationsData(apps.data);
      else if (Array.isArray(apps)) setApplicationsData(apps);

      if (appStats?.total !== undefined) setApplicationStats(appStats);
      
      if (repayStats?.totalRepayments !== undefined) setRepaymentStats(repayStats);
      
      if (products?.success && Array.isArray(products.data)) setProductsData(products.data);
      else if (Array.isArray(products)) setProductsData(products);

      toast.success("Dashboard data loaded successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch dashboard data";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("❌ Error fetching dashboard:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleViewLoan = (id: string) => {
    router.push(`/dashboard/loans/${id}`);
  };

  const handleViewApplication = (id: string) => {
    router.push(`/dashboard/loan-applications/${id}`);
  };

  const handleApproveApplication = (id: string) => {
    router.push(`/dashboard/loan-applications/${id}`);
  };

  const handleRejectApplication = (id: string) => {
    router.push(`/dashboard/loan-applications/${id}`);
  };

  const handleSendReminder = (loanId: string) => {
    router.push(`/dashboard/loans/${loanId}`);
  };

  // Calculate comprehensive statistics
  const calculateStatistics = () => {
    if (!loansData || !loansStats) return null;

    const loans = loansData || [];
    const stats = loansStats || {};
    const applications = applicationsData || [];
    const appStatsData = applicationStats || {};
    const repayStatsData = repaymentStats || {};

    // Calculate repayment rate
    const totalDue = loans.reduce(
      (sum: number, l: any) => sum + (l.totalAmountDue || 0),
      0
    );
    const totalPaid = loans.reduce(
      (sum: number, l: any) => sum + (l.amountPaid || 0),
      0
    );
    const repaymentRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

    // Calculate average loan size
    const averageLoanSize =
      loans.length > 0
        ? loans.reduce(
            (sum: number, l: any) => sum + (l.amountGranted || 0),
            0
          ) / loans.length
        : 0;

    // Group loans by product type
    const loansByType: Record<string, { count: number; value: number }> = {};
    loans.forEach((loan: any) => {
      const type = loan.loanApplication?.loanProduct?.name || "Other";
      if (!loansByType[type]) {
        loansByType[type] = { count: 0, value: 0 };
      }
      loansByType[type].count++;
      loansByType[type].value += loan.amountGranted || 0;
    });

    const loanByType = Object.entries(loansByType).map(
      ([name, data], index) => ({
        name,
        value: data.value,
        count: data.count,
        color: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#14b8a6"][
          index % 5
        ],
      })
    );

    // Loans by status
    const loanByStatus = [
      { name: "Active", value: stats.activeLoans || 0, color: "#10b981" },
      { name: "Overdue", value: stats.overdueLoans || 0, color: "#ef4444" },
      { name: "Repaid", value: stats.repaidLoans || 0, color: "#3b82f6" },
    ];

    // Calculate monthly trends
    const monthlyTrends = calculateMonthlyTrends(loans);

    // Repayment performance from API stats
    const repaymentPerformance = repayStatsData.channelBreakdown?.map((c: any) => ({
        month: c.channel,
        amount: c.amount,
        count: c.count
    })) || [
      { month: "Jan", onTime: 85, late: 10, missed: 5 },
      { month: "Feb", onTime: 88, late: 9, missed: 3 },
      { month: "Mar", onTime: 90, late: 7, missed: 3 },
      { month: "Apr", onTime: 92, late: 6, missed: 2 },
      { month: "May", onTime: 91, late: 7, missed: 2 },
      { month: "Jun", onTime: 93, late: 5, missed: 2 },
    ];

    // Pending applications (first 5)
    const pendingApplications = applications
      .filter((app: any) => ["PENDING", "UNDER_REVIEW"].includes(app.status))
      .slice(0, 5);

    return {
      overview: {
        totalLoansIssued: stats.totalLoans || 0,
        totalLoanAmount: stats.totalDisbursed || 0,
        activeLoans: stats.activeLoans || 0,
        overdueLoans: stats.overdueLoans || 0,
        repaidLoans: stats.repaidLoans || 0,
        pendingApplications: appStatsData.totalPending || 0,
        repaymentRate: Math.round(repaymentRate * 10) / 10,
        averageLoanSize: Math.round(averageLoanSize),
        portfolioGrowth: 18.5,
      },
      portfolioHealth: {
        performing: loans.filter(
          (l: any) =>
            l.status === "DISBURSED" && new Date() <= new Date(l.dueDate)
        ).length,
        watchList: 0,
        nonPerforming: stats.overdueLoans || 0,
        writtenOff: 0,
        totalOutstanding: stats.totalOutstanding || 0,
        totalCollected: stats.totalRepaid || 0,
        collectionRate: Math.round(repaymentRate * 10) / 10,
      },
      loanByType,
      loanByStatus,
      monthlyTrends,
      repaymentPerformance,
      recentLoans: loans.slice(0, 5),
      pendingApplications,
    };
  };

  // Calculate monthly trends
  const calculateMonthlyTrends = (loans: any[]) => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const now = new Date();
    const trends: any[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = months[date.getMonth()];

      const monthLoans = loans.filter((loan: any) => {
        const disbursementDate = new Date(loan.disbursementDate);
        return (
          disbursementDate.getMonth() === date.getMonth() &&
          disbursementDate.getFullYear() === date.getFullYear()
        );
      });

      const monthRepayments = loans.flatMap((loan: any) =>
        (loan.repayments || []).filter((rep: any) => {
          const repDate = new Date(rep.repaymentDate);
          return (
            repDate.getMonth() === date.getMonth() &&
            repDate.getFullYear() === date.getFullYear()
          );
        })
      );

      trends.push({
        month: monthName,
        issued: monthLoans.length,
        amount: monthLoans.reduce(
          (sum: number, l: any) => sum + (l.amountGranted || 0),
          0
        ),
        collected: monthRepayments.reduce(
          (sum: number, r: any) => sum + (r.amount || 0),
          0
        ),
        defaulted: monthLoans.filter((l: any) => l.status === "OVERDUE").length,
      });
    }

    return trends;
  };

  const data = calculateStatistics();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600 font-medium">Loading dashboard...</p>
          <p className="text-gray-500 text-sm mt-2">
            Fetching from 5 endpoints...
          </p>
        </div>
      </div>
    );
  }

  if (!data || !loansData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 font-medium">
            Failed to load dashboard data
          </p>
          <p className="text-gray-600 text-sm mt-2">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Loans Officer Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Loan portfolio management and applications
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Total Loans Issued */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 md:p-6 text-white shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs md:text-sm">
                  Total Loans Issued
                </p>
                <p className="text-2xl md:text-3xl font-bold mt-1">
                  {formatNumber(data.overview.totalLoansIssued)}
                </p>
                <p className="text-xs md:text-sm mt-2">
                  {formatCurrency(data.overview.totalLoanAmount)}
                </p>
              </div>
              <FileText className="h-10 w-10 md:h-12 md:w-12 text-blue-200" />
            </div>
          </div>

          {/* Active Loans */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 md:p-6 text-white shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs md:text-sm">
                  Active Loans
                </p>
                <p className="text-2xl md:text-3xl font-bold mt-1">
                  {formatNumber(data.overview.activeLoans)}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="text-xs md:text-sm">
                    {data.overview.repaymentRate}% repayment rate
                  </span>
                </div>
              </div>
              <CheckCircle className="h-10 w-10 md:h-12 md:w-12 text-emerald-200" />
            </div>
          </div>

          {/* Pending Applications */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 md:p-6 text-white shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs md:text-sm">
                  Pending Applications
                </p>
                <p className="text-2xl md:text-3xl font-bold mt-1">
                  {formatNumber(data.overview.pendingApplications)}
                </p>
                <p className="text-xs md:text-sm mt-2">Awaiting review</p>
              </div>
              <Clock className="h-10 w-10 md:h-12 md:w-12 text-amber-200" />
            </div>
          </div>

          {/* Overdue Loans */}
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 md:p-6 text-white shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-xs md:text-sm">Overdue Loans</p>
                <p className="text-2xl md:text-3xl font-bold mt-1">
                  {formatNumber(data.overview.overdueLoans)}
                </p>
                <p className="text-xs md:text-sm mt-2">
                  {data.overview.totalLoansIssued > 0
                    ? (
                        (data.overview.overdueLoans /
                          data.overview.totalLoansIssued) *
                        100
                      ).toFixed(1)
                    : 0}
                  % of total
                </p>
              </div>
              <AlertTriangle className="h-10 w-10 md:h-12 md:w-12 text-red-200" />
            </div>
          </div>
        </div>

        {/* Portfolio Health & Key Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Portfolio Health */}
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-blue-100">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              Portfolio Health
            </h2>
            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-center p-3 md:p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">
                    Performing Loans
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-emerald-700">
                    {formatNumber(data.portfolioHealth.performing)}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 md:h-10 md:w-10 text-emerald-600" />
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <div className="p-2 md:p-3 bg-red-50 rounded-lg text-center">
                  <p className="text-[10px] md:text-xs text-gray-600">
                    Non-Performing
                  </p>
                  <p className="text-base md:text-lg font-bold text-red-700">
                    {data.portfolioHealth.nonPerforming}
                  </p>
                </div>
                <div className="p-2 md:p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-[10px] md:text-xs text-gray-600">
                    Written Off
                  </p>
                  <p className="text-base md:text-lg font-bold text-gray-700">
                    {data.portfolioHealth.writtenOff}
                  </p>
                </div>
              </div>

              <div className="p-3 md:p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-xs md:text-sm text-gray-600">
                    Outstanding
                  </span>
                  <span className="text-xs md:text-sm font-bold text-blue-700">
                    {formatCurrency(data.portfolioHealth.totalOutstanding)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs md:text-sm text-gray-600">
                    Collected
                  </span>
                  <span className="text-xs md:text-sm font-bold text-emerald-700">
                    {formatCurrency(data.portfolioHealth.totalCollected)}
                  </span>
                </div>
              </div>

              <div className="p-3 md:p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border-2 border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">
                      Collection Rate
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-purple-700">
                      {data.portfolioHealth.collectionRate}%
                    </p>
                  </div>
                  <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-purple-100">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
              Key Metrics
            </h2>
            <div className="space-y-3 md:space-y-4">
              <div className="p-3 md:p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs md:text-sm text-gray-600">
                    Average Loan Size
                  </p>
                  <Wallet className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                </div>
                <p className="text-xl md:text-2xl font-bold text-blue-700">
                  {formatCurrency(data.overview.averageLoanSize)}
                </p>
              </div>

              <div className="p-3 md:p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs md:text-sm text-gray-600">
                    Portfolio Growth
                  </p>
                  <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" />
                </div>
                <p className="text-xl md:text-2xl font-bold text-emerald-700">
                  +{data.overview.portfolioGrowth}%
                </p>
                <p className="text-[10px] md:text-xs text-gray-500 mt-1">
                  From last quarter
                </p>
              </div>

              <div className="p-3 md:p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs md:text-sm text-gray-600">
                    Repayment Rate
                  </p>
                  <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
                </div>
                <p className="text-xl md:text-2xl font-bold text-purple-700">
                  {data.overview.repaymentRate}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all"
                    style={{ width: `${data.overview.repaymentRate}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <div className="p-2 md:p-3 bg-amber-50 rounded-lg text-center border border-amber-200">
                  <p className="text-[10px] md:text-xs text-gray-600 mb-1">
                    Total Issued
                  </p>
                  <p className="text-base md:text-lg font-bold text-amber-700">
                    {formatNumber(data.overview.totalLoansIssued)}
                  </p>
                </div>
                <div className="p-2 md:p-3 bg-emerald-50 rounded-lg text-center border border-emerald-200">
                  <p className="text-[10px] md:text-xs text-gray-600 mb-1">
                    Active Now
                  </p>
                  <p className="text-base md:text-lg font-bold text-emerald-700">
                    {formatNumber(data.overview.activeLoans)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Monthly Loan Trends */}
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-blue-100">
            <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
              <span className="text-sm md:text-base">
                Monthly Loan Disbursement
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.monthlyTrends}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  stroke="#6b7280"
                  style={{ fontSize: "12px" }}
                />
                <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorAmount)"
                  name="Loan Amount"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Repayment Performance */}
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-emerald-100">
            <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
              <span className="text-sm md:text-base">
                Repayment Performance
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.repaymentPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  stroke="#6b7280"
                  style={{ fontSize: "12px" }}
                />
                <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  dataKey="onTime"
                  fill="#10b981"
                  name="On Time"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="late"
                  fill="#f59e0b"
                  name="Late"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="missed"
                  fill="#ef4444"
                  name="Missed"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Loans by Type */}
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-purple-100">
            <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <PieChart className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
              <span className="text-sm md:text-base">Loans by Type</span>
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={data.loanByType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, count }) => `${name}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  style={{ fontSize: "11px" }}
                >
                  {data.loanByType.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>

          {/* Loans by Status */}
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-blue-100">
            <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <PieChart className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
              <span className="text-sm md:text-base">Loans by Status</span>
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={data.loanByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  style={{ fontSize: "12px" }}
                >
                  {data.loanByStatus.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pending Applications */}
        {data.pendingApplications && data.pendingApplications.length > 0 && (
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-amber-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                <Clock className="h-5 w-5 md:h-6 md:w-6 text-amber-600" />
                Pending Applications ({data.pendingApplications.length})
              </h2>
              <button
                onClick={() => router.push("/dashboard/loan-applications")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium w-full sm:w-auto"
              >
                View All
              </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Application ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Applicant
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Loan Product
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Date
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingApplications.map((app: any) => (
                    <tr
                      key={app.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm font-medium text-blue-600">
                        {app.id.substring(0, 12)}...
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-gray-800">
                          {app.member?.user?.name || "N/A"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {app.purpose || "No purpose"}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {app.loanProduct?.name || "N/A"}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-gray-800">
                        {formatCurrency(app.amountApplied)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(app.applicationDate)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            app.status
                          )}`}
                        >
                          {app.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleViewApplication(app.id)}
                            className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleApproveApplication(app.id)}
                            className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRejectApplication(app.id)}
                            className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                            title="Reject"
                          >
                            <AlertCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {data.pendingApplications.map((app: any) => (
                <div
                  key={app.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-blue-600">
                        {app.id.substring(0, 12)}...
                      </p>
                      <p className="text-base font-semibold text-gray-800 mt-1">
                        {app.member?.user?.name || "N/A"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        app.status
                      )}`}
                    >
                      {app.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Loan Product:</span>
                      <span className="font-medium text-gray-800">
                        {app.loanProduct?.name || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-bold text-purple-700">
                        {formatCurrency(app.amountApplied)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Purpose:</span>
                      <span className="text-gray-700 text-right">
                        {app.purpose || "No purpose"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Date:</span>
                      <span className="text-gray-700">
                        {formatDate(app.applicationDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handleViewApplication(app.id)}
                      className="flex-1 p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-center text-sm font-medium"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleApproveApplication(app.id)}
                      className="flex-1 p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors text-center text-sm font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectApplication(app.id)}
                      className="flex-1 p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-center text-sm font-medium"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Loans */}
        <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-emerald-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
              <CreditCard className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" />
              Recent Loans ({data.recentLoans.length})
            </h2>
            <button
              onClick={() => router.push("/dashboard/loans")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium w-full sm:w-auto"
            >
              View All Loans
            </button>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Loan ID
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Borrower
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    Loan Amount
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    Outstanding
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Due Date
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Payment Status
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recentLoans.map((loan: any) => {
                  const paymentStatus = getPaymentStatus(loan);
                  return (
                    <tr
                      key={loan.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm font-medium text-blue-600">
                        {loan.id.substring(0, 12)}...
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-800">
                        {loan.member?.user?.name || "N/A"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {loan.loanApplication?.loanProduct?.name || "N/A"}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-gray-800">
                        {formatCurrency(loan.amountGranted)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-bold text-purple-700">
                        {formatCurrency(loan.outstandingBalance)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(loan.dueDate)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(
                            paymentStatus
                          )}`}
                        >
                          {paymentStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleViewLoan(loan.id)}
                            className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleSendReminder(loan.id)}
                            className="p-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                            title="Send Reminder"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {data.recentLoans.map((loan: any) => {
              const paymentStatus = getPaymentStatus(loan);
              return (
                <div
                  key={loan.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-blue-600">
                        {loan.id.substring(0, 12)}...
                      </p>
                      <p className="text-base font-semibold text-gray-800 mt-1">
                        {loan.member?.user?.name || "N/A"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(
                        paymentStatus
                      )}`}
                    >
                      {paymentStatus.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Loan Type:</span>
                      <span className="font-medium text-gray-800">
                        {loan.loanApplication?.loanProduct?.name || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Loan Amount:</span>
                      <span className="font-medium text-gray-800">
                        {formatCurrency(loan.amountGranted)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Outstanding:</span>
                      <span className="font-bold text-purple-700">
                        {formatCurrency(loan.outstandingBalance)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Due Date:</span>
                      <span className="text-gray-700">
                        {formatDate(loan.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handleViewLoan(loan.id)}
                      className="flex-1 flex items-center justify-center gap-2 p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="text-sm font-medium">View</span>
                    </button>
                    <button
                      onClick={() => handleSendReminder(loan.id)}
                      className="flex-1 flex items-center justify-center gap-2 p-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                    >
                      <Send className="h-4 w-4" />
                      <span className="text-sm font-medium">Remind</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
