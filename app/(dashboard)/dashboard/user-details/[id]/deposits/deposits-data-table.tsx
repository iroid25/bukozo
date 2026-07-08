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

import type { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";

interface Deposit {
  id: string;
  transaction: {
    transactionRef: string;
    status: string;
    transactionDate: Date;
  };
  amount: number;
  depositDate: Date;
  account: {
    accountNumber: string;
    accountType: {
      name: string;
    };
  };
  handler: { name: string };
  channel: string;
  mobileMoneyRef: string | null;
}

interface DepositsDataTableProps {
  data: Deposit[];
}

export function DepositsDataTable({ data }: DepositsDataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [channelFilter, setChannelFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Filter data
  const filteredData = data.filter((deposit) => {
    const matchesSearch =
      deposit.transaction.transactionRef
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      deposit.account.accountNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      deposit.handler.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (deposit.mobileMoneyRef &&
        deposit.mobileMoneyRef
          .toLowerCase()
          .includes(searchTerm.toLowerCase()));

    const matchesChannel =
      channelFilter === "all" || deposit.channel === channelFilter;

    const matchesDateRange =
      !dateRange?.from ||
      !dateRange?.to ||
      (deposit.depositDate >= dateRange.from &&
        deposit.depositDate <= dateRange.to);

    return matchesSearch && matchesChannel && matchesDateRange;
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

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search deposits..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="Cash">Cash</SelectItem>
            <SelectItem value="Mobile Money">Mobile Money</SelectItem>
            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
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
              <TableHead>Amount</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Account Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Mobile Money Ref</TableHead>
              <TableHead>Handled By</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-8 text-muted-foreground"
                >
                  No deposits found
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((deposit) => (
                <TableRow key={deposit.id}>
                  <TableCell className="font-medium">
                    {deposit.transaction.transactionRef}
                  </TableCell>
                  <TableCell className="font-mono text-green-600">
                    UGX {deposit.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>{deposit.account.accountNumber}</TableCell>
                  <TableCell>
                    {deposit.account.accountType.name.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(deposit.transaction.status)}
                  </TableCell>
                  <TableCell>{deposit.channel}</TableCell>
                  <TableCell>{deposit.mobileMoneyRef || "N/A"}</TableCell>
                  <TableCell>{deposit.handler.name}</TableCell>
                  <TableCell>
                    {deposit.depositDate.toLocaleDateString()}
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
