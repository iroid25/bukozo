"use client";

import React, { useState } from "react";
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  CreditCard,
  Clock,
  Activity,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Zap,
  Star,
  Eye,
  EyeOff,
  Download,
  PlusCircle,
  ArrowUpCircle,
  FileText,
  User,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, formatISODate } from "@/lib/utils";
import Link from "next/link";

interface MemberDashboardViewProps {
  data: any;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function MemberDashboardView({
  data,
  onRefresh,
  refreshing,
}: MemberDashboardViewProps) {
  const { profile, stats, accounts, recentTransactions, activeLoans } = data;
  const [balanceVisible, setBalanceVisible] = useState(true);

  return (
    <div className="flex flex-col gap-8 p-6 pt-2 animate-in fade-in duration-700 max-w-7xl mx-auto w-full">
      {/* Personalized Welcome Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-16 w-16 border-2 border-indigo-500/20 p-1 bg-white shadow-sm">
              <AvatarImage src={profile.avatar} />
              <AvatarFallback className="bg-indigo-600 text-white font-bold text-xl">
                {profile.name?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 border-2 border-white h-5 w-5 rounded-full flex items-center justify-center shadow-sm">
              <CheckCircle className="h-3 w-3 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-neutral-900 tracking-tight">
              Hello, {profile.name.split(' ')[0]}!
            </h1>
            <p className="text-neutral-500 font-medium flex items-center gap-2">
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 rounded-full font-bold">
                Level 1 Member
              </Badge>
              <span className="text-neutral-300">•</span>
              {profile.memberNumber}
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
           <Button 
            variant="outline" 
            size="sm" 
            className="rounded-2xl border-neutral-200 hover:bg-neutral-50 h-11 px-5 font-bold text-neutral-600 shadow-sm"
            onClick={onRefresh}
            disabled={refreshing}
          >
             <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
             Refresh
           </Button>
           <Link href="/dashboard/profile">
            <Button className="rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white h-11 px-6 font-bold shadow-lg shadow-neutral-200">
               <User className="h-4 w-4 mr-2" />
               Profile
            </Button>
           </Link>
        </div>
      </header>

      {/* Main Wealth Card & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* Glassmorphism Wealth Card */}
          <div className="relative overflow-hidden group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-[32px] blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200" />
            <div className="relative bg-neutral-900 rounded-[30px] p-8 text-white flex flex-col gap-8 shadow-2xl">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-2">
                   <p className="text-indigo-300/60 uppercase font-black text-[10px] tracking-[0.2em]">Combined Wealth Balance</p>
                   <div className="flex items-center gap-4">
                      <h2 className="text-4xl md:text-5xl font-black tracking-tighter">
                        {balanceVisible ? formatCurrency(stats.totalBalance) : "••••••••••••"}
                      </h2>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setBalanceVisible(!balanceVisible)}
                        className="text-white/40 hover:text-white hover:bg-white/10 rounded-full"
                      >
                        {balanceVisible ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                      </Button>
                   </div>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 backdrop-blur-md">
                   <ShieldCheck className="h-8 w-8 text-indigo-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-8 border-t border-white/5">
                <div className="flex flex-col gap-1">
                   <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Active Accounts</p>
                   <p className="text-xl font-bold">{stats.accountCount}</p>
                </div>
                <div className="flex flex-col gap-1">
                   <p className="text-rose-500/60 text-[10px] font-bold uppercase tracking-widest">Outstanding Loans</p>
                   <p className="text-xl font-bold text-rose-400">{formatCurrency(stats.totalLoanOutstanding)}</p>
                </div>
                <div className="hidden md:flex flex-col gap-1">
                   <p className="text-emerald-500/60 text-[10px] font-bold uppercase tracking-widest">Savings Goals</p>
                   <p className="text-xl font-bold text-emerald-400">82% on track</p>
                </div>
              </div>

              <div className="flex gap-4">
                 <Link href="/dashboard/member-details/deposit-details" className="flex-1">
                    <Button className="w-full h-12 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-black shadow-lg shadow-indigo-500/20">
                      <PlusCircle className="h-5 w-5 mr-2" />
                      ADD FUNDS
                    </Button>
                 </Link>
                 <Link href="/dashboard/member-details/my-withdrawals" className="flex-1">
                    <Button variant="outline" className="w-full h-12 rounded-2xl bg-white/5 border-white/10 hover:bg-white/10 text-white font-black transition-all">
                      <ArrowUpCircle className="h-5 w-5 mr-2" />
                      WITHDRAW
                    </Button>
                 </Link>
              </div>
            </div>
          </div>

          {/* Accounts Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-black text-neutral-400 uppercase tracking-[0.2em] px-1">My Accounts</h3>
              <div className="flex flex-col gap-4">
                {accounts.map((acc: any) => (
                  <div key={acc.id} className="p-5 rounded-[24px] bg-white border border-neutral-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group">
                    <div className="flex justify-between items-center mb-4">
                      <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="rounded-full border-neutral-100 text-[10px] font-bold text-neutral-400">
                        {acc.number}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-tighter">{acc.type}</p>
                      <p className="text-xl font-black text-neutral-900 mt-1">
                        {balanceVisible ? formatCurrency(acc.balance) : "••••••"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-black text-neutral-400 uppercase tracking-[0.2em]">Quick Services</h3>
                <span className="text-[10px] font-black text-indigo-600 cursor-pointer hover:underline uppercase">View All</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <ServiceButton icon={FileText} label="Statements" href="/dashboard/statements" color="bg-blue-50 text-blue-600" />
                 <ServiceButton icon={Zap} label="Loans" href="/dashboard/loanprocess/tracking" color="bg-amber-50 text-amber-600" />
                 <ServiceButton icon={TrendingUp} label="Dividends" href="/dashboard/member-details/dividends" color="bg-emerald-50 text-emerald-600" />
                 <ServiceButton icon={CheckCircle} label="Repayments" href="/dashboard/loans/reports/ledger" color="bg-indigo-50 text-indigo-600" />
              </div>
              
              <Card className="rounded-[24px] border-none bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-xl shadow-blue-500/20 overflow-hidden relative">
                 <div className="absolute top-0 right-0 h-24 w-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl" />
                 <CardContent className="p-6 relative z-10 flex flex-col gap-4">
                    <div className="p-2 rounded-xl bg-white/20 w-fit backdrop-blur-md">
                      <Star className="h-5 w-5 fill-white" />
                    </div>
                    <div>
                       <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Active Offer</p>
                       <h4 className="text-lg font-black leading-tight mt-1">Instant Loan up to {formatCurrency(5000000)}</h4>
                    </div>
                    <Button className="w-full bg-white text-indigo-600 hover:bg-white/90 rounded-xl font-black h-10 shadow-sm">
                      APPLY NOW
                    </Button>
                 </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-[28px] border-neutral-100 shadow-sm overflow-hidden bg-white">
            <CardHeader className="border-b border-neutral-50 bg-neutral-50/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black tracking-tight">Active Loans</CardTitle>
                  <CardDescription className="text-xs font-medium">
                    Your active loan ledgers, products, and outstanding balances.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full text-[10px] font-bold uppercase tracking-[0.18em]">
                  {activeLoans?.length || 0} loans
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {Array.isArray(activeLoans) && activeLoans.length > 0 ? (
                <div className="divide-y divide-neutral-100">
                  {activeLoans.map((loan: any) => (
                    <div key={loan.id} className="p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-neutral-900">
                            {loan.productName || "Loan"}
                          </p>
                          <Badge variant="secondary" className="rounded-full text-[10px] font-bold">
                            {loan.loanNumber || loan.id.slice(0, 8).toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="rounded-full text-[10px] font-bold">
                            {loan.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-neutral-500">
                          Outstanding balance {formatCurrency(loan.outstanding || 0)}
                          {loan.dueDate && (
                            <span className="ml-2">
                              • Due {formatISODate(loan.dueDate)}
                            </span>
                          )}
                        </p>
                        {loan.applicationDate && (
                          <p className="text-xs text-neutral-400">
                            Disbursed / applied on {formatISODate(loan.applicationDate)}
                          </p>
                        )}
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Loan Amount</p>
                        <p className="text-xl font-black text-neutral-900">
                          {formatCurrency(loan.amount || 0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-neutral-400">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-neutral-200" />
                  <p className="font-semibold">No active loans found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Pane: Activity Timeline */}
        <div className="space-y-8">
           <Card className="rounded-[30px] border-neutral-100 shadow-xl overflow-hidden bg-white h-full flex flex-col">
              <CardHeader className="bg-neutral-50/50 border-b border-neutral-50 p-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-neutral-900 flex items-center justify-center">
                       <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                       <CardTitle className="text-lg font-black tracking-tight">Activity Log</CardTitle>
                       <CardDescription className="text-xs font-bold uppercase tracking-tighter">Real-time alerts</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col">
                <div className="divide-y divide-neutral-50 flex-1">
                  {recentTransactions.map((t: any) => (
                    <div key={t.id} className="p-5 hover:bg-neutral-50/80 transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-3">
                          <div className={`mt-1 p-2 rounded-xl h-fit ${t.type === 'DEPOSIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {t.type === 'DEPOSIT' ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-neutral-900 group-hover:text-indigo-600 transition-colors uppercase leading-none mb-1">{t.type}</p>
                            <p className="text-xs font-medium text-neutral-400 line-clamp-1">{t.description}</p>
                          </div>
                        </div>
                        <p className={`text-sm font-black ${t.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-neutral-900'}`}>
                          {t.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center mt-3 pl-11">
                         <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">{t.ref?.substring(0, 10)}</span>
                         <span className="text-[10px] font-bold text-neutral-400">{formatISODate(t.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {recentTransactions.length === 0 && (
                   <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4 text-neutral-400">
                      <Clock className="h-12 w-12 text-neutral-100" />
                      <p className="text-sm font-bold">No recent activity detected.</p>
                   </div>
                )}
                <Button variant="ghost" className="w-full rounded-none h-14 text-xs font-black text-neutral-400 hover:text-indigo-600 border-t border-neutral-100 uppercase tracking-[0.2em]">
                  View Full Statement
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

function ServiceButton({ icon: Icon, label, href, color }: any) {
  return (
    <Link href={href} className="group">
      <div className="flex flex-col items-center justify-center p-4 rounded-[24px] bg-white border border-neutral-100 hover:border-indigo-100 hover:shadow-md transition-all h-28 gap-3">
        <div className={`p-3 rounded-2xl ${color} group-hover:scale-110 transition-transform`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-black uppercase text-neutral-500 tracking-tighter group-hover:text-indigo-600 transition-colors text-center">{label}</span>
      </div>
    </Link>
  );
}
