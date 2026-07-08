//@ts-nocheck
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  User,
  Building,
  Calculator,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wallet,
  Activity,
  FileText,
  RefreshCw,
} from "lucide-react";

import {
  UserFloat,
  FloatTransaction,
  FloatReconciliation,
  getFloatTransactionTypeInfo,
  getReconciliationStatus,
  getFloatStatus,
  getFloatUserRoleInfo,
} from "@/types/float";

import { formatISODate } from "@/lib/utils";
import FloatReconciliationCreateForm from "../../components/FloatReconciliationForm";

interface CurrentUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
  branch?: {
    id: string;
    name: string;
    location: string;
  };
}

export default function MyFloatView({
  userFloat,
  floatTransactions,
  floatReconciliations,
  currentUser,
}: {
  userFloat: UserFloat | null;
  floatTransactions: FloatTransaction[];
  floatReconciliations: FloatReconciliation[];
  currentUser: CurrentUser;
}) {
  const router = useRouter();
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate statistics for the user's float
  const calculateMyFloatStats = () => {
    if (!userFloat) {
      return {
        currentBalance: 0,
        totalTransactions: 0,
        totalReconciliations: 0,
        lastReconciliation: null,
        pendingReconciliation: true,
        todayTransactions: 0,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = floatTransactions.filter(
      (t) => new Date(t.transactionDate) >= today
    ).length;

    const lastReconciliation =
      floatReconciliations.length > 0
        ? floatReconciliations.sort(
            (a, b) =>
              new Date(b.reconciliationDate).getTime() -
              new Date(a.reconciliationDate).getTime()
          )[0]
        : null;

    // Check if reconciliation is needed (no reconciliation today)
    const hasReconciledToday =
      lastReconciliation &&
      new Date(lastReconciliation.reconciliationDate) >= today;

    return {
      currentBalance: userFloat.balance,
      totalTransactions: floatTransactions.length,
      totalReconciliations: floatReconciliations.length,
      lastReconciliation,
      pendingReconciliation: !hasReconciledToday,
      todayTransactions,
    };
  };

  const stats = calculateMyFloatStats();

  // Float Transactions Columns (filtered to user's transactions)
  const transactionColumns: Column<FloatTransaction>[] = [
    {
      accessorKey: "type",
      header: "Transaction Type",
      cell: (row) => {
        const transaction = row;
        const typeInfo = getFloatTransactionTypeInfo(transaction.type);

        return (
          <div className="flex items-center gap-2">
            <Badge className={typeInfo.color}>
              {typeInfo.icon} {typeInfo.label}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (row) => {
        const transaction = row;
        const isPositive = transaction.amount > 0;

        return (
          <span
            className={`font-medium text-lg ${
              isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {isPositive ? "+" : ""}
            {formatCurrency(transaction.amount)}
          </span>
        );
      },
    },
    {
      accessorKey: "transactionDate",
      header: "Date & Time",
      cell: (row) => {
        const transaction = row;

        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {formatISODate(transaction.transactionDate)}
            </span>
            <span className="text-sm text-gray-500">
              {format(new Date(transaction.transactionDate), "HH:mm:ss")}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "performedByUser",
      header: "Performed By",
      cell: (row) => {
        const transaction = row;

        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {transaction.performedByUser.name}
            </span>
            <Badge variant="outline" className="text-xs w-fit">
              {transaction.performedByUser.role}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: (row) => {
        const transaction = row;
        return (
          <span className="text-sm text-gray-600">
            {transaction.description || "No description"}
          </span>
        );
      },
    },
  ];

  // Float Reconciliations Columns
  const reconciliationColumns: Column<FloatReconciliation>[] = [
    {
      accessorKey: "reconciledByUser",
      header: "Reconciliation Details",
      cell: (row) => {
        const reconciliation = row;
        const status = getReconciliationStatus(
          reconciliation.actualCash,
          reconciliation.systemBalance
        );

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge className={status.color}>
                {status.icon} {status.label}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">System: </span>
                <span className="font-medium">
                  {formatCurrency(reconciliation.systemBalance)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Actual: </span>
                <span className="font-medium">
                  {formatCurrency(reconciliation.actualCash)}
                </span>
              </div>
            </div>
            {reconciliation.difference !== 0 && (
              <div className="text-sm">
                <span className="text-gray-500">Difference: </span>
                <span
                  className={`font-medium ${
                    reconciliation.difference > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {reconciliation.difference > 0 ? "+" : ""}
                  {formatCurrency(reconciliation.difference)}
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "reconciliationDate",
      header: "Reconciliation Date",
      cell: (row) => {
        const reconciliation = row;

        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {formatISODate(reconciliation.reconciliationDate)}
            </span>
            <span className="text-sm text-gray-500">
              {format(new Date(reconciliation.reconciliationDate), "HH:mm:ss")}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: (row) => {
        const reconciliation = row;
        return (
          <span className="text-sm text-gray-600">
            {reconciliation.notes || "No notes"}
          </span>
        );
      },
    },
  ];

  // Export functions
  const exportMyTransactions = async (filteredData: FloatTransaction[]) => {
    try {
      const exportData = filteredData.map((transaction) => ({
        "Transaction Type": getFloatTransactionTypeInfo(transaction.type).label,
        Amount: transaction.amount,
        "Transaction Date": formatISODate(transaction.transactionDate),
        "Transaction Time": format(
          new Date(transaction.transactionDate),
          "HH:mm:ss"
        ),
        "Performed By": transaction.performedByUser.name,
        Description: transaction.description || "No description",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "My Transactions");

      const fileName = `My_Float_Transactions_${format(
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

  // If user has no float assigned
  if (!userFloat) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <Wallet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            No Float Assigned
          </h2>
          <p className="text-gray-500 mb-4">
            You don't have a float assigned yet. Please contact your branch
            manager.
          </p>
          <Button onClick={() => router.refresh()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  const floatStatus = getFloatStatus(
    userFloat.balance,
    userFloat.lastReconciliation
  );

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Float</h1>
            <p className="text-gray-600">
              Manage your personal float balance and reconciliations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={floatStatus.color}>
              {floatStatus.icon} {floatStatus.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* User Info Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <User className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{currentUser.name}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{currentUser.email}</span>
                <Badge variant="outline">{currentUser.role}</Badge>
                {currentUser.branch && (
                  <div className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
                    <span>{currentUser.branch.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current Balance
            </CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(stats.currentBalance)}
            </div>
            <p className="text-xs text-blue-600">Your available float</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {stats.totalTransactions}
            </div>
            <p className="text-xs text-green-600">
              Today: {stats.todayTransactions}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Reconciliations
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {stats.totalReconciliations}
            </div>
            <p className="text-xs text-purple-600">Total completed</p>
          </CardContent>
        </Card>

        <Card
          className={`bg-gradient-to-r ${
            stats.pendingReconciliation
              ? "from-orange-50 to-orange-100"
              : "from-green-50 to-green-100"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {stats.pendingReconciliation ? (
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-lg font-bold ${
                stats.pendingReconciliation
                  ? "text-orange-700"
                  : "text-green-700"
              }`}
            >
              {stats.pendingReconciliation
                ? "Reconciliation Due"
                : "Up to Date"}
            </div>
            <p
              className={`text-xs ${
                stats.pendingReconciliation
                  ? "text-orange-600"
                  : "text-green-600"
              }`}
            >
              {stats.lastReconciliation
                ? `Last: ${formatISODate(
                    stats.lastReconciliation.reconciliationDate
                  )}`
                : "Never reconciled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Button for Reconciliation */}
      {stats.pendingReconciliation && (
        <Card className="mb-6 bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-800">
                    Daily Reconciliation Required
                  </p>
                  <p className="text-sm text-orange-600">
                    Please reconcile your float to ensure accurate balance
                    tracking.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setReconciliationModalOpen(true)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Reconcile Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reconciliation Modal */}
      <FloatReconciliationCreateForm
        isOpen={reconciliationModalOpen}
        onClose={() => setReconciliationModalOpen(false)}
        currentUserId={currentUser.id}
        preSelectedFloatId={userFloat.id}
      />

      {/* Main Content Tabs */}
      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transactions">
            My Transactions ({floatTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="reconciliations">
            My Reconciliations ({floatReconciliations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <DataTable<FloatTransaction>
            title="My Float Transactions"
            subtitle="Your personal float transaction history"
            data={floatTransactions}
            columns={transactionColumns}
            keyField="id"
            isLoading={false}
            onRefresh={() => router.refresh()}
            actions={{
              onExport: exportMyTransactions,
            }}
            filters={{
              searchFields: ["description", "performedByUser.name"],
              enableDateFilter: true,
              getItemDate: (item) => item.transactionDate,
            }}
          />
        </TabsContent>

        <TabsContent value="reconciliations">
          <DataTable<FloatReconciliation>
            title="My Float Reconciliations"
            subtitle="Your personal reconciliation history"
            data={floatReconciliations}
            columns={reconciliationColumns}
            keyField="id"
            isLoading={false}
            onRefresh={() => router.refresh()}
            actions={{
              onAdd: () => setReconciliationModalOpen(true),
            }}
            filters={{
              searchFields: ["notes"],
              enableDateFilter: true,
              getItemDate: (item) => item.reconciliationDate,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
