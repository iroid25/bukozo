"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { formatISODate, formatCurrency } from "@/lib/utils";
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
import { ReportHeader } from "@/components/reports/ReportHeader";

interface TopBorrowersListingProps {
  title: string;
  subtitle: string;
  data: any;
  branchId: string;
  role: string;
}

export default function TopBorrowersListing({
  title,
  subtitle,
  data,
  branchId,
  role,
}: TopBorrowersListingProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [repaymentRateFilter, setRepaymentRateFilter] = useState<string>("all");
  const [loanCountFilter, setLoanCountFilter] = useState<string>("all");

  const columns: Column<any>[] = [
    { header: "Rank", accessorKey: "rank" },
    { header: "Member ID", accessorKey: "memberId" },
    { header: "Member Number", accessorKey: "memberNumber" },
    { header: "Member Name", accessorKey: "name" },
    { header: "Phone", accessorKey: "phone" },
    { header: "Total Loans", accessorKey: "totalLoans" },
    { header: "Active Loans", accessorKey: "activeLoans" },
    { header: "Total Borrowed", accessorKey: "totalBorrowedFormatted" },
    { header: "Total Savings", accessorKey: "totalSavingsFormatted" },
    { header: "Outstanding Balance", accessorKey: "outstandingFormatted" },
    { header: "Repayment Rate", accessorKey: "repaymentRateFormatted" },
  ];

  const borrowers = data?.borrowers || [];

  // Calculate repayment rate for each borrower
  const borrowersWithRate = useMemo(() => {
    return borrowers.map((item: any) => ({
      ...item,
      repaymentRateValue:
        item.totalBorrowed > 0
          ? ((item.totalBorrowed - item.outstanding) / item.totalBorrowed) * 100
          : 0,
    }));
  }, [borrowers]);

  // Filter borrowers
  const filteredBorrowers = useMemo(() => {
    return borrowersWithRate.filter((borrower: any) => {
      const matchesSearch =
        searchTerm === "" ||
        borrower.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        borrower.memberNumber
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        borrower.phone?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRepaymentRate =
        repaymentRateFilter === "all" ||
        (repaymentRateFilter === "excellent" &&
          borrower.repaymentRateValue >= 90) ||
        (repaymentRateFilter === "good" &&
          borrower.repaymentRateValue >= 70 &&
          borrower.repaymentRateValue < 90) ||
        (repaymentRateFilter === "fair" &&
          borrower.repaymentRateValue >= 50 &&
          borrower.repaymentRateValue < 70) ||
        (repaymentRateFilter === "poor" && borrower.repaymentRateValue < 50);

      const matchesLoanCount =
        loanCountFilter === "all" ||
        (loanCountFilter === "high" && borrower.totalLoans >= 5) ||
        (loanCountFilter === "medium" &&
          borrower.totalLoans >= 3 &&
          borrower.totalLoans < 5) ||
        (loanCountFilter === "low" && borrower.totalLoans < 3);

      return matchesSearch && matchesRepaymentRate && matchesLoanCount;
    });
  }, [borrowersWithRate, searchTerm, repaymentRateFilter, loanCountFilter]);

  // Format the filtered data and add rank
  const formattedData = filteredBorrowers.map((item: any, index: number) => ({
    ...item,
    rank: index + 1,
    totalBorrowedFormatted: formatCurrency(item.totalBorrowed || 0),
    totalSavingsFormatted: formatCurrency(item.totalSavings || 0),
    outstandingFormatted: formatCurrency(item.outstanding || 0),
    repaymentRateFormatted:
      item.totalBorrowed > 0 ? `${item.repaymentRateValue.toFixed(1)}%` : "N/A",
  }));

  // Calculate summary from filtered data
  const summary = useMemo(() => {
    return {
      totalBorrowers: filteredBorrowers.length,
      totalLoans: filteredBorrowers.reduce(
        (sum: number, b: any) => sum + (b.totalLoans || 0),
        0
      ),
      totalBorrowed: filteredBorrowers.reduce(
        (sum: number, b: any) => sum + (b.totalBorrowed || 0),
        0
      ),
      totalOutstanding: filteredBorrowers.reduce(
        (sum: number, b: any) => sum + (b.outstanding || 0),
        0
      ),
      averageRepaymentRate:
        filteredBorrowers.length > 0
          ? filteredBorrowers.reduce(
              (sum: number, b: any) => sum + (b.repaymentRateValue || 0),
              0
            ) / filteredBorrowers.length
          : 0,
    };
  }, [filteredBorrowers]);

  const handleExport = () => {
    try {
      if (!filteredBorrowers.length) {
        toast.error("No data to export");
        return;
      }

      const exportData = formattedData.map((item: any) => ({
        Rank: item.rank,
        "Member ID": item.memberId,
        "Member Number": item.memberNumber,
        "Member Name": item.name,
        Phone: item.phone || "N/A",
        "Total Loans": item.totalLoans,
        "Active Loans": item.activeLoans,
        "Total Borrowed": item.totalBorrowed,
        "Total Savings": item.totalSavings,
        "Outstanding Balance": item.outstanding,
        "Repayment Rate": item.repaymentRateFormatted,
      }));

      // Add summary row
      exportData.push({
        Rank: "",
        "Member ID": "SUMMARY",
        "Member Number": "",
        "Member Name": "",
        Phone: "",
        "Total Loans": summary.totalLoans,
        "Active Loans": "",
        "Total Borrowed": summary.totalBorrowed,
        "Total Savings": "",
        "Outstanding Balance": summary.totalOutstanding,
        "Repayment Rate": `${summary.totalBorrowers} borrowers | Avg: ${summary.averageRepaymentRate.toFixed(1)}%`,
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Top Borrowers");
      XLSX.writeFile(wb, `top-borrowers-${formatISODate(new Date())}.xlsx`);
      toast.success("Exported successfully");
    } catch (error) {
      toast.error("Export failed");
      console.error("Export error:", error);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setRepaymentRateFilter("all");
    setLoanCountFilter("all");
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title={title}
        subtitle={subtitle}
        onPrint={() => window.print()}
        onExport={handleExport}
        disableExport={!filteredBorrowers.length}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Top Borrowers</p>
          <p className="text-2xl font-bold">{summary.totalBorrowers}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Loans</p>
          <p className="text-2xl font-bold">{summary.totalLoans}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Borrowed</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.totalBorrowed)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(summary.totalOutstanding)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Avg Repayment Rate</p>
          <p className="text-2xl font-bold text-green-600">
            {summary.averageRepaymentRate.toFixed(1)}%
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
                  placeholder="Search by name, member number, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={repaymentRateFilter}
                onValueChange={setRepaymentRateFilter}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Repayment Rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rates</SelectItem>
                  <SelectItem value="excellent">Excellent (≥90%)</SelectItem>
                  <SelectItem value="good">Good (70-89%)</SelectItem>
                  <SelectItem value="fair">Fair (50-69%)</SelectItem>
                  <SelectItem value="poor">Poor (&lt;50%)</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={loanCountFilter}
                onValueChange={setLoanCountFilter}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Loan Count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counts</SelectItem>
                  <SelectItem value="high">High (≥5 loans)</SelectItem>
                  <SelectItem value="medium">Medium (3-4 loans)</SelectItem>
                  <SelectItem value="low">Low (&lt;3 loans)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(searchTerm ||
              repaymentRateFilter !== "all" ||
              loanCountFilter !== "all") && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredBorrowers.length} of {borrowers.length}{" "}
                  borrowers
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
      {filteredBorrowers.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              No borrowers found matching your filters
            </div>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          title=""
          subtitle=""
          data={formattedData}
          columns={columns}
          keyField="memberId"
        />
      )}
    </div>
  );
}
