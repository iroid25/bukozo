// @ts-nocheck
// app/dashboard/floats/users/[userId]/components/FloatDetailView.tsx
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  DollarSign,
  User,
  Building,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Plus,
  Calendar,
  FileText,
  History,
  BarChart3,
  Calculator,
  Eye,
} from "lucide-react";

import {
  UserFloat,
  FloatTransaction,
  FloatReconciliation,
  getFloatTransactionTypeInfo,
  getReconciliationStatus,
  getFloatStatus,
  getFloatUserRoleInfo,
  calculateFloatUtilization,
} from "@/types/float";

import { formatISODate } from "@/lib/utils";
import FloatReconciliationCreateForm from "@/app/(dashboard)/dashboard/floats/users/[userId]/components/FloatReconciliationForm";
import { UserRole } from "@prisma/client";

// Define completely flexible types that match your actual database structure
type DatabaseFloatTransaction = {
  id: string;
  type: any; // TransactionType
  floatId: string;
  amount: number;
  transactionDate: Date;
  description: string | null;
  relatedTransactionId: string | null;
  performedByUserId: string;
  performedByUser: {
    name: string;
    role: UserRole;
    [key: string]: any;
  };
  [key: string]: any; // Allow any additional properties
};

type DatabaseFloatReconciliation = {
  id: string;
  floatId: string;
  reconciliationDate: Date;
  systemBalance: number;
  actualCash: number;
  difference: number;
  reconciledByUserId: string;
  reconciledByUser: {
    name: string;
    role: UserRole;
    [key: string]: any;
  };
  [key: string]: any; // Allow any additional properties
};

type DatabaseUser = {
  name: string;
  email: string | null;
  role: UserRole;
  phone?: string | null;
  branch?: {
    name: string;
    location: string;
  } | null;
  [key: string]: any; // Allow any additional properties from database
};

type DatabaseUserFloat = {
  id: string;
  userId: string;
  balance: number;
  lastReconciliation?: Date | null;
  user: DatabaseUser;
  // The database might return either of these property names
  floatTransactions?: DatabaseFloatTransaction[];
  floatReconciliation?: DatabaseFloatReconciliation[];
  floatReconciliations?: DatabaseFloatReconciliation[];
  [key: string]: any; // Allow any additional properties
};

interface FloatDetailViewProps {
  userFloat: DatabaseUserFloat;
  floatTransactions: DatabaseFloatTransaction[];
  floatReconciliations: DatabaseFloatReconciliation[];
  currentUserId: string;
  currentUserRole: string;
}

interface FloatStatistics {
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalAllocations: number;
  averageTransaction: number;
  lastReconciliation?: string;
  reconciliationCount: number;
  balancedReconciliations: number;
  unbalancedReconciliations: number;
  utilizationRate: number;
  weeklyActivity: Array<{
    day: string;
    transactions: number;
    amount: number;
  }>;
}

