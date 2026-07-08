"use client";

import React from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  PieChart as PieChartIcon,
  BarChart3,
  FileText,
  ChevronRight,
  Landmark,
  ShieldCheck,
  Scale,
  Receipt,
  GanttChartSquare,
  Users,
} from "lucide-react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatISODate } from "@/lib/utils";

interface AccountantDashboardViewProps {
  data: any;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function AccountantDashboardView({
  data,
  onRefresh,
  refreshing,
}: AccountantDashboardViewProps) {
  const {
    branch,
    overview,
    budgetPerformance,
    cashPosition,
    reconciliation,
    monthlyTrends,
    categoryBreakdown,
    budgetVsActual,
    pendingApprovals,
    recentActivity,
    transactions,
    loans,
    staff,
    liveActivity,
  } = data;
  const branchLiquidity = data.branchLiquidity ?? cashPosition.totalCash;

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

  return (
    <div className="flex flex-col gap-8 p-6 pt-2 animate-in fade-in duration-700">
      {/* Financial Treasury Header */}
      <header className="relative overflow-hidden rounded-3xl bg-indigo-950 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-blue-500/10 to-transparent" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
              <Landmark className="h-10 w-10 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{branch?.name || "Financial"} Treasury</h1>
                <Badge className="bg-blue-500 text-white border-none px-3">
                  {branch?.location || "Branch"} Operations
                </Badge>
              </div>
              <p className="text-blue-200/60 mt-1 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Live Financial Oversight Dashboard
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 min-w-[320px]">
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
              <p className="text-[10px] uppercase font-bold text-blue-300/50 mb-1">Today's Net Flow</p>
              <p className={`text-xl font-bold ${transactions.today.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(transactions.today.netCashFlow)}
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
              <p className="text-[10px] uppercase font-bold text-blue-300/50 mb-1">Total Liquidity</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(branchLiquidity)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Strategic Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AccountantMetricCard
          title="Branch Liquidity"
          value={formatCurrency(branchLiquidity)}
          trend={`${cashPosition.cashGrowth}%`}
          positive={cashPosition.cashGrowth >= 0}
          icon={Wallet}
          description="Current reserve balance"
          color="blue"
        />
        <AccountantMetricCard
          title="Total Portfolio"
          value={formatCurrency(loans.totalOutstanding)}
          trend="Live"
          positive={true}
          icon={TrendingUp}
          description={`${loans.active} Active Loans`}
          color="emerald"
        />
        <AccountantMetricCard
          title="Active Members"
          value={overview.totalMembers.toLocaleString()}
          trend={`+${overview.newMembersThisMonth}`}
          positive={true}
          icon={Activity}
          description="Branch membership"
          color="indigo"
        />
        <AccountantMetricCard
          title="Action Required"
          value={overview.pendingApprovals.toLocaleString()}
          trend="Attention"
          positive={false}
          icon={AlertCircle}
          description="Pending vouchers"
          color="amber"
        />
      </div>

      {/* Branch Activity Summary Section (Ported from BM) */}
      <Card className="border-none shadow-xl bg-gradient-to-br from-neutral-50 to-white overflow-hidden">
        <CardHeader className="border-b border-neutral-100 pb-6">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                Branch Operational Summary
              </CardTitle>
              <CardDescription>Daily vs Monthly transaction performance</CardDescription>
            </div>
            <Badge className="bg-indigo-100 text-indigo-700 px-4 py-1 rounded-full font-bold">
              Scoped Data
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Today's Statistics */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-8 bg-emerald-500 rounded-full" />
                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-widest">Today's Log</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Deposits</p>
                  <p className="text-2xl font-bold text-emerald-900">{transactions.today.deposits.count}</p>
                  <p className="text-xs text-emerald-600 font-medium">{formatCurrency(transactions.today.deposits.amount)}</p>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100">
                  <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Withdrawals</p>
                  <p className="text-2xl font-bold text-rose-900">{transactions.today.withdrawals.count}</p>
                  <p className="text-xs text-rose-600 font-medium">{formatCurrency(transactions.today.withdrawals.amount)}</p>
                </div>
              </div>
            </div>

            {/* Monthly Statistics */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-8 bg-blue-500 rounded-full" />
                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-widest">MTD Aggregates</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                  <p className="text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1">Deposits</p>
                  <p className="text-2xl font-bold text-neutral-900">{transactions.month.deposits.count}</p>
                  <p className="text-xs text-emerald-600 font-medium">{formatCurrency(transactions.month.deposits.amount)}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                  <p className="text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1">Withdrawals</p>
                  <p className="text-2xl font-bold text-neutral-900">{transactions.month.withdrawals.count}</p>
                  <p className="text-xs text-rose-600 font-medium">{formatCurrency(transactions.month.withdrawals.amount)}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Trends View */}
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-neutral-100 pb-6">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  Financial Performance Trends
                </CardTitle>
                <CardDescription>Monthly Income vs Expenditure Analysis</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="rounded-xl">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrends}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#6B7280' }} 
                      tickFormatter={(value) => `Shs ${value / 1000000}M`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                      formatter={(val: number) => [formatCurrency(val), '']}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                    <Area type="monotone" dataKey="expenditure" name="Expenditure" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pending Financial Approvals (Action Required) */}
          <Card className="border-none shadow-xl bg-white">
            <CardHeader className="flex flex-row items-center justify-between border-b border-neutral-50">
                <div>
                  <CardTitle className="text-lg font-bold text-rose-600">Pending Approvals</CardTitle>
                  <CardDescription>Actions requiring your authentication</CardDescription>
                </div>
                <Badge className="bg-rose-100 text-rose-600 hover:bg-rose-100 rounded-full">
                  {overview.pendingApprovals} Issues
                </Badge>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-neutral-100">
                  {pendingApprovals.map((app: any) => (
                    <div key={app.id} className="p-4 hover:bg-neutral-50 transition-colors cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${app.priority === 'HIGH' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                            <p className="text-sm font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">{app.category}</p>
                          </div>
                          <p className="text-sm font-bold text-rose-600">{formatCurrency(app.amount)}</p>
                      </div>
                      <p className="text-xs text-neutral-500 line-clamp-1 mb-2">{app.description}</p>
                      <div className="flex justify-between items-center">
                          <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">{app.submittedBy}</p>
                          <p className="text-[10px] text-neutral-400">{formatISODate(app.submittedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full rounded-none h-12 text-sm font-bold text-neutral-500 border-t">
                  GO TO APPROVAL CENTER
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Pane: Staff & Live Log */}
        <div className="space-y-8">
           {/* Staff Status */}
           <Card className="border-none shadow-xl bg-neutral-900 text-white overflow-hidden">
              <CardHeader className="border-b border-white/5">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-400" />
                  Branch Personnel
                </CardTitle>
                <CardDescription className="text-neutral-400">Current active staff in {branch?.name}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {staff.map((s: any) => (
                    <div key={s.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-white/10">
                          <AvatarFallback className="bg-neutral-800 text-neutral-100">
                            {s.name?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold">{s.name}</p>
                          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{s.role}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`rounded-full text-[10px] ${s.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-neutral-800 text-neutral-500 border-neutral-700'}`}>
                        {s.isActive ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
           </Card>

           {/* Live Feed */}
           <Card className="border-none shadow-lg bg-white">
              <CardHeader className="bg-neutral-50/50 rounded-t-xl">
                 <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-600" />
                    Live Activity Feed
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-neutral-100">
                  {liveActivity.length > 0 ? liveActivity.map((t: any) => (
                    <div key={t.id} className="p-4 hover:bg-neutral-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-bold text-neutral-900 truncate pr-2">{t.memberName}</p>
                        <span className={`text-xs font-bold ${t.type === 'DEPOSIT' || t.type === 'REPAYMENT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCurrency(t.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-neutral-500 uppercase font-black">{t.type}</p>
                        <p className="text-[10px] text-neutral-400">{formatISODate(t.date)}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-neutral-400 text-xs">
                       No recent activities recorded for today
                    </div>
                  )}
                </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

function AccountantMetricCard({ title, value, trend, positive, icon: Icon, description, color, type }: any) {
  const colorMap: any = {
    emerald: "text-emerald-500 bg-emerald-50 border-emerald-100",
    rose: "text-rose-500 bg-rose-50 border-rose-100",
    amber: "text-amber-500 bg-amber-50 border-amber-100",
    blue: "text-blue-500 bg-blue-50 border-blue-100",
  };

  return (
    <Card className="border-none shadow-lg bg-white overflow-hidden hover:shadow-xl transition-shadow group">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-4 rounded-3xl ${colorMap[color]} group-hover:scale-110 transition-transform`}>
            <Icon className="h-6 w-6" />
          </div>
          <Badge className={`rounded-full px-2 py-0 h-6 text-[10px] border-none ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {positive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
            {trend}
          </Badge>
        </div>
        <div>
          <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{title}</h3>
          <p className="text-2xl font-black text-neutral-900 mt-1 tracking-tight">{value}</p>
          <p className="text-xs text-neutral-400 mt-2 font-medium">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
