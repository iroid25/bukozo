// @ts-nocheck
// ==============================================
// FILE: app/dashboard/pages/institution/InstitutionDashboardContent.tsx
// ==============================================

"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ActivityIcon,
  UsersIcon,
  RefreshCwIcon,
  BuildingIcon,
  CreditCardIcon,
  TrendingUpIcon,
  CalendarIcon,
  DownloadIcon,
} from "lucide-react";

// ==============================================
// TYPE DEFINITIONS (Matching your actual DB schema)
// ==============================================

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  transactionDate: Date | string;
  description?: string | null;
  reference?: string | null; // Changed from referenceNumber
  member?: {
    user: {
      name: string;
      email: string | null;
      phone: string | null;
    };
  } | null;
  account?: {
    accountNumber: string;
    accountType: {
      name: string;
    };
    branch: {
      name: string;
    };
  } | null;
  processedByUser?: {
    name: string;
    role: string;
  } | null;
}

interface Statistics {
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  accountBalance: number;
  todayTransactions: number;
  todayAmount: number;
  activeAccounts: number;
  totalMembers: number;
  typeBreakdown: Array<{
    type: string;
    count: number;
    amount: number;
  }>;
}

interface InstitutionDetails {
  id: string;
  institutionName: string;
  institutionType: string;
  institutionNumber: string;
  user: {
    name: string;
    email: string | null;
    phone: string | null; // Changed to allow null
    branch: {
      name: string;
      location?: string | null;
    } | null; // Changed to allow null
  };
  accounts: Array<{
    id: string;
    accountNumber: string;
    balance: number;
    accountType: {
      name: string;
    };
  }>;
}

interface Props {
  transactions: Transaction[];
  statistics: Statistics | null;
  institutionDetails: InstitutionDetails | null;
  userId: string;
}

// ==============================================
// MAIN COMPONENT
// ==============================================

