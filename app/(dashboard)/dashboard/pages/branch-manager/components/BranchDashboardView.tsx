"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Wallet,
  BarChart3,
  UserCheck,
  FileText,
  ChevronRight,
  Search,
  Filter,
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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, formatISODate } from "@/lib/utils";
import { toast } from "sonner";

interface BranchDashboardViewProps {
  data: any;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function BranchDashboardView({
  data,
  onRefresh,
  refreshing,
}: BranchDashboardViewProps) {
  const {
    branch,
    overview,
    transactions,
    loans,
    float,
    vault,
    staff,
    recentActivity,
    pendingApprovals,
    quickStats,
    fixedDeposits,
  } = data;
  const branchLiquidity = data.branchLiquidity ?? vault.totalBalance + float.totalBalance;
  const [approvingInstitutionId, setApprovingInstitutionId] = useState<string | null>(null);

  const netFlow = transactions.today.netCashFlow;

  const handleApproveInstitution = async (institutionId: string) => {
    try {
      setApprovingInstitutionId(institutionId);
      const response = await fetch(`/api/v1/institutions/${institutionId}/approve`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to approve institution");
      }

      toast.success("Institution approved");
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve institution");
    } finally {
      setApprovingInstitutionId(null);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-6 pt-2 animate-in fade-in duration-700">
      {/* Station Header */}
      <header className="relative overflow-hidden rounded-3xl bg-neutral-900 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-emerald-500/20 to-transparent" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-emerald-500 blur opacity-30 animate-pulse" />
              <Avatar className="h-16 w-16 border-2 border-emerald-500/50 p-1 bg-neutral-800">
                <AvatarFallback className="bg-emerald-500/10 text-emerald-400 font-bold text-xl">
                  {branch?.name?.substring(0, 2).toUpperCase() || "BM"}
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{branch?.name} HQ</h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <Activity className="h-3 w-3 mr-1" />
                  Live Operational
                </Badge>
              </div>
              <p className="text-neutral-400 mt-1 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 min-w-[240px]">
            <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold w-full text-right">Today's Net Flow</p>
            <div className="flex items-center justify-end gap-3 w-full">
              <span className={`text-3xl font-bold ${netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(netFlow)}
              </span>
              {netFlow >= 0 ? <TrendingUp className="h-6 w-6 text-emerald-400" /> : <TrendingDown className="h-6 w-6 text-red-400" />}
            </div>
          </div>
        </div>
      </header>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Branch Liquidity"
          value={formatCurrency(branchLiquidity)}
          description={`${vault.vaults.length} Active Vaults`}
          icon={Wallet}
          trend="+12% from open"
          positive={true}
          color="emerald"
        />
        <MetricCard
          title="Total Portfolio"
          value={formatCurrency(loans.totalOutstanding)}
          description={`${loans.active} Active Loans`}
          icon={TrendingUp}
          trend={`${loans.recoveryRate.toFixed(1)}% Recovery`}
          positive={loans.recoveryRate > 95}
          color="blue"
        />
        <MetricCard
          title="Active Members"
          value={overview.totalMembers.toLocaleString()}
          description={`${overview.newMembersThisMonth} New this month`}
          icon={Users}
          trend="Steady growth"
          positive={true}
          color="indigo"
        />
        <MetricCard
          title="Pending Actions"
          value={quickStats.pendingApprovalsCount.toLocaleString()}
          description={`${pendingApprovals.loanApplications.length} Loan Apps`}
          icon={AlertCircle}
          trend="Attention required"
          positive={false}
          color="amber"
        />
        <MetricCard
          title="Asset Requests"
          value={(quickStats.assetRequestsCount || 0).toLocaleString()}
          description="Transfer and disposal approvals"
          icon={FileText}
          trend="Review needed"
          positive={false}
          color="blue"
        />
        <MetricCard
          title="Fixed Deposits"
          value={formatCurrency(fixedDeposits?.totalAmount || 0)}
          description={`${fixedDeposits?.count || 0} Active Accounts`}
          icon={BarChart3}
          trend={`${fixedDeposits?.maturingSoon || 0} mat. soon`}
          positive={true}
          color="amber"
        />
      </div>

      {/* Branch Activity Summary Section */}
      <Card className="border-none shadow-xl bg-gradient-to-br from-neutral-50 to-white overflow-hidden">
        <CardHeader className="border-b border-neutral-100 pb-6">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                Branch Activity Summary
              </CardTitle>
              <CardDescription>Comprehensive transaction and operational metrics</CardDescription>
            </div>
            <Badge className="bg-indigo-100 text-indigo-700 px-4 py-1 rounded-full font-bold">
              Live Data
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Today's Statistics */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-8 bg-emerald-500 rounded-full" />
                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-widest">Today's Activity</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Deposits</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-900">{transactions.today.deposits.count}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-1">{formatCurrency(transactions.today.deposits.amount)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpRight className="h-4 w-4 text-rose-600" />
                    <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Withdrawals</p>
                  </div>
                  <p className="text-2xl font-bold text-rose-900">{transactions.today.withdrawals.count}</p>
                  <p className="text-xs text-rose-600 font-medium mt-1">{formatCurrency(transactions.today.withdrawals.amount)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total Txns</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{transactions.today.total}</p>
                  <p className="text-xs text-blue-600 font-medium mt-1">Completed today</p>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-indigo-600" />
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Net Flow</p>
                  </div>
                  <p className={`text-2xl font-bold ${netFlow >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                    {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow).replace('UGX ', '')}
                  </p>
                  <p className="text-xs text-indigo-600 font-medium mt-1">Cash position</p>
                </div>
              </div>
            </div>

            {/* Monthly Statistics */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-8 bg-blue-500 rounded-full" />
                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-widest">This Month</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                    <p className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Deposits</p>
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{transactions.month.deposits.count}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-1">{formatCurrency(transactions.month.deposits.amount)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpRight className="h-4 w-4 text-rose-600" />
                    <p className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Withdrawals</p>
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{transactions.month.withdrawals.count}</p>
                  <p className="text-xs text-rose-600 font-medium mt-1">{formatCurrency(transactions.month.withdrawals.amount)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <p className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Total Txns</p>
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{transactions.month.total}</p>
                  <p className="text-xs text-blue-600 font-medium mt-1">MTD volume</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-indigo-600" />
                    <p className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Net Flow</p>
                  </div>
                  <p className={`text-2xl font-bold ${transactions.month.netCashFlow >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                    {transactions.month.netCashFlow >= 0 ? '+' : ''}{formatCurrency(transactions.month.netCashFlow).replace('UGX ', '')}
                  </p>
                  <p className="text-xs text-indigo-600 font-medium mt-1">MTD position</p>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Branch Metrics */}
          <Separator className="my-6" />
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-xl bg-neutral-50">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Active Accounts</p>
              <p className="text-2xl font-bold text-neutral-900">{overview.activeAccounts}</p>
              <p className="text-xs text-neutral-400 mt-1">of {overview.totalAccounts} total</p>
            </div>

            <div className="text-center p-4 rounded-xl bg-neutral-50">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Staff Active</p>
              <p className="text-2xl font-bold text-neutral-900">{overview.activeStaff}</p>
              <p className="text-xs text-neutral-400 mt-1">of {overview.totalStaff} staff</p>
            </div>

            <div className="text-center p-4 rounded-xl bg-neutral-50">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Loan Portfolio</p>
              <p className="text-2xl font-bold text-neutral-900">{loans.active}</p>
              <p className="text-xs text-neutral-400 mt-1">{loans.overdue} overdue</p>
            </div>

            <div className="text-center p-4 rounded-xl bg-neutral-50">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Float Status</p>
              <p className="text-2xl font-bold text-neutral-900">{float.activeFloats}</p>
              <p className="text-xs text-neutral-400 mt-1">active floats</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Operational Analytics */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-neutral-100 pb-6">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  Transaction Heatmap
                </CardTitle>
                <CardDescription>Visualizing volume and cash flow stability</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 rounded-full px-4" onClick={onRefresh} disabled={refreshing}>
                  <RefreshCw className={`h-3 w-3 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Sync
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recentActivity.transactions.slice(0, 10).reverse()}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      hide 
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `Shs ${value / 1000}k`}
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
                      fill="url(#colorValue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <Card className="border-none shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-rose-600">
                    <Clock className="h-5 w-5" />
                    Loan Applications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingApprovals.loanApplications.length > 0 ? (
                    pendingApprovals.loanApplications.map((loan: any) => (
                      <div key={loan.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100 hover:border-rose-200 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-rose-100 text-rose-600 font-bold">
                              {loan.memberName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-bold group-hover:text-rose-600 transition-colors">{loan.memberName}</p>
                            <p className="text-xs text-neutral-500">{loan.memberNumber}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{formatCurrency(loan.amount)}</p>
                          <p className="text-[10px] text-neutral-400 uppercase tracking-tighter">Needs Review</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm text-neutral-500">All applications cleared</p>
                    </div>
                  )}
                </CardContent>
             </Card>

             <Card className="border-none shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-600">
                    <UserCheck className="h-5 w-5" />
                    New Members
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingApprovals.members.length > 0 ? (
                    pendingApprovals.members.map((member: any) => (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100 hover:border-indigo-200 transition-colors cursor-pointer group">
                         <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-indigo-100 text-indigo-600 font-bold">
                              {member.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-bold group-hover:text-indigo-600 transition-colors uppercase">{member.name}</p>
                            <p className="text-xs text-neutral-500">{member.phone || 'No Phone'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-full text-[10px]">
                            Pending
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm text-neutral-500">All cleared</p>
                    </div>
                  )}
                </CardContent>
             </Card>

             <Card className="border-none shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-600">
                    <Building2 className="h-5 w-5" />
                    Institutions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingApprovals.institutions?.length > 0 ? (
                    pendingApprovals.institutions.map((institution: any) => (
                      <div
                        key={institution.id}
                        className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-emerald-900">
                              {institution.institutionName}
                            </p>
                            <p className="text-xs text-emerald-700">
                              {institution.institutionType} · #{institution.institutionNumber}
                            </p>
                          </div>
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                            Pending
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                          <p>{institution.primaryContactPerson} · {institution.primaryContactPhone}</p>
                          <p>{institution.institutionEmail}</p>
                          <p>{institution.branchName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="sm" className="flex-1">
                            <Link href={`/dashboard/users/institutions/${institution.id}`}>
                              Preview
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleApproveInstitution(institution.id)}
                            disabled={approvingInstitutionId === institution.id}
                          >
                            {approvingInstitutionId === institution.id ? "Approving..." : "Approve"}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm text-neutral-500">No pending institutions</p>
                    </div>
                  )}
                </CardContent>
             </Card>
          </div>
        </div>

        {/* Right Pane: Staff & Live Log */}
        <div className="space-y-8">
           <Card className="border-none shadow-xl bg-neutral-900 text-white overflow-hidden">
              <CardHeader className="border-b border-white/5">
                <CardTitle className="text-lg font-bold flex items-center gap-2 capitalize">
                  <Users className="h-5 w-5 text-emerald-400" />
                  Staff Operations
                </CardTitle>
                <CardDescription className="text-neutral-400">Current active personnel</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {staff.map((s: any) => (
                    <div key={s.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10 border border-white/10">
                            <AvatarFallback className="bg-neutral-800 text-neutral-100">
                              {s.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {s.isActive && (
                            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-neutral-900 shadow-lg" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{s.name}</p>
                          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{s.role}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`rounded-full text-[10px] ${s.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-neutral-800 text-neutral-500 border-neutral-700'}`}>
                        {s.isActive ? 'Active' : 'Offline'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
           </Card>

           <Card className="border-none shadow-lg bg-white">
              <CardHeader className="flex flex-row items-center justify-between bg-neutral-50/50 rounded-t-xl">
                 <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-600" />
                    Live Activity
                 </CardTitle>
                 <Badge variant="outline" className="text-[10px] uppercase font-bold text-neutral-400 tracking-tighter">
                   Latest 5
                 </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-neutral-100">
                  {recentActivity.transactions.slice(0, 5).map((t: any) => (
                    <div key={t.id} className="p-4 hover:bg-neutral-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-bold text-neutral-900">{t.memberName}</p>
                        <span className={`text-xs font-bold ${t.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(t.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-neutral-500 truncate mr-4">{t.description || t.type}</p>
                        <p className="text-[10px] text-neutral-400 whitespace-nowrap">{formatISODate(t.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full rounded-none h-10 text-xs font-bold text-neutral-400 hover:text-emerald-600">
                  EXPLORE ALL ACTIVITY
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, description, icon: Icon, trend, positive, color }: any) {
  const colorStyles: any = {
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100 shadow-emerald-100/20",
    blue: "text-blue-600 bg-blue-50 border-blue-100 shadow-blue-100/20",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100 shadow-indigo-100/20",
    amber: "text-amber-600 bg-amber-50 border-amber-100 shadow-amber-100/20",
  };

  return (
    <Card className="border-none shadow-xl bg-white overflow-hidden group hover:-translate-y-1 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-2xl ${colorStyles[color]} group-hover:scale-110 transition-transform`}>
            <Icon className="h-6 w-6" />
          </div>
          <Badge className={`rounded-full px-2 py-0 h-6 text-[10px] border-none ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {positive ? '+' : ''}{trend}
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
