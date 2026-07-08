"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Column, DataTable, TableActions } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Eye,
  DollarSign,
  User,
  Building,
  Calendar,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  RotateCcw,
  Printer,
} from "lucide-react";

import {
  Transaction,
  getTransactionTypeInfo,
  getTransactionStatusInfo,
  getTransactionChannelInfo,
  formatTransactionReference,
  isPositiveTransaction,
  canReverseTransaction,
} from "@/types/transactions";

import { formatISODate } from "@/lib/utils";

interface TransactionStatistics {
  totalTransactions: number;
  totalAmount: number;
  todayTransactions: number;
  todayAmount: number;
  pendingTransactions: number;
  failedTransactions: number;
  typeBreakdown: Array<{
    type: string;
    count: number;
    amount: number;
  }>;
  channelBreakdown: Array<{
    channel: string;
    count: number;
    amount: number;
  }>;
}

export default function TransactionListing({
  transactions,
  title,
  subtitle,
  statistics,
  userRole,
  currentUserId,
}: {
  transactions: Transaction[];
  title: string;
  subtitle: string;
  statistics: TransactionStatistics;
  userRole: string;
  currentUserId: string;
}) {
  const router = useRouter();

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Helper function to get owner info (member or institution)
  const getOwnerInfo = (transaction: Transaction) => {
    if (transaction.member) {
      return {
        type: "Member",
        name: transaction.member.user.name,
        identifier: transaction.member.memberNumber,
        email: transaction.member.user.email,
        phone: transaction.member.user.phone,
        image: transaction.member.user.image,
      };
    } else if (transaction.institution) {
      return {
        type: "Institution",
        name: transaction.institution.institutionName,
        identifier: transaction.institution.institutionNumber,
        email: transaction.institution.institutionEmail,
        phone: transaction.institution.institutionPhone,
        image: null,
      };
    }
    return {
      type: "Unknown",
      name: "N/A",
      identifier: "N/A",
      email: "N/A",
      phone: null,
      image: null,
    };
  };

  const columns: Column<Transaction>[] = [
    {
      accessorKey: "transactionRef",
      header: "Transaction Details",
      cell: (row) => {
        const transaction = row;
        const typeInfo = getTransactionTypeInfo(transaction.type);
        const statusInfo = getTransactionStatusInfo(transaction.status);

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">
                {transaction.transactionRef}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${typeInfo.color} text-xs`}>
                {typeInfo.icon} {typeInfo.label}
              </Badge>
              {transaction.externalReference && (
                <span className="text-xs text-gray-500 font-mono">
                  Ref: {transaction.externalReference}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "member",
      header: "Owner & Account",
      cell: (row) => {
        const transaction = row;
        const owner = getOwnerInfo(transaction);
        const account = transaction.account;

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              {owner.image ? (
                <img
                  src={owner.image}
                  alt={owner.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : owner.type === "Institution" ? (
                <Building className="h-5 w-5" />
              ) : (
                <User className="h-5 w-5" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">{owner.name}</span>
                <Badge variant="outline" className="text-xs">
                  {owner.type}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>{account.accountNumber}</span>
                <span>•</span>
                <span>{account.accountType.name.replace(/_/g, " ")}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount & Channel",
      cell: (row) => {
        const transaction = row;
        const isPositive = isPositiveTransaction(
          transaction.type,
          transaction.amount
        );
        const channelInfo = getTransactionChannelInfo(transaction.channel);

        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span
                className={`font-medium text-lg ${isPositive ? "text-green-600" : "text-red-600"}`}
              >
                {isPositive ? "+" : "-"}
                {formatCurrency(Math.abs(transaction.amount))}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Badge className={`${channelInfo.color} text-xs`}>
                {channelInfo.icon} {channelInfo.label}
              </Badge>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "id",
      header: "Actions",
      cell: (row) => {
        const transaction = row;
        const canReverse = canReverseTransaction(
          transaction,
          userRole,
          currentUserId
        );

        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/dashboard/transactions/${transaction.id}`)
              }
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            {canReverse && (
              <Button
                variant="outline"
                size="sm"
                className="text-orange-600 hover:text-orange-700"
                onClick={() =>
                  router.push(
                    `/dashboard/transactions/${transaction.id}?action=reverse`
                  )
                }
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reverse
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/v1/transactions/${transaction.id}/receipt`, '_blank')}
              className="bg-green-50 hover:bg-green-100 border-green-200"
            >
              <Printer className="h-4 w-4 mr-1" />
              Receipt
            </Button>
          </div>
        );
      },
    },
  ];

  // Export to Excel
  const handleExport = async (filteredTransactions: Transaction[]) => {
    try {
      const exportData = filteredTransactions.map((transaction) => {
        const owner = getOwnerInfo(transaction);

        return {
          "Transaction Reference": transaction.transactionRef,
          "Owner Type": owner.type,
          "Owner Name": owner.name,
          "Owner Identifier": owner.identifier,
          "Account Number": transaction.account.accountNumber,
          "Account Type": transaction.account.accountType.name.replace(
            /_/g,
            " "
          ),
          Branch: transaction.account.branch.name,
          "Transaction Type": getTransactionTypeInfo(transaction.type).label,
          Amount: transaction.amount,
          Status: getTransactionStatusInfo(transaction.status).label,
          Channel: getTransactionChannelInfo(transaction.channel).label,
          Description: transaction.description || "N/A",
          "Transaction Date": formatISODate(transaction.transactionDate),
          "Transaction Time": format(
            new Date(transaction.transactionDate),
            "HH:mm:ss"
          ),
          "Processed By": transaction.processedByUser?.name || "System",
          "External Reference": transaction.externalReference || "N/A",
          "Owner Email": owner.email,
          "Owner Phone": owner.phone || "N/A",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

      const fileName = `Transactions_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Transactions exported to ${fileName}`,
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {statistics.totalTransactions.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">All completed transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(statistics.totalAmount)}
            </div>
            <p className="text-xs text-gray-500">Total transaction value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Transactions
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {statistics.todayTransactions}
            </div>
            <p className="text-xs text-gray-500">
              {formatCurrency(statistics.todayAmount)} volume
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending & Failed
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {statistics.pendingTransactions + statistics.failedTransactions}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.pendingTransactions} pending,{" "}
              {statistics.failedTransactions} failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Type Breakdown */}
      {statistics.typeBreakdown && statistics.typeBreakdown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statistics.typeBreakdown
            .filter((type) => type.type)
            .map((type) => {
              const typeInfo = getTransactionTypeInfo(type.type as any);

              if (!typeInfo || !typeInfo.icon) {
                console.warn(`Invalid type info for: ${type.type}`);
                return null;
              }

              return (
                <Card key={type.type} className="bg-gray-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{typeInfo.icon}</span>
                        <div>
                          <p className="text-sm font-medium">
                            {typeInfo.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {type.count} transactions
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {formatCurrency(type.amount)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
            .filter(Boolean)}
        </div>
      )}

      {/* Channel Breakdown */}
      {statistics.channelBreakdown &&
        statistics.channelBreakdown.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statistics.channelBreakdown
              .filter((channel) => channel.channel)
              .map((channel) => {
                const channelInfo = getTransactionChannelInfo(channel.channel);

                if (!channelInfo || !channelInfo.icon) {
                  console.warn(`Invalid channel info for: ${channel.channel}`);
                  return null;
                }

                return (
                  <Card key={channel.channel} className="bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{channelInfo.icon}</span>
                          <div>
                            <p className="text-sm font-medium">
                              {channelInfo.label}
                            </p>
                            <p className="text-xs text-gray-500">
                              {channel.count} transactions
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">
                            {formatCurrency(channel.amount)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
              .filter(Boolean)}
          </div>
        )}

      <DataTable<Transaction>
        title={title}
        subtitle={subtitle}
        data={transactions}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onExport: handleExport,
        }}
        filters={{
          searchFields: [
            "transactionRef",
            "member.user.name",
            "member.memberNumber",
            "institution.institutionName",
            "institution.institutionNumber",
            "account.accountNumber",
            "description",
            "externalReference",
            "processedByUser.name",
          ],
          enableDateFilter: true,
          getItemDate: (item) => item.transactionDate,
        }}
        renderRowActions={(item) => <TableActions.RowActions />}
      />
    </div>
  );
}
