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
  CreditCard,
  Calendar,
  TrendingUp,
  Building,
  Plus,
} from "lucide-react";

import { Deposit, getChannelInfo } from "@/types/deposits";
import DepositCreateForm from "./DepositCreateForm";
import { formatISODate } from "@/lib/utils";
import Link from "next/link";
import PrintReceiptButton from "./PrintReceiptButton";

interface DepositStatistics {
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

export default function DepositListing({
  deposits,
  title,
  subtitle,
  statistics,
  userRole,
  currentUserId,
}: {
  deposits: Deposit[];
  title: string;
  subtitle: string;
  statistics: DepositStatistics;
  userRole: any;
  currentUserId: string;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const canCreateDeposit = ["TELLER", "AGENT"].includes(userRole);
  const canViewDepositList = userRole !== "AGENT";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getAccountTypeDisplayName = (name: string) => {
    const displayNames: { [key: string]: string } = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  };

  const columns: Column<Deposit>[] = [
    {
      accessorKey: "transaction",
      header: "Transaction Details",
      cell: (row) => {
        const deposit = row;

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
      accessorKey: (row) =>
        row.member?.user.name ||
        row.institution?.institutionName ||
        row.institution?.user?.name ||
        row.institutionName ||
        row.depositorName ||
        "Unknown",
      header: "Owner Info",
      cell: (row) => {
        const deposit = row;
        const isMemberDeposit = !!deposit.member;

        if (isMemberDeposit) {
          const member = deposit.member!;
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

        if (deposit.institution) {
          const institution = deposit.institution;
          const institutionLabel =
            institution.institutionName ||
            institution.user?.name ||
            deposit.institutionName ||
            deposit.depositorName ||
            "Institution";

          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <Building className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{institutionLabel}</span>
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

        if (deposit.institutionName) {
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <Building className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{deposit.institutionName}</span>
                <Badge variant="outline" className="text-xs bg-purple-50">
                  Institution
                </Badge>
              </div>
            </div>
          );
        }

        if (deposit.depositorName) {
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <Building className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{deposit.depositorName}</span>
                <Badge variant="outline" className="text-xs bg-purple-50">
                  Institution
                </Badge>
              </div>
            </div>
          );
        }

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
            <span className="font-medium text-green-700 text-lg">
              {formatCurrency(deposit.amount)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "id",
      header: "Actions",
      cell: (row) => {
        const deposit = row;

        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/deposits/${deposit.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            <PrintReceiptButton id={deposit.id} prefix="deposits" />
          </div>
        );
      },
    },
  ];

  const handleAddNew = async () => {
    if (canCreateDeposit) {
      try {
        const response = await fetch("/api/v1/floats/me", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to check float status");
        }

        const floatCheck = {
          userFloat: result.data?.userFloat || null,
        };

        if (!floatCheck.userFloat) {
          toast.error("No Float Account", {
            description:
              "You don't have a float account. Please contact your branch manager.",
          });
          return;
        }

        if (!floatCheck.userFloat.isActiveForDay) {
          toast.error("Float Not Active", {
            description:
              "Your float is not active for today. Please start your day first.",
          });
          return;
        }

        if (floatCheck.userFloat.balance <= 0) {
          toast.error("Insufficient Float", {
            description:
              "Your float balance is zero. Please request float allocation from accountant.",
          });
          return;
        }

        setModalOpen(true);
      } catch (error) {
        toast.error("Error", {
          description: "Failed to check float status. Please try again.",
        });
        console.error("Float check error:", error);
      }
    }
  };

  const handleExport = async (filteredDeposits: Deposit[]) => {
    try {
      const exportData = filteredDeposits.map((deposit) => {
        const isMemberDeposit = !!deposit.member;

        return {
          "Transaction Ref": deposit.transaction.transactionRef,
          "Owner Type": isMemberDeposit ? "Member" : "Institution",
          "Owner Name": isMemberDeposit
            ? deposit.member!.user.name
            : deposit.institution?.institutionName ||
              deposit.institution?.user?.name ||
              deposit.institutionName ||
              deposit.depositorName ||
              "Unknown",
          "Owner Number": isMemberDeposit
            ? deposit.member!.memberNumber
            : deposit.institution?.institutionNumber || "N/A",
          "Account Number": deposit.account.accountNumber,
          "Account Type": getAccountTypeDisplayName(
            deposit.account.accountType.name
          ),
          Amount: deposit.amount,
          Channel: deposit.channel,
          "Mobile Money Ref": deposit.mobileMoneyRef || "N/A",
          "Depositor Name": deposit.depositorName || "N/A",
          Branch: deposit.account.branch.name,
          "Branch Location": deposit.account.branch.location,
          "Processed By": deposit.handler.name,
          "Handler Role": deposit.handler.role,
          "Deposit Date": formatISODate(deposit.depositDate),
          Description: deposit.transaction.description || "N/A",
          "Transaction Status": deposit.transaction.status,
          "Owner Email": isMemberDeposit
            ? deposit.member!.user.email
            : deposit.institution?.user?.email || "N/A",
          "Owner Phone": isMemberDeposit
            ? deposit.member!.user.phone || "N/A"
            : deposit.institution?.institutionPhone || "N/A",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Deposits");

      const fileName = `Deposits_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Deposits exported to ${fileName}`,
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
      {/* Statistics Cards - Visible to ALL users including AGENT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Link href="/dashboard/deposits/todaysdeposits">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {userRole === "AGENT"
                  ? "My Today's Deposits"
                  : "Today's Deposits"}
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
        </Link>

        <Link href="/dashboard/deposits/monthlydeposits">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {userRole === "AGENT" ? "My This Month" : "This Month"}
              </CardTitle>
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
        </Link>

        <Link href="/dashboard/deposits/totaldeposits">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {userRole === "AGENT" ? "My Total Deposits" : "Total Deposits"}
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
        </Link>
      </div>

      <DepositCreateForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userRole={userRole}
        userId={currentUserId}
      />

      {/* ✅ AGENT sees only title and button (NO DataTable) */}
      {!canViewDepositList ? (
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="text-gray-500">{subtitle}</p>
          </div>
          <Button
            onClick={handleAddNew}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Deposit
          </Button>
        </div>
      ) : (
        <DataTable<Deposit>
          title={title}
          subtitle={subtitle}
          data={deposits}
          columns={columns}
          keyField="id"
          isLoading={false}
          onRefresh={() => router.refresh()}
          actions={{
            onAdd: canCreateDeposit ? handleAddNew : undefined,
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
            ],
            enableDateFilter: true,
            getItemDate: (item) => item.depositDate,
          }}
          renderRowActions={(item) => <TableActions.RowActions />}
        />
      )}
    </div>
  );
}
