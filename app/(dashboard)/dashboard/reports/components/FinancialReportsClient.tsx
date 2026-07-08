"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import {
  CalendarIcon,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Banknote,
  AlertTriangle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Link from "next/link";

interface FinancialSummary {
  deposits: {
    today: number;
    thisMonth: number;
    total: number;
    count: number;
  };
  withdrawals: {
    today: number;
    thisMonth: number;
    total: number;
    count: number;
  };
  loans: {
    totalDisbursed: number;
    totalOutstanding: number;
    totalRepaid: number;
    activeLoans: number;
    overdueLoans: number;
  };
  netFlow: {
    today: number;
    thisMonth: number;
    total: number;
  };
}

const emptyFinancialSummary: FinancialSummary = {
  deposits: { today: 0, thisMonth: 0, total: 0, count: 0 },
  withdrawals: { today: 0, thisMonth: 0, total: 0, count: 0 },
  loans: {
    totalDisbursed: 0,
    totalOutstanding: 0,
    totalRepaid: 0,
    activeLoans: 0,
    overdueLoans: 0,
  },
  netFlow: { today: 0, thisMonth: 0, total: 0 },
};

function normalizeFinancialSummary(
  summary: Partial<FinancialSummary> | null | undefined,
): FinancialSummary {
  return {
    deposits: {
      ...emptyFinancialSummary.deposits,
      ...summary?.deposits,
    },
    withdrawals: {
      ...emptyFinancialSummary.withdrawals,
      ...summary?.withdrawals,
    },
    loans: {
      ...emptyFinancialSummary.loans,
      ...summary?.loans,
    },
    netFlow: {
      ...emptyFinancialSummary.netFlow,
      ...summary?.netFlow,
    },
  };
}

interface Props {
  user: any;
  financialSummary: FinancialSummary;
  monthlyTrends: any[];
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function FinancialReportsClient({
  user,
  financialSummary,
  monthlyTrends,
}: Props) {
  const safeFinancialSummary = normalizeFinancialSummary(financialSummary);

  // Safety check for data
  if (!monthlyTrends) {
    return (
      <div className="container mx-auto py-6">
        <div>Loading financial data...</div>
      </div>
    );
  }

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [reportType, setReportType] = useState<string>("summary");
  const [isExporting, setIsExporting] = useState(false);

  // Format currency
  const formatCurrency = (amount: number) => {
    const numAmount = Number(amount) || 0;
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  // Export comprehensive financial report
  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });

      const response = await fetch(
        `/api/v1/reports/financial/transactions?${params.toString()}`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch transaction export data");
      }