export default function InstitutionDashboardContent({
  transactions,
  statistics,
  institutionDetails,
  userId,
}: Props) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ==============================================
  // UTILITY FUNCTIONS
  // ==============================================

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DEPOSIT: "Deposit",
      WITHDRAWAL: "Withdrawal",
      LOAN_DISBURSEMENT: "Loan Disbursement",
      LOAN_REPAYMENT: "Loan Repayment",
      FLOAT_ALLOCATION: "Float Allocation",
      TRANSFER: "Transfer",
      INTEREST_CREDIT: "Interest Credit",
      FEE_CHARGE: "Fee Charge",
      REVERSAL: "Reversal",
    };
    return labels[type] || type.replace(/_/g, " ");
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: any; label: string }> = {
      COMPLETED: { variant: "default", label: "Completed" },
      PENDING: { variant: "secondary", label: "Pending" },
      FAILED: { variant: "destructive", label: "Failed" },
      CANCELLED: { variant: "outline", label: "Cancelled" },
      PROCESSING: { variant: "secondary", label: "Processing" },
    };

    const statusConfig = config[status] || {
      variant: "secondary",
      label: status.replace(/_/g, " "),
    };

    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  const getTransactionColor = (type: string) => {
    const depositTypes = [
      "DEPOSIT",
      "LOAN_REPAYMENT",
      "FLOAT_ALLOCATION",
      "INTEREST_CREDIT",
    ];
    return depositTypes.includes(type) ? "text-green-600" : "text-red-600";
  };

  // ==============================================
  // EVENT HANDLERS
  // ==============================================

  const handleExport = () => {
    try {
      const exportData = transactions.map((t) => ({
        Date: format(new Date(t.transactionDate), "dd/MM/yyyy HH:mm"),
        Reference: t.reference || t.id.slice(0, 8),
        Type: getTransactionTypeLabel(t.type),
        Member: t.member?.user?.name || "N/A",
        "Account Number": t.account?.accountNumber || "N/A",
        "Account Type": t.account?.accountType?.name || "N/A",
        Branch: t.account?.branch?.name || "N/A",
        Amount: Math.abs(t.amount),
        Status: t.status,
        Description: t.description || "",
        "Processed By": t.processedByUser?.name || "System",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");

      const maxWidth = 50;
      const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
        wch: Math.min(
          maxWidth,
          Math.max(
            key.length,
            ...exportData.map(
              (row) => String(row[key as keyof typeof row]).length
            )
          )
        ),
      }));
      ws["!cols"] = colWidths;

      const fileName = `${institutionDetails?.institutionName || "Institution"}_Transactions_${format(
        new Date(),
        "yyyy-MM-dd_HHmmss"
      )}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success("Transactions exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export transactions");
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      setTimeout(() => {
        setIsRefreshing(false);
        toast.success("Dashboard refreshed successfully");
      }, 1000);
    } catch (error) {
      setIsRefreshing(false);
      toast.error("Failed to refresh dashboard");
    }
  };

  // ==============================================
  // TABLE COLUMNS DEFINITION
  // ==============================================

  const columns: Column<Transaction>[] = [
    {
      key: "transactionDate",
      label: "Date & Time",
      sortable: true,
      render: (transaction) => (
        <div className="space-y-1">
          <div className="font-medium">
            {format(new Date(transaction.transactionDate), "dd MMM yyyy")}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(transaction.transactionDate), "HH:mm:ss")}
          </div>
        </div>
      ),
    },
    {
      key: "reference",
      label: "Reference",
      sortable: true,
      render: (transaction) => (
        <div className="font-mono text-sm">
          {transaction.reference || transaction.id.slice(0, 8).toUpperCase()}
        </div>
      ),
    },
    {
      key: "type",
      label: "Transaction Type",
      sortable: true,
      render: (transaction) => (
        <div className="space-y-1">
          <div className="font-medium">
            {getTransactionTypeLabel(transaction.type)}
          </div>
          {transaction.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {transaction.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "member",
      label: "Member",
      render: (transaction) =>
        transaction.member?.user ? (
          <div className="space-y-1">
            <div className="font-medium">{transaction.member.user.name}</div>
            <div className="text-xs text-muted-foreground">
              {transaction.member.user.phone || "No phone"}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        ),
    },
    {
      key: "account",
      label: "Account Details",
      render: (transaction) =>
        transaction.account ? (
          <div className="space-y-1">
            <div className="font-medium font-mono text-sm">
              {transaction.account.accountNumber}
            </div>
            <div className="text-xs text-muted-foreground">
              {transaction.account.accountType.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {transaction.account.branch.name}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (transaction) => (
        <div
          className={`font-bold text-right ${getTransactionColor(transaction.type)}`}
        >
          {formatCurrency(Math.abs(transaction.amount))}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (transaction) => getStatusBadge(transaction.status),
    },
    {
      key: "processedByUser",
      label: "Processed By",
      render: (transaction) =>
        transaction.processedByUser ? (
          <div className="space-y-1">
            <div className="font-medium">
              {transaction.processedByUser.name}
            </div>
            <div className="text-xs text-muted-foreground capitalize">
              {transaction.processedByUser.role
                .toLowerCase()
                .replace(/_/g, " ")}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">System</span>
        ),
    },
  ];

  // ==============================================
  // RENDER
  // ==============================================

  return (
    <div className="space-y-6">
      {/* WELCOME HEADER */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">
              Welcome back,{" "}
              {institutionDetails?.institutionName || "Institution"}! 👋
            </h1>
            <div className="flex items-center gap-4 text-blue-100">
              <span className="flex items-center gap-2">
                <BuildingIcon className="h-4 w-4" />
                {institutionDetails?.institutionType || "Institutional Account"}
              </span>
              <span className="flex items-center gap-2">
                <span>•</span>
                {institutionDetails?.user?.branch?.name || "Branch"}
              </span>
            </div>
            <p className="text-blue-200 text-sm">
              Institution No:{" "}
              <span className="font-mono font-semibold">
                {institutionDetails?.institutionNumber || "N/A"}
              </span>
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="shadow-md"
          >
            <RefreshCwIcon
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* QUICK STATS - TOP ROW */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(statistics?.accountBalance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all accounts
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Accounts
            </CardTitle>
            <BuildingIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.activeAccounts || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Institutional accounts
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.totalTransactions || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All-time count</p>
          </CardContent>
        </Card>
      </div>

      {/* DETAILED STATISTICS - SECOND ROW */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Deposits
            </CardTitle>
            <ArrowUpIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(statistics?.totalDeposits || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cumulative deposits
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Withdrawals
            </CardTitle>
            <ArrowDownIcon className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(statistics?.totalWithdrawals || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cumulative withdrawals
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today&apos;s Activity
            </CardTitle>
            <CalendarIcon className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {statistics?.todayTransactions || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(statistics?.todayAmount || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <UsersIcon className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statistics?.totalMembers || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Unique members</p>
          </CardContent>
        </Card>
      </div>

      {/* TRANSACTION TYPE BREAKDOWN */}
      {statistics?.typeBreakdown && statistics.typeBreakdown.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Transaction Breakdown by Type
          </h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {statistics.typeBreakdown.map((item) => (
              <Card
                key={item.type}
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    {getTransactionTypeLabel(item.type)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{item.count}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(item.amount)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TRANSACTIONS TABLE */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Complete list of all institutional transactions
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={transactions.length === 0}
            >
              <DownloadIcon className="h-4 w-4 mr-2" />
              Export to Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={transactions}
            searchKeys={["reference", "type", "description"]}
            searchPlaceholder="Search by reference, type, or description..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
