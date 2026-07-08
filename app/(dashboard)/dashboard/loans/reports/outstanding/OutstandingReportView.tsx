// FILE: app/dashboard/loans/reports/outstanding/OutstandingReportView.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  Briefcase,
  Percent,
  Filter,
  Search,
  Calendar,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface OutstandingLoan {
  loanId: string;
  memberName: string;
  memberNumber: string;
  memberPhone: string;
  loanProduct: string;
  principalDue: number;
  interestDue: number;
  penaltyDue: number;
  totalDue: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingPenalty: number;
  totalOutstanding: number;
  loanOfficer: string;
  branch: string;
  status: string;
  daysInArrears: number;
  agingBracket: string;
}

interface OutstandingData {
  loans: OutstandingLoan[];
  summary: {
    totalLoans: number;
    totalPrincipalDue: number;
    totalInterestDue: number;
    totalPenaltyDue: number;
    totalDue: number;
    totalOutstandingPrincipal: number;
    totalOutstandingInterest: number;
    totalOutstandingPenalty: number;
    totalOutstanding: number;
    percentageRecovered: number;
  };
}

interface OutstandingReportViewProps {
  userRole: string;
  initialBranchId?: string;
}

export default function OutstandingReportView({
  userRole,
  initialBranchId,
}: OutstandingReportViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [data, setData] = useState<OutstandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");

  // ✅ Fetch filter options (officers)
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch("/api/v1/users?role=LOANOFFICER", {
          cache: "no-store",
        });
        const result = await response.json();
        if (result.success) {
          setFilterOfficers(result.data);
        }
      } catch (error) {
        console.error("Error fetching officer options:", error);
      }
    };
    fetchOptions();
  }, []);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all"
  );
  const [startDate, setStartDate] = useState(
    searchParams.get("startDate") || ""
  );
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
  const [agingFilter, setAgingFilter] = useState<string>("all");

  // Calculate PAR Metrics
  const parMetrics = {
    current: data?.loans.filter((l) => l.agingBracket === "Current") || [],
    days30: data?.loans.filter((l) => l.agingBracket === "1 - 30 Days") || [],
    days60: data?.loans.filter((l) => l.agingBracket === "31 - 60 Days") || [],
    days90: data?.loans.filter((l) => l.agingBracket === "61 - 90 Days") || [],
    days90Plus: data?.loans.filter((l) => l.agingBracket === "90+ Days") || [],
  };

  const calculateTotal = (loans: OutstandingLoan[]) =>
    loans.reduce((sum, l) => sum + l.totalOutstanding, 0);

  // ✅ Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/outstanding${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error || "Failed to fetch data");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("An error occurred while fetching data");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Re-fetch when URL params change
  useEffect(() => {
    fetchData();
  }, [searchParams]);

  // Apply filters
  const handleApplyFilters = () => {
    const params = new URLSearchParams(searchParams);
    if (statusFilter !== "all") params.set("status", statusFilter);
    else params.delete("status");
    
    if (startDate) params.set("startDate", startDate);
    else params.delete("startDate");
    
    if (endDate) params.set("endDate", endDate);
    else params.delete("endDate");

    router.push(`${pathname}?${params.toString()}`);
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
    router.push(pathname);
  };

  const columns: Column<OutstandingLoan>[] = [
    {
      header: "Member",
      accessorKey: "memberName",
      cell: (row: OutstandingLoan) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.memberName}</span>
          <span className="text-xs text-muted-foreground">
            {row.memberNumber}
          </span>
        </div>
      ),
    },
    {
      header: "Phone",
      accessorKey: "memberPhone",
      cell: (row: OutstandingLoan) => (
        <span className="text-sm">{row.memberPhone}</span>
      ),
    },
    {
      header: "Product",
      accessorKey: "loanProduct",
      cell: (row: OutstandingLoan) => (
        <Badge variant="outline" className="text-[10px] sm:text-xs">
          {row.loanProduct}
        </Badge>
      ),
    },
    {
      header: "Disbursed amount",
      accessorKey: "principalDue",
      cell: (row: OutstandingLoan) => (
        <span className="font-semibold">{formatCurrency(row.principalDue)}</span>
      ),
    },
    {
      header: "Interest",
      accessorKey: "interestDue",
      cell: (row: OutstandingLoan) => (
        <span className="font-semibold">{formatCurrency(row.interestDue)}</span>
      ),
    },
    {
      header: "Outstanding P",
      accessorKey: "outstandingPrincipal",
      cell: (row: OutstandingLoan) => (
        <span className="font-semibold text-orange-600">
          {formatCurrency(row.outstandingPrincipal)}
        </span>
      ),
    },
    {
      header: "Outstanding I",
      accessorKey: "outstandingInterest",
      cell: (row: OutstandingLoan) => (
        <span className="font-semibold text-orange-500">
          {formatCurrency(row.outstandingInterest)}
        </span>
      ),
    },
    {
      header: "Outstanding Pen.",
      accessorKey: "outstandingPenalty",
      cell: (row: OutstandingLoan) => (
        <span className="font-semibold text-red-600">
          {formatCurrency(row.outstandingPenalty)}
        </span>
      ),
    },
    {
      header: "Outstanding Total",
      accessorKey: "totalOutstanding",
      cell: (row: OutstandingLoan) => (
        <div className="flex flex-col min-w-[120px]">
          <span className="font-bold text-orange-600">
            {formatCurrency(row.totalOutstanding)}
          </span>
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{
                width: `${Math.min(
                  100,
                  ((row.totalDue - row.totalOutstanding) / row.totalDue) * 100
                ).toFixed(1)}%`,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      header: "Officer",
      accessorKey: "loanOfficer",
      cell: (row: OutstandingLoan) => row.loanOfficer,
    },
    {
      header: "Branch",
      accessorKey: "branch",
      cell: (row: OutstandingLoan) => row.branch,
    },
    {
      header: "Days Overdue",
      accessorKey: "daysInArrears",
      cell: (row: OutstandingLoan) => (
        <span
          className={`font-semibold ${
            row.daysInArrears > 0 ? "text-red-600" : "text-green-600"
          }`}
        >
          {row.daysInArrears}
        </span>
      ),
    },
    {
      header: "Bracket",
      accessorKey: "agingBracket",
      cell: (row: OutstandingLoan) => (
        <Badge
          variant="outline"
          className={`whitespace-nowrap ${
            row.agingBracket === "Current"
              ? "bg-green-50 text-green-700 border-green-200"
              : row.agingBracket === "90+ Days"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-yellow-50 text-yellow-700 border-yellow-200"
          }`}
        >
          {row.agingBracket}
        </Badge>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: OutstandingLoan) => (
        <Badge variant={row.status === "OVERDUE" ? "destructive" : "secondary"}>
          {row.status}
        </Badge>
      ),
    },
  ];

  // Apply filters
  // const handleApplyFilters = () => { // This was moved above
  //   const params = new URLSearchParams();
  //   if (statusFilter !== "all") params.set("status", statusFilter);
  //   if (startDate) params.set("startDate", startDate);
  //   if (endDate) params.set("endDate", endDate);
  //   router.push(`/dashboard/loans/reports/outstanding?${params.toString()}`);
  // };

  // Clear filters
  // const handleClearFilters = () => { // This was moved above
  //   setSearchTerm("");
  //   setStatusFilter("all");
  //   setStartDate("");
  //   setEndDate("");
  //   router.push("/dashboard/loans/reports/outstanding");
  // };

  const handleExport = async (filteredData: OutstandingLoan[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const wb = XLSX.utils.book_new();

      // Calculate summary for filtered data
      const filteredSummary = {
        totalLoans: filteredData.length,
        totalPrincipalDue: filteredData.reduce(
          (sum, loan) => sum + loan.principalDue,
          0
        ),
        totalInterestDue: filteredData.reduce(
          (sum, loan) => sum + loan.interestDue,
          0
        ),
        totalPenaltyDue: filteredData.reduce(
          (sum, loan) => sum + loan.penaltyDue,
          0
        ),
        totalDue: filteredData.reduce((sum, loan) => sum + loan.totalDue, 0),
        totalOutstandingPrincipal: filteredData.reduce(
          (sum, loan) => sum + loan.outstandingPrincipal,
          0
        ),
        totalOutstandingInterest: filteredData.reduce(
          (sum, loan) => sum + loan.outstandingInterest,
          0
        ),
        totalOutstandingPenalty: filteredData.reduce(
          (sum, loan) => sum + loan.outstandingPenalty,
          0
        ),
        totalOutstanding: filteredData.reduce(
          (sum, loan) => sum + loan.totalOutstanding,
          0
        ),
      };

      // Summary sheet
      const summaryData = [
        { Metric: "Total Loans", Value: filteredSummary.totalLoans },
        {
          Metric: "Total Principal Due",
          Value: filteredSummary.totalPrincipalDue,
        },
        {
          Metric: "Total Interest Due",
          Value: filteredSummary.totalInterestDue,
        },
        { Metric: "Total Penalty Due", Value: filteredSummary.totalPenaltyDue },
        { Metric: "Total Due", Value: filteredSummary.totalDue },
        {
          Metric: "Total Outstanding Principal",
          Value: filteredSummary.totalOutstandingPrincipal,
        },
        {
          Metric: "Total Outstanding Interest",
          Value: filteredSummary.totalOutstandingInterest,
        },
        {
          Metric: "Total Outstanding Penalty",
          Value: filteredSummary.totalOutstandingPenalty,
        },
        {
          Metric: "Total Outstanding",
          Value: filteredSummary.totalOutstanding,
        },
      ];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // Loans sheet
      const loansData = filteredData.map((loan) => ({
        Member: loan.memberName,
        "Member Number": loan.memberNumber,
        Phone: loan.memberPhone,
        Product: loan.loanProduct,
        "Disbursed Amount": loan.principalDue,
        Interest: loan.interestDue,
        "Outstanding Principal": loan.outstandingPrincipal,
        "Outstanding Interest": loan.outstandingInterest,
        "Outstanding Penalty": loan.outstandingPenalty,
        "Total Outstanding": loan.totalOutstanding,
        "Days Overdue": loan.daysInArrears,
        Bracket: loan.agingBracket,
        Officer: loan.loanOfficer,
        Branch: loan.branch,
        Status: loan.status,
      }));
      const loansWs = XLSX.utils.json_to_sheet(loansData);
      XLSX.utils.book_append_sheet(wb, loansWs, "Outstanding Loans");

      const fileName = `outstanding-balance-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful", {
        description: `Report exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Failed to export report");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Outstanding Balance Report"
        subtitle="Active loans with outstanding balances - detailed breakdown"
        onPrint={() => window.print()}
        onExport={() => handleExport(data?.loans || [])}
        disableExport={!data?.loans.length}
      >
        <div className="flex items-center space-x-2 mr-4 bg-muted/50 p-2 rounded-lg border">
          <Switch
            id="summary-mode"
            checked={viewMode === "summary"}
            onCheckedChange={(checked) => setViewMode(checked ? "summary" : "detailed")}
          />
          <Label htmlFor="summary-mode" className="cursor-pointer font-medium">
            {viewMode === "summary" ? "Summary Print" : "Detailed Print"}
          </Label>
        </div>
      </ReportHeader>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter Loans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <Label
                htmlFor="search"
                className="text-sm font-medium mb-2 block"
              >
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Member name, number, or loan ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label
                htmlFor="officer"
                className="text-sm font-medium mb-2 block"
              >
                Officer
              </Label>
              <Select 
                value={searchParams.get("officerId") || "all"} 
                onValueChange={(v) => {
                  const params = new URLSearchParams(searchParams);
                  if (v !== "all") params.set("officerId", v);
                  else params.delete("officerId");
                  router.push(`${pathname}?${params.toString()}`);
                }}
              >
                <SelectTrigger id="officer">
                  <SelectValue placeholder="All Officers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Officers</SelectItem>
                  {filterOfficers.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label
                htmlFor="status"
                className="text-sm font-medium mb-2 block"
              >
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DISBURSED">Active</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label
                htmlFor="aging"
                className="text-sm font-medium mb-2 block"
              >
                Aging
              </Label>
              <Select value={agingFilter} onValueChange={setAgingFilter}>
                <SelectTrigger id="aging">
                  <SelectValue placeholder="All Brackets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brackets</SelectItem>
                  <SelectItem value="Current">Current</SelectItem>
                  <SelectItem value="1 - 30 Days">1 - 30 Days</SelectItem>
                  <SelectItem value="31 - 60 Days">31 - 60 Days</SelectItem>
                  <SelectItem value="61 - 90 Days">61 - 90 Days</SelectItem>
                  <SelectItem value="90+ Days">90+ Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="flex items-end gap-2">
              <Button onClick={handleApplyFilters} className="flex-1">
                Apply
              </Button>
              {(statusFilter !== "all" ||
                searchTerm ||
                startDate ||
                endDate) && (
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>

      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
            {data?.summary.totalLoans || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            Active loans with balance
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Due</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(data?.summary.totalDue || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Principal + Interest + Penalty
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Outstanding
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(data?.summary.totalOutstanding || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Amount to be collected
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
          <Percent className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {(data?.summary.percentageRecovered || 0).toFixed(2)}%
          </div>
          <p className="text-xs text-muted-foreground">
            Amount recovered so far
          </p>
        </CardContent>
      </Card>
      </div>

      {/* PAR Analysis Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio at Risk (PAR) Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-green-50 border-green-200">
              <div>
                <p className="text-sm text-muted-foreground">Current</p>
                <p className="text-2xl font-bold text-green-800">
                  {formatCurrency(calculateTotal(parMetrics.current))}
                </p>
                <p className="text-xs text-green-600">
                  {parMetrics.current.length} loans
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-yellow-50 border-yellow-200">
              <div>
                <p className="text-sm text-muted-foreground">1 - 30 Days</p>
                <p className="text-2xl font-bold text-yellow-800">
                  {formatCurrency(calculateTotal(parMetrics.days30))}
                </p>
                <p className="text-xs text-yellow-600">
                  {parMetrics.days30.length} loans
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-orange-50 border-orange-200">
              <div>
                <p className="text-sm text-muted-foreground">31 - 60 Days</p>
                <p className="text-2xl font-bold text-orange-800">
                  {formatCurrency(calculateTotal(parMetrics.days60))}
                </p>
                <p className="text-xs text-orange-600">
                  {parMetrics.days60.length} loans
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-red-50 border-red-200">
              <div>
                <p className="text-sm text-muted-foreground">61 - 90 Days</p>
                <p className="text-2xl font-bold text-red-800">
                  {formatCurrency(calculateTotal(parMetrics.days90))}
                </p>
                <p className="text-xs text-red-600">
                  {parMetrics.days90.length} loans
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-red-100 border-red-300">
              <div>
                <p className="text-sm text-muted-foreground">90+ Days</p>
                <p className="text-2xl font-bold text-red-950">
                  {formatCurrency(calculateTotal(parMetrics.days90Plus))}
                </p>
                <p className="text-xs text-red-800">
                  {parMetrics.days90Plus.length} loans
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Principal Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Principal Due</span>
              <span className="font-semibold text-blue-600">
                {formatCurrency(data?.summary.totalPrincipalDue || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Outstanding Principal
              </span>
              <span className="font-semibold text-orange-600">
                {formatCurrency(data?.summary.totalOutstandingPrincipal || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interest Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Interest Due</span>
              <span className="font-semibold text-purple-600">
                {formatCurrency(data?.summary.totalInterestDue || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Outstanding Interest
              </span>
              <span className="font-semibold text-orange-500">
                {formatCurrency(data?.summary.totalOutstandingInterest || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Penalty Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Penalty Due</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(data?.summary.totalPenaltyDue || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Outstanding Penalty</span>
              <span className="font-semibold text-orange-600">
                {formatCurrency(data?.summary.totalOutstandingPenalty || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <div className={`flex-1 overflow-hidden rounded-lg border bg-card ${viewMode === 'summary' ? 'print:hidden' : ''}`}>
        <DataTable
          title="Outstanding Loans Details"
          subtitle={`Showing ${data?.loans.length || 0} loans with outstanding balances`}
          data={data?.loans || []}
          columns={columns}
          keyField="loanId"
          isLoading={loading}
          onRefresh={fetchData}
          actions={{
            onExport: handleExport,
          }}
          filters={{
            searchFields: [
              "loanId",
              "memberName",
              "memberNumber",
              "memberPhone",
              "loanProduct",
              "loanOfficer",
              "branch",
            ],
          }}
        />
      </div>
      
      {/* Summary Only Footer / Text */}
      {viewMode === 'summary' && (
          <div className="hidden print:block mt-8 text-center text-sm text-muted-foreground">
              <p>*** Summary Report Only ***</p>
          </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the data table */
          body * {
            visibility: hidden;
          }

          /* Show only the data table and its contents */
          .flex.h-full.flex-col.gap-4,
          .flex.h-full.flex-col.gap-4 * {
            visibility: visible;
          }

          /* Hide filters, summary cards, and action buttons */
          .flex.h-full.flex-col.gap-4 > div:nth-child(2),
          .flex.h-full.flex-col.gap-4 > div:nth-child(3),
          .flex.h-full.flex-col.gap-4 > h3,
          .flex.h-full.flex-col.gap-4 > div:nth-child(5),
          .flex.h-full.flex-col.gap-4 > div:nth-child(6) {
            display: none !important;
          }

          /* Show only report header and data table */
          .flex.h-full.flex-col.gap-4 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }

          /* Print header styling */
          .flex.h-full.flex-col.gap-4 > div:first-child {
            margin-bottom: 20px;
            page-break-after: avoid;
          }

          /* Ensure table is visible and formatted */
          .flex-1.overflow-hidden.rounded-lg.border.bg-card {
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
          }

          /* Remove action buttons from table */
          button,
          .no-print {
            display: none !important;
          }

          /* Table styling for print */
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }

          table th {
            background-color: #f3f4f6 !important;
            padding: 8px 4px;
            text-align: left;
            border: 1px solid #d1d5db;
            font-weight: 600;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          table td {
            padding: 6px 4px;
            border: 1px solid #e5e7eb;
          }

          /* Page breaks */
          tr {
            page-break-inside: avoid;
          }

          /* Print title */
          @page {
            margin: 1cm;
          }

          /* Add report title at top of print */
          .flex.h-full.flex-col.gap-4::before {
            content: "Outstanding Balance Report";
            display: block;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #1f2937;
          }

          /* Add date/time stamp */
          .flex.h-full.flex-col.gap-4::after {
            content: "Generated: " attr(data-print-date);
            display: block;
            font-size: 10px;
            color: #6b7280;
            margin-top: 10px;
          }
        }
      `}</style>
    </div>
  );
}
