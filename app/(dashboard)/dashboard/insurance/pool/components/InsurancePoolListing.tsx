// app/dashboard/insurance/pool/components/InsurancePoolListing.tsx
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { Column, DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import {
  Shield,
  DollarSign,
  TrendingUp,
  Calendar,
  Users,
} from "lucide-react";

interface PoolStatistics {
  totalPoolBalance: number;
  totalContributions: number;
  totalFromLoans: number;
  monthlyCollection: number;
}

interface InsurancePoolListingProps {
  title: string;
  subtitle: string;
  contributions: any[];
  statistics: PoolStatistics;
  userRole: string;
}

export default function InsurancePoolListing({
  title,
  subtitle,
  contributions,
  statistics,
  userRole,
}: InsurancePoolListingProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredContributions = contributions.filter((contribution) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const memberName = contribution.member?.user?.name?.toLowerCase() || "";
    const memberNumber = contribution.member?.member?.memberNumber?.toLowerCase() || "";
    const description = contribution.description?.toLowerCase() || "";
    return (
      memberName.includes(search) ||
      memberNumber.includes(search) ||
      description.includes(search)
    );
  });

  const columns: Column<any>[] = [
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: (row: any) => (
        <span className="text-xs">
          {format(new Date(row.createdAt), "dd/MM/yyyy HH:mm")}
        </span>
      ),
    },
    {
      header: "Member",
      accessorKey: "memberName",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">
            {row.member?.user?.name || "N/A"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {row.member?.memberNumber || "N/A"}
          </span>
        </div>
      ),
    },
    {
      header: "Phone",
      accessorKey: "memberPhone",
      cell: (row: any) => (
        <span className="text-xs">{row.member?.user?.phone || "N/A"}</span>
      ),
    },
    {
      header: "Loan Amount",
      accessorKey: "loanAmount",
      cell: (row: any) => (
        <span className="font-semibold text-xs">
          {formatCurrency(row.loanApplication?.approvedAmount || row.loanApplication?.amountApplied || 0)}
        </span>
      ),
    },
    {
      header: "Insurance Amount",
      accessorKey: "amount",
      cell: (row: any) => (
        <span className="font-bold text-xs text-green-600">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      header: "Type",
      accessorKey: "type",
      cell: (row: any) => (
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            row.type === "CONTRIBUTION"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {row.type}
        </span>
      ),
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: (row: any) => (
        <span className="text-xs max-w-[200px] truncate">
          {row.description || "N/A"}
        </span>
      ),
    },
    {
      header: "Collected By",
      accessorKey: "collectedBy",
      cell: (row: any) => (
        <span className="text-xs text-muted-foreground">
          {row.createdBy?.name || "System"}
        </span>
      ),
    },
  ];

  const handleExport = async (filteredData: any[]) => {
    try {
      const exportData = filteredData.map((item) => ({
        Date: format(new Date(item.createdAt), "dd/MM/yyyy HH:mm"),
        "Member Name": item.member?.user?.name || "N/A",
        "Member Number": item.member?.member?.memberNumber || "N/A",
        "Phone": item.member?.user?.phone || "N/A",
        "Loan Amount": item.loanApplication?.approvedAmount || item.loanApplication?.amountApplied || 0,
        "Insurance Amount": item.amount,
        Type: item.type,
        Description: item.description || "N/A",
        "Collected By": item.createdBy?.name || "System",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Insurance Pool");
      const fileName = `insurance-pool-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export successful", {
        description: `Report exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed");
      console.error("Export error:", error);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-3 sm:p-4 bg-card">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            <p className="text-xs text-muted-foreground">Total Pool</p>
          </div>
          <p className="text-xl font-bold sm:text-2xl">
            {formatCurrency(statistics.totalPoolBalance)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 bg-card">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-500" />
            <p className="text-xs text-muted-foreground">Total Contributions</p>
          </div>
          <p className="text-xl font-bold sm:text-2xl">
            {statistics.totalContributions}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 bg-card">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-purple-500" />
            <p className="text-xs text-muted-foreground">This Month</p>
          </div>
          <p className="text-xl font-bold sm:text-2xl">
            {formatCurrency(statistics.monthlyCollection)}
          </p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4 bg-card">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <p className="text-xs text-muted-foreground">From Loans</p>
          </div>
          <p className="text-xl font-bold sm:text-2xl">
            {statistics.totalFromLoans}
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <div className="h-full overflow-y-auto">
          <DataTable
            title={title}
            subtitle={subtitle}
            data={filteredContributions}
            columns={columns}
            keyField="id"
            isLoading={false}
            onRefresh={() => window.location.reload()}
            actions={{
              onExport: handleExport,
            }}
            filters={{
              searchFields: ["memberName", "memberNumber", "description"],
              enableDateFilter: true,
            }}
          />
        </div>
      </div>
    </div>
  );
}