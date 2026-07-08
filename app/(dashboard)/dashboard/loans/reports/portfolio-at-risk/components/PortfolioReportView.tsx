// FILE: app/dashboard/loans/reports/portfolio/components/PortfolioReportView.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Briefcase,
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Download,
  Filter,
  Info,
  Printer,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface PortfolioData {
  byProduct: Array<{
    productName: string;
    totalLoans: number;
    totalDisbursed: number;
    totalOutstanding: number;
    activeLoans: number;
    overdueLoans: number;
    repaidLoans: number;
    portfolioAtRisk: number;
  }>;
  byBranch: Array<{
    branchName: string;
    totalLoans: number;
    totalDisbursed: number;
    totalOutstanding: number;
    activeLoans: number;
    overdueLoans: number;
    portfolioAtRisk: number;
  }>;
  byOfficer: Array<{
    officerName: string;
    totalLoans: number;
    totalDisbursed: number;
    totalOutstanding: number;
    activeLoans: number;
    overdueLoans: number;
    performanceScore: number;
  }>;
  summary: {
    totalLoans: number;
    totalDisbursed: number;
    totalOutstanding: number;
    totalRepaid: number;
    activeLoans: number;
    overdueLoans: number;
    repaidLoans: number;
    portfolioAtRisk: number;
    recoveryRate: number;
  };
  userRole?: string;
  userName?: string;
  branchName?: string | null;
  filterOptions?: {
    branches: Array<{ id: string; name: string }>;
    officers: Array<{ id: string; name: string }>;
  };
}

interface PortfolioReportViewProps {
  userRole: string;
  initialBranchId?: string;
}

