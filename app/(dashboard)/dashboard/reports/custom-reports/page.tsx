// ============================================================================
// app/(dashboard)/reports/custom/page.tsx - Complete Custom Reports Page
// ============================================================================
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  FileText,
  TrendingUp,
  Calendar,
  Filter,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useReportLiveRefresh } from "@/lib/hooks/useReportLiveRefresh";
// Server actions replaced with API calls

// ============================================================================
// TYPES
// ============================================================================
interface ReportConfig {
  reportType: "cashflow" | "balance" | "profitloss";
  startDate: string;
  endDate: string;
  groupBy?: "category" | "branch" | "month";
  includedCategories?: string[];
  excludedCategories?: string[];
  branchIds?: string[];
  comparisonEnabled?: boolean;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function CustomReportsPage() {
  const liveRefreshVersion = useReportLiveRefresh({
    enabled: true,
    intervalMs: 15000,
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const hasLoadedRef = useRef(false);
  const [config, setConfig] = useState<ReportConfig>({
    reportType: "cashflow",
    startDate: new Date(new Date().getFullYear(), 0, 1)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    groupBy: "category",
  });
  const sourceSummary =
    "Sources: ledger postings · income and expenditure · cash flow · balance sheet · profit/loss";

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const handleGenerateReport = useCallback(async () => {
    setLoading(true);
    try {
      let response;

      if (config.reportType === "cashflow") {
        response = await fetch("/api/v1/reports/custom/cash-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            startDate: config.startDate,
            endDate: config.endDate,
            groupBy: config.groupBy,
            includedCategories: config.includedCategories,
            excludedCategories: config.excludedCategories,
            branchIds: config.branchIds,
          }),
        });
      } else if (config.reportType === "balance") {
        response = await fetch("/api/v1/reports/custom/balance-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            asOfDate: config.endDate,
            includedCategories: config.includedCategories,
            excludedCategories: config.excludedCategories,
            branchIds: config.branchIds,
          }),
        });
      } else if (config.reportType === "profitloss") {
        response = await fetch("/api/v1/reports/custom/profit-loss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            startDate: config.startDate,
            endDate: config.endDate,
            includedIncomeCategories: config.includedCategories,
            excludeCategories: config.excludedCategories,
            branchIds: config.branchIds,
            comparisonPeriod: config.comparisonEnabled
              ? {
                  startDate: config.comparisonStartDate,
                  endDate: config.comparisonEndDate,
                }
              : undefined,
          }),
        });
      }

      if (!response || !response.ok) {
        throw new Error("Failed to generate custom report");
      }

      const result = await response.json();
      setReportData(result.data);
      toast.success("Report generated successfully!");
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }

    if (!reportData) return;
    void handleGenerateReport();
  }, [handleGenerateReport, liveRefreshVersion, reportData]);

  useEffect(() => {
    if (reportData) {
      hasLoadedRef.current = true;
    }
  }, [reportData]);

  const handleDownloadJSON = () => {
    if (!reportData) {
      toast.error("No report data to download");
      return;
    }

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.reportType}-report-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded!");
  };

  const handleReset = () => {
    setConfig({
      reportType: "cashflow",
      startDate: new Date(new Date().getFullYear(), 0, 1)
        .toISOString()
        .split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      groupBy: "category",
    });
    setReportData(null);
    toast.info("Configuration reset");
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Custom Reports</h1>
          <p className="text-muted-foreground mt-1">
            Generate customized financial reports with advanced filtering
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{sourceSummary}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Configuration
            </CardTitle>
            <CardDescription>Customize your report parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Report Type */}
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select
                value={config.reportType}
                onValueChange={(value: any) =>
                  setConfig({ ...config, reportType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashflow">Cash Flow Statement</SelectItem>
                  <SelectItem value="balance">Balance Sheet</SelectItem>
                  <SelectItem value="profitloss">Profit & Loss</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={config.startDate}
                onChange={(e) =>
                  setConfig({ ...config, startDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={config.endDate}
                onChange={(e) =>
                  setConfig({ ...config, endDate: e.target.value })
                }
              />
            </div>

            {/* Grouping Options (for Cash Flow and P&L) */}
            {(config.reportType === "cashflow" ||
              config.reportType === "profitloss") && (
              <div className="space-y-2">
                <Label>Group By</Label>
                <Select
                  value={config.groupBy}
                  onValueChange={(value: any) =>
                    setConfig({ ...config, groupBy: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="branch">Branch</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Comparison Period (P&L only) */}
            {config.reportType === "profitloss" && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.comparisonEnabled}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        comparisonEnabled: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300"
                  />
                  <Label>Enable Comparison Period</Label>
                </div>

                {config.comparisonEnabled && (
                  <>
                    <Input
                      type="date"
                      placeholder="Comparison Start"
                      value={config.comparisonStartDate || ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          comparisonStartDate: e.target.value,
                        })
                      }
                    />
                    <Input
                      type="date"
                      placeholder="Comparison End"
                      value={config.comparisonEndDate || ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          comparisonEndDate: e.target.value,
                        })
                      }
                    />
                  </>
                )}
              </div>
            )}

            {/* Generate Button */}
            <Button
              className="w-full"
              onClick={handleGenerateReport}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Report Display Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Report Output
                </CardTitle>
                <CardDescription>
                  {reportData
                    ? reportData.reportType
                    : "Generate a report to view results"}
                </CardDescription>
              </div>
              {reportData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadJSON}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!reportData ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Report Generated
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Configure your report parameters and click "Generate Report"
                  to see the results here.
                </p>
              </div>
            ) : (
              <ReportDisplay data={reportData} config={config} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// REPORT DISPLAY COMPONENT
// ============================================================================
function ReportDisplay({ data, config }: { data: any; config: ReportConfig }) {
  if (config.reportType === "cashflow") {
    return <CashFlowDisplay data={data} />;
  } else if (config.reportType === "balance") {
    return <BalanceSheetDisplay data={data} />;
  } else if (config.reportType === "profitloss") {
    return <ProfitLossDisplay data={data} />;
  }
  return null;
}

// ============================================================================
// CASH FLOW DISPLAY
// ============================================================================
function CashFlowDisplay({ data }: { data: any }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Cash Inflow</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(data.summary.totalCashInflow)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Cash Outflow</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(data.summary.totalCashOutflow)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Cash Flow</CardDescription>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                data.summary.netCashFlow >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatCurrency(data.summary.netCashFlow)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grouped Data */}
      {data.groupedData && (
        <Tabs defaultValue="income">
          <TabsList>
            <TabsTrigger value="income">Income Breakdown</TabsTrigger>
            <TabsTrigger value="expenses">Expense Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="income" className="space-y-2">
            {data.groupedData.income?.map((item: any, idx: number) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 bg-muted rounded-lg"
              >
                <span className="font-medium">
                  {item.categoryName || item.branchName || item.month}
                </span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(item.total)}
                </span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="expenses" className="space-y-2">
            {data.groupedData.expenses?.map((item: any, idx: number) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 bg-muted rounded-lg"
              >
                <span className="font-medium">
                  {item.categoryName || item.branchName || item.month}
                </span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(item.total)}
                </span>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============================================================================
// BALANCE SHEET DISPLAY
// ============================================================================
function BalanceSheetDisplay({ data }: { data: any }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Balance Status */}
      <Card className={data.balanced ? "border-green-500" : "border-red-500"}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Balance Sheet Status</span>
            <span
              className={`text-sm ${
                data.balanced ? "text-green-600" : "text-red-600"
              }`}
            >
              {data.balanced ? "✓ Balanced" : "✗ Not Balanced"}
            </span>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Assets */}
      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span>Cash & Deposits:</span>
            <span className="font-semibold">
              {formatCurrency(data.assets.current.deposits)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Loans Receivable:</span>
            <span className="font-semibold">
              {formatCurrency(data.assets.current.loansReceivable)}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t font-bold">
            <span>Total Assets:</span>
            <span>{formatCurrency(data.assets.total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Liabilities */}
      <Card>
        <CardHeader>
          <CardTitle>Liabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span>Member Deposits Payable:</span>
            <span className="font-semibold">
              {formatCurrency(data.liabilities.current.memberDepositsPayable)}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t font-bold">
            <span>Total Liabilities:</span>
            <span>{formatCurrency(data.liabilities.total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Equity */}
      <Card>
        <CardHeader>
          <CardTitle>Equity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span>Retained Earnings:</span>
            <span className="font-semibold">
              {formatCurrency(data.equity.retainedEarnings)}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t font-bold">
            <span>Total Equity:</span>
            <span>{formatCurrency(data.equity.total)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// PROFIT & LOSS DISPLAY
// ============================================================================
function ProfitLossDisplay({ data }: { data: any }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Income</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(data.currentPeriod.income.total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(data.currentPeriod.expenses.total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Profit</CardDescription>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                data.currentPeriod.netProfit >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatCurrency(data.currentPeriod.netProfit)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Margin: {data.currentPeriod.profitMargin.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">Income by Category</TabsTrigger>
          <TabsTrigger value="expenses">Expenses by Category</TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="space-y-2">
          {data.currentPeriod.income.byCategory?.map(
            (cat: any, idx: number) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 bg-muted rounded-lg"
              >
                <span className="font-medium">{cat.categoryName}</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(cat.total)}
                </span>
              </div>
            )
          )}
        </TabsContent>

        <TabsContent value="expenses" className="space-y-2">
          {data.currentPeriod.expenses.byCategory?.map(
            (cat: any, idx: number) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 bg-muted rounded-lg"
              >
                <span className="font-medium">{cat.categoryName}</span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(cat.total)}
                </span>
              </div>
            )
          )}
        </TabsContent>
      </Tabs>

      {/* Comparison Period (if enabled) */}
      {data.comparisonPeriod && (
        <Card>
          <CardHeader>
            <CardTitle>Period Comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Income Variance:</span>
              <span
                className={
                  data.variance.income >= 0 ? "text-green-600" : "text-red-600"
                }
              >
                {formatCurrency(data.variance.income)} (
                {data.variance.incomePercent.toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span>Expense Variance:</span>
              <span
                className={
                  data.variance.expenses <= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {formatCurrency(data.variance.expenses)} (
                {data.variance.expensesPercent.toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t font-bold">
              <span>Net Profit Variance:</span>
              <span
                className={
                  data.variance.netProfit >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {formatCurrency(data.variance.netProfit)} (
                {data.variance.netProfitPercent.toFixed(2)}%)
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
