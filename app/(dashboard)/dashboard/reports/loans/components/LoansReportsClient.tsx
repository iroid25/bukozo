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
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Percent,
  Printer,
  Building2,
} from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  AreaChart,
  Area,
  LabelList,
} from "recharts";

interface LoanSummary {
  totalLoans: number;
  totalDisbursed: number;
  totalOutstanding: number;
  totalRepaid: number;
  activeLoans: number;
  overdueLoans: number;
  repaidLoans: number;
  approvalRate: number;
  repaymentRate: number;
  defaultRate: number;
  averageLoanAmount: number;
  averageRepaymentPeriod: number;
}

interface LoanProductPerformance {
  name: string;
  totalApplications: number;
  approvedApplications: number;
  totalDisbursed: number;
  outstandingBalance: number;
  repaidAmount: number;
  approvalRate: number;
  repaymentRate: number;
}

interface MonthlyLoanTrend {
  month: string;
  year?: number;
  applicationsCount: number;
  approvedCount: number;
  disbursedAmount: number;
  repaymentsAmount: number;
  outstandingAmount: number;
}

interface LoanAgeAnalysis {
  range: string;
  count: number;
  totalAmount: number;
  outstandingAmount: number;
}

interface RepaymentChannelStats {
  channel: string;
  count: number;
  amount: number;
  percentage: number;
}