      const transactionsResult = await response.json();
      const transactions = transactionsResult.data || {
        deposits: [],
        withdrawals: [],
        loanRepayments: [],
      };

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = [
        ["Financial Summary Report"],
        [
          `Period: ${format(dateRange.from, "MMM dd, yyyy")} - ${format(
            dateRange.to,
            "MMM dd, yyyy"
          )}`,
        ],
        [""],
        ["DEPOSITS"],
        ["Today", formatCurrency(financialSummary.deposits.today)],
        ["This Month", formatCurrency(financialSummary.deposits.thisMonth)],
        ["Total", formatCurrency(financialSummary.deposits.total)],
        ["Total Count", String(financialSummary.deposits.count)],
        [""],
        ["WITHDRAWALS"],
        ["Today", formatCurrency(financialSummary.withdrawals.today)],
        ["This Month", formatCurrency(financialSummary.withdrawals.thisMonth)],
        ["Total", formatCurrency(financialSummary.withdrawals.total)],
        ["Total Count", String(financialSummary.withdrawals.count)],
        [""],
        ["LOANS"],
        [
          "Total Disbursed",
          formatCurrency(financialSummary.loans.totalDisbursed),
        ],
        [
          "Total Outstanding",
          formatCurrency(financialSummary.loans.totalOutstanding),
        ],
        ["Total Repaid", formatCurrency(financialSummary.loans.totalRepaid)],
        ["Active Loans", String(financialSummary.loans.activeLoans)],
        ["Overdue Loans", String(financialSummary.loans.overdueLoans)],
        [""],
        ["NET CASH FLOW"],
        ["Today", formatCurrency(financialSummary.netFlow.today)],
        ["This Month", formatCurrency(financialSummary.netFlow.thisMonth)],
        ["Total", formatCurrency(financialSummary.netFlow.total)],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      // Deposits Sheet
      if (transactions.deposits && transactions.deposits.length > 0) {
        const depositsData = transactions.deposits.map((deposit: any) => ({
          "Transaction Ref": deposit.transaction?.transactionRef || "N/A",
          Date: format(new Date(deposit.depositDate), "yyyy-MM-dd"),
          "Member Name": deposit.member?.user?.name || "N/A",
          "Member Email": deposit.member?.user?.email || "N/A",
          "Account Number": deposit.account?.accountNumber || "N/A",
          "Account Type": deposit.account?.accountType?.name || "N/A",
          Amount: Number(deposit.amount) || 0,
          Channel: deposit.channel || "N/A",
          "Mobile Money Ref": deposit.mobileMoneyRef || "N/A",
          Branch: deposit.account?.branch?.name || "N/A",
          "Processed By": deposit.handler?.name || "N/A",
          "Handler Role": deposit.handler?.role || "N/A",
          Description: deposit.transaction?.description || "N/A",
          Status: deposit.transaction?.status || "N/A",
        }));

        const depositsSheet = XLSX.utils.json_to_sheet(depositsData);
        XLSX.utils.book_append_sheet(workbook, depositsSheet, "Deposits");
      }

      // Withdrawals Sheet
      if (transactions.withdrawals && transactions.withdrawals.length > 0) {
        const withdrawalsData = transactions.withdrawals.map(
          (withdrawal: any) => ({
            "Transaction Ref": withdrawal.transaction?.transactionRef || "N/A",
            Date: format(new Date(withdrawal.withdrawalDate), "yyyy-MM-dd"),
            "Member Name": withdrawal.member?.user?.name || "N/A",
            "Member Email": withdrawal.member?.user?.email || "N/A",
            "Account Number": withdrawal.account?.accountNumber || "N/A",
            "Account Type": withdrawal.account?.accountType?.name || "N/A",
            Amount: Number(withdrawal.amount) || 0,
            Channel: withdrawal.channel || "N/A",
            "Mobile Money Ref": withdrawal.mobileMoneyRef || "N/A",
            Branch: withdrawal.account?.branch?.name || "N/A",
            "Processed By": withdrawal.handler?.name || "N/A",
            "Handler Role": withdrawal.handler?.role || "N/A",
            Description: withdrawal.transaction?.description || "N/A",
            Status: withdrawal.transaction?.status || "N/A",
          })
        );

        const withdrawalsSheet = XLSX.utils.json_to_sheet(withdrawalsData);
        XLSX.utils.book_append_sheet(workbook, withdrawalsSheet, "Withdrawals");
      }

      // Loan Repayments Sheet
      if (
        transactions.loanRepayments &&
        transactions.loanRepayments.length > 0
      ) {
        const repaymentsData = transactions.loanRepayments.map(
          (repayment: any) => ({
            "Repayment Date": format(
              new Date(repayment.repaymentDate),
              "yyyy-MM-dd"
            ),
            "Member Name": repayment.loan?.member?.user?.name || "N/A",
            "Member Email": repayment.loan?.member?.user?.email || "N/A",
            "Loan ID": repayment.loanId || "N/A",
            Amount: Number(repayment.amount) || 0,
            Channel: repayment.channel || "N/A",
            "Mobile Money Ref": repayment.mobileMoneyRef || "N/A",
            "Processed By": repayment.handler?.name || "N/A",
            "Handler Role": repayment.handler?.role || "N/A",
          })
        );

        const repaymentsSheet = XLSX.utils.json_to_sheet(repaymentsData);
        XLSX.utils.book_append_sheet(
          workbook,
          repaymentsSheet,
          "Loan Repayments"
        );
      }

      // Monthly Trends Sheet
      if (monthlyTrends && monthlyTrends.length > 0) {
        const trendsSheet = XLSX.utils.json_to_sheet(monthlyTrends);
        XLSX.utils.book_append_sheet(workbook, trendsSheet, "Monthly Trends");
      }

      // Generate filename
      const fileName = `Financial_Report_${format(
        dateRange.from,
        "yyyy-MM-dd"
      )}_to_${format(dateRange.to, "yyyy-MM-dd")}.xlsx`;

      // Export file
      XLSX.writeFile(workbook, fileName);

      toast.success("Report exported successfully", {
        description: `Financial report exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Prepare chart data with safety checks
  const pieChartData = [
    {
      name: "Deposits",
      value: Number(safeFinancialSummary.deposits.total) || 0,
      color: "#0088FE",
    },
    {
      name: "Withdrawals",
      value: Number(safeFinancialSummary.withdrawals.total) || 0,
      color: "#00C49F",
    },
    {
      name: "Loans Disbursed",
      value: Number(safeFinancialSummary.loans.totalDisbursed) || 0,
      color: "#FFBB28",
    },
    {
      name: "Loans Repaid",
      value: Number(safeFinancialSummary.loans.totalRepaid) || 0,
      color: "#FF8042",
    },
  ];

  // Safe monthly trends data
  const safeMonthlyTrends = Array.isArray(monthlyTrends)
    ? monthlyTrends.map((trend) => ({
        month: trend.month || "N/A",
        deposits: Number(trend.deposits) || 0,
        withdrawals: Number(trend.withdrawals) || 0,
        loans: Number(trend.loans) || 0,
        netFlow: Number(trend.netFlow) || 0,
      }))
    : [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive financial analytics and reporting dashboard
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[280px] justify-start text-left font-normal bg-transparent"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) =>
                  range && setDateRange(range as { from: Date; to: Date })
                }
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button onClick={handleExportReport} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export Report"}
          </Button>
        </div>
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/dashboard/deposits" className="cursor-pointer">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Deposits
              </CardTitle>

              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                {formatCurrency(safeFinancialSummary.deposits.total)}
                </div>
                <p className="text-xs text-muted-foreground">
                {Number(safeFinancialSummary.deposits.count)} transactions
                </p>
              </CardContent>
            </Card>
        </Link>
        <Link href="/dashboard/withdraw-test" className="cursor-pointer">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Withdrawals
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">
                {formatCurrency(safeFinancialSummary.withdrawals.total)}
                </div>
                <p className="text-xs text-muted-foreground">
                {Number(safeFinancialSummary.withdrawals.count)} transactions
                </p>
              </CardContent>
            </Card>
        </Link>
        <Link href="/dashboard/" className="cursor-pointer">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Net Cash Flow
              </CardTitle>
              <DollarSign
                className={`h-4 w-4 ${
                  (Number(financialSummary.netFlow.total) || 0) >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              />
            </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                  (Number(safeFinancialSummary.netFlow.total) || 0) >= 0
                    ? "text-green-700"
                    : "text-red-700"
                }`}
                >
                {formatCurrency(safeFinancialSummary.netFlow.total)}
                </div>
                <p className="text-xs text-muted-foreground">
                Total inflow minus outflow
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/loans" className="cursor-pointer">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Loans
              </CardTitle>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                {Number(safeFinancialSummary.loans.activeLoans)}
                </div>
                <p className="text-xs text-muted-foreground">
                {formatCurrency(safeFinancialSummary.loans.totalOutstanding)}{" "}
                outstanding
                </p>
              </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/deposits" className="cursor-pointer">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Deposits
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                {formatCurrency(safeFinancialSummary.deposits.today)}
                </div>
              <p className="text-xs text-muted-foreground">
                Today's deposit activity
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/withdraw-test" className="cursor-pointer">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Withdrawals
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">
                {formatCurrency(safeFinancialSummary.withdrawals.today)}
                </div>
              <p className="text-xs text-muted-foreground">
                Today's withdrawal activity
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/loans" className="cursor-pointer">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Loans Disbursed
              </CardTitle>
              <Banknote className="h-4 w-4 text-purple-600" />
            </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-700">
                {formatCurrency(safeFinancialSummary.loans.totalDisbursed)}
                </div>
              <p className="text-xs text-muted-foreground">
                Total amount disbursed
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/loans" className="cursor-pointer">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Overdue Loans
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-700">
                {Number(safeFinancialSummary.loans.overdueLoans)}
                </div>
              <p className="text-xs text-muted-foreground">
                Require immediate attention
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={safeMonthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="deposits"
                  stroke="#0088FE"
                  name="Deposits"
                />
                <Line
                  type="monotone"
                  dataKey="withdrawals"
                  stroke="#00C49F"
                  name="Withdrawals"
                />
                <Line
                  type="monotone"
                  dataKey="netFlow"
                  stroke="#FFBB28"
                  name="Net Flow"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Transaction Volume */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Transaction Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={safeMonthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="deposits" fill="#0088FE" name="Deposits" />
              <Bar dataKey="withdrawals" fill="#00C49F" name="Withdrawals" />
              <Bar dataKey="loans" fill="#FFBB28" name="Loans" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
