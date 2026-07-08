"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
  Clock,
  Activity,
  Receipt,
  CheckCircle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Building2,
  User as UserIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, formatISODate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface TellerDashboardViewProps {
  data: any;
}

export function TellerDashboardView({ data }: TellerDashboardViewProps) {
  const router = useRouter();
  const {
    user,
    userFloat,
    stats,
    hourlyData,
    recentTransactions,
    drawerBalance,
  } = data;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filteredTransactions = useMemo(() => {
    let filtered = recentTransactions;
    
    if (activeTab === "deposits") {
      filtered = filtered.filter((t: any) => t.type === "DEPOSIT");
    } else if (activeTab === "withdrawals") {
      filtered = filtered.filter((t: any) => t.type === "WITHDRAWAL");
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((t: any) => 
        t.transactionRef.toLowerCase().includes(query) ||
        (t.member?.user?.name || "").toLowerCase().includes(query) ||
        (t.institution?.institutionName || "").toLowerCase().includes(query) ||
        t.account?.accountNumber.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [recentTransactions, activeTab, searchQuery]);

  const netFlow = stats.deposits.amount - stats.withdrawals.amount;

  return (
    <div className="flex flex-col gap-8 p-6 pt-2 animate-in fade-in duration-700">
      {/* Station Header */}
      <header className="relative overflow-hidden rounded-3xl bg-neutral-900 p-8 text-white shadow-2xl">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-emerald-500/20 to-transparent" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border-4 border-white/10 shadow-xl">
              <AvatarImage src={user.image} />
              <AvatarFallback className="bg-emerald-500 text-2xl font-bold">
                {user.name?.substring(0, 2).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {user.name}</h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <Activity className="mr-1 h-3 w-3 animate-pulse" />
                  Station Active
                </Badge>
              </div>
              <p className="text-neutral-400 mt-1 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Main Branch • Session started {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Today's Net Flow</p>
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(netFlow)}
              </span>
              {netFlow >= 0 ? <TrendingUp className="h-6 w-6 text-emerald-400" /> : <TrendingUp className="h-6 w-6 text-red-400 rotate-180" />}
            </div>
          </div>
        </div>
      </header>

      {/* Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Drawer Balance"
          value={formatCurrency(drawerBalance)}
          icon={Wallet}
          color="text-blue-600"
          bgColor="bg-blue-50"
          description="Total physical cash in hand"
        />
        <MetricCard
          title="Deposits Today"
          value={formatCurrency(stats.deposits.amount)}
          icon={ArrowDownCircle}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          description={`${stats.deposits.count} successful deposits`}
        />
        <MetricCard
          title="Withdrawals Today"
          value={formatCurrency(stats.withdrawals.amount)}
          icon={ArrowUpCircle}
          color="text-red-600"
          bgColor="bg-red-50"
          description={`${stats.withdrawals.count} processed requests`}
        />
        <MetricCard
          title="Customers Served"
          value={stats.uniquecustomers}
          icon={Users}
          color="text-teal-600"
          bgColor="bg-teal-50"
          description="Unique members & institutions"
        />
      </div>

      {/* Float Control Center Banner */}
      {!userFloat?.isActiveForDay && (
        <Card className="border-red-200 bg-red-50 shadow-sm overflow-hidden">
          <div className="flex items-center p-6 gap-6">
            <div className="h-14 w-14 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shadow-inner">
              <Clock className="h-8 w-8 animate-bounce" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-red-900">Float Reconciliation Required</h3>
              <p className="text-red-700">Your session is currently restricted. Please complete your end-of-day reconciliation from yesterday to continue.</p>
            </div>
            <Button variant="destructive" size="lg" className="rounded-xl shadow-lg shadow-red-200">
              Reconcile Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Pending Disbursements Alert Banner */}
      {data.pendingDisbursementsCount > 0 && (
        <Card className="border-blue-200 bg-blue-50 shadow-sm overflow-hidden border-l-4 border-l-blue-600">
          <div className="flex items-center p-6 gap-6">
            <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
              <CreditCard className="h-8 w-8 animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600 text-white hover:bg-blue-700">Action Required</Badge>
                <h3 className="text-xl font-bold text-blue-900">New Loan Assignments</h3>
              </div>
              <p className="text-blue-700 mt-1">You have <b>{data.pendingDisbursementsCount}</b> loan{data.pendingDisbursementsCount > 1 ? 's' : ''} allocated to you for disbursement. Please process these as soon as possible.</p>
            </div>
            <Button 
                onClick={() => router.push('/dashboard/loanprocess/disbursement-queue')}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-200 font-bold px-8"
            >
              Go to Disbursements
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-sm border-neutral-100 rounded-3xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-8">
            <div>
              <CardTitle className="text-xl font-bold">Hourly Heatmap</CardTitle>
              <CardDescription>Visualizing transaction volume across the last 24 hours</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100">Deposits</Badge>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100">Withdrawals</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="hour" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#888', fontSize: 12}} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#888', fontSize: 12}}
                    tickFormatter={(val) => `UGX ${(val/1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="deposits" fill="url(#colorDeposits)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="withdrawals" fill="url(#colorWithdrawals)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-neutral-100 rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Operational Efficiency</CardTitle>
            <CardDescription>Comparison of activity types today</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Deposits', value: stats.deposits.count, color: '#10b981' },
                      { name: 'Withdrawals', value: stats.withdrawals.count, color: '#ef4444' }
                    ]}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full space-y-4 mt-8">
               <EfficiencyStat 
                  label="Deposits" 
                  value={stats.deposits.count} 
                  total={stats.totalTransactions} 
                  color="bg-emerald-500" 
               />
               <EfficiencyStat 
                  label="Withdrawals" 
                  value={stats.withdrawals.count} 
                  total={stats.totalTransactions} 
                  color="bg-red-500" 
               />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Log */}
      <Card className="shadow-sm border-neutral-100 rounded-3xl overflow-hidden">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-neutral-50/50 pb-6 border-b">
          <div>
            <CardTitle className="text-xl font-bold">Transaction Command Log</CardTitle>
            <CardDescription>Monitoring your processed activities in real-time</CardDescription>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input 
                placeholder="Search ref or customer..." 
                className="pl-10 h-10 w-full md:w-[300px] bg-white rounded-xl border-neutral-200" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex bg-neutral-200/50 p-1 rounded-xl">
               <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>All</TabButton>
               <TabButton active={activeTab === "deposits"} onClick={() => setActiveTab("deposits")}>IN</TabButton>
               <TabButton active={activeTab === "withdrawals"} onClick={() => setActiveTab("withdrawals")}>OUT</TabButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-neutral-50/50">
              <TableRow>
                <TableHead className="font-bold py-6">Transaction Ref</TableHead>
                <TableHead className="font-bold">Entity / Customer</TableHead>
                <TableHead className="font-bold">Type/Channel</TableHead>
                <TableHead className="font-bold">Amount</TableHead>
                <TableHead className="font-bold">Processed At</TableHead>
                <TableHead className="font-bold text-right">Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((txn: any) => (
                <TableRow key={txn.id} className="hover:bg-neutral-50 transition-colors group">
                  <TableCell className="py-4 font-mono text-xs font-semibold text-neutral-600">
                    {txn.transactionRef}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 rounded-lg shadow-sm border border-neutral-100">
                        <AvatarFallback className="bg-emerald-50 text-emerald-700 text-xs font-bold">
                          {(txn.member?.user?.name || txn.institution?.institutionName || "??").substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-bold text-neutral-900 leading-none">
                          {txn.member?.user?.name || txn.institution?.institutionName || "Unknown Customer"}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-semibold mt-1 uppercase tracking-tight">
                          {txn.account?.accountType?.name || "Savings Account"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <Badge variant="outline" className={`w-fit text-[10px] font-bold ${txn.type === 'DEPOSIT' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        {txn.type}
                      </Badge>
                      <span className="text-[10px] text-neutral-500 font-bold mt-1 uppercase ml-1">{txn.channel || 'CASH'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm font-black ${txn.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {txn.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-neutral-500 font-medium">
                    {new Date(txn.transactionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow-none">
                      Verified
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredTransactions.length === 0 && (
            <div className="p-20 text-center">
               <div className="h-20 w-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="h-10 w-10 text-neutral-300" />
               </div>
               <h3 className="text-lg font-bold text-neutral-900">No transactions match your filter</h3>
               <p className="text-neutral-500">Try adjusting your search or tab selection</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color, bgColor, description }: any) {
  return (
    <Card className="border-none shadow-xl shadow-neutral-200/50 rounded-3xl group hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      <div className={`absolute top-0 right-0 h-24 w-24 -mr-8 -mt-8 rounded-full ${bgColor} opacity-20 transition-transform group-hover:scale-150 duration-500`} />
      <CardContent className="p-6 relative">
        <div className="flex justify-between items-start mb-6">
          <div className={`p-4 rounded-2xl ${bgColor} ${color} shadow-inner`}>
            <Icon className="h-6 w-6" />
          </div>
          <Badge variant="outline" className="border-neutral-100 text-neutral-400 font-bold">LIVE</Badge>
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

function EfficiencyStat({ label, value, total, color }: any) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm font-bold mb-2">
        <span className="text-neutral-600">{label}</span>
        <span className="text-neutral-900">{value} ({percentage.toFixed(0)}%)</span>
      </div>
      <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function TabButton({ children, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
        active ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
      }`}
    >
      {children}
    </button>
  );
}
