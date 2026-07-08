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
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpIcon,
  ArrowDownIcon,
} from "lucide-react";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";

interface Transaction {
  id: string;
  transactionRef: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  transactionDate: Date;
  account: { accountNumber: string };
  processedByUser: { name: string } | null;
  channel: string | null;
}

interface TransactionsDataTableProps {
  data: Transaction[];
}

export function TransactionsDataTable({ data }: TransactionsDataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Filter data
  const filteredData = data.filter((transaction) => {
    const matchesSearch =
      transaction.transactionRef
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transaction.account.accountNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "all" || transaction.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" || transaction.status === statusFilter;

    const matchesDateRange =
      !dateRange?.from ||
      !dateRange?.to ||
      (transaction.transactionDate >= dateRange.from &&
        transaction.transactionDate <= dateRange.to);

    return matchesSearch && matchesType && matchesStatus && matchesDateRange;
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  const getStatusBadge = (status: string) => {
    const variant =
      status === "COMPLETED"
        ? "default"
        : status === "PENDING"
          ? "outline"
          : "destructive";
    return <Badge variant={variant}>{status}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    if (type === "DEPOSIT" || type === "LOAN_DISBURSEMENT") {
      return <ArrowDownIcon className="h-4 w-4 text-green-600" />;
    }
    return <ArrowUpIcon className="h-4 w-4 text-red-600" />;
  };

  const getAmountColor = (type: string) => {
    if (type === "DEPOSIT" || type === "LOAN_DISBURSEMENT") {
      return "text-green-600";
    }
    return "text-red-600";
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="DEPOSIT">Deposit</SelectItem>
            <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
            <SelectItem value="LOAN_DISBURSEMENT">Loan Disbursement</SelectItem>
            <SelectItem value="LOAN_REPAYMENT">Loan Repayment</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="REVERSED">Reversed</SelectItem>
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
              <TableHead>Reference</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Processed By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-8 text-muted-foreground"
                >
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">
                    {transaction.transactionRef}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(transaction.type)}
                      <span>{transaction.type.replace(/_/g, " ")}</span>
                    </div>
                  </TableCell>
                  <TableCell
                    className={`font-mono ${getAmountColor(transaction.type)}`}
                  >
                    UGX {transaction.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>{transaction.account.accountNumber}</TableCell>
                  <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                  <TableCell>{transaction.channel}</TableCell>
                  <TableCell>
                    {transaction.processedByUser?.name || "System"}
                  </TableCell>
                  <TableCell>
                    {transaction.transactionDate.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {transaction.description}
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
