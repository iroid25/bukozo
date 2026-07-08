"use client";

import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Filter } from "lucide-react";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface RepaymentScheduleListingProps {
  title: string;
  subtitle: string;
  initialRole: string;
}

export default function RepaymentScheduleListing({
  title,
  subtitle,
  initialRole,
}: RepaymentScheduleListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOfficers, setFilterOfficers] = useState<any[]>([]);
  const loanId = searchParams.get("loanId");
  const isIndividual = Boolean(loanId);

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryString = searchParams.toString();
      const endpoint = loanId ? "repayment-schedule" : "all-schedules";
      const response = await fetch(`/api/v1/reports/loans/${endpoint}${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to fetch data");
        toast.error(result.error || "Failed to fetch data");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setError("An error occurred while fetching data");
      toast.error("An error occurred while fetching data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch officers for filter
  useEffect(() => {
    const fetchFilterOfficers = async () => {
      try {
        const response = await fetch("/api/v1/users?role=LOANOFFICER", {
          cache: "no-store",
        });
        const result = await response.json();
        if (result.success) {
          setFilterOfficers(result.data);
        }
      } catch (error) {
        console.error("Error fetching filter officers:", error);
      }
    };
    fetchFilterOfficers();
  }, []);

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const columns: Column<any>[] = [
    {
      header: "Due Date",
      accessorKey: "dueDate",
      cell: (row: any) => (
        <span className="text-[10px]">
          {row.dueDate ? format(new Date(row.dueDate), "dd/MM/yy") : "N/A"}
        </span>
      ),
    },
    {
      header: "Member/Type",
      accessorKey: "memberName",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-[10px] truncate max-w-[100px] text-blue-700">{row.memberName}</span>
          <div className="flex items-center gap-1">
             <span className="text-[9px] text-muted-foreground">{row.memberNumber}</span>
             <Badge variant="outline" className="text-[8px] h-3 px-1 py-0">PAYMENT</Badge>
          </div>
        </div>
      ),
    },
    {
       header: "Inst #", 
       accessorKey: "installmentNumber",
       cell: (row: any) => <span className="text-[10px]">{row.installmentNumber}</span>
    },
    {
      header: "Principal",
      accessorKey: "principalDue",
      cell: (row: any) => (
        <span className="text-[10px]">
           {formatCurrency(row.principalDue)}
        </span>
      ),
    },
    {
      header: "Interest",
      accessorKey: "interestDue",
      cell: (row: any) => (
        <span className="text-[10px]">
           {formatCurrency(row.interestDue)}
        </span>
      ),
    },
    {
      header: "Total Due",
      accessorKey: "totalDue",
      cell: (row: any) => (
        <span className="text-[10px] font-bold text-blue-600">
          {formatCurrency(row.totalDue)}
        </span>
      ),
    },
    {
      header: "Balance",
      accessorKey: "balance",
      cell: (row: any) => (
        <span className="text-[10px] font-bold text-red-700">
          {formatCurrency(row.balance)}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: any) => {
        const statusColors: Record<string, string> = {
          PAID: "bg-green-100 text-green-800",
          PARTIAL: "bg-orange-100 text-orange-800",
          OVERDUE: "bg-red-100 text-red-800",
          PENDING: "bg-blue-100 text-blue-800",
        };
        return (
          <Badge className={`text-[8px] h-4 ${statusColors[row.status] || ""}`}>
            {row.status}
          </Badge>
        );
      },
    },
  ];

  const displayColumns = isIndividual 
    ? columns.filter(col => col.accessorKey !== "memberName") 
    : columns;

  const schedules = data?.schedules || [];
  const loanDetails = data?.loanDetails;
  const memberName = loanDetails?.memberName;
  const loanProduct = loanDetails?.loanProduct;
  const summary = data?.summary || {
    totalScheduledPayments: 0,
    totalPrincipalDue: 0,
    totalInterestDue: 0,
    totalDue: 0,
    totalPaid: 0,
    totalBalance: 0,
  };


  const handleExport = async (filteredData: any[]) => {
    try {
      if (!filteredData.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredData.map((item: any) => ({
        "Member Name": item.memberName,
        "Member Number": item.memberNumber,
        Product: item.loanProduct,
        "Loan ID": item.loanId,
        "Installment No": item.installmentNumber,
        "Principal Due": item.principalDue,
        "Interest Due": item.interestDue,
        "Total Due": item.totalDue,
        Status: item.status,
      }));

      // Add summary row
      exportData.push({
        "Member Name": "SUMMARY",
        "Member Number": "",
        Product: "",
        "Loan ID": "",
        "Installment No": `Total Payments: ${filteredData.length}`,
        "Principal Due": summary.totalPrincipalDue,
        "Interest Due": summary.totalInterestDue,
        "Total Due": summary.totalDue,
        Status: "",
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Repayment Schedule");
      const fileName = `repayment-schedule-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful");
    } catch (error) {
      toast.error("Export failed");
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <ReportHeader
        title={isIndividual ? `Repayment Schedule - ${memberName || "Loading..."}` : title}
        subtitle={isIndividual ? `${loanProduct || ""} | Loan ID: ${loanId}` : subtitle}
        onPrint={() => window.print()}
        onExport={() => handleExport(schedules)}
        disableExport={!schedules.length}
      >
        {isIndividual && (
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/loans/reports/repayment-schedule")}>
            ← All Schedules
          </Button>
        )}
      </ReportHeader>

      {/* Branch & Officer Filters - Only show if not individual */}
      {!isIndividual && (
        <div className="flex flex-col md:flex-row gap-4">
        {["ADMIN", "AUDITOR"].includes(initialRole) && (
          <Select
            value={searchParams.get("branchId") || "all"}
            onValueChange={(v) => {
              const params = new URLSearchParams(searchParams.toString());
              if (v && v !== "all") params.set("branchId", v);
              else params.delete("branchId");
              router.push(`${pathname}?${params.toString()}`);
            }}
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
          onValueChange={(v) => {
            const params = new URLSearchParams(searchParams.toString());
            if (v && v !== "all") params.set("officerId", v);
            else params.delete("officerId");
            router.push(`${pathname}?${params.toString()}`);
          }}
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
      )}

      {/* Individual Loan Info Banner */}
      {isIndividual && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border bg-muted/30">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold text-[10px]">Grant Date</p>
            <p className="font-medium text-sm">
              {loanDetails?.disbursementDate ? format(new Date(loanDetails.disbursementDate), "dd/MM/yyyy") : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold text-[10px]">Officer</p>
            <p className="font-medium text-sm">{loanDetails?.loanOfficer || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold text-[10px]">Branch</p>
            <p className="font-medium text-sm">{loanDetails?.branch || "N/A"}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total Principal</p>
          <p className="text-xl font-bold text-blue-600">
            {formatCurrency(summary.totalPrincipalDue)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total Interest</p>
          <p className="text-xl font-bold text-orange-600">
            {formatCurrency(summary.totalInterestDue)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total Payable</p>
          <p className="text-xl font-bold text-green-600">
            {formatCurrency(summary.totalDue)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Amount Paid</p>
          <p className="text-xl font-bold text-emerald-600">
            {formatCurrency(summary.totalPaid)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total Balance</p>
          <p className="text-xl font-bold text-red-600">
            {formatCurrency(summary.totalBalance)}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <DataTable
          title="Payment Schedule"
          subtitle="Detailed repayment plan for disbursed loans"
          data={schedules}
          columns={displayColumns}
          keyField="id"
          isLoading={loading}
          onRefresh={fetchData}
          actions={{
            onExport: handleExport,
          }}
          filters={{
            searchFields: ["loanId", "memberName", "memberNumber"],
          }}
        />
      </div>
    </div>
  );
}
