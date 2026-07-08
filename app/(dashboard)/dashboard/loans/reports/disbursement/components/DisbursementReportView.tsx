// FILE: app/dashboard/loans/reports/disbursement/components/DisbursementReportView.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatCurrency, formatISODate, cn } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Users,
  BarChart3,
  CalendarIcon,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface DisbursementData {
  disbursements: Array<{
    loanId: string;
    memberName: string;
    memberNumber: string;
    loanProduct: string;
    amountDisbursed: number;
    totalLoanInterest?: number;
    disbursementDate: Date;
    disbursedBy: string;
    branch: string;
    disbursementMethod: string;
    accountCredited: string;
    repaymentPeriodDays?: number;
  }>;
  summary: {
    totalDisbursements: number;
    totalAmount: number;
    byProduct: Array<{ product: string; count: number; amount: number }>;
    byBranch: Array<{ branch: string; count: number; amount: number }>;
    byMethod: Array<{ method: string; count: number; amount: number }>;
  };
}

export default function DisbursementReportView({
  userRole,
  initialBranchId,
}: {
  userRole: string;
  initialBranchId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const [data, setData] = useState<DisbursementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);

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

  // ✅ Date range state - initialize from URL
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined,
    to: searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined,
  });

  // ✅ Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/disbursement${queryString ? `?${queryString}` : ""}`, {
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

  // ✅ Apply date filter
  const handleApplyFilter = () => {
    if (!dateRange.from || !dateRange.to) {
      toast.error("Please select both start and end dates");
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
    params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));

    router.push(`${pathname}?${params.toString()}`);
  };

  // ✅ Clear filters
  const handleClearFilter = () => {
    setDateRange({ from: undefined, to: undefined });
    router.push(pathname);
  };

  const columns: Column<DisbursementData["disbursements"][0]>[] = [
    {
      accessorKey: "disbursementDate",
      header: "Date",
      cell: (row) => row.disbursementDate ? formatISODate(row.disbursementDate) : "N/A",
    },
    {
      accessorKey: "memberNumber",
      header: "Member #",
      cell: (row) => <span className="font-mono text-xs">{row.memberNumber}</span>,
    },
    {
      accessorKey: "memberName",
      header: "Member Name",
      cell: (row) => <span className="font-medium">{row.memberName}</span>,
    },
    {
      accessorKey: "loanProduct",
      header: "Product",
      cell: (row) => <Badge variant="outline">{row.loanProduct}</Badge>,
    },
    {
      accessorKey: "amountDisbursed",
      header: "Loan Amount",
      cell: (row) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(row.amountDisbursed)}
        </span>
      ),
    },
    {
      accessorKey: "totalLoanInterest",
      header: "Total Interest",
      cell: (row) => (
        <span className="font-semibold text-purple-600">
          {formatCurrency(row.totalLoanInterest || 0)}
        </span>
      ),
    },
    {
      accessorKey: "repaymentPeriodDays",
      header: "Loan Period",
      cell: (row) => (
        <Badge variant="secondary">
          {row.repaymentPeriodDays
            ? `${Math.round(row.repaymentPeriodDays / 30)} months`
            : "N/A"}
        </Badge>
      ),
    },
    {
      accessorKey: "disbursementMethod",
      header: "Method",
      cell: (row) => (
        <Badge variant="secondary">{row.disbursementMethod}</Badge>
      ),
    },
    {
      accessorKey: "disbursedBy",
      header: "Officer",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{row.disbursedBy}</span>
      ),
    },
    {
      accessorKey: "branch",
      header: "Branch",
      cell: (row) => row.branch,
    },
  ];

  const handleExport = async (
    filteredData: DisbursementData["disbursements"]
  ) => {
    try {
      const exportData = filteredData.map((item) => ({
        "Disbursement Date": formatISODate(item.disbursementDate),
        "Member Number": item.memberNumber,
        "Member Name": item.memberName,
        "Loan Product": item.loanProduct,
        "Loan Amount": item.amountDisbursed,
        "Total Loan Interest": item.totalLoanInterest || 0,
        "Loan Period (Months)": item.repaymentPeriodDays
          ? Math.round(item.repaymentPeriodDays / 30)
          : "N/A",
        "Disbursement Method": item.disbursementMethod,
        "Disbursed By (Officer)": item.disbursedBy,
        Branch: item.branch,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Disbursements");

      const fileName = `Loan_Disbursements_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Report exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <ReportHeader
        title="Loan Disbursement Report"
        subtitle="Track all loan disbursements with detailed breakdown"
        period={dateRange.from && dateRange.to ? `${format(dateRange.from, "PPP")} - ${format(dateRange.to, "PPP")}` : "All Time"}
        onPrint={() => window.print()}
        onExport={() => handleExport(data?.disbursements || [])}
        disableExport={!data?.disbursements.length}
      />

      {/* NEW: Branch & Officer Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {["ADMIN", "AUDITOR"].includes(userRole) && (
          <Select
            value={searchParams.get("branchId") || "all"}
            onValueChange={(v) => updateFilter("branchId", v)}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select
          value={searchParams.get("officerId") || "all"}
          onValueChange={(v) => updateFilter("officerId", v)}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Officers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Officers</SelectItem>
            {filterOfficers.map((officer) => (
              <SelectItem key={officer.id} value={officer.id}>
                {officer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(searchParams.get("branchId") || searchParams.get("officerId")) && (
          <Button
            variant="ghost"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("branchId");
              params.delete("officerId");
              router.push(`${pathname}?${params.toString()}`);
            }}
          >
            Clear Search
          </Button>
        )}
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter by Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from
                      ? format(dateRange.from, "PPP")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) =>
                      setDateRange({ ...dateRange, from: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? format(dateRange.to, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) =>
                      setDateRange({ ...dateRange, to: date })
                    }
                    initialFocus
                    disabled={(date) =>
                      dateRange.from ? date < dateRange.from : false
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleApplyFilter}>Apply Filter</Button>
              {(dateRange.from || dateRange.to) && (
                <Button variant="outline" onClick={handleClearFilter}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {dateRange.from && dateRange.to && (
            <p className="text-sm text-muted-foreground mt-4">
              Showing disbursements from{" "}
              <span className="font-medium">
                {format(dateRange.from, "PPP")}
              </span>{" "}
              to{" "}
              <span className="font-medium">{format(dateRange.to, "PPP")}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Disbursements
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.summary.totalDisbursements || 0}
            </div>
            <p className="text-xs text-muted-foreground">Loan disbursements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.summary.totalAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Disbursed amount</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.summary.byProduct.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Loan products</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Amount
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                (data?.summary.totalAmount || 0) / (data?.summary.totalDisbursements || 1)
              )}
            </div>
            <p className="text-xs text-muted-foreground">Per disbursement</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.summary.byProduct || []).slice(0, 5).map((item) => (
              <div key={item.product} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.product}</span>
                <div className="flex gap-2">
                  <span className="font-medium">{item.count}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Branch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.summary.byBranch || []).slice(0, 5).map((item) => (
              <div key={item.branch} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.branch}</span>
                <div className="flex gap-2">
                  <span className="font-medium">{item.count}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.summary.byMethod || []).map((item) => (
              <div key={item.method} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.method}</span>
                <div className="flex gap-2">
                  <span className="font-medium">{item.count}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <DataTable<DisbursementData["disbursements"][0]>
        title="Disbursement Details"
        subtitle={`Showing ${data?.disbursements.length || 0} disbursements`}
        data={data?.disbursements || []}
        columns={columns}
        keyField="loanId"
        isLoading={loading}
        onRefresh={fetchData}
        actions={{
          onExport: handleExport,
        }}
        filters={{
          searchFields: ["memberName", "memberNumber", "loanProduct"],
          enableDateFilter: true,
          getItemDate: (item) => item.disbursementDate,
        }}
      />
    </div>
  );
}
