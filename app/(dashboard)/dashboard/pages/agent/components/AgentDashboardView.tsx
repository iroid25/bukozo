"use client";

import React from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Zap,
  MapPin,
  Users,
  Target,
  BarChart3,
  Printer,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatISODate } from "@/lib/utils";

interface AgentDashboardViewProps {
  data: any;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function AgentDashboardView({
  data,
  onRefresh,
  refreshing,
}: AgentDashboardViewProps) {
  const { agent, float, stats, recentActivity, floatTransactions } = data;

  const netFlow = stats.today.netCashFlow;

  const handlePrintReceipt = (transactionId: string) => {
    window.open(`/api/v1/transactions/${transactionId}/receipt`, "_blank");
  };

  return (
    <div className="flex flex-col gap-8 p-6 pt-2 animate-in fade-in duration-700">
      {/* Field Agent Hero */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 to-teal-800 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-emerald-500/20 to-transparent" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-emerald-400 blur opacity-30 animate-pulse" />
              <Avatar className="h-16 w-16 border-2 border-emerald-400/50 p-1 bg-emerald-800">
                <AvatarFallback className="bg-emerald-500/10 text-emerald-200 font-bold text-xl">
                  {agent.name?.substring(0, 2).toUpperCase() || "AG"}
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
                <Badge className={`${float.isActive ? 'bg-emerald-400 text-emerald-900' : 'bg-amber-400 text-amber-900'} border-none`}>
                  <Zap className="h-3 w-3 mr-1" />
                  {float.isActive ? 'Field Active' : 'Offline'}
                </Badge>
              </div>
              <p className="text-emerald-200/60 mt-1 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Mobile Banking Agent • {agent.phone}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 min-w-[240px]">
            <p className="text-xs uppercase tracking-widest text-emerald-300/50 font-semibold w-full text-right">Today's Net Flow</p>
            <div className="flex items-center justify-end gap-3 w-full">
              <span className={`text-3xl font-bold ${netFlow >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {formatCurrency(netFlow)}
              </span>
              {netFlow >= 0 ? <TrendingUp className="h-6 w-6 text-emerald-300" /> : <TrendingDown className="h-6 w-6 text-rose-300" />}
            </div>
          </div>
        </div>
      </header>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AgentMetricCard
          title="Float Balance"
          value={formatCurrency(float.balance)}
          description={float.isActive ? "Active & Ready" : "Inactive"}
          icon={Wallet}
          trend={float.isActive ? "Operational" : "Offline"}
          positive={float.isActive}
          color="emerald"
        />
        <AgentMetricCard
          title="Transactions Today"
          value={stats.today.transactions.toString()}
          description={`${stats.month.transactions} this month`}
          icon={Activity}
          trend="Active"
          positive={true}
          color="blue"
        />
        <AgentMetricCard
          title="Deposits Collected"
          value={formatCurrency(stats.today.deposits.amount)}
          description={`${stats.today.deposits.count} transactions`}
          icon={ArrowDownRight}
          trend={`${stats.today.deposits.count} txns`}
          positive={true}
          color="indigo"
        />
        <AgentMetricCard
          title="Withdrawals Paid"
          value={formatCurrency(stats.today.withdrawals.amount)}
          description={`${stats.today.withdrawals.count} transactions`}
          icon={ArrowUpRight}
          trend={`${stats.today.withdrawals.count} txns`}
          positive={stats.today.withdrawals.amount <= float.balance}
          color="amber"
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Transaction Analytics */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-neutral-100 pb-6">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  Field Activity Heatmap
                </CardTitle>
                <CardDescription>Real-time transaction volume tracking</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="rounded-full">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recentActivity.slice(0, 10).reverse()}>
                    <defs>
                      <linearGradient id="colorAgentValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" hide />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(val: number) => [formatCurrency(val), 'Amount']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorAgentValue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Float Transactions Log */}
          <Card className="border-none shadow-lg bg-white">
            <CardHeader className="bg-neutral-50/50 border-b border-neutral-100">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-teal-600" />
                Float Movement Log
              </CardTitle>
              <CardDescription>Today's float allocations and reconciliations</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-neutral-100">
                {floatTransactions.length > 0 ? (
                  floatTransactions.map((ft: any) => (
                    <div key={ft.id} className="p-4 hover:bg-neutral-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${ft.type === 'DEPOSIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {ft.type === 'DEPOSIT' ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-neutral-900">{ft.type}</p>
                            <p className="text-xs text-neutral-500">{ft.description || 'Float transaction'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${ft.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {ft.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(ft.amount)}
                          </p>
                          <p className="text-xs text-neutral-400">{formatISODate(ft.date)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">No float transactions today</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Pane: Live Activity */}
        <div className="space-y-8">
          <Card className="border-none shadow-xl bg-neutral-900 text-white overflow-hidden">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" />
                Live Transaction Feed
              </CardTitle>
              <CardDescription className="text-neutral-400">Real-time customer service log</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                {recentActivity.map((t: any) => (
                  <div key={t.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${t.type === 'DEPOSIT' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <p className="text-sm font-bold text-white">{t.memberName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold ${t.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handlePrintReceipt(t.id)}
                          className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                          title="Print receipt"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-neutral-500 truncate mr-4">{t.description || t.type}</p>
                      <p className="text-xs text-neutral-400 whitespace-nowrap">{formatISODate(t.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="w-full rounded-none h-10 text-xs font-bold text-neutral-400 hover:text-emerald-400">
                VIEW ALL ACTIVITY
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats Card */}
          <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Performance</p>
                  <h3 className="text-2xl font-bold">Excellent</h3>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-sm text-white/70">Customers Served</span>
                  <span className="text-sm font-bold">{stats.today.transactions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/70">Avg. Transaction</span>
                  <span className="text-sm font-bold">
                    {formatCurrency(stats.today.transactions > 0 ? (stats.today.deposits.amount + stats.today.withdrawals.amount) / stats.today.transactions : 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/70">Float Utilization</span>
                  <span className="text-sm font-bold">
                    {float.balance > 0 ? ((stats.today.withdrawals.amount / float.balance) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AgentMetricCard({ title, value, description, icon: Icon, trend, positive, color }: any) {
  const colorStyles: any = {
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
  };

  return (
    <Card className="border-none shadow-xl bg-white overflow-hidden group hover:-translate-y-1 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-2xl ${colorStyles[color]} group-hover:scale-110 transition-transform`}>
            <Icon className="h-6 w-6" />
          </div>
          <Badge className={`rounded-full px-2 py-0 h-6 text-[10px] border-none ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {trend}
          </Badge>
        </div>
        <div>
          <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">{title}</h3>
          <p className="text-2xl font-bold text-neutral-900 mt-2 tracking-tight">{value}</p>
          <p className="text-xs text-neutral-400 mt-2 font-medium">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
