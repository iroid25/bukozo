// @ts-nocheck
"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";

import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  DollarSign,
  CreditCard,
  Calendar,
  TrendingDown,
  Building,
  Phone,
  FileText,
  ArrowDownLeft,
  Download,
} from "lucide-react";

import { formatISODate } from "@/lib/utils";
import { getWithdrawalChannelInfo, Withdrawal } from "@/types/withdraw";

interface MemberWithdrawalStatistics {
  today: {
    amount: number;
    count: {
      id: number;
    };
  };
  thisMonth: {
    amount: number;
    count: {
      id: number;
    };
  };
  total: {
    amount: number;
    count: {
      id: number;
    };
  };
}

export default function MemberWithdrawalListing({
  withdrawals,
  title,
  subtitle,
  statistics,
  currentUserId,
  memberId,
}: {
  withdrawals: Withdrawal[];
  title: string;
  subtitle: string;
  statistics: MemberWithdrawalStatistics;
  currentUserId: string;
  memberId: string;
}) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get account type display name
  const getAccountTypeDisplayName = (name: string) => {
    const displayNames: { [key: string]: string } = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  };

  // Helper to convert string to Date
  const toDate = (date: Date | string): Date => {
    return typeof date === "string" ? new Date(date) : date;
  };

  // Get channel display info
  const getChannelInfo = (channel: string | null) => {
    const channelInfo = getWithdrawalChannelInfo(channel || "N/A");
    return (
      <Badge variant="outline" className={channelInfo.color}>
        {channelInfo.icon} {channelInfo.label}
      </Badge>
    );
  };

  const columns: Column<Withdrawal>[] = [
    {
      accessorKey: "transaction",
      header: "Transaction Details",
      cell: (row) => {
        const withdrawal = row;

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {withdrawal.transaction.transactionRef}
                </span>
                <Badge
                  variant={
                    withdrawal.transaction.status === "COMPLETED"
                      ? "default"
                      : "secondary"
                  }
                >
                  {withdrawal.transaction.status}
                </Badge>
              </div>
              <span className="text-sm text-gray-500">
                {formatISODate(withdrawal.withdrawalDate)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "account",
      header: "Account Details",
      cell: (row) => {
        const withdrawal = row;
        const account = withdrawal.account;

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <CreditCard className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{account.accountNumber}</span>
            </div>
            <span className="text-sm text-gray-500">
              {getAccountTypeDisplayName(account.accountType.name)}
            </span>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Building className="h-3 w-3" />
              <span>{account.branch.name}</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (row) => {
        const withdrawal = row;

        return (
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-700 text-lg">
              {formatCurrency(withdrawal.amount)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "channel",
      header: "Payment Method",
      cell: (row) => {
        const withdrawal = row;

        return (
          <div className="flex flex-col gap-1">
            {getChannelInfo(withdrawal.channel)}
            {withdrawal.mobileMoneyRef && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Phone className="h-3 w-3" />
                <span>Ref: {withdrawal.mobileMoneyRef}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "handler",
      header: "Processed By",
      cell: (row) => {
        const withdrawal = row;
        const handler = withdrawal.handler;

        return (
          <div className="flex flex-col">
            <span className="font-medium">{handler.name}</span>
            <Badge variant="outline" className="text-xs w-fit">
              {handler.role}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: (row) => row.transaction.description,
      header: "Description",
      cell: (row) => {
        const withdrawal = row;
        const description =
          withdrawal.transaction.description || "No description";

        return (
          <div className="max-w-[200px]">
            <span className="text-sm text-gray-600 line-clamp-2">
              {description}
            </span>
          </div>
        );
      },
    },
  ];

  // Export to Excel
  const handleExport = async (filteredWithdrawals: Withdrawal[]) => {
    try {
      // Prepare data for export
      const exportData = filteredWithdrawals.map((withdrawal) => ({
        "Transaction Ref": withdrawal.transaction.transactionRef,
        "Account Number": withdrawal.account.accountNumber,
        "Account Type": getAccountTypeDisplayName(
          withdrawal.account.accountType.name
        ),
        Amount: withdrawal.amount,
        Channel: withdrawal.channel || "N/A",
        "Mobile Money Ref": withdrawal.mobileMoneyRef || "N/A",
        Branch: withdrawal.account.branch.name,
        "Branch Location": withdrawal.account.branch.location,
        "Processed By": withdrawal.handler.name,
        "Handler Role": withdrawal.handler.role,
        "Withdrawal Date": formatISODate(withdrawal.withdrawalDate),
        Description: withdrawal.transaction.description || "N/A",
        "Transaction Status": withdrawal.transaction.status,
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "My Withdrawals");

      // Generate filename with current date
      const fileName = `My_Withdrawals_${format(
        new Date(),
        "yyyy-MM-dd"
      )}.xlsx`;

      // Export to file
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Withdrawals exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Withdrawals
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {formatCurrency(statistics.today.amount)}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.today.count.id} transactions today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(statistics.thisMonth.amount)}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.thisMonth.count.id} transactions this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Withdrawals
            </CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {formatCurrency(statistics.total.amount)}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.total.count.id} total transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <DataTable<Withdrawal>
        title={title}
        subtitle={subtitle}
        data={withdrawals}
        columns={columns}
        keyField="id"
        isLoading={false}
        actions={{
          onExport: handleExport,
        }}
        filters={{
          searchFields: [
            "transaction.transactionRef",
            "account.accountNumber",
            "channel",
          ],
          enableDateFilter: true,
          getItemDate: (item) => toDate(item.withdrawalDate), // ✅ Convert to Date
        }}
      />
    </div>
  );
}