interface Props {
  user: any;
  loanSummary: LoanSummary;
  productPerformance: LoanProductPerformance[];
  monthlyTrends: MonthlyLoanTrend[];
  ageAnalysis: LoanAgeAnalysis[];
  channelStats: RepaymentChannelStats[];
  branches: any[];
  currentBranchId: string;
  dateRange: { from: Date; to: Date };
  setDateRange: (range: { from: Date; to: Date }) => void;
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
];
export default function LoansReportsClient({
  user,
  loanSummary,
  productPerformance,
  monthlyTrends,
  ageAnalysis,
  channelStats,
  branches,
  currentBranchId,
  dateRange,
  setDateRange,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isExporting, setIsExporting] = useState(false);

  // Handle branch change by updating URL
  const handleBranchChange = (branchId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (branchId === "all") {
      params.delete("branchId");
    } else {
      params.set("branchId", branchId);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  // Ensure all array props have default values
  const safeProductPerformance = Array.isArray(productPerformance) ? productPerformance : [];
  const safeMonthlyTrends = Array.isArray(monthlyTrends) ? monthlyTrends : [];
  const safeAgeAnalysis = Array.isArray(ageAnalysis) ? ageAnalysis : [];
  const safeChannelStats = Array.isArray(channelStats) ? channelStats : [];

  // Ensure loanSummary has default values
  const safeLoanSummary = loanSummary || {
    totalLoans: 0,
    totalDisbursed: 0,
    totalOutstanding: 0,
    totalRepaid: 0,
    activeLoans: 0,
    overdueLoans: 0,
    repaidLoans: 0,
    approvalRate: 0,
    repaymentRate: 0,
    defaultRate: 0,
    averageLoanAmount: 0,
    averageRepaymentPeriod: 0,
  };

  // Format currency
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null || isNaN(amount)) return "UGX 0";
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return "0.00%";
    return `${value.toFixed(2)}%`;
  };

  // Safe number display
  const safeNumber = (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return 0;
    return value;
  };

  // Export comprehensive loan report
  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("startDate", dateRange.from.toISOString());
      params.append("endDate", dateRange.to.toISOString());
      if (currentBranchId && currentBranchId !== "all") {
        params.append("branchId", currentBranchId);
      }
      
      const response = await fetch(`/api/v1/reports/loans/detailed?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch detailed loan report");
      const result = await response.json();
      const detailedLoans = result.data || [];

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = [
        ["Loan Reports Summary"],
        [
          `Period: ${format(dateRange.from, "MMM dd, yyyy")} - ${format(
            dateRange.to,
            "MMM dd, yyyy"
          )}`,
        ],
        ["Generated:", format(new Date(), "MMM dd, yyyy HH:mm:ss")],
        [""],
        ["LOAN OVERVIEW"],
        ["Total Loans", safeNumber(safeLoanSummary.totalLoans)],
        ["Total Disbursed", formatCurrency(safeLoanSummary.totalDisbursed)],
        ["Total Outstanding", formatCurrency(safeLoanSummary.totalOutstanding)],
        ["Total Repaid", formatCurrency(safeLoanSummary.totalRepaid)],
        [""],
        ["LOAN STATUS"],
        ["Active Loans", safeNumber(safeLoanSummary.activeLoans)],
        ["Overdue Loans", safeNumber(safeLoanSummary.overdueLoans)],
        ["Repaid Loans", safeNumber(safeLoanSummary.repaidLoans)],
        [""],
        ["PERFORMANCE METRICS"],
        ["Approval Rate", formatPercentage(safeLoanSummary.approvalRate)],
        ["Repayment Rate", formatPercentage(safeLoanSummary.repaymentRate)],
        ["Default Rate", formatPercentage(safeLoanSummary.defaultRate)],
        ["Average Loan Amount", formatCurrency(safeLoanSummary.averageLoanAmount)],
        [
          "Average Repayment Period",
          `${safeNumber(safeLoanSummary.averageRepaymentPeriod)} days`,
        ],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Loan Summary");

      // Product Performance Sheet
      if (safeProductPerformance.length > 0) {
        const productData = safeProductPerformance.map((product) => ({
          "Product Name": product.name,
          "Total Applications": safeNumber(product.totalApplications),
          "Approved Applications": safeNumber(product.approvedApplications),
          "Total Disbursed": safeNumber(product.totalDisbursed),
          "Outstanding Balance": safeNumber(product.outstandingBalance),
          "Repaid Amount": safeNumber(product.repaidAmount),
          "Approval Rate": formatPercentage(product.approvalRate),
          "Repayment Rate": formatPercentage(product.repaymentRate),
        }));

        const productSheet = XLSX.utils.json_to_sheet(productData);
        XLSX.utils.book_append_sheet(
          workbook,
          productSheet,
          "Product Performance"
        );
      }

      // Monthly Trends Sheet
      if (safeMonthlyTrends.length > 0) {
        const trendsData = safeMonthlyTrends.map((trend) => ({
          Month: trend.month,
          Year: trend.year,
          "Applications Count": safeNumber(trend.applicationsCount),
          "Approved Count": safeNumber(trend.approvedCount),
          "Disbursed Amount": safeNumber(trend.disbursedAmount),
          "Repayments Amount": safeNumber(trend.repaymentsAmount),
          "Outstanding Amount": safeNumber(trend.outstandingAmount),
        }));

        const trendsSheet = XLSX.utils.json_to_sheet(trendsData);
        XLSX.utils.book_append_sheet(workbook, trendsSheet, "Monthly Trends");
      }

      // Age Analysis Sheet
      if (safeAgeAnalysis.length > 0) {
        const ageData = safeAgeAnalysis.map((age) => ({
          "Age Range": age.range,
          "Loan Count": safeNumber(age.count),
          "Total Amount": safeNumber(age.totalAmount),
          "Outstanding Amount": safeNumber(age.outstandingAmount),
        }));

        const ageSheet = XLSX.utils.json_to_sheet(ageData);
        XLSX.utils.book_append_sheet(workbook, ageSheet, "Loan Age Analysis");
      }

      // Repayment Channels Sheet
      if (safeChannelStats.length > 0) {
        const channelData = safeChannelStats.map((channel) => ({
          Channel: channel.channel,
          "Transaction Count": safeNumber(channel.count),
          "Total Amount": safeNumber(channel.amount),
          Percentage: formatPercentage(channel.percentage),
        }));

        const channelSheet = XLSX.utils.json_to_sheet(channelData);
        XLSX.utils.book_append_sheet(
          workbook,
          channelSheet,
          "Repayment Channels"
        );
      }

      // Detailed Loans Sheet
      if (detailedLoans.length > 0) {
        const detailedData = detailedLoans.map((loan: any) => ({
          "Loan ID": loan.loanId,
          "Member Name": loan.memberName,
          "Member Email": loan.memberEmail,
          "Member Phone": loan.memberPhone,
          "Loan Product": loan.loanProduct,
          "Amount Granted": safeNumber(loan.amountGranted),
          "Interest Rate": formatPercentage(loan.interestRate),
          "Total Amount Due": safeNumber(loan.totalAmountDue),
          "Outstanding Balance": safeNumber(loan.outstandingBalance),
          "Amount Paid": safeNumber(loan.amountPaid),
          Status: loan.status,
          "Disbursement Date": loan.disbursementDate
            ? format(new Date(loan.disbursementDate), "yyyy-MM-dd")
            : "N/A",
          "Due Date": loan.dueDate
            ? format(new Date(loan.dueDate), "yyyy-MM-dd")
            : "N/A",
          "Disbursed By": loan.disbursedBy,
          Branch: loan.branch,
          "Repayment Count": safeNumber(loan.repaymentCount),
          "Last Repayment": loan.lastRepaymentDate
            ? format(new Date(loan.lastRepaymentDate), "yyyy-MM-dd")
            : "N/A",
          "Days Past Due": safeNumber(loan.daysPastDue),
        }));

        const detailedSheet = XLSX.utils.json_to_sheet(detailedData);
        XLSX.utils.book_append_sheet(workbook, detailedSheet, "Detailed Loans");
      }

      // Generate filename
      const fileName = `Loan_Report_${format(
        dateRange.from,
        "yyyy-MM-dd"
      )}_to_${format(dateRange.to, "yyyy-MM-dd")}.xlsx`;

      // Export file
      XLSX.writeFile(workbook, fileName);

      toast.success("Loan report exported successfully", {
        description: `Loan report exported to ${fileName}`,
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

  // Prepare chart data with safe values
  const loanStatusData = [
    { name: "Active", value: safeNumber(safeLoanSummary.activeLoans), color: "#0088FE" },
    { name: "Overdue", value: safeNumber(safeLoanSummary.overdueLoans), color: "#FF8042" },
    { name: "Repaid", value: safeNumber(safeLoanSummary.repaidLoans), color: "#00C49F" },
  ];

  const performanceMetrics = [
    {
      name: "Approval Rate",
      value: safeNumber(safeLoanSummary.approvalRate),
      color: "#0088FE",
    },
    {
      name: "Repayment Rate",
      value: safeNumber(safeLoanSummary.repaymentRate),
      color: "#00C49F",
    },
    {
      name: "Default Rate",
      value: safeNumber(safeLoanSummary.defaultRate),
      color: "#FF8042",
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Print Only Header */}
      <div className="hidden print:block text-center border-b-2 border-neutral-900 pb-6 mb-4">
        <h1 className="text-4xl font-black uppercase tracking-widest text-[#1e1b4b]">
          Bukonzo Teachers SACCO
        </h1>
        <div className="mt-4 space-y-2">
          <h2 className="text-2xl font-bold text-neutral-800 uppercase tracking-tight">
            Comprehensive Loan Reports Summary
          </h2>
          <p className="text-lg font-semibold text-neutral-700">
            REPORTING PERIOD: {format(dateRange.from, "PPP")} - {format(dateRange.to, "PPP")}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-neutral-500 font-medium">
            <span>Generated: {format(new Date(), "PPpp")}</span>
            <span>•</span>
            <span>Official System Report</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loan Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive loan analytics and performance reporting
          </p>
        </div>
        <div className="flex items-center gap-4 print:hidden">
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
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button onClick={handleExportReport} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export Report"}
          </Button>
        </div>
      </div>

      {/* Global Filters */}
      <div className="flex flex-col md:flex-row gap-4 print:hidden">
         {/* Branch Selector - Visible to ADMIN only */}
         {user.role === "ADMIN" && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={currentBranchId || "all"} onValueChange={handleBranchChange}>
              <SelectTrigger className="w-[200px] h-10 bg-white shadow-sm border-neutral-200">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
         )}
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {safeNumber(safeLoanSummary.totalLoans).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total loans disbursed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Disbursed
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(safeLoanSummary.totalDisbursed)}
            </div>
            <p className="text-xs text-muted-foreground">
              Amount disbursed to members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Outstanding Balance
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {formatCurrency(safeLoanSummary.totalOutstanding)}
            </div>
            <p className="text-xs text-muted-foreground">
              Amount yet to be repaid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Repaid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(safeLoanSummary.totalRepaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              Amount successfully repaid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {safeNumber(safeLoanSummary.activeLoans)}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active loans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Loans</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {safeNumber(safeLoanSummary.overdueLoans)}
            </div>
            <p className="text-xs text-muted-foreground">Loans past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <Percent className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {formatPercentage(safeLoanSummary.approvalRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              Application approval rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Repayment Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatPercentage(safeLoanSummary.repaymentRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              Successful repayment rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Products & Trends</TabsTrigger>
          <TabsTrigger value="demographics">Age Analysis & Channels</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Loan Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={loanStatusData}
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
                  {loanStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `${Number(value).toFixed(2)}%`}
                />
                <Bar dataKey="value" fill="#0088FE">
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(value: any) => `${Number(value).toFixed(1)}%`}
                    style={{ fontSize: "12px", fill: "#666" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </TabsContent>

    {/* DEMOGRAPHICS TAB */}
        <TabsContent value="demographics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Loan Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {safeMonthlyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={safeMonthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="disbursedAmount"
                    stackId="1"
                    stroke="#0088FE"
                    fill="#0088FE"
                    name="Disbursed"
                  />
                  <Area
                    type="monotone"
                    dataKey="repaymentsAmount"
                    stackId="2"
                    stroke="#00C49F"
                    fill="#00C49F"
                    name="Repayments"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No monthly trend data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan Age Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {safeAgeAnalysis.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={safeAgeAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#FFBB28" name="Loan Count">
                    <LabelList
                      dataKey="count"
                      position="top"
                      style={{ fontSize: "12px", fill: "#666" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No age analysis data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TabsContent>

    {/* PERFORMANCE TAB */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Product Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {safeProductPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={safeProductPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="totalDisbursed" fill="#0088FE" name="Disbursed">
                    <LabelList
                      dataKey="totalDisbursed"
                      position="top"
                      formatter={(val: number) => formatCurrency(val)}
                      style={{ fontSize: "10px", fill: "#666" }}
                    />
                  </Bar>
                  <Bar dataKey="repaidAmount" fill="#00C49F" name="Repaid">
                    <LabelList
                      dataKey="repaidAmount"
                      position="top"
                      formatter={(val: number) => formatCurrency(val)}
                      style={{ fontSize: "10px", fill: "#666" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No product performance data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repayment Channels</CardTitle>
          </CardHeader>
          <CardContent>
            {safeChannelStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={safeChannelStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ channel, percentage }) =>
                      `${channel} ${safeNumber(percentage).toFixed(1)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {safeChannelStats.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No repayment channel data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applications vs Approvals Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {safeMonthlyTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={safeMonthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="applicationsCount"
                  stroke="#FF8042"
                  name="Applications"
                  strokeWidth={2}
                />
            <Line
              type="monotone"
              dataKey="approvedCount"
              stroke="#00C49F"
              name="Approved"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
          No trend data available
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>
</Tabs>
</div>
);
}
