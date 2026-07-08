// components/my-account/MyAccountOverview.tsx
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
  Wallet,
  PiggyBank,
  HandCoins,
  Receipt,
  Activity,
  Phone,
  Mail,
  MapPin,
  Hash,
  Banknote,
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

interface MyAccountData {
  member: {
    id: string;
    memberNumber: string;
    user: {
      id: string;
      name: string;
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      image: string | null;
      createdAt: string | Date;
    };
    accounts: Array<{
      id: string;
      accountNumber: string;
      balance: number;
      status: string;
      openedAt: string | Date;
      accountType: {
        id: string;
        name: string;
        interestRate: number;
        minBalance: number;
      };
      branch: {
        name: string;
        location: string;
      };
      _count: {
        transactions: number;
      };
    }>;
    loans: Array<{
      id: string;
      loanRef: string;
      amountGranted: number;
      outstandingBalance: number;
      amountPaid: number;
      status: string;
      disbursementDate: string | Date;
      dueDate: string | Date;
      branch: {
        name: string;
      };
      _count: {
        repayments: number;
      };
    }>;
    _count: {
      accounts: number;
      loans: number;
    };
  };
  statistics: {
    totalBalance: number;
    accountsCount: number;
    accountBalances: Array<{
      type: string;
      balance: number;
    }>;
    totalTransactions: number;
    todayTransactions: number;
    thisMonthTransactions: number;
    todayAmount: number;
    pendingTransactions: number;
    failedTransactions: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalLoans: number;
    activeLoans: number;
    totalLoanAmount: number;
    outstandingLoanBalance: number;
    totalLoanRepaid: number;
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
  };
  transactions: Transaction[];
}

