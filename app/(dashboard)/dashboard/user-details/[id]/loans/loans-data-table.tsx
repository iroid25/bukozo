"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";

interface Loan {
  id: string;
  loanApplication: {
    loanProduct: { name: string };
    amountApplied: number;
    applicationDate: Date;
    status: string;
  };
  amountGranted: number;
  interestRate: number;
  totalAmountDue: number;
  amountPaid: number;
  outstandingBalance: number;
  disbursementDate: Date | null;
  dueDate: Date | null;
  status: string;
  branch: { name: string } | null;
}

interface LoansDataTableProps {
  data: Loan[];
}

export function LoansDataTable({ data }: LoansDataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Filter data
  const filteredData = data.filter((loan) => {
    const matchesSearch =
      loan.loanApplication.loanProduct.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      loan.branch?.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || loan.status === statusFilter;

    const matchesDateRange =
      !dateRange?.from ||
      !dateRange?.to ||
      (loan.loanApplication.applicationDate >= dateRange.from &&
        loan.loanApplication.applicationDate <= dateRange.to);

    return matchesSearch && matchesStatus && matchesDateRange;
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  const getStatusBadge = (status: string) => {
    const variant =
      status === "DISBURSED"
        ? "default"
        : status === "APPROVED"
          ? "secondary"
          : status === "PENDING"
            ? "outline"
            : status === "REPAID"
              ? "default"
              : "destructive";
    return <Badge variant={variant}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search loans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="DISBURSED">Disbursed</SelectItem>
            <SelectItem value="REPAID">Repaid</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <DatePickerWithRange
          date={dateRange}
          onDateChange={setDateRange}
          placeholder="Filter by date range"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loan Product</TableHead>
              <TableHead>Amount Applied</TableHead>
              <TableHead>Amount Granted</TableHead>
              <TableHead>Interest Rate</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Application Date</TableHead>
              <TableHead>Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No loans found
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">
                    {loan.loanApplication.loanProduct.name}
                  </TableCell>
                  <TableCell className="font-mono">
                    UGX {loan.loanApplication.amountApplied.toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono">
                    UGX {loan.amountGranted.toLocaleString()}
                  </TableCell>
                  <TableCell>{loan.interestRate}%</TableCell>
                  <TableCell className="font-mono">
                    UGX {loan.outstandingBalance.toLocaleString()}
                  </TableCell>
                  <TableCell>{getStatusBadge(loan.status)}</TableCell>
                  <TableCell>
                    {loan.loanApplication.applicationDate.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {loan.dueDate?.toLocaleDateString() || "N/A"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to{" "}
            {Math.min(startIndex + pageSize, filteredData.length)} of{" "}
            {filteredData.length} results
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="flex items-center space-x-1">
            {Array.from(
              { length: Math.min(totalPages, 5) },
              (_, i) => i + 1
            ).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className="w-8 h-8 p-0"
              >
                {page}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
