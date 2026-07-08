"use client";

import { useCallback, useEffect, useState } from "react";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarClock, DollarSign, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";

type BudgetVarianceRecord = {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentageUsed: number;
  status: string;
};

type BudgetVarianceResponse = {
  data: BudgetVarianceRecord[];
  summary: {
    totalRecords: number;
    totalBudgeted: number;
    totalActual: number;
    totalVariance: number;
    overBudgetCount: number;
    nearLimitCount: number;
    onTrackCount: number;
    year: number;
  };
};

const columns: Column<BudgetVarianceRecord>[] = [
  { header: "Category", accessorKey: "category" },
  { header: "Budgeted", accessorKey: "budgeted", cell: (row) => formatCurrency(row.budgeted) },
  { header: "Actual", accessorKey: "actual", cell: (row) => formatCurrency(row.actual) },
  { header: "Variance", accessorKey: "variance", cell: (row) => formatCurrency(row.variance) },
  { header: "% Used", accessorKey: "percentageUsed", cell: (row) => `${row.percentageUsed.toFixed(2)}%` },
  {
    header: "Status",
    accessorKey: "status",
    cell: (row) => (
      <Badge variant={row.status === "Over Budget" ? "destructive" : row.status === "Near Limit" ? "secondary" : "outline"}>
        {row.status}
      </Badge>
    ),
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export default function BudgetVariancePage() {
  const currentYear = new Date().getFullYear();
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 15000,
  });
  const [year, setYear] = useState(String(currentYear));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BudgetVarianceResponse | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/reports/comprehensive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({
          reportType: "budget-variance",
          year: Number(year),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to load budget variance report");
      }

      setData({
        data: Array.isArray(result.data) ? result.data : result.data || [],
        summary: result.summary || {
          totalRecords: 0,
          totalBudgeted: 0,
          totalActual: 0,
          totalVariance: 0,
          overBudgetCount: 0,
          nearLimitCount: 0,
          onTrackCount: 0,
          year: Number(year),
        },
      });
    } catch (error) {
      console.error("Budget variance fetch error:", error);
      toast.error("Failed to load budget variance report");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport, liveRefreshVersion]);

  const summary = data?.summary;

  return (
    <ReportPageLayout
      title="Budget Variance"
      description="Compare approved budgets with actual expenditure by category."
      period={`Financial Year ${year}`}
      summary={
        summary ? (
          <>
            <ReportSummaryCard title="Budgeted" value={formatCurrency(summary.totalBudgeted)} icon={DollarSign} />
            <ReportSummaryCard title="Actual" value={formatCurrency(summary.totalActual)} icon={TrendingUp} />
            <ReportSummaryCard title="Variance" value={formatCurrency(summary.totalVariance)} icon={TrendingDown} />
            <ReportSummaryCard title="Over Budget" value={summary.overBudgetCount} icon={CalendarClock} />
            <ReportSummaryCard title="On Track" value={summary.onTrackCount} icon={CheckCircle2} />
          </>
        ) : null
      }
      filters={
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-40"
          />
          <Button onClick={() => void fetchReport()} disabled={loading}>
            {loading ? "Loading..." : "Generate Report"}
          </Button>
        </div>
      }
    >
      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          <DataTable
            title="Budget Variance Detail"
            data={data?.data || []}
            columns={columns}
            keyField="category"
            isLoading={loading}
            onRefresh={() => void fetchReport()}
            filters={{
              searchFields: ["category", "status"],
              enableDateFilter: false,
            }}
            emptyState={
              <div className="py-12 text-center text-muted-foreground">
                No budget variance data found for the selected year.
              </div>
            }
          />
        </CardContent>
      </Card>
    </ReportPageLayout>
  );
}