export default function MyAccountOverview({
  member,
  statistics,
  transactions,
  userRole,
  currentUserId,
}: MyAccountData & {
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

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString("en-UG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getLoanStatusBadge = (status: string) => {
    const statusConfig = {
      DISBURSED: { color: "bg-green-100 text-green-800", label: "Active" },
      OVERDUE: { color: "bg-red-100 text-red-800", label: "Overdue" },
      REPAID: { color: "bg-gray-100 text-gray-800", label: "Repaid" },
      PENDING: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-100 text-gray-800",
      label: status,
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.label}
      </span>
    );
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
                className={`font-medium text-lg ${
                  isPositive ? "text-green-600" : "text-red-600"
                }`}
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
      accessorKey: "transactionDate",
      header: "Date & Status",
      cell: (row) => {
        const transaction = row;
        const statusInfo = getTransactionStatusInfo(transaction.status);

        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div className="flex flex-col">
                <span className="font-medium text-sm">
                  {formatISODate(transaction.transactionDate)}
                </span>
                <span className="text-xs text-gray-500">
                  {format(new Date(transaction.transactionDate), "HH:mm:ss")}
                </span>
              </div>
            </div>
            <Badge className={statusInfo.color}>
              {statusInfo.icon} {statusInfo.label}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "id",
      header: "Actions",
      cell: (row) => {
        const transaction = row;
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
          </div>
        );
      },
    },
  ];

  // Export to Excel
  const handleExport = async (filteredTransactions: Transaction[]) => {
    try {
      const exportData = filteredTransactions.map((transaction) => ({
        "Transaction Reference": transaction.transactionRef,
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
        "External Reference": transaction.externalReference || "N/A",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "My_Transactions");

      const fileName = `My_Transactions_${format(
        new Date(),
        "yyyy-MM-dd"
      )}.xlsx`;
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
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center">
              {member.user.image ? (
                <img
                  src={member.user.image}
                  alt={member.user.name}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <User className="h-10 w-10 text-blue-600" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {member.user.name}
              </h1>
              <p className="text-gray-600 mb-2">
                Member #{member.memberNumber}
              </p>
              <div className="flex flex-col gap-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{member.user.email}</span>
                </div>
                {member.user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{member.user.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Member since {formatDate(member.user.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 md:ml-auto">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">
                  Total Balance
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(statistics.totalBalance)}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">
                  Accounts
                </span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {statistics.accountsCount}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-600">
                  Loans
                </span>
              </div>
              <p className="text-2xl font-bold text-purple-700">
                {statistics.totalLoans}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-600">
                  Transactions
                </span>
              </div>
              <p className="text-2xl font-bold text-orange-700">
                {statistics.totalTransactions}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(statistics.totalBalance)}
            </div>
            <p className="text-xs text-gray-500">
              Across {statistics.accountsCount} account
              {statistics.accountsCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Deposits
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(statistics.totalDeposits)}
            </div>
            <p className="text-xs text-gray-500">All-time deposits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Outstanding Loans
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {formatCurrency(statistics.outstandingLoanBalance)}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.activeLoans} active loan
              {statistics.activeLoans !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {statistics.thisMonthTransactions}
            </div>
            <p className="text-xs text-gray-500">Transactions this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Account Details */}
      {member.accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                My Accounts ({member.accounts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {member.accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/accounts/${account.id}`)
                    }
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {account.accountType.name.replace(/_/g, " ")}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {account.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 font-mono">
                        {account.accountNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {account.branch.name} • {account._count.transactions}{" "}
                        transactions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(account.balance)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Opened {formatDate(account.openedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Loans Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5" />
                My Loans ({member.loans.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {member.loans.length > 0 ? (
                <div className="space-y-4">
                  {member.loans.slice(0, 3).map((loan) => (
                    <div
                      key={loan.id}
                      className="flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/dashboard/loans/${loan.id}`)}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">
                            Loan {loan.loanRef}
                          </span>
                          {getLoanStatusBadge(loan.status)}
                        </div>
                        <p className="text-sm text-gray-600">
                          {loan.branch.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Due: {formatDate(loan.dueDate)} •{" "}
                          {loan._count.repayments} payments
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(loan.outstandingBalance)}
                        </p>
                        <p className="text-xs text-gray-500">
                          of {formatCurrency(loan.amountGranted)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {member.loans.length > 3 && (
                    <div className="text-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/dashboard/loans")}
                      >
                        View All {member.loans.length} Loans
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <PiggyBank className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No loans found</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => router.push("/dashboard/loan-applications")}
                  >
                    Apply for Loan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transaction Breakdown */}
      {(statistics.typeBreakdown.length > 0 ||
        statistics.channelBreakdown.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Transaction Type Breakdown */}
          {statistics.typeBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Transaction Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statistics.typeBreakdown.map((type) => {
                    const typeInfo = getTransactionTypeInfo(type.type as any);
                    return (
                      <div
                        key={type.type}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{typeInfo.icon}</span>
                          <div>
                            <p className="font-medium text-gray-900">
                              {typeInfo.label}
                            </p>
                            <p className="text-sm text-gray-600">
                              {type.count} transactions
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            {formatCurrency(type.amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Channel Breakdown */}
          {statistics.channelBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Transaction Channels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statistics.channelBreakdown.map((channel) => {
                    const channelInfo = getTransactionChannelInfo(
                      channel.channel
                    );
                    return (
                      <div
                        key={channel.channel}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{channelInfo.icon}</span>
                          <div>
                            <p className="font-medium text-gray-900">
                              {channelInfo.label}
                            </p>
                            <p className="text-sm text-gray-600">
                              {channel.count} transactions
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            {formatCurrency(channel.amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* My Transactions Table */}
      <DataTable<Transaction>
        title={`My Transactions (${transactions.length})`}
        subtitle="Your complete transaction history"
        data={transactions}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onExport: handleExport,
        }}
        filters={{
          searchFields: ["transactionRef", "description", "externalReference"],
          enableDateFilter: true,
          getItemDate: (item) => item.transactionDate,
        }}
        renderRowActions={(item) => <TableActions.RowActions />}
      />
    </div>
  );
}
