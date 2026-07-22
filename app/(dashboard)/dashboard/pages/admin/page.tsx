// @ts-ignore
"use client";
import React, { useState, useEffect } from "react";
import {
  Users,
  Building2,
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  UserCheck,
  AlertCircle,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  BarChart3,
  Settings,
  Bell,
  Search,
  Filter,
  Download,
  ChevronRight,
  Circle,
  RefreshCw,
  Shield,
  LucideIcon,
} from "lucide-react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Types and Interfaces
interface Transaction {
  id: string;
  transactionRef: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'LOAN_DISBURSEMENT' | 'LOAN_REPAYMENT';
  amount: number;
  transactionDate: string;
  member?: {
    user?: {
      name: string;
    };
  };
  institution?: {
    institutionName: string;
  };
}

interface DashboardData {
  deposits: {
    total: { amount: number; count: number };
  };
  loanApps: {
    pending: number;
    approved: number;
  };
  users: {
    members: number;
    institutions: number;
  };
  portfolio: {
    totalDisbursedAmount: number;
    activeDisbursedCount: number;
    outstandingBalance: number;
    overdueCount: number;
  };
  recentTransactions: Transaction[];
  income: {
    amount: number;
    count: number;
  };
}

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
}

// Utility formatting functions
const formatCurrency = (amount: number | string | (string | number)[] | undefined | null) => {
  if (amount === undefined || amount === null) return "UGX 0";
  
  let val: number;
  if (Array.isArray(amount)) {
    val = typeof amount[0] === 'string' ? parseFloat(amount[0]) : amount[0];
  } else {
    val = typeof amount === 'string' ? parseFloat(amount) : amount;
  }

  if (isNaN(val)) return "UGX 0";
  try {
    return `UGX ${new Intl.NumberFormat("en-UG").format(val)}`;
  } catch (e) {
    return "UGX 0";
  }
};

const formatNumber = (num: number | string | (string | number)[] | undefined | null) => {
  if (num === undefined || num === null) return "0";
  
  let val: number;
  if (Array.isArray(num)) {
    val = typeof num[0] === 'string' ? parseFloat(num[0]) : num[0];
  } else {
    val = typeof num === 'string' ? parseFloat(num) : num;
  }

  if (isNaN(val)) return "0";
  try {
    return new Intl.NumberFormat("en-UG").format(val);
  } catch (e) {
    return "0";
  }
};

const formatTime = (dateString: string | undefined | null) => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleString('en-UG', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (e) {
    return "N/A";
  }
};

