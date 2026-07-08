"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import FinancialReportsClient from "../components/FinancialReportsClient";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

export default function FinancialReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<any[]>([]);
  const refreshVersion = useReportLiveRefresh({
    enabled: status === "authenticated",
    intervalMs: 15000,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryRes, trendsRes] = await Promise.all([
        fetch("/api/v1/reports/financial/dashboard-summary", {
          cache: "no-store",
        }),
        fetch("/api/v1/reports/financial/dashboard-trends?months=12", {
          cache: "no-store",
        }),
      ]);

      if (!summaryRes.ok || !trendsRes.ok) {
        throw new Error("Failed to fetch financial data");
      }

      const summaryData = await summaryRes.json();
      const trendsData = await trendsRes.json();

      setFinancialSummary(summaryData.data);
      setMonthlyTrends(trendsData.data || []);
    } catch (err) {
      console.error("Error fetching financial reports:", err);
      setError(err instanceof Error ? err.message : "Failed to load financial reports");
      toast.error("Failed to load financial reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      void fetchData();
    }
  }, [fetchData, refreshVersion, router, status]);

  if (status === "loading" || loading) {
    return <FinancialReportsLoading />;
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">
            Error Loading Reports
          </h2>
          <p className="text-muted-foreground">
            There was an error loading the financial reports. Please try again
            later.
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

  if (!financialSummary) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold">
            No Financial Data Available
          </h2>
          <p className="text-muted-foreground">
            Unable to load financial summary.
          </p>
        </div>
      </div>
    );
  }

  if (!Array.isArray(monthlyTrends)) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold">No Trend Data Available</h2>
          <p className="text-muted-foreground">
            Unable to load monthly trends.
          </p>
        </div>
      </div>
    );
  }

  return (
    <FinancialReportsClient
      user={session?.user}
      financialSummary={financialSummary}
      monthlyTrends={monthlyTrends}
    />
  );
}

function FinancialReportsLoading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Statistics Cards Loading */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={`loading-card-${i}`}>
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

      {/* Bar Chart Loading */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
