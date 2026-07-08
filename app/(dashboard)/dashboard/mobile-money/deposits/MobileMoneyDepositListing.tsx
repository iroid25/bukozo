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
  TrendingUp,
  User,
  CreditCard,
  DollarSign,
  Phone,
  Calendar,
  Smartphone,
  Plus,
  Building,
} from "lucide-react";

import { formatISODate } from "@/lib/utils";
import {
  MobileMoneyDeposit,
  MobileMoneyStatistics,
  getDepositOwnerName,
  getDepositOwnerNumber,
  getDepositOwnerType,
  getDepositOwnerEmail,
  getDepositOwnerPhone,
  isMemberDeposit,
  isInstitutionDeposit,
} from "@/types/mobileMoney";
import MobileMoneyDepositCreateForm from "./MobileMoneyDepositCreateForm";

export default function MobileMoneyDepositListing({
  deposits,
  title,
  subtitle,
  statistics,
  userRole,
  currentUserId,
}: {
  deposits: MobileMoneyDeposit[];
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

  const columns: Column<MobileMoneyDeposit>[] = [
    {
      accessorKey: "transaction",
      header: "Transaction Details",
      cell: (row) => {
        const deposit = row;

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {deposit.transaction.transactionRef}
                </span>
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                  Mobile Money
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
      // ✅ Use accessor function for sorting/filtering
      accessorKey: (row) => getDepositOwnerName(row),
      header: "Owner Info",
      cell: (row) => {
        const deposit = row;

        // ✅ Member deposit
        if (isMemberDeposit(deposit)) {
          const member = deposit.member;
          const user = member.user;

          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
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
                  <Badge variant="outline" className="text-xs">
                    Member
                  </Badge>
                  <span>#{member.memberNumber}</span>
                </div>
              </div>
            </div>
          );
        }

        // ✅ Institution deposit
        if (isInstitutionDeposit(deposit)) {
          const institution = deposit.institution;

          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <Building className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">
                  {institution.institutionName}
                </span>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Badge variant="outline" className="text-xs bg-purple-50">
                    Institution
                  </Badge>
                  <span>#{institution.institutionNumber}</span>
                </div>
              </div>
            </div>
          );
        }

        // Fallback
        return <div className="text-sm text-gray-500">Unknown Owner</div>;
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
            <div className="flex flex-col">
              <span className="font-medium text-green-700 text-lg">
                {formatCurrency(deposit.amount)}
              </span>
              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                REF: {deposit.mobileMoneyRef || "N/A"}
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
  const handleExport = async (filteredDeposits: MobileMoneyDeposit[]) => {
    try {
      // Prepare data for export
      const exportData = filteredDeposits.map((deposit) => ({
        "Transaction Ref": deposit.transaction.transactionRef,
        "Owner Type": getDepositOwnerType(deposit),
        "Owner Name": getDepositOwnerName(deposit),
        "Owner Number": getDepositOwnerNumber(deposit),
        "Account Number": deposit.account.accountNumber,
        "Account Type": getAccountTypeDisplayName(
          deposit.account.accountType.name
        ),
        Amount: deposit.amount,
        "Mobile Money Ref": deposit.mobileMoneyRef || "N/A",
        "Depositor Name": deposit.depositorName || "N/A",
        Branch: deposit.account.branch.name,
        "Branch Location": deposit.account.branch.location,
        "Processed By": deposit.handler.name,
        "Handler Role": deposit.handler.role,
        "Deposit Date": formatISODate(deposit.depositDate),
        Description: deposit.transaction.description || "N/A",
        "Transaction Status": deposit.transaction.status,
        "Owner Email": getDepositOwnerEmail(deposit) || "N/A",
        "Owner Phone": getDepositOwnerPhone(deposit) || "N/A",
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Mobile Money Deposits"
      );

      // Generate filename with current date
      const fileName = `Mobile_Money_Deposits_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      // Export to file
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Mobile money deposits exported to ${fileName}`,
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
              Today's Mobile Deposits
            </CardTitle>
            <Smartphone className="h-4 w-4 text-green-600" />
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
              Total Mobile Deposits
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
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

      <MobileMoneyDepositCreateForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentUserId={currentUserId}
      />

      <DataTable<MobileMoneyDeposit>
        title={title}
        subtitle={subtitle}
        data={deposits}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onAdd: ["ADMIN", "MANAGER", "TELLER", "AGENT"].includes(userRole)
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
          getItemDate: (item) => item.depositDate,
        }}
      />
    </div>
  );
}