export default function FloatDetailView({
  userFloat,
  floatTransactions,
  floatReconciliations,
  currentUserId,
  currentUserRole,
}: FloatDetailViewProps) {
  const router = useRouter();
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);

  // Safe format currency function with null/undefined handling
  const formatCurrency = (amount: number | undefined | null) => {
    // Handle all edge cases: undefined, null, NaN, or non-numeric values
    const safeAmount =
      typeof amount === "number" && !isNaN(amount) ? amount : 0;

    try {
      return new Intl.NumberFormat("en-UG", {
        style: "currency",
        currency: "UGX",
        minimumFractionDigits: 0,
      }).format(safeAmount);
    } catch (error) {
      console.error("Error formatting currency:", error);
      return `UGX ${safeAmount.toLocaleString()}`;
    }
  };

  // Safe array and data validation
  const safeUserFloat = userFloat || {};
  const safeUser = safeUserFloat.user || {};
  const safeFloatTransactions = Array.isArray(floatTransactions)
    ? floatTransactions
    : [];
  const safeFloatReconciliations = Array.isArray(floatReconciliations)
    ? floatReconciliations
    : [];

  // Calculate statistics with comprehensive null safety
  const calculateStatistics = (): FloatStatistics => {
    const validTransactions = safeFloatTransactions.filter(
      (t) => t && typeof t.amount === "number" && !isNaN(t.amount)
    );

    const validReconciliations = safeFloatReconciliations.filter(
      (r) => r && typeof r.difference === "number" && !isNaN(r.difference)
    );

    const deposits = validTransactions.filter((t) => t.amount > 0);
    const withdrawals = validTransactions.filter((t) => t.amount < 0);
    const allocations = validTransactions.filter(
      (t) => t.type === "FLOAT_ALLOCATION"
    );

    const totalDeposits = deposits.reduce((sum, t) => sum + t.amount, 0);
    const totalWithdrawals = Math.abs(
      withdrawals.reduce((sum, t) => sum + t.amount, 0)
    );
    const totalAllocations = allocations.reduce((sum, t) => sum + t.amount, 0);

    const balancedRecs = validReconciliations.filter(
      (r) => Math.abs(r.difference) <= 1000
    ).length;

    // Calculate weekly activity (last 7 days) with error handling
    const now = new Date();
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(now.getDate() - i);

      const dayTransactions = validTransactions.filter((t) => {
        if (!t.transactionDate) return false;
        try {
          const tDate = new Date(t.transactionDate);
          return (
            !isNaN(tDate.getTime()) &&
            tDate.toDateString() === date.toDateString()
          );
        } catch (error) {
          console.error("Error parsing transaction date:", error);
          return false;
        }
      });

      return {
        day: format(date, "EEE"),
        transactions: dayTransactions.length,
        amount: dayTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      };
    }).reverse();

    const totalTransactionAmount = validTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    return {
      totalTransactions: validTransactions.length,
      totalDeposits,
      totalWithdrawals,
      totalAllocations,
      averageTransaction:
        validTransactions.length > 0
          ? totalTransactionAmount / validTransactions.length
          : 0,
      lastReconciliation: safeUserFloat.lastReconciliation
        ? formatISODate(safeUserFloat.lastReconciliation)
        : undefined,
      reconciliationCount: validReconciliations.length,
      balancedReconciliations: balancedRecs,
      unbalancedReconciliations: validReconciliations.length - balancedRecs,
      utilizationRate: calculateFloatUtilization(
        safeUserFloat.balance || 0,
        totalAllocations
      ),
      weeklyActivity,
    };
  };

  const statistics = calculateStatistics();

  // Safe status calculations
  const floatStatus = getFloatStatus(
    safeUserFloat.balance || 0,
    safeUserFloat.lastReconciliation
  );

  const roleInfo = getFloatUserRoleInfo(safeUser.role || "AGENT");

  // Transaction columns with comprehensive error handling
  const transactionColumns: Column<DatabaseFloatTransaction>[] = [
    {
      accessorKey: "type",
      header: "Transaction Type",
      cell: (row) => {
        const transaction = row;
        if (!transaction || !transaction.type) {
          return (
            <Badge variant="outline" className="text-gray-500">
              Unknown Type
            </Badge>
          );
        }

        try {
          const typeInfo = getFloatTransactionTypeInfo(transaction.type);
          return (
            <div className="flex items-center gap-2">
              <Badge className={typeInfo.color}>
                {typeInfo.icon} {typeInfo.label}
              </Badge>
            </div>
          );
        } catch (error) {
          console.error("Error getting transaction type info:", error);
          return (
            <Badge variant="outline" className="text-gray-500">
              {transaction.type || "Unknown"}
            </Badge>
          );
        }
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (row) => {
        const transaction = row;
        if (
          !transaction ||
          typeof transaction.amount !== "number" ||
          isNaN(transaction.amount)
        ) {
          return <span className="text-gray-500 italic">No amount</span>;
        }

        const isPositive = transaction.amount > 0;

        return (
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
              {isPositive ? "+" : ""}
              {formatCurrency(transaction.amount)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "transactionDate",
      header: "Date & Time",
      cell: (row) => {
        const transaction = row;
        if (!transaction || !transaction.transactionDate) {
          return <span className="text-gray-500 italic">No date</span>;
        }

        try {
          const date = new Date(transaction.transactionDate);
          if (isNaN(date.getTime())) {
            return <span className="text-gray-500 italic">Invalid date</span>;
          }

          return (
            <div className="flex flex-col">
              <span className="font-medium">
                {formatISODate(transaction.transactionDate)}
              </span>
              <span className="text-sm text-gray-500">
                {format(date, "HH:mm:ss")}
              </span>
            </div>
          );
        } catch (error) {
          console.error("Error formatting transaction date:", error);
          return <span className="text-gray-500 italic">Invalid date</span>;
        }
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: (row) => {
        const transaction = row;

        return (
          <div className="max-w-xs">
            <span className="text-sm">
              {transaction?.description || "No description"}
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
        const user = transaction?.performedByUser;

        if (!user) {
          return <span className="text-gray-500 italic">Unknown user</span>;
        }

        return (
          <div className="flex flex-col">
            <span className="font-medium">{user.name || "Unknown"}</span>
            <Badge variant="outline" className="text-xs w-fit">
              {user.role || "Unknown Role"}
            </Badge>
          </div>
        );
      },
    },
  ];

  // Reconciliation columns with comprehensive error handling
  const reconciliationColumns: Column<DatabaseFloatReconciliation>[] = [
    {
      accessorKey: "reconciliationDate",
      header: "Reconciliation Date",
      cell: (row) => {
        const reconciliation = row;
        if (!reconciliation || !reconciliation.reconciliationDate) {
          return <span className="text-gray-500 italic">No date</span>;
        }

        try {
          const date = new Date(reconciliation.reconciliationDate);
          if (isNaN(date.getTime())) {
            return <span className="text-gray-500 italic">Invalid date</span>;
          }

          return (
            <div className="flex flex-col">
              <span className="font-medium">
                {formatISODate(reconciliation.reconciliationDate)}
              </span>
              <span className="text-sm text-gray-500">
                {format(date, "HH:mm:ss")}
              </span>
            </div>
          );
        } catch (error) {
          console.error("Error formatting reconciliation date:", error);
          return <span className="text-gray-500 italic">Invalid date</span>;
        }
      },
    },
    {
      accessorKey: "systemBalance",
      header: "Balance Comparison",
      cell: (row) => {
        const reconciliation = row;
        if (
          !reconciliation ||
          typeof reconciliation.actualCash !== "number" ||
          typeof reconciliation.systemBalance !== "number" ||
          isNaN(reconciliation.actualCash) ||
          isNaN(reconciliation.systemBalance)
        ) {
          return <span className="text-gray-500 italic">Invalid data</span>;
        }

        try {
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
            </div>
          );
        } catch (error) {
          console.error("Error getting reconciliation status:", error);
          return (
            <span className="text-gray-500 italic">
              Error displaying status
            </span>
          );
        }
      },
    },
    {
      accessorKey: "difference",
      header: "Difference",
      cell: (row) => {
        const reconciliation = row;
        if (
          !reconciliation ||
          typeof reconciliation.difference !== "number" ||
          isNaN(reconciliation.difference)
        ) {
          return (
            <span className="text-gray-500 italic">No difference data</span>
          );
        }

        return (
          <div className="flex flex-col">
            <span
              className={`font-bold text-lg ${
                reconciliation.difference === 0
                  ? "text-green-600"
                  : reconciliation.difference > 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {reconciliation.difference === 0 ? (
                "Balanced"
              ) : (
                <>
                  {reconciliation.difference > 0 ? "+" : ""}
                  {formatCurrency(reconciliation.difference)}
                </>
              )}
            </span>
            {reconciliation.difference !== 0 && (
              <span className="text-xs text-gray-500">
                {Math.abs(reconciliation.difference) <= 1000
                  ? "Within tolerance"
                  : "Significant variance"}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "reconciledByUser",
      header: "Reconciled By",
      cell: (row) => {
        const reconciliation = row;
        const user = reconciliation?.reconciledByUser;

        if (!user) {
          return <span className="text-gray-500 italic">Unknown user</span>;
        }

        return (
          <div className="flex flex-col">
            <span className="font-medium">{user.name || "Unknown"}</span>
            <Badge variant="outline" className="text-xs w-fit">
              {user.role || "Unknown Role"}
            </Badge>
          </div>
        );
      },
    },
  ];

  // Export functions with error handling
  const exportTransactions = async (
    filteredData: DatabaseFloatTransaction[]
  ) => {
    try {
      const validData = filteredData.filter((t) => t && t.id);

      const exportData = validData.map((transaction) => ({
        "Transaction Type": transaction.type
          ? getFloatTransactionTypeInfo(transaction.type)?.label ||
            transaction.type
          : "Unknown",
        Amount: transaction.amount || 0,
        "Transaction Date": transaction.transactionDate
          ? formatISODate(transaction.transactionDate)
          : "No date",
        "Transaction Time": transaction.transactionDate
          ? format(new Date(transaction.transactionDate), "HH:mm:ss")
          : "No time",
        Description: transaction.description || "No description",
        "Performed By": transaction.performedByUser?.name || "Unknown",
        "Performer Role": transaction.performedByUser?.role || "Unknown",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Float Transactions");

      const fileName = `${(safeUser.name || "Unknown_User").replace(
        /\s+/g,
        "_"
      )}_Float_Transactions_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Float transactions exported to ${fileName}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const exportReconciliations = async (
    filteredData: DatabaseFloatReconciliation[]
  ) => {
    try {
      const validData = filteredData.filter((r) => r && r.id);

      const exportData = validData.map((reconciliation) => ({
        "Reconciliation Date": reconciliation.reconciliationDate
          ? formatISODate(reconciliation.reconciliationDate)
          : "No date",
        "System Balance": reconciliation.systemBalance || 0,
        "Actual Cash": reconciliation.actualCash || 0,
        Difference: reconciliation.difference || 0,
        "Is Balanced": (reconciliation.difference || 0) === 0 ? "Yes" : "No",
        "Reconciled By": reconciliation.reconciledByUser?.name || "Unknown",
        "Reconciler Role": reconciliation.reconciledByUser?.role || "Unknown",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Float Reconciliations"
      );

      const fileName = `${(safeUser.name || "Unknown_User").replace(
        /\s+/g,
        "_"
      )}_Float_Reconciliations_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Float reconciliations exported to ${fileName}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Float Overview
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Float Details</h1>
            <p className="text-gray-500">
              Detailed view of {safeUser.name || "Unknown User"}'s float
              management
            </p>
          </div>
        </div>

        {["ADMIN", "BRANCHMANAGER", "TELLER", "AGENT"].includes(
          currentUserRole || ""
        ) && (
          <Button
            onClick={() => setReconciliationModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Reconciliation
          </Button>
        )}
      </div>

      {/* User Information Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <User className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold">
                    {safeUser.name || "Unknown User"}
                  </h2>
                  <Badge className={roleInfo.color}>
                    {roleInfo.icon} {roleInfo.label}
                  </Badge>
                </div>
                <p className="text-gray-500 mb-1">
                  {safeUser.email || "No email"}
                </p>
                {safeUser.phone && (
                  <p className="text-gray-500 text-sm">{safeUser.phone}</p>
                )}
                {safeUser.branch && (
                  <div className="flex items-center gap-2 mt-2">
                    <Building className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      {safeUser.branch.name || "Unknown Branch"} -{" "}
                      {safeUser.branch.location || "Unknown Location"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="flex flex-col items-end gap-2">
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(safeUserFloat.balance)}
                </div>
                <Badge className={`${floatStatus.color} text-sm`}>
                  {floatStatus.icon} {floatStatus.label}
                </Badge>
                {safeUserFloat.lastReconciliation && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>
                      Last reconciled:{" "}
                      {formatISODate(safeUserFloat.lastReconciliation)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {statistics.totalTransactions}
            </div>
            <p className="text-xs text-gray-500">
              Avg: {formatCurrency(statistics.averageTransaction)}
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
            <p className="text-xs text-gray-500">Money received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Withdrawals
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {formatCurrency(statistics.totalWithdrawals)}
            </div>
            <p className="text-xs text-gray-500">Money disbursed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Reconciliations
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {statistics.reconciliationCount}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.balancedReconciliations} balanced
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Status Summary */}
      {statistics.reconciliationCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">
                      Balanced Reconciliations
                    </p>
                    <p className="text-xs text-gray-500">
                      Within 1,000 UGX tolerance
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">
                    {statistics.balancedReconciliations}
                  </p>
                  <p className="text-xs text-gray-500">
                    {statistics.reconciliationCount > 0
                      ? Math.round(
                          (statistics.balancedReconciliations /
                            statistics.reconciliationCount) *
                            100
                        )
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm font-medium">
                      Unbalanced Reconciliations
                    </p>
                    <p className="text-xs text-gray-500">
                      Significant variances
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600">
                    {statistics.unbalancedReconciliations}
                  </p>
                  <p className="text-xs text-gray-500">
                    {statistics.reconciliationCount > 0
                      ? Math.round(
                          (statistics.unbalancedReconciliations /
                            statistics.reconciliationCount) *
                            100
                        )
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Weekly Activity Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {statistics.weeklyActivity.map((day, index) => (
              <div key={index} className="text-center">
                <div className="text-xs text-gray-500 mb-1">{day.day}</div>
                <div className="bg-blue-100 rounded p-2">
                  <div className="text-sm font-medium">{day.transactions}</div>
                  <div className="text-xs text-gray-600">
                    {formatCurrency(day.amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reconciliation Modal */}
      {reconciliationModalOpen && (
        <FloatReconciliationCreateForm
          isOpen={reconciliationModalOpen}
          onClose={() => setReconciliationModalOpen(false)}
          userId={currentUserId}
          preSelectedFloatId={safeUserFloat.id}
        />
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transactions">
            Transactions ({safeFloatTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="reconciliations">
            Reconciliations ({safeFloatReconciliations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <DataTable<DatabaseFloatTransaction>
            title="Float Transactions"
            subtitle={`All transactions for ${
              safeUser.name || "Unknown User"
            }'s float`}
            data={safeFloatTransactions}
            columns={transactionColumns}
            keyField="id"
            isLoading={false}
            onRefresh={() => router.refresh()}
            actions={{
              onExport: exportTransactions,
            }}
            filters={{
              searchFields: ["description", "performedByUser.name"],
              enableDateFilter: true,
              getItemDate: (item) => item.transactionDate,
            }}
          />
        </TabsContent>

        <TabsContent value="reconciliations">
          <DataTable<DatabaseFloatReconciliation>
            title="Float Reconciliations"
            subtitle={`Reconciliation history for ${
              safeUser.name || "Unknown User"
            }'s float`}
            data={safeFloatReconciliations}
            columns={reconciliationColumns}
            keyField="id"
            isLoading={false}
            onRefresh={() => router.refresh()}
            actions={{
              onExport: exportReconciliations,
            }}
            filters={{
              searchFields: ["reconciledByUser.name"],
              enableDateFilter: true,
              getItemDate: (item) => item.reconciliationDate,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
