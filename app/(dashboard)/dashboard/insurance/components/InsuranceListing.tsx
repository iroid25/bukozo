// @ts-nocheck
// FILE: app/dashboard/insurance/components/InsuranceListing.tsx

"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Column, DataTable, TableActions } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Shield,
  DollarSign,
  TrendingUp,
  Users,
  Download,
  Plus,
} from "lucide-react";

interface InsuranceRecord {
  id: string;
  amount: number;
  type: string;
  description: string;
  memberName?: string;
  memberNumber?: string;
  accountNumber?: string;
  reference?: string;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
}

interface InsuranceStatistics {
  totalPoolBalance: number;
  totalCollected: number;
  totalPaidOut: number;
  monthlyCollection: number;
  membersCovered: number;
  averageContribution: number;
}

// Look for your InsuranceListingProps interface and update it like this:

import { InsuranceRecord, InsuranceStatistics } from "@/types/insurance";

export interface InsuranceListingProps {
  title: string;
  subtitle: string;
  insuranceRecords: InsuranceRecord[]; // Use the InsuranceRecord type from types/insurance.ts
  statistics: InsuranceStatistics;
  userRole: string;
  currentUserId: string;
}

export default function InsuranceListing({
  title,
  subtitle,
  insuranceRecords,
  statistics,
  userRole,
  currentUserId,
}: InsuranceListingProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  // Filter records based on search
  const filteredRecords = insuranceRecords.filter((record) => {
    const search = searchTerm.toLowerCase();
    return (
      record.memberName?.toLowerCase().includes(search) ||
      record.memberNumber?.toLowerCase().includes(search) ||
      record.accountNumber?.toLowerCase().includes(search) ||
      record.description?.toLowerCase().includes(search) ||
      record.reference?.toLowerCase().includes(search)
    );
  });

  // Export to Excel
  const handleExportToExcel = () => {
    const exportData = filteredRecords.map((record) => ({
      Date: format(new Date(record.createdAt), "dd/MM/yyyy HH:mm"),
      Type: record.type,
      "Member Name": record.memberName || "N/A",
      "Member Number": record.memberNumber || "N/A",
      "Account Number": record.accountNumber || "N/A",
      Amount: record.amount,
      Description: record.description,
      Reference: record.reference || "N/A",
      "Created By": record.createdByName || "System",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Insurance Records");

    // Auto-size columns
    const maxWidth = 50;
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.min(
        Math.max(
          key.length,
          ...exportData.map((row) => String(row[key] || "").length)
        ),
        maxWidth
      ),
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(
      wb,
      `Insurance_Records_${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );
    toast.success("Insurance records exported successfully");
  };

  // Define columns for data table
  const columns: Column<InsuranceRecord>[] = [
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: (row) => format(new Date(row.createdAt), "dd/MM/yyyy HH:mm"),
    },
    {
      header: "Type",
      accessorKey: "type",
      cell: (row) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            row.type === "CONTRIBUTION"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {row.type}
        </span>
      ),
    },
    {
      header: "Member",
      accessorKey: "memberName",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.memberName || "SACCO"}</div>
          <div className="text-xs text-gray-500">
            {row.memberNumber || "N/A"}
          </div>
        </div>
      ),
    },
    {
      header: "Account",
      accessorKey: "accountNumber",
      cell: (row) => (
        <span className="font-mono text-xs">{row.accountNumber || "N/A"}</span>
      ),
    },
    {
      header: "Amount",
      accessorKey: "amount",
      cell: (row) => (
        <span className="font-semibold">UGX {row.amount.toLocaleString()}</span>
      ),
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: (row) => (
        <div className="max-w-xs truncate" title={row.description}>
          {row.description}
        </div>
      ),
    },
    {
      header: "Reference",
      accessorKey: "reference",
      cell: (row) => (
        <span className="text-xs text-gray-600">{row.reference || "N/A"}</span>
      ),
    },
    {
      header: "Created By",
      accessorKey: "createdByName",
      cell: (row) => (
        <span className="text-xs">{row.createdByName || "System"}</span>
      ),
    },
  ];

  // Statistics cards
  const statsCards = [
    {
      title: "Insurance Pool Balance",
      value: `UGX ${statistics.totalPoolBalance.toLocaleString()}`,
      icon: Shield,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Total Collected",
      value: `UGX ${statistics.totalCollected.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Paid Out",
      value: `UGX ${statistics.totalPaidOut.toLocaleString()}`,
      icon: DollarSign,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Members Covered",
      value: statistics.membersCovered.toString(),
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  const canRecordPayment = ["ADMIN", "ACCOUNTANT"].includes(userRole);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportToExcel}
            disabled={filteredRecords.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          {canRecordPayment && (
            <Button
              onClick={() => router.push("/dashboard/insurance/record-payment")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Monthly Collection Card */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              This Month's Collection
            </p>
            <p className="text-3xl font-bold text-blue-700">
              UGX {statistics.monthlyCollection.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Average Contribution</p>
            <p className="text-xl font-semibold text-indigo-600">
              UGX {statistics.averageContribution.toLocaleString()}
            </p>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card>
        <DataTable
          columns={columns}
          data={filteredRecords}
          searchable
          searchPlaceholder="Search by member, account, or description..."
          onSearchChange={setSearchTerm}
        />
      </Card>
    </div>
  );
}
