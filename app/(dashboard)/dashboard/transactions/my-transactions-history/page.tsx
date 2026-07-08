"use client";

import React, { useState } from "react";
import {
  ArrowUpRight, ArrowDownRight, ArrowRight, Activity, Search,
  Filter, Download, Calendar, CreditCard, CheckCircle, Clock,
  XCircle, Eye, ChevronLeft, ChevronRight, AlertCircle, Loader2,
  RefreshCw as RefreshIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";

// =====================
// TypeScript Interfaces
// =====================

interface Transaction {
  id: string;
  transactionRef: string;
  type:
    | "DEPOSIT"
    | "WITHDRAWAL"
    | "TRANSFER"
    | "LOAN_DISBURSEMENT"
    | "LOAN_REPAYMENT"
    | "FEE";
  amount: number;
  description: string;
  date: string;
  accountNumber: string;
  accountType: string;
  status: "COMPLETED" | "PENDING" | "FAILED" | "REVERSED";
  balanceAfter: number;
  channel?: string;
  processedBy?: string;
  paymentMethod?: string;
  paymentReference?: string;
}

interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  balance: number;
}

// =====================
// Dummy Data
// =====================

// Dummy data removed in favor of API fetching

// =====================
// Helper Functions
// =====================

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString("en-UG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString("en-UG", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getTransactionIcon = (type: string) => {
  switch (type) {
    case "DEPOSIT":
    case "LOAN_DISBURSEMENT":
      return <ArrowDownRight className="h-5 w-5 text-emerald-600" />;
    case "WITHDRAWAL":
    case "LOAN_REPAYMENT":
    case "FEE":
      return <ArrowUpRight className="h-5 w-5 text-red-600" />;
    case "TRANSFER":
      return <ArrowRight className="h-5 w-5 text-blue-600" />;
    default:
      return <Activity className="h-5 w-5 text-gray-600" />;
  }
};

const getTransactionColor = (type: string) => {
  switch (type) {
    case "DEPOSIT":
    case "LOAN_DISBURSEMENT":
      return "border-l-4 border-l-emerald-500 bg-emerald-50";
    case "WITHDRAWAL":
    case "LOAN_REPAYMENT":
    case "FEE":
      return "border-l-4 border-l-red-500 bg-red-50";
    case "TRANSFER":
      return "border-l-4 border-l-blue-500 bg-blue-50";
    default:
      return "border-l-4 border-l-gray-500 bg-gray-50";
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
          <CheckCircle className="h-3 w-3" />
          Completed
        </span>
      );
    case "PENDING":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      );
    case "REVERSED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
          <RefreshIcon className="h-3 w-3" />
          Reversed
        </span>
      );
    default:
      return null;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "DEPOSIT":
      return "Deposit";
    case "WITHDRAWAL":
      return "Withdrawal";
    case "TRANSFER":
      return "Transfer";
    case "LOAN_DISBURSEMENT":
      return "Loan Disbursement";
    case "LOAN_REPAYMENT":
      return "Loan Repayment";
    case "FEE":
      return "Fee";
    default:
      return type;
  }
};

// =====================
// Main Component
// =====================

