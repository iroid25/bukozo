"use client";
import React from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Eye,
  DollarSign,
  User,
  CreditCard,
  Calendar,
  TrendingUp,
  Building,
  Phone,
  FileText,
  Banknote,
  Smartphone,
  Building2,
  RefreshCcw,
} from "lucide-react";
import { useState } from "react";

import { Deposit, getChannelInfo } from "@/types/deposits";
import { formatISODate } from "@/lib/utils";

// Fixed interface to match your statistics structure
interface MemberDepositStatistics {
  today: {
    amount: number;
    count: number;
  };
  thisMonth: {
    amount: number;
    count: number;
  };
  total: {
    amount: number;
    count: number;
  };
}

export default function MemberDepositListing({
  deposits,
  statistics,
  memberName,
}: {
  deposits: Deposit[];
  statistics: MemberDepositStatistics;
  memberName: string;
}) {
  const router = useRouter();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const handleVerify = async (id: string, transactionId: string) => {
    try {
      setVerifyingId(id);
      const res = await fetch("/api/v1/relworx/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });

      const data = await res.json();

      if (data.status === "COMPLETED") {
        toast.success("Payment Confirmed!", {
          description: "Your balance has been updated.",
        });
        router.refresh();
      } else if (data.status === "FAILED") {
        toast.error("Payment Failed", {
          description: "The transaction was unsuccessful.",
        });
        router.refresh();
      } else {
        toast.info(data.message || "Still pending...", {
          description: "Please check again in a few moments.",
        });
      }
    } catch (error) {
      toast.error("Verification error", {
        description: "Could not connect to the verification service.",
      });
    } finally {
      setVerifyingId(null);
    }
  };

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
    const displayNames: Record<string, string> = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
      SHARES: "Shares Account",
      LOAN_SAVINGS: "Loan Savings",
      CURRENT: "Current Account",
    };
    return displayNames[name] || name;
  };

  // Get channel icon component
  const getChannelIcon = (channel: string): React.ReactElement => {
    const iconMap: Record<string, React.ReactElement> = {
      CASH: <Banknote className="h-3 w-3" />,
      MOBILE_MONEY: <Smartphone className="h-3 w-3" />,
      BANK: <Building2 className="h-3 w-3" />,
      BANK_TRANSFER: <Building2 className="h-3 w-3" />,
    };

    return iconMap[channel] || <FileText className="h-3 w-3" />;
  };

  const columns: Column<Deposit>[] = [
    {
      accessorKey: "transaction",
      header: "Transaction Details",
      cell: (row) => {
        const deposit = row;
        const channelInfo = getChannelInfo(deposit.channel);

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {deposit.transaction.transactionRef}
                </span>
                <Badge className={channelInfo.color}>
                  <span className="mr-1">{channelInfo.icon}</span>
                  {channelInfo.label}
                </Badge>
              </div>
              <span className="text-sm text-gray-500">
                {formatISODate(deposit.depositDate)}
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
        const deposit = row;
        const account = deposit.account;

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
        const deposit = row;

        return (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-700 text-lg">
              {formatCurrency(deposit.amount)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "channel",
      header: "Payment Method",
      cell: (row) => {
        const deposit = row;
        const channelInfo = getChannelInfo(deposit.channel);

        return (
          <div className="flex flex-col gap-1">
            <Badge className={channelInfo.color}>
              <span className="mr-1">{getChannelIcon(deposit.channel)}</span>
              {channelInfo.label}
            </Badge>
            {deposit.mobileMoneyRef && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Phone className="h-3 w-3" />
                <span>Ref: {deposit.mobileMoneyRef}</span>
              </div>
            )}
            {deposit.depositorName && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <User className="h-3 w-3" />
                <span>{deposit.depositorName}</span>
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
        const deposit = row;
        const handler = deposit.handler;

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
      accessorKey: "id",
      header: "Actions",
      cell: (row) => {
        const deposit = row;
        const isPending = deposit.transaction.status === "PENDING";

        return (
          <div className="flex gap-2">
            {isPending && (
              <Button
                variant="default"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={verifyingId === deposit.id}
                onClick={() => handleVerify(deposit.id, deposit.transaction.id)}
              >
                <RefreshCcw className={`h-4 w-4 mr-1 ${verifyingId === deposit.id ? "animate-spin" : ""}`} />
                {verifyingId === deposit.id ? "Verifying..." : "Verify Payment"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/deposits/${deposit.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </Button>
          </div>
        );
      },
    },
  ];

  // Export to Excel (member-specific data)
  const handleExport = async (filteredDeposits: Deposit[]) => {
    try {
      // Prepare data for export
      const exportData = filteredDeposits.map((deposit) => ({
        "Transaction Ref": deposit.transaction.transactionRef,
        "Account Number": deposit.account.accountNumber,
        "Account Type": getAccountTypeDisplayName(
          deposit.account.accountType.name
        ),
        Amount: deposit.amount,
        Channel: deposit.channel,
        "Mobile Money Ref": deposit.mobileMoneyRef || "N/A",
        "Depositor Name": deposit.depositorName || "Self",
        Branch: deposit.account.branch.name,
        "Branch Location": deposit.account.branch.location,
        "Processed By": deposit.handler.name,
        "Handler Role": deposit.handler.role,
        "Deposit Date": formatISODate(deposit.depositDate),
        Description: deposit.transaction.description || "N/A",
        "Transaction Status": deposit.transaction.status,
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "My Deposits");

      // Generate filename with current date and member name
      const fileName = `My_Deposits_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      // Export to file
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Your deposits exported to ${fileName}`,
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
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-6 w-6 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">My Deposits</h1>
        </div>
        <p className="text-gray-600">
          View and manage your deposit transactions
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Deposits
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(statistics.today.amount)}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.today.count} transactions today
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
              {statistics.thisMonth.count} transactions this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Deposits
            </CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {formatCurrency(statistics.total.amount)}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.total.count} total transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <DataTable<Deposit>
        title="Deposit History"
        subtitle="Your deposit transaction history and details"
        data={deposits}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          // Members can't add new deposits directly - they're processed by staff
          onExport: handleExport,
        }}
        filters={{
          searchFields: [
            "transaction.transactionRef",
            "account.accountNumber",
            "account.accountType.name",
          ],
          enableDateFilter: true,
          getItemDate: (item) => item.depositDate,
        }}
      />

      {/* Empty State */}
      {deposits.length === 0 && (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Deposits Yet
          </h3>
          <p className="text-gray-600 mb-4">
            You haven't made any deposits yet. Visit your nearest branch or
            contact a teller to make your first deposit.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/branches")}
          >
            <Building className="h-4 w-4 mr-2" />
            Find a Branch
          </Button>
        </div>
      )}
    </div>
  );
}
