"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  PiggyBank, 
  PieChart, 
  Users, 
  TrendingUp, 
  FolderOpen,
  Landmark,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

interface DashboardStats {
  savings: {
    totalBalance: string;
    activeAccounts: number;
    dormantAccounts: number;
  };
  shares: {
    totalCapital: string;
    totalShares: number;
    totalShareholders: number;
  };
  members: {
    total: number;
    active: number;
  };
}

export default function ManagerReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 20000,
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/reports/manager/dashboard-stats", {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats, liveRefreshVersion]);

  const StatCard = ({ title, value, subValue, icon: Icon, trend }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading ? "..." : value}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {loading ? "Loading..." : subValue}
        </p>
      </CardContent>
    </Card>
  );

  const ReportLink = ({ title, description, href, badge }: any) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          {badge && (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button variant="link" className="p-0 h-auto text-sm text-primary" asChild>
          <a href={href}>View Report →</a>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manager Reports</h2>
          <p className="text-muted-foreground">
            Comprehensive overview and detailed reporting for management.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={fetchStats} variant="outline" size="sm">
            <TrendingUp className="mr-2 h-4 w-4" />
            Refresh Stats
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Savings Balance"
          value={stats?.savings?.totalBalance || "0"}
          subValue={`${stats?.savings?.activeAccounts || 0} active accounts`}
          icon={PiggyBank}
        />
        <StatCard
          title="Total Share Capital"
          value={stats?.shares?.totalCapital || "0"}
          subValue={`${stats?.shares?.totalShareholders || 0} shareholders`}
          icon={PieChart}
        />
        <StatCard
          title="Total Members"
          value={stats?.members?.total || 0}
          subValue={`${stats?.members?.active || 0} active members`}
          icon={Users}
        />
        <StatCard
          title="System Status"
          value="Healthy"
          subValue="All systems operational"
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-emerald-700" />
              <CardTitle className="text-lg">Savings & Shares Reports</CardTitle>
            </div>
            <CardDescription>
              Savings and share reporting has been moved into one dedicated hub with all reports from both categories.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <a href="/dashboard/reports/savings-shares-reports">
                <FolderOpen className="mr-2 h-4 w-4" />
                Open Savings & Shares Reports
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-slate-700" />
              <CardTitle className="text-lg">Manager Reports Scope</CardTitle>
            </div>
            <CardDescription>
              This page focuses on management summaries, loan reporting access, and financial statements.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use the dedicated savings and shares reports hub for listings, balances, dormancy, capital, concentration, transactions, and holder analysis.
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="loans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="loans">Loan Reports</TabsTrigger>
          <TabsTrigger value="financial">Financial Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="loans">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Loan reports are available in the API-backed loan reports area.</p>
              <Button variant="outline" className="mt-4" asChild>
                <a href="/dashboard/reports/loans">Open Loan Reports</a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

         <TabsContent value="financial">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             <ReportLink 
              title="Trial Balance" 
              description="Ending balances of all accounts." 
              href="/dashboard/reports/financial-statements/trial-balance"
              badge="Essential"
            />
             <ReportLink 
              title="Balance Sheet" 
              description="Financial position statement." 
              href="/dashboard/reports/financial-statements/balance-sheet"
              badge="Essential"
            />
             <ReportLink 
              title="Income Statement" 
              description="Profit and Loss statement." 
              href="/dashboard/reports/financial-statements/income-statement"
              badge="Essential"
            />
             <ReportLink 
              title="Cash Flow" 
              description="Cash inflows and outflows analysis." 
              href="/dashboard/reports/financial-statements/cash-flow"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
