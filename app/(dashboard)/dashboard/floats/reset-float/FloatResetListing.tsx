// app/dashboard/accountant/components/FloatResetListing.tsx
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
  User,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Shield,
  TrendingDown,
  Users2,
} from "lucide-react";

import { formatISODate } from "@/lib/utils";
import FloatResetForm from "./components/FloatResetForm";

interface UserFloat {
  id: string;
  userId: string;
  balance: number;
  lastReconciliation: Date | null;
  currentDayStarted: Date | null;
  isActiveForDay: boolean;
  canStartNewDay: boolean;
  pendingReconciliation: boolean;
  user: {
    id: string;
    name: string;
    email: string | null;
    role: string;
    branch?: {
      name: string;
      location: string;
    } | null;
  };
  floatTransactions: any[];
}

interface Statistics {
  totalUsers: number;
  totalBalance: number;
  activeUsers: number;
  usersWithBalance: number;
  pendingReconciliations: number;
  blockedUsers: number;
}

interface Props {
  title: string;
  subtitle: string;
  userFloats: UserFloat[];
  statistics: Statistics;
  currentUserId: string;
  userRole: string;
}

export default function FloatResetListing({
  title,
  subtitle,
  userFloats,
  statistics,
  currentUserId,
  userRole,
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFloat, setSelectedFloat] = useState<UserFloat | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (userFloat: UserFloat) => {
    if (userFloat.pendingReconciliation) {
      return (
        <Badge className="bg-orange-100 text-orange-700">
          <Clock className="h-3 w-3 mr-1" />
          Pending EOD
        </Badge>
      );
    }

    if (!userFloat.canStartNewDay) {
      return (
        <Badge className="bg-red-100 text-red-700">
          <XCircle className="h-3 w-3 mr-1" />
          Blocked
        </Badge>
      );
    }

    if (userFloat.isActiveForDay) {
      return (
        <Badge className="bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-gray-600">
        Inactive
      </Badge>
    );
  };

  const columns: Column<UserFloat>[] = [
    {
      accessorKey: "user",
      header: "User Details",
      cell: (row) => {
        const userFloat = row;
        const user = userFloat.user;

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <User className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{user.name}</span>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{user.email}</span>
                <Badge variant="outline" className="text-xs">
                  {user.role}
                </Badge>
              </div>
              {user.branch && (
                <span className="text-xs text-gray-400">
                  {user.branch.name}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "balance",
      header: "Current Balance",
      cell: (row) => {
        const userFloat = row;

        return (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <div className="flex flex-col">
              <span
                className={`text-lg font-bold ${
                  userFloat.balance > 0 ? "text-green-700" : "text-gray-500"
                }`}
              >
                {formatCurrency(userFloat.balance)}
              </span>
              {userFloat.balance > 0 && (
                <span className="text-xs text-gray-500">Has balance</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: (row) => row.isActiveForDay,
      header: "Status",
      cell: (row) => {
        const userFloat = row;

        return (
          <div className="flex flex-col gap-2">
            {getStatusBadge(userFloat)}
            {userFloat.currentDayStarted && (
              <span className="text-xs text-gray-500">
                Started: {formatISODate(userFloat.currentDayStarted)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "lastReconciliation",
      header: "Last Reconciliation",
      cell: (row) => {
        const userFloat = row;

        return (
          <div className="flex flex-col">
            {userFloat.lastReconciliation ? (
              <>
                <span className="font-medium">
                  {formatISODate(userFloat.lastReconciliation)}
                </span>
                <span className="text-xs text-gray-500">
                  {format(new Date(userFloat.lastReconciliation), "HH:mm")}
                </span>
              </>
            ) : (
              <span className="text-gray-400">Never reconciled</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: (row) => row.floatTransactions.length,
      header: "Transactions",
      cell: (row) => {
        const userFloat = row;

        return (
          <div className="text-center">
            <span className="font-medium text-blue-600">
              {userFloat.floatTransactions.length}
            </span>
            <p className="text-xs text-gray-500">Recent txns</p>
          </div>
        );
      },
    },
    {
      accessorKey: (row) => row.id,
      header: "Actions",
      cell: (row) => {
        const userFloat = row;

        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedFloat(userFloat);
              setModalOpen(true);
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </Button>
        );
      },
    },
  ];

  const handleExport = async (filteredFloats: UserFloat[]) => {
    try {
      const exportData = filteredFloats.map((userFloat) => ({
        "User Name": userFloat.user.name,
        Email: userFloat.user.email,
        Role: userFloat.user.role,
        Branch: userFloat.user.branch?.name || "N/A",
        "Current Balance": userFloat.balance,
        Status: userFloat.pendingReconciliation
          ? "Pending EOD"
          : userFloat.isActiveForDay
            ? "Active"
            : userFloat.canStartNewDay
              ? "Ready"
              : "Blocked",
        "Is Active": userFloat.isActiveForDay ? "Yes" : "No",
        "Can Start New Day": userFloat.canStartNewDay ? "Yes" : "No",
        "Pending Reconciliation": userFloat.pendingReconciliation
          ? "Yes"
          : "No",
        "Last Reconciliation": userFloat.lastReconciliation
          ? formatISODate(userFloat.lastReconciliation)
          : "Never",
        "Current Day Started": userFloat.currentDayStarted
          ? formatISODate(userFloat.currentDayStarted)
          : "N/A",
        "Transaction Count": userFloat.floatTransactions.length,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Float Balances");

      const fileName = `Float_Balances_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Float balances exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedFloat(null);
    router.refresh();
  };

  return (
    <div className="container mx-auto py-6">
      {/* Warning Banner */}
      <Card className="mb-6 bg-amber-50 border-amber-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">
                ⚠️ Float Balance Reset - Use with Caution
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Resetting float balances is a sensitive operation that affects
                financial records. Only reset balances when absolutely necessary
                and ensure proper documentation. All reset actions are logged
                for audit purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users2 className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {statistics.totalUsers}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Tellers & Agents with float
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(statistics.totalBalance)}
            </div>
            <p className="text-xs text-green-600 mt-1">
              {statistics.usersWithBalance} users with balance
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <CheckCircle className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {statistics.activeUsers}
            </div>
            <p className="text-xs text-purple-600 mt-1">
              Currently active today
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending EOD</CardTitle>
            <Clock className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {statistics.pendingReconciliations}
            </div>
            <p className="text-xs text-orange-600 mt-1">
              Awaiting end-of-day approval
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-50 to-red-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Users</CardTitle>
            <XCircle className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {statistics.blockedUsers}
            </div>
            <p className="text-xs text-red-600 mt-1">Cannot start new day</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-gray-50 to-gray-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Balance
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-700">
              {formatCurrency(
                statistics.totalUsers > 0
                  ? statistics.totalBalance / statistics.totalUsers
                  : 0
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">Per user average</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts for Issues */}
      {statistics.blockedUsers > 0 && (
        <Card className="mb-6 bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-800">
                  {statistics.blockedUsers} user(s) are blocked from starting
                  new days
                </p>
                <p className="text-sm text-red-600">
                  These users have unreconciled previous days. Review and
                  approve their end-of-day reconciliations or reset their float
                  status.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal for Float Reset */}
      {selectedFloat && (
        <FloatResetForm
          isOpen={modalOpen}
          onClose={handleModalClose}
          userFloat={selectedFloat}
          currentUserId={currentUserId}
        />
      )}

      {/* Data Table */}
      <DataTable<UserFloat>
        title={title}
        subtitle={subtitle}
        data={userFloats}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onExport: handleExport,
        }}
        filters={{
          searchFields: [
            "user.name",
            "user.email",
            "user.role",
            "user.branch.name",
          ],
          enableDateFilter: false,
        }}
      />
    </div>
  );
}
