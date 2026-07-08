"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingDown,
  User,
  CreditCard,
  DollarSign,
  Phone,
  Calendar,
  Smartphone,
  Plus,
  Building2,
} from "lucide-react";

import { formatISODate } from "@/lib/utils";
import {
  MobileMoneyStatistics,
  MobileMoneyWithdrawal,
  getWithdrawalOwnerEmail,
  getWithdrawalOwnerPhone,
  getWithdrawalOwnerType,
  getWithdrawalOwnerName,
  getWithdrawalOwnerNumber,
} from "@/types/mobileMoney";
import MobileMoneyWithdrawalCreateForm from "./WithdrawalForm";

export default function MobileMoneyWithdrawalListing({
  withdrawals,
  title,
  subtitle,
  statistics,
  userRole,
  currentUserId,
}: {
  withdrawals: MobileMoneyWithdrawal[];
  title: string;
  subtitle: string;
  statistics: MobileMoneyStatistics;
  userRole: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

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

  const columns: Column<MobileMoneyWithdrawal>[] = [
    {
      accessorKey: "transaction",
      header: "Transaction Details",
      cell: (row) => {
        const withdrawal = row;

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {withdrawal.transaction.transactionRef}
                </span>
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                  Mobile Money
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
      accessorKey: "member",
      header: "Member/Institution Info",
      cell: (row) => {
        const withdrawal = row;

        // ✅ Handle both member and institution cases
        if (withdrawal.member) {
          const member = withdrawal.member;
          const user = member.user;

          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{user.name}</span>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <span>#{member.memberNumber}</span>
                  <Badge variant="outline" className="text-xs">
                    Member
                  </Badge>
                </div>
              </div>
            </div>
          );
        }

        if (withdrawal.institution) {
          const institution = withdrawal.institution;

          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">
                  {institution.institutionName}
                </span>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <span>#{institution.institutionNumber}</span>
                  <Badge variant="outline" className="text-xs">
                    Institution
                  </Badge>
                </div>
              </div>
            </div>
          );
        }

        // ✅ Fallback for unknown cases
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
              <User className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-gray-500">Unknown</span>
              <span className="text-sm text-gray-400">N/A</span>
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
            <DollarSign className="h-4 w-4 text-red-600" />
            <div className="flex flex-col">
              <span className="font-medium text-red-700 text-lg">
                {formatCurrency(withdrawal.amount)}
              </span>
              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                {withdrawal.mobileMoneyRef || "N/A"}
              </span>
            </div>
          </div>
        );
      },
    },
  ];

  const handleAddNew = () => {
    setModalOpen(true);
  };

  // Export to Excel
  const handleExport = async (filteredWithdrawals: MobileMoneyWithdrawal[]) => {
    try {
      // Prepare data for export
      const exportData = filteredWithdrawals.map((withdrawal) => {
        return {
          "Transaction Ref": withdrawal.transaction.transactionRef,
          "Owner Type": getWithdrawalOwnerType(withdrawal),
          "Owner Name": getWithdrawalOwnerName(withdrawal),
          "Owner Number": getWithdrawalOwnerNumber(withdrawal),
          "Account Number": withdrawal.account.accountNumber,
          "Account Type": getAccountTypeDisplayName(
            withdrawal.account.accountType.name
          ),
          Amount: withdrawal.amount,
          "Mobile Money Ref": withdrawal.mobileMoneyRef || "N/A",
          Branch: withdrawal.account.branch.name,
          "Processed By": withdrawal.handler.name,
          "Handler Role": withdrawal.handler.role,
          "Withdrawal Date": formatISODate(withdrawal.withdrawalDate),
          Description: withdrawal.transaction.description || "N/A",
          "Transaction Status": withdrawal.transaction.status,
          "Owner Email": getWithdrawalOwnerEmail(withdrawal) || "N/A",
          "Owner Phone": getWithdrawalOwnerPhone(withdrawal) || "N/A",
        };
      });

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Mobile Money Withdrawals"
      );

      // Generate filename with current date
      const fileName = `Mobile_Money_Withdrawals_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      // Export to file
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Mobile money withdrawals exported to ${fileName}`,
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
              Today's Mobile Withdrawals
            </CardTitle>
            <Smartphone className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
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
              Total Mobile Withdrawals
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-purple-600" />
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

      <MobileMoneyWithdrawalCreateForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentUserId={currentUserId}
      />

      <DataTable<MobileMoneyWithdrawal>
        title={title}
        subtitle={subtitle}
        data={withdrawals}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onAdd: ["ADMIN", "MANAGER", "TELLER"].includes(userRole)
            ? handleAddNew
            : undefined,
          onExport: handleExport,
        }}
        filters={{
          searchFields: [
            "transaction.transactionRef",
            "member.user.name",
            "member.memberNumber",
            "institution.institutionName",
            "institution.institutionNumber",
            "account.accountNumber",
            "mobileMoneyRef",
          ],
          enableDateFilter: true,
          getItemDate: (item) => item.withdrawalDate,
        }}
      />
    </div>
  );
}
