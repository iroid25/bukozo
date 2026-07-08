"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Search, Filter } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReportHeader } from "@/components/reports/ReportHeader";

interface RepaymentHistoryListingProps {
  title: string;
  subtitle: string;
  data: any;
  branchId: string;
  role: string;
  officers?: any[];
}

export default function RepaymentHistoryListing({
  title,
  subtitle,
  data,
  branchId,
  role,
  officers = [],
}: RepaymentHistoryListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  const columns: Column<any>[] = [
    { header: "Transaction Date", accessorKey: "transactionDateFormatted" },
    { header: "Receipt No.", accessorKey: "receiptNumber" },
    { header: "Member Name", accessorKey: "memberName" },
    { header: "Member Number", accessorKey: "memberNumber" },
    { header: "Loan Product", accessorKey: "loanProduct" },
    { header: "Principal Paid", accessorKey: "principalPaidFormatted" },
    { header: "Interest Paid", accessorKey: "interestPaidFormatted" },
    { header: "Penalty Paid", accessorKey: "penaltyPaidFormatted" },
    { header: "Total Paid", accessorKey: "totalAmountFormatted" },
    { header: "Payment Method", accessorKey: "paymentMethod" },
    { header: "Received By", accessorKey: "receivedBy" },
    { header: "Branch", accessorKey: "branch" },
  ];

  const repayments = data?.repayments || [];

  // Get unique payment methods for filter - Fixed TypeScript typing
  const paymentMethods = useMemo(() => {
    const methods = new Set<string>(
      repayments
        .map((r: any) => r.paymentMethod)
        .filter((method: any): method is string => typeof method === "string")
    );
    return Array.from(methods).sort();
  }, [repayments]);

  // Filter repayments
  const filteredRepayments = useMemo(() => {
    return repayments.filter((repayment: any) => {
      const matchesSearch =
        searchTerm === "" ||
        Object.values(repayment).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchesPaymentMethod =
        paymentMethodFilter === "all" ||
        repayment.paymentMethod === paymentMethodFilter;

      const transactionDate = new Date(repayment.transactionDate);
      const now = new Date();
      const matchesDateRange =
        dateRangeFilter === "all" ||
        (dateRangeFilter === "today" &&
          transactionDate.toDateString() === now.toDateString()) ||
        (dateRangeFilter === "week" &&
          transactionDate >= new Date(now.setDate(now.getDate() - 7))) ||
        (dateRangeFilter === "month" &&
          transactionDate >= new Date(now.setMonth(now.getMonth() - 1))) ||
        (dateRangeFilter === "quarter" &&
          transactionDate >= new Date(now.setMonth(now.getMonth() - 3)));

      return matchesSearch && matchesPaymentMethod && matchesDateRange;
    });
  }, [repayments, searchTerm, paymentMethodFilter, dateRangeFilter]);

  // Calculate summary from filtered data
  const summary = useMemo(() => {
    return {
      totalRepayments: filteredRepayments.length,
      totalPrincipalPaid: filteredRepayments.reduce(
        (sum: number, item: any) => sum + (item.principalPaid || 0),
        0
      ),
      totalInterestPaid: filteredRepayments.reduce(
        (sum: number, item: any) => sum + (item.interestPaid || 0),
        0
      ),
      totalPenaltyPaid: filteredRepayments.reduce(
        (sum: number, item: any) => sum + (item.penaltyPaid || item.feesPaid || 0),
        0
      ),
      totalAmount: filteredRepayments.reduce(
        (sum: number, item: any) => sum + (item.totalAmount || 0),
        0
      ),
    };
  }, [filteredRepayments]);

  // Format the filtered data
  const formattedData = filteredRepayments.map((item: any) => ({
    ...item,
    transactionDateFormatted: item.transactionDate
      ? format(new Date(item.transactionDate), "dd/MM/yyyy HH:mm")
      : "N/A",
    principalPaidFormatted: formatCurrency(item.principalPaid || 0),
    interestPaidFormatted: formatCurrency(item.interestPaid || 0),
    penaltyPaidFormatted: formatCurrency(item.penaltyPaid || item.feesPaid || 0),
    totalAmountFormatted: formatCurrency(item.totalAmount || 0),
  }));

  const handleExport = () => {
    try {
      if (!filteredRepayments.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = filteredRepayments.map((item: any) => ({
        "Transaction Date": item.transactionDate
          ? format(new Date(item.transactionDate), "dd/MM/yyyy HH:mm")
          : "N/A",
        "Receipt No.": item.receiptNumber,
        "Member Name": item.memberName,
        "Member Number": item.memberNumber,
        "Loan Product": item.loanProduct,
        "Principal Paid": item.principalPaid,
        "Interest Paid": item.interestPaid,
        "Penalty Paid": item.penaltyPaid || item.feesPaid || 0,
        "Total Paid": item.totalAmount,
        "Payment Method": item.paymentMethod,
        "Received By": item.receivedBy,
        Branch: item.branch,
      }));

      // Add summary row
      exportData.push({
        "Transaction Date": "",
        "Receipt No.": "SUMMARY",
        "Member Name": "",
        "Member Number": "",
        "Loan Product": "",
        "Principal Paid": summary.totalPrincipalPaid,
        "Interest Paid": summary.totalInterestPaid,
        "Penalty Paid": summary.totalPenaltyPaid,
        "Total Paid": summary.totalAmount,
        "Payment Method": "",
        "Received By": `Total Repayments: ${summary.totalRepayments}`,
        Branch: "",
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Repayment History");
      XLSX.writeFile(wb, `repayment-history-${formatISODate(new Date())}.xlsx`);
      toast.success("Exported successfully");
    } catch (error) {
      toast.error("Export failed");
      console.error("Export error:", error);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setPaymentMethodFilter("all");
    setDateRangeFilter("all");
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={handleExport}
        disableExport={!filteredRepayments.length}
      />

      {/* NEW: Branch & Officer Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {["ADMIN", "AUDITOR"].includes(role) && (
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
            {officers.map((officer) => (
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
              router.push(`?${params.toString()}`);
            }}
          >
            Clear Search
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total Repayments</p>
          <p className="text-xl font-bold">{summary.totalRepayments}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Principal Paid</p>
          <p className="text-xl font-bold text-blue-600">
            {formatCurrency(summary.totalPrincipalPaid)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Interest Paid</p>
          <p className="text-xl font-bold text-orange-600">
            {formatCurrency(summary.totalInterestPaid)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total Amount</p>
          <p className="text-xl font-bold text-green-600">
            {formatCurrency(summary.totalAmount)}
          </p>
        </div>
      </div>

      {/* Search and Filter Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by member, loan ID, receipt..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={paymentMethodFilter}
                onValueChange={setPaymentMethodFilter}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={dateRangeFilter}
                onValueChange={setDateRangeFilter}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="quarter">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(searchTerm ||
              paymentMethodFilter !== "all" ||
              dateRangeFilter !== "all") && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredRepayments.length} of {repayments.length}{" "}
                  repayments
                </p>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      {filteredRepayments.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              No repayments found matching your filters
            </div>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          title=""
          subtitle=""
          data={formattedData}
          columns={columns}
          keyField="receiptNumber"
        />
      )}
    </div>
  );
}