export default function PortfolioReportView({
  userRole,
  initialBranchId,
}: PortfolioReportViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [performanceFilter, setPerformanceFilter] = useState<string>("all");

  // Server-side filters from URL
  const selectedBranch = searchParams.get("branchId") || "all";
  const selectedOfficer = searchParams.get("officerId") || "all";

  // ✅ Determine what data to show based on role
  const showBranchTab =
    userRole === "ADMIN" || userRole === "ACCOUNTANT" || userRole === "AUDITOR";
  const showOfficerTab =
    userRole === "ADMIN" ||
    userRole === "ACCOUNTANT" ||
    userRole === "AUDITOR" ||
    userRole === "BRANCHMANAGER";

  // ✅ Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/portfolio-at-risk${queryString ? `?${queryString}` : ""}`, {
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

  // Handle URL Filter Changes
  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setRiskFilter("all");
    setPerformanceFilter("all");
    router.replace(pathname); // Clear URL params too
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return (data?.byProduct || []).filter((product) => {
      const matchesSearch = product.productName
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      const matchesRisk =
        riskFilter === "all" ||
        (riskFilter === "high" && product.portfolioAtRisk > 10) ||
        (riskFilter === "medium" &&
          product.portfolioAtRisk > 5 &&
          product.portfolioAtRisk <= 10) ||
        (riskFilter === "low" && product.portfolioAtRisk <= 5);

      return matchesSearch && matchesRisk;
    });
  }, [data?.byProduct, searchTerm, riskFilter]);

  // Filter branches
  const filteredBranches = useMemo(() => {
    return (data?.byBranch || []).filter((branch) => {
      const matchesSearch = (branch.branchName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      const matchesRisk =
        riskFilter === "all" ||
        (riskFilter === "high" && branch.portfolioAtRisk > 10) ||
        (riskFilter === "medium" &&
          branch.portfolioAtRisk > 5 &&
          branch.portfolioAtRisk <= 10) ||
        (riskFilter === "low" && branch.portfolioAtRisk <= 5);

      return matchesSearch && matchesRisk;
    });
  }, [data?.byBranch, searchTerm, riskFilter]);

  // Filter officers
  const filteredOfficers = useMemo(() => {
    return (data?.byOfficer || []).filter((officer) => {
      const matchesSearch = (officer.officerName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      const matchesPerformance =
        performanceFilter === "all" ||
        (performanceFilter === "high" && officer.performanceScore >= 80) ||
        (performanceFilter === "medium" &&
          officer.performanceScore >= 60 &&
          officer.performanceScore < 80) ||
        (performanceFilter === "low" && officer.performanceScore < 60);

      return matchesSearch && matchesPerformance;
    });
  }, [data?.byOfficer, searchTerm, performanceFilter]);

  const handleExportExcel = () => {
    if (!data) return;
    try {
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        { Metric: "User", Value: data.userName || "N/A" },
        { Metric: "Role", Value: userRole },
        {
          Metric: "Branch",
          Value: data.branchName || "All Branches",
        },
        { Metric: "", Value: "" },
        { Metric: "Total Loans", Value: data.summary.totalLoans },
        {
          Metric: "Total Disbursed",
          Value: data.summary.totalDisbursed,
        },
        {
          Metric: "Total Outstanding",
          Value: data.summary.totalOutstanding,
        },
        { Metric: "Total Repaid", Value: data.summary.totalRepaid },
        { Metric: "Active Loans", Value: data.summary.activeLoans },
        { Metric: "Overdue Loans", Value: data.summary.overdueLoans },
        { Metric: "Repaid Loans", Value: data.summary.repaidLoans },
        {
          Metric: "Portfolio at Risk (%)",
          Value: data.summary.portfolioAtRisk.toFixed(2),
        },
        {
          Metric: "Recovery Rate (%)",
          Value: data.summary.recoveryRate.toFixed(2),
        },
      ];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // By Product sheet
      const productWs = XLSX.utils.json_to_sheet(filteredProducts);
      XLSX.utils.book_append_sheet(wb, productWs, "By Product");

      // By Branch sheet (only if user can see it)
      if (showBranchTab && filteredBranches.length > 0) {
        const branchWs = XLSX.utils.json_to_sheet(filteredBranches);
        XLSX.utils.book_append_sheet(wb, branchWs, "By Branch");
      }

      // By Officer sheet (only if user can see it)
      if (showOfficerTab && filteredOfficers.length > 0) {
        const officerWs = XLSX.utils.json_to_sheet(filteredOfficers);
        XLSX.utils.book_append_sheet(wb, officerWs, "By Officer");
      }

      XLSX.writeFile(
        wb,
        `loan-portfolio-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`
      );
      toast.success("Report exported successfully");
    } catch (error) {
      toast.error("Failed to export report");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Clock className="h-12 w-12 text-muted-foreground animate-spin" />
        <p className="text-muted-foreground">Loading portfolio data...</p>
      </div>
    );
  }

  if (!data || !data.summary) {
    return (
      <div className="space-y-6">
        <ReportHeader
          title="Loan Portfolio Report"
          subtitle="Comprehensive overview of loan portfolio performance"
          onPrint={() => window.print()}
          onExport={handleExportExcel}
          disableExport={!data}
        >
          <Button variant="outline" onClick={fetchData} disabled={loading} size="sm">
            <Clock className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </ReportHeader>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground space-y-4">
            <AlertTriangle className="h-12 w-12 text-orange-500" />
            <p>No portfolio data available for the selected filters.</p>
            <Button variant="outline" onClick={clearFilters}>Clear All Filters</Button>
          </CardContent>
        </Card>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      {/* Header */}
      <ReportHeader
        title="Loan Portfolio Report"
        subtitle={
          data?.branchName
            ? `${data.branchName} - Portfolio Overview`
            : userRole === "LOANOFFICER" || userRole === "TELLER"
              ? `Your Loan Portfolio - ${data?.userName}`
              : "Comprehensive overview of loan portfolio performance"
        }
        onPrint={() => window.print()}
        onExport={handleExportExcel}
        disableExport={!data}
      >
        <Button variant="outline" onClick={fetchData} disabled={loading} size="sm">
          <Clock className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </ReportHeader>

      {/* ✅ Role-based Info Alert */}
      <div className="print:hidden space-y-4">
        {(userRole === "LOANOFFICER" || userRole === "TELLER") && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You are viewing portfolio data for loans assigned to you.
            </AlertDescription>
          </Alert>
        )}

        {userRole === "BRANCHMANAGER" && data?.branchName && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You are viewing portfolio data for {data.branchName}.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Overall Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              {userRole === "LOANOFFICER" || userRole === "TELLER"
                ? "Your assigned loans"
                : "All time loans"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Disbursed
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.summary.totalDisbursed || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Lifetime disbursements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(data?.summary.totalOutstanding || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Current outstanding</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(data?.summary.recoveryRate || 0).toFixed(2)}%
            </div>
            <Progress
              value={data?.summary.recoveryRate || 0}
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Loan Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Active Loans</p>
                  <p className="text-2xl font-bold">
                    {data?.summary.activeLoans || 0}
                  </p>
                </div>
              </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Overdue Loans</p>
                <p className="text-2xl font-bold text-red-600">
                  {data?.summary.overdueLoans || 0}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <CheckCircle className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Repaid Loans</p>
                <p className="text-2xl font-bold text-blue-600">
                  {data?.summary.repaidLoans || 0}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Portfolio at Risk
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {(data?.summary.portfolioAtRisk || 0).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Branch Filter - Only for Admins */}
             {["ADMIN", "AUDITOR"].includes(userRole) && (
              <Select 
                value={selectedBranch} 
                onValueChange={(val) => handleFilterChange("branchId", val)}
              >
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {(data?.filterOptions?.branches || []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Officer Filter */}
            {["ADMIN", "ACCOUNTANT", "AUDITOR", "BRANCHMANAGER"].includes(userRole) && (
              <Select 
                value={selectedOfficer} 
                onValueChange={(val) => handleFilterChange("officerId", val)}
              >
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Loan Officer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Officers</SelectItem>
                  {(data?.filterOptions?.officers || []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger>
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="low">Low Risk (≤5%)</SelectItem>
                <SelectItem value="medium">Medium Risk (5-10%)</SelectItem>
                <SelectItem value="high">High Risk (&gt; 10%)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={performanceFilter}
              onValueChange={setPerformanceFilter}
            >
              <SelectTrigger>
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Performance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Performance</SelectItem>
                <SelectItem value="high">High (≥80%)</SelectItem>
                <SelectItem value="medium">Medium (60-80%)</SelectItem>
                <SelectItem value="low">Low (&lt;60%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(searchTerm ||
            riskFilter !== "all" ||
            performanceFilter !== "all" || 
            selectedBranch !== "all" ||
            selectedOfficer !== "all") && (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={clearFilters}>
                Clear All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ Conditional Tabs based on role */}
      <Tabs defaultValue="product" className="w-full">
        <TabsList
          className={`grid w-full ${
            showBranchTab && showOfficerTab
              ? "grid-cols-3"
              : showOfficerTab
                ? "grid-cols-2"
                : "grid-cols-1"
          }`}
        >
          <TabsTrigger value="product">
            By Product ({filteredProducts.length})
          </TabsTrigger>
          {showBranchTab && (
            <TabsTrigger value="branch">
              By Branch ({filteredBranches.length})
            </TabsTrigger>
          )}
          {showOfficerTab && (
            <TabsTrigger value="officer">
              By Officer ({filteredOfficers.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* By Product Tab */}
        <TabsContent value="product" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio by Loan Product</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No products found matching your filters
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProducts.map((product, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {product.productName}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {product.totalLoans} loans
                          </p>
                        </div>
                        <Badge
                          variant={
                            product.portfolioAtRisk > 10
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          PAR: {product.portfolioAtRisk.toFixed(2)}%
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Disbursed</p>
                          <p className="font-semibold">
                            {formatCurrency(product.totalDisbursed)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Outstanding</p>
                          <p className="font-semibold text-orange-600">
                            {formatCurrency(product.totalOutstanding)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Active</p>
                          <p className="font-semibold text-green-600">
                            {product.activeLoans}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Overdue</p>
                          <p className="font-semibold text-red-600">
                            {product.overdueLoans}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Repaid</p>
                          <p className="font-semibold text-blue-600">
                            {product.repaidLoans}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Branch Tab */}
        {showBranchTab && (
          <TabsContent value="branch" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio by Branch</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredBranches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No branches found matching your filters
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredBranches.map((branch, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {branch.branchName}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {branch.totalLoans} loans
                            </p>
                          </div>
                          <Badge
                            variant={
                              branch.portfolioAtRisk > 10
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            PAR: {branch.portfolioAtRisk.toFixed(2)}%
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Disbursed</p>
                            <p className="font-semibold">
                              {formatCurrency(branch.totalDisbursed)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Outstanding</p>
                            <p className="font-semibold text-orange-600">
                              {formatCurrency(branch.totalOutstanding)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Active</p>
                            <p className="font-semibold text-green-600">
                              {branch.activeLoans}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Overdue</p>
                            <p className="font-semibold text-red-600">
                              {branch.overdueLoans}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* By Officer Tab */}
        {showOfficerTab && (
          <TabsContent value="officer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio by Loan Officer</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredOfficers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No officers found matching your filters
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredOfficers.map((officer, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {officer.officerName}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {officer.totalLoans} loans managed
                            </p>
                          </div>
                          <Badge
                            variant={
                              officer.performanceScore >= 80
                                ? "default"
                                : "secondary"
                            }
                          >
                            Score: {officer.performanceScore.toFixed(0)}%
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Disbursed</p>
                            <p className="font-semibold">
                              {formatCurrency(officer.totalDisbursed)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Outstanding</p>
                            <p className="font-semibold text-orange-600">
                              {formatCurrency(officer.totalOutstanding)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Active</p>
                            <p className="font-semibold text-green-600">
                              {officer.activeLoans}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Overdue</p>
                            <p className="font-semibold text-red-600">
                              {officer.overdueLoans}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
