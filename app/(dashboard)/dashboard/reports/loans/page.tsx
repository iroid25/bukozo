"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import LoanReportsClient from "./components/LoansReportsClient";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
export default function LoanReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loanSummary, setLoanSummary] = useState<any>(null);
  const [productPerformance, setProductPerformance] = useState<any[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<any[]>([]);
  const [ageAnalysis, setAgeAnalysis] = useState<any>(null);
  const [channelStats, setChannelStats] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: status === "authenticated",
    intervalMs: 20000,
  });
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const branchId = searchParams.get("branchId") || "";

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/branches", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }

      const branchData = await response.json();
      setBranches(branchData.data || []);
    } catch (err) {
      console.error("Error fetching branches:", err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (branchId) params.append("branchId", branchId);
      if (dateRange.from) params.append("startDate", dateRange.from.toISOString());
      if (dateRange.to) params.append("endDate", dateRange.to.toISOString());
      
      const query = params.toString() ? `?${params.toString()}` : "";

      // Fetch all loan data from new API endpoints
      const [summaryRes, performanceRes, trendsRes, ageRes, channelsRes] = await Promise.all([
        fetch(`/api/v1/reports/loans/summary${query}`, { cache: "no-store" }),
        fetch(`/api/v1/reports/loans/product-performance${query}`, { cache: "no-store" }),
        fetch(`/api/v1/reports/loans/monthly-trends${query ? `${query}&months=12` : "?months=12"}`, { cache: "no-store" }),
        fetch(`/api/v1/reports/loans/age-analysis${query}`, { cache: "no-store" }),
        fetch(`/api/v1/reports/loans/channel-stats${query}`, { cache: "no-store" }),
      ]);

      if (!summaryRes.ok || !performanceRes.ok || !trendsRes.ok || !ageRes.ok || !channelsRes.ok) {
        throw new Error("Failed to fetch loan data");
      }

      const summaryData = await summaryRes.json();
      const performanceData = await performanceRes.json();
      const trendsData = await trendsRes.json();
      const ageData = await ageRes.json();
      const channelsData = await channelsRes.json();

      setLoanSummary(summaryData.data);
      setProductPerformance(performanceData.data || []);
      setMonthlyTrends(trendsData.data || []);
      setAgeAnalysis(ageData.data);
      setChannelStats(channelsData.data);
    } catch (err) {
      console.error("Error fetching loan reports:", err);
      setError(err instanceof Error ? err.message : "Failed to load loan reports");
      toast.error("Failed to load loan reports");
    } finally {
      setLoading(false);
    }
  }, [branchId, dateRange]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      void fetchBranches();
    }
  }, [status, router, fetchBranches]);

  useEffect(() => {
    if (status !== "authenticated") return;

    void fetchData();
  }, [status, branchId, dateRange, liveRefreshVersion, fetchData]);

  if (status === "loading" || loading) {
    return <LoanReportsLoading />;
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Error Loading Reports</h2>
          <p className="text-muted-foreground">
            There was an error loading the loan reports. Please try again later.
          </p>
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <LoanReportsClient
      user={session.user}
      loanSummary={loanSummary}
      productPerformance={productPerformance}
      monthlyTrends={monthlyTrends}
      ageAnalysis={ageAnalysis}
      channelStats={channelStats}
      branches={branches}
      currentBranchId={branchId}
      dateRange={dateRange}
      setDateRange={setDateRange}
    />
  );
}

function LoanReportsLoading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-[280px]" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Statistics Cards Loading */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Loading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