export default function TransactionHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterAccount, setFilterAccount] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch member accounts for the filter dropdown
      const accountsRes = await axios.get("/api/v1/accounts/my-account");
      if (accountsRes.data.success) {
        setAccounts(accountsRes.data.data.accounts);
      }

      // Build query string
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString(),
      });

      if (filterType !== "ALL") params.append("type", filterType);
      if (filterAccount !== "ALL") {
        const selectedAcc = accountsRes.data.data.accounts.find((a: any) => a.accountNumber === filterAccount);
        if (selectedAcc) params.append("accountId", selectedAcc.id);
      }
      
      const transactionsRes = await axios.get(`/api/v1/transactions/my-transactions?${params.toString()}`);
      if (transactionsRes.data.success) {
        setTransactions(transactionsRes.data.data.transactions);
        setTotalItems(transactionsRes.data.data.pagination.total);
      }
    } catch (err: any) {
      console.error("Error fetching transaction data:", err);
      const msg = err.response?.data?.error || "Failed to load transactions";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterType, filterAccount]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side search for the current page results
  const filteredTransactions = transactions.filter((txn) => {
    return (
      txn.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.transactionRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.accountNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Calculate summary (Note: This currently only sums the current page's visible transactions 
  // unless we add a bulk stats API for members specifically)
  const totalDeposits = filteredTransactions
    .filter((t) => ["DEPOSIT", "LOAN_DISBURSEMENT"].includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawals = filteredTransactions
    .filter((t) => ["WITHDRAWAL", "LOAN_REPAYMENT", "FEE"].includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalTransfers = filteredTransactions
    .filter((t) => t.type === "TRANSFER")
    .reduce((sum, t) => sum + t.amount, 0);

  const handleViewDetails = (transactionId: string) => {
    // Note: The original code used /member-account/transactions/
    // but the file is in /dashboard/transactions/my-transactions-history
    // Adjusting to relative path or correct absolute path
    toast.info("Viewing details for: " + transactionId);
  };

  const handleExport = () => {
    alert("Export functionality will be implemented");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Transaction History
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">
              View and manage your transactions
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md"
          >
            <Download className="h-4 w-4" />
            <span className="text-sm md:text-base">Export</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-md border border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Deposits</p>
                <p className="text-xl md:text-2xl font-bold text-emerald-600 mt-1">
                  {formatCurrency(totalDeposits)}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <ArrowDownRight className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-md border border-red-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Withdrawals</p>
                <p className="text-xl md:text-2xl font-bold text-red-600 mt-1">
                  {formatCurrency(totalWithdrawals)}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <ArrowUpRight className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-md border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Transfers</p>
                <p className="text-xl md:text-2xl font-bold text-blue-600 mt-1">
                  {formatCurrency(totalTransfers)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <ArrowRight className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Types</option>
              <option value="DEPOSIT">Deposits</option>
              <option value="WITHDRAWAL">Withdrawals</option>
              <option value="TRANSFER">Transfers</option>
              <option value="LOAN_DISBURSEMENT">Loan Disbursements</option>
              <option value="LOAN_REPAYMENT">Loan Repayments</option>
              <option value="FEE">Fees</option>
            </select>

            {/* Account Filter */}
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.accountNumber}>
                  {account.accountType} ({account.accountNumber})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredTransactions.length} transactions
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                        <p className="text-gray-500">Loading transactions...</p>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center gap-2 text-red-500">
                        <AlertCircle className="h-8 w-8" />
                        <p>{error}</p>
                        <button onClick={() => fetchData()} className="text-blue-600 hover:underline">Retry</button>
                      </div>
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No transactions found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className={`hover:bg-gray-50 transition-colors ${getTransactionColor(
                      transaction.type
                    )}`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(transaction.date)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(transaction.date).toLocaleTimeString(
                              "en-UG",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(transaction.type)}
                        <span className="text-sm font-medium text-gray-900">
                          {getTypeLabel(transaction.type)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {transaction.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          Ref: {transaction.transactionRef}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {transaction.accountType}
                          </p>
                          <p className="text-xs text-gray-500">
                            {transaction.accountNumber}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <p
                        className={`text-sm font-bold ${
                          transaction.type === "DEPOSIT" ||
                          transaction.type === "LOAN_DISBURSEMENT"
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.type === "DEPOSIT" ||
                        transaction.type === "LOAN_DISBURSEMENT"
                          ? "+"
                          : "-"}
                        {formatCurrency(transaction.amount)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Bal: {formatCurrency(transaction.balanceAfter)}
                      </p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleViewDetails(transaction.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all text-sm font-medium"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to{" "}
                {Math.min(startIndex + transactions.length, totalItems)} of{" "}
                {totalItems} transactions
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