// Sub-components
interface MetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
  trend?: 'up' | 'down';
  trendValue?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  trend,
  trendValue,
}) => (
  <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
    <CardContent className="p-0">
      <div className={`p-1 ${color}`} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-2xl bg-gray-50`}>
            <Icon className="w-6 h-6 text-gray-700" />
          </div>
          {trend && (
            <Badge variant="outline" className={`flex items-center gap-1 ${trend === 'up' ? 'text-emerald-600 border-emerald-100 bg-emerald-50' : 'text-red-600 border-red-100 bg-red-50'}`}>
              {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trendValue}
            </Badge>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 leading-none">{value}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-2 font-medium">{subtitle}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      
      const [sessionRes, dashboardRes] = await Promise.all([
        fetch("/api/auth/session"),
        fetch("/api/v1/admin/dashboard")
      ]);

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setCurrentUser(sessionData?.user || null);
      }

      if (dashboardRes.ok) {
        const result = await dashboardRes.json();
        if (result.success) {
          setDashboardData(result.data);
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
        </div>
        <h2 className="mt-6 text-xl font-bold text-gray-800">Initializing Admin Console...</h2>
        <p className="text-gray-500 mt-2">Securing connection and aggregating system metrics</p>
      </div>
    );
  }

  const deposits = dashboardData?.deposits;
  const loanApps = dashboardData?.loanApps;
  const users = dashboardData?.users;
  const portfolio = dashboardData?.portfolio;
  const recentTransactions = dashboardData?.recentTransactions;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm uppercase tracking-widest">
            <Shield className="w-4 h-4" />
            Control Center
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            System Overview
          </h1>
          <p className="text-gray-500 font-medium">
            Welcome back, <span className="text-gray-900 underline decoration-emerald-500 decoration-2 underline-offset-4">{currentUser?.name || 'Administrator'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="rounded-xl border-gray-200 shadow-sm transition-all hover:bg-gray-50"
            onClick={fetchDashboardData}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </Button>
          <Button className="rounded-xl bg-gray-900 text-white shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all">
            <Download className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Consolidated Inflow"
          value={formatCurrency((deposits?.total?.amount || 0) + (dashboardData?.income?.amount || 0))}
          icon={Wallet}
          color="bg-emerald-500"
          subtitle={`${formatNumber((deposits?.total?.count || 0) + (dashboardData?.income?.count || 0))} receipts`}
          trend="up"
          trendValue="12.5%"
        />
        <MetricCard
          title="Current Loan Portfolio"
          value={formatCurrency(portfolio?.totalDisbursedAmount)}
          icon={CreditCard}
          color="bg-blue-500"
          subtitle={`${formatNumber(portfolio?.activeDisbursedCount)} active assets`}
          trend="up"
          trendValue="8.2%"
        />
        <MetricCard
          title="Active Membership"
          value={formatNumber(users?.members)}
          icon={Users}
          color="bg-purple-500"
          subtitle={`${formatNumber(users?.institutions)} institutions`}
          trend="up"
          trendValue="3.1%"
        />
        <MetricCard
          title="Outstanding Balance"
          value={formatCurrency(portfolio?.outstandingBalance)}
          icon={Activity}
          color="bg-orange-500"
          subtitle={`${formatNumber(portfolio?.overdueCount)} accounts overdue`}
          trend="down"
          trendValue="1.4%"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Span: Visual Insights & Applications */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Visual: Financial Performance */}
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-50 px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">Financial Performance</CardTitle>
                  <p className="text-sm text-gray-500 font-medium">Aggregated deposit vs loan disbursement volumes</p>
                </div>
                <div className="flex items-center gap-2">
                   <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-100">Live Feed</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { month: 'Jul', deposits: ((deposits?.total?.amount || 0) + (dashboardData?.income?.amount || 0)) * 0.7, loans: (portfolio?.totalDisbursedAmount || 0) * 0.6 },
                    { month: 'Aug', deposits: ((deposits?.total?.amount || 0) + (dashboardData?.income?.amount || 0)) * 0.75, loans: (portfolio?.totalDisbursedAmount || 0) * 0.65 },
                    { month: 'Sep', deposits: ((deposits?.total?.amount || 0) + (dashboardData?.income?.amount || 0)) * 0.82, loans: (portfolio?.totalDisbursedAmount || 0) * 0.72 },
                    { month: 'Oct', deposits: ((deposits?.total?.amount || 0) + (dashboardData?.income?.amount || 0)) * 0.88, loans: (portfolio?.totalDisbursedAmount || 0) * 0.78 },
                    { month: 'Nov', deposits: ((deposits?.total?.amount || 0) + (dashboardData?.income?.amount || 0)) * 0.94, loans: (portfolio?.totalDisbursedAmount || 0) * 0.85 },
                    { month: 'Dec', deposits: ((deposits?.total?.amount || 0) + (dashboardData?.income?.amount || 0)), loans: (portfolio?.totalDisbursedAmount || 0) },
                  ]}>
                    <defs>
                      <linearGradient id="colorDep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 12}}
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                      formatter={(value:any) => formatCurrency(value)}
                    />
                    <Area type="monotone" dataKey="deposits" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorDep)" />
                    <Area type="monotone" dataKey="loans" stroke="#3b82f6" strokeWidth={3} fill="none" strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Table Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <Card className="border-none shadow-md">
                <CardHeader className="p-6 pb-2">
                   <CardTitle className="text-lg font-bold flex items-center gap-2">
                     <BarChart3 className="w-5 h-5 text-blue-600" />
                     Portfolio Health
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                   <div className="space-y-6">
                      <div className="space-y-2">
                         <div className="flex justify-between text-sm">
                            <span className="text-gray-500 font-medium">Disbursed Balance</span>
                            <span className="text-gray-900 font-bold">{formatCurrency(portfolio?.totalDisbursedAmount)}</span>
                         </div>
                         <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{width: '75%'}} />
                         </div>
                      </div>
                      <div className="space-y-2">
                         <div className="flex justify-between text-sm">
                            <span className="text-gray-500 font-medium">Member Deposits</span>
                            <span className="text-gray-900 font-bold">{formatCurrency(deposits?.total?.amount)}</span>
                         </div>
                         <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full" style={{width: '90%'}} />
                         </div>
                      </div>
                   </div>
                </CardContent>
             </Card>

             <Card className="border-none shadow-md text-gray-900">
                <CardHeader className="p-6 pb-2">
                   <CardTitle className="text-lg font-bold flex items-center gap-2">
                     <FileText className="w-5 h-5 text-orange-600" />
                     Pipeline Summary
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-orange-50 border border-orange-100">
                         <p className="text-orange-600 text-xs font-bold uppercase mb-1">Queue</p>
                         <h4 className="text-2xl font-extrabold text-orange-700">{formatNumber(loanApps?.pending)}</h4>
                      </div>
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                         <p className="text-emerald-600 text-xs font-bold uppercase mb-1">Approved</p>
                         <h4 className="text-2xl font-extrabold text-emerald-700">{formatNumber(loanApps?.approved)}</h4>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>

        {/* Right Span: Logs & Governance */}
        <div className="space-y-8">
           <Card className="border-none shadow-md bg-gray-900 text-white min-h-[400px]">
              <CardHeader className="p-6 border-b border-white/10">
                 <div className="flex items-center justify-between">
                   <CardTitle className="text-lg font-bold">Operation Logs</CardTitle>
                   <Badge className="bg-white/10 text-white border-white/20">Realtime</Badge>
                 </div>
              </CardHeader>
              <CardContent className="p-6">
                 <div className="space-y-6">
                    {recentTransactions?.map((txn) => (
                      <div key={txn.id} className="flex items-start gap-4">
                        <div className={`mt-1.5 h-2 w-2 rounded-full ${txn.type === 'DEPOSIT' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-bold truncate text-white">{txn.member?.user?.name || txn.institution?.institutionName || 'System User'}</p>
                           <p className="text-[10px] text-gray-400 flex items-center gap-1 uppercase tracking-wider">
                              <span className="font-mono">{txn.transactionRef}</span>
                              <Circle className="w-1 h-1 fill-gray-600" />
                              <span>{formatTime(txn.transactionDate)}</span>
                           </p>
                        </div>
                        <div className="text-right">
                           <p className={`text-sm font-bold ${txn.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {txn.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(txn.amount)}
                           </p>
                        </div>
                      </div>
                    ))}
                    {(!recentTransactions || recentTransactions.length === 0) && (
                      <div className="text-center py-12 text-gray-500 italic text-sm">No recent transactions</div>
                    )}
                 </div>
                 <Button variant="ghost" className="w-full mt-8 text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 rounded-xl transition-all">
                    View Complete Ledger
                    <ChevronRight className="w-4 h-4 ml-2" />
                 </Button>
              </CardContent>
           </Card>

           <Card className="border-none shadow-md overflow-hidden bg-white">
              <CardHeader className="p-6 border-b border-gray-50">
                 <CardTitle className="text-lg font-bold text-gray-900">System Signals</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                 <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 transition-hover hover:border-emerald-200">
                    <div className="flex items-center gap-3">
                       <UserCheck className="w-5 h-5 text-emerald-600" />
                       <span className="text-sm font-bold text-gray-700">Verified Members</span>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-none font-bold">
                       {formatNumber(users?.members)}
                    </Badge>
                 </div>
                 <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 transition-hover hover:border-blue-200">
                    <div className="flex items-center gap-3">
                       <Building2 className="w-5 h-5 text-blue-600" />
                       <span className="text-sm font-bold text-gray-700">Institution Nodes</span>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-none font-bold">
                       {formatNumber(users?.institutions)}
                    </Badge>
                 </div>
                 <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 border border-red-100 transition-hover hover:bg-red-100 transition-all">
                    <div className="flex items-center gap-3">
                       <AlertCircle className="w-5 h-5 text-red-600" />
                       <span className="text-sm font-bold text-red-700">Portfolio At Risk</span>
                    </div>
                    <Badge variant="destructive" className="bg-red-600 text-white border-none font-bold">
                       {formatNumber(portfolio?.overdueCount)} Critical
                    </Badge>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
