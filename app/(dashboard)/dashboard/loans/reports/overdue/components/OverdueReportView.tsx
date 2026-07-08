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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatISODate } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Users,
  TrendingDown,
  Filter,
} from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface OverdueLoan {
  loanId: string;
  memberName: string;
  memberNumber: string;
  memberPhone: string;
  loanProduct: string;
  principalAmount: number;
  totalAmountDue: number;
  amountPaid: number;
  outstandingBalance: number;
  disbursementDate: Date;
  dueDate: Date;
  daysOverdue: number;
  loanOfficer: string;
  branch: string;
  status: string;
}

interface OverdueData {
  loans: OverdueLoan[];
  summary: {
    totalOverdueLoans: number;
    totalOverdueAmount: number;
    averageDaysOverdue: number;
  };
}

interface OverdueReportViewProps {
  userRole: string;
  initialBranchId?: string;
}

export default function OverdueReportView({
  userRole,
  initialBranchId,
}: OverdueReportViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [data, setData] = useState<OverdueData | null>(null);
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

  // ✅ Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryString = searchParams.toString();
      const response = await fetch(`/api/v1/reports/loans/overdue${queryString ? `?${queryString}` : ""}`, {
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

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const columns: Column<OverdueLoan>[] = [
    {
      header: "Loan ID",
      accessorKey: "loanId",
      cell: (row) => <span className="font-mono text-xs">{row.loanId}</span>,
    },
    {
      header: "Member",
      accessorKey: "memberName",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.memberName}</span>
          <span className="text-xs text-muted-foreground">
            {row.memberNumber}
          </span>
        </div>
      ),
    },
    {
      header: "Contact",
      accessorKey: "memberPhone",
      cell: (row) => <span className="text-sm">{row.memberPhone}</span>,
    },
    {
      header: "Product",
      accessorKey: "loanProduct",
      cell: (row) => <Badge variant="outline">{row.loanProduct}</Badge>,
    },
    {
      header: "Principal",
      accessorKey: "principalAmount",
      cell: (row) => (
        <span className="font-medium">
          {formatCurrency(row.principalAmount)}
        </span>
      ),
    },
    {
      header: "Outstanding",
      accessorKey: "outstandingBalance",
      cell: (row) => (
        <span className="font-bold text-red-600">
          {formatCurrency(row.outstandingBalance)}
        </span>
      ),
    },
    {
      header: "Due Date",
      accessorKey: "dueDate",
      cell: (row) => (
        <span className="text-sm text-red-600">
          {formatISODate(row.dueDate)}
        </span>
      ),
    },
    {
      header: "Days Overdue",
      accessorKey: "daysOverdue",
      cell: (row) => {
        const severity =
          row.daysOverdue > 90
            ? "bg-red-500"
            : row.daysOverdue > 30
              ? "bg-orange-500"
              : "bg-yellow-500";
        return (
          <Badge className={`${severity} text-white`}>
            {row.daysOverdue} days
          </Badge>
        );
      },
    },
    {
      header: "Officer",
      accessorKey: "loanOfficer",
      cell: (row) => <span className="text-sm">{row.loanOfficer}</span>,
    },
    {
      header: "Branch",
      accessorKey: "branch",
      cell: (row) => <span className="text-sm">{row.branch}</span>,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => (
        <Badge className="bg-red-100 text-red-800">{row.status}</Badge>
      ),
    },
  ];

  const handleExportExcel = () => {
    try {
      const exportLoans = (data?.loans || []).map((loan) => ({
        "Loan ID": loan.loanId,
        "Member Name": loan.memberName,
        "Member Number": loan.memberNumber,
        Phone: loan.memberPhone,
        "Loan Product": loan.loanProduct,
        "Principal Amount": loan.principalAmount,
        "Total Due": loan.totalAmountDue,
        "Amount Paid": loan.amountPaid,
        "Outstanding Balance": loan.outstandingBalance,
        "Disbursement Date": format(
          new Date(loan.disbursementDate),
          "yyyy-MM-dd"
        ),
        "Due Date": format(new Date(loan.dueDate), "yyyy-MM-dd"),
        "Days Overdue": loan.daysOverdue,
        "Loan Officer": loan.loanOfficer,
        Branch: loan.branch,
        Status: loan.status,
      }));

      const ws = XLSX.utils.json_to_sheet(exportLoans);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Overdue Loans Report");

      // Add summary sheet
      const summaryData = [
        {
          Metric: "Total Overdue Loans",
          Value: data?.summary.totalOverdueLoans || 0,
        },
        {
          Metric: "Total Overdue Amount",
          Value: data?.summary.totalOverdueAmount || 0,
        },
        {
          Metric: "Average Days Overdue",
          Value: (data?.summary.averageDaysOverdue || 0).toFixed(0),
        },
      ];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      XLSX.writeFile(
        wb,
        `overdue-loans-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`
      );
      toast.success("Report exported successfully");
    } catch (error) {
      toast.error("Failed to export report");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <ReportHeader
        title="Overdue Loans Report"
        subtitle="Track loans past their due date"
        onPrint={() => window.print()}
        onExport={handleExportExcel}
        disableExport={!data?.loans.length}
      />

      {/* NEW: Branch & Officer Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {["ADMIN", "AUDITOR"].includes(userRole) && (
          <Select
            value={searchParams.get("branchId") || "all"}
            onValueChange={(v) => handleFilterChange("branchId", v)}
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
          onValueChange={(v) => handleFilterChange("officerId", v)}
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
            Clear Filters
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Loans</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data?.summary.totalOverdueLoans || 0}
            </div>
            <p className="text-xs text-muted-foreground">Loans past due date</p>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Overdue Amount
            </CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(data?.summary.totalOverdueAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Outstanding on overdue loans
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Days Overdue
            </CardTitle>
            <Clock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(data?.summary.averageDaysOverdue || 0).toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">Days past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Banner */}
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Action Required</h3>
              <p className="text-sm text-red-700 mt-1">
                These loans require immediate attention. Contact members and
                loan officers to arrange payment plans or recovery actions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Overdue Loans Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable<OverdueLoan>
            title="Overdue Loans"
            keyField="loanId"
            columns={columns}
            data={data?.loans || []}
            actions={{
              onExport: handleExportExcel,
            }}
            isLoading={loading}
            onRefresh={fetchData}
            filters={{
              searchFields: ["loanId", "memberName", "memberNumber", "loanProduct"],
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
