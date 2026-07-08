// app/(dashboard)/member-account/loan-repayments/page.tsx

 
"use client";

import React, { useState } from "react";
import {
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  Calendar,
  CreditCard,
  CheckCircle,
  Clock,
  User,
  TrendingDown,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Plus,
  Receipt,
  Percent,
  Building,
  Smartphone,
  Banknote,
} from "lucide-react";
import AddDepositDialog from "../../member-details/deposit-details/components/DepositDiag";
import UniversalTransactionDialog from "./UniversalTransactionDialog";

// =====================
// TypeScript Interfaces
// =====================

interface LoanRepayment {
  id: string;
  loanNumber: string;
  loanProduct: string;
  amount: number;
  repaymentDate: string;
  channel: string;
  reference: string | null;
  processedBy: string;
  processedByRole: string;
  loanAmount: number;
  outstandingBalance: number;
  interestRate: number;
  status: "COMPLETED" | "PENDING" | "FAILED";
}

// =====================
// Dummy Data
// =====================

const DUMMY_REPAYMENTS: LoanRepayment[] = [
  {
    id: "rep001",
    loanNumber: "LN-2024-001",
    loanProduct: "Personal Loan",
    amount: 500000,
    repaymentDate: "2024-12-01T10:30:00Z",
    channel: "MOBILE_MONEY",
    reference: "MM2024120112345",
    processedBy: "Mary Nakato",
    processedByRole: "TELLER",
    loanAmount: 5000000,
    outstandingBalance: 3500000,
    interestRate: 12,
    status: "COMPLETED",
  },
  {
    id: "rep002",
    loanNumber: "LN-2024-001",
    loanProduct: "Personal Loan",
    amount: 1000000,
    repaymentDate: "2024-11-01T14:20:00Z",
    channel: "BANK_TRANSFER",
    reference: "BT2024110198765",
    processedBy: "System",
    processedByRole: "SYSTEM",
    loanAmount: 5000000,
    outstandingBalance: 3500000,
    interestRate: 12,
    status: "COMPLETED",
  },
  {
    id: "rep003",
    loanNumber: "LN-2024-002",
    loanProduct: "Business Loan",
    amount: 600000,
    repaymentDate: "2024-11-15T09:00:00Z",
    channel: "MOBILE_MONEY",
    reference: "MM2024111534567",
    processedBy: "Peter Ssemwanga",
    processedByRole: "LOANOFFICER",
    loanAmount: 3000000,
    outstandingBalance: 1200000,
    interestRate: 10,
    status: "COMPLETED",
  },
  {
    id: "rep004",
    loanNumber: "LN-2024-002",
    loanProduct: "Business Loan",
    amount: 1200000,
    repaymentDate: "2024-10-01T11:30:00Z",
    channel: "CASH",
    reference: null,
    processedBy: "Agnes Nalwanga",
    processedByRole: "TELLER",
    loanAmount: 3000000,
    outstandingBalance: 1200000,
    interestRate: 10,
    status: "COMPLETED",
  },
  {
    id: "rep005",
    loanNumber: "LN-2024-003",
    loanProduct: "Emergency Loan",
    amount: 250000,
    repaymentDate: "2024-11-20T16:45:00Z",
    channel: "MOBILE_MONEY",
    reference: "MM2024112045678",
    processedBy: "David Musoke",
    processedByRole: "TELLER",
    loanAmount: 1000000,
    outstandingBalance: 500000,
    interestRate: 15,
    status: "COMPLETED",
  },
  {
    id: "rep006",
    loanNumber: "LN-2024-003",
    loanProduct: "Emergency Loan",
    amount: 250000,
    repaymentDate: "2024-10-20T08:15:00Z",
    channel: "BANK_TRANSFER",
    reference: "BT2024102056789",
    processedBy: "Grace Auma",
    processedByRole: "TELLER",
    loanAmount: 1000000,
    outstandingBalance: 500000,
    interestRate: 15,
    status: "COMPLETED",
  },
  {
    id: "rep007",
    loanNumber: "LN-2024-004",
    loanProduct: "Agricultural Loan",
    amount: 800000,
    repaymentDate: "2024-11-10T13:00:00Z",
    channel: "CASH",
    reference: null,
    processedBy: "Sarah Nambi",
    processedByRole: "BRANCHMANAGER",
    loanAmount: 4000000,
    outstandingBalance: 2400000,
    interestRate: 8,
    status: "COMPLETED",
  },
  {
    id: "rep008",
    loanNumber: "LN-2024-004",
    loanProduct: "Agricultural Loan",
    amount: 800000,
    repaymentDate: "2024-10-10T10:30:00Z",
    channel: "MOBILE_MONEY",
    reference: "MM2024101067890",
    processedBy: "Isaac Kato",
    processedByRole: "TELLER",
    loanAmount: 4000000,
    outstandingBalance: 2400000,
    interestRate: 8,
    status: "COMPLETED",
  },
  {
    id: "rep009",
    loanNumber: "LN-2024-005",
    loanProduct: "Education Loan",
    amount: 450000,
    repaymentDate: "2024-11-25T15:20:00Z",
    channel: "BANK_TRANSFER",
    reference: "BT2024112578901",
    processedBy: "Ruth Akello",
    processedByRole: "TELLER",
    loanAmount: 2500000,
    outstandingBalance: 1600000,
    interestRate: 9,
    status: "COMPLETED",
  },
  {
    id: "rep010",
    loanNumber: "LN-2024-005",
    loanProduct: "Education Loan",
    amount: 450000,
    repaymentDate: "2024-10-25T12:00:00Z",
    channel: "MOBILE_MONEY",
    reference: "MM2024102589012",
    processedBy: "Michael Okoth",
    processedByRole: "TELLER",
    loanAmount: 2500000,
    outstandingBalance: 1600000,
    interestRate: 9,
    status: "COMPLETED",
  },
];

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
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getChannelBadge = (channel: string) => {
  const channelConfig: Record<
    string,
    { color: string; icon: React.ReactNode }
  > = {
    CASH: {
      color: "bg-green-100 text-green-700",
      icon: <Banknote className="h-3 w-3" />,
    },
    MOBILE_MONEY: {
      color: "bg-blue-100 text-blue-700",
      icon: <Smartphone className="h-3 w-3" />,
    },
    BANK_TRANSFER: {
      color: "bg-purple-100 text-purple-700",
      icon: <Building className="h-3 w-3" />,
    },
  };

  const config = channelConfig[channel] || {
    color: "bg-gray-100 text-gray-700",
    icon: null,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.icon}
      {channel.replace(/_/g, " ")}
    </span>
  );
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
          <AlertCircle className="h-3 w-3" />
          Failed
        </span>
      );
    default:
      return null;
  }
};

// =====================
// Main Component
// =====================

export default function LoanRepaymentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLoan, setFilterLoan] = useState<string>("ALL");
  const [filterChannel, setFilterChannel] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const itemsPerPage = 10;

  const handleRepaymentSuccess = (result: any) => {
    console.log("Repayment created:", result);
  };

  // Filter repayments
  const filteredRepayments = DUMMY_REPAYMENTS.filter((rep) => {
    const matchesSearch =
      rep.loanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.loanProduct.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.processedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rep.reference?.toLowerCase() || "").includes(searchQuery.toLowerCase());

    const matchesLoan = filterLoan === "ALL" || rep.loanNumber === filterLoan;
    const matchesChannel =
      filterChannel === "ALL" || rep.channel === filterChannel;
    const matchesStatus = filterStatus === "ALL" || rep.status === filterStatus;

    return matchesSearch && matchesLoan && matchesChannel && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRepayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRepayments = filteredRepayments.slice(startIndex, endIndex);

  // Calculate summary
  const totalPaid = filteredRepayments.reduce((sum, r) => sum + r.amount, 0);
  const averagePayment =
    filteredRepayments.length > 0 ? totalPaid / filteredRepayments.length : 0;
  const paymentCount = filteredRepayments.length;

  // Get unique loan numbers for filter
  const uniqueLoans = Array.from(
    new Set(DUMMY_REPAYMENTS.map((r) => r.loanNumber))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Loan Repayment History
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">
              Track your loan repayments and payment history
            </p>
          </div>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm md:text-base">Make Payment</span>
          </button>
        </div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Paid */}
          <div className="bg-white rounded-xl p-4 shadow-md border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Paid</p>
                <p className="text-xl md:text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(totalPaid)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {paymentCount} payment{paymentCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Average Payment */}
          <div className="bg-white rounded-xl p-4 shadow-md border border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average Payment</p>
                <p className="text-xl md:text-2xl font-bold text-emerald-600 mt-1">
                  {formatCurrency(averagePayment)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Per transaction</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <TrendingDown className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Payment Count */}
          <div className="bg-white rounded-xl p-4 shadow-md border border-teal-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Payments</p>
                <p className="text-xl md:text-2xl font-bold text-teal-600 mt-1">
                  {paymentCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">Repayments made</p>
              </div>
              <div className="p-3 bg-teal-100 rounded-full">
                <Receipt className="h-6 w-6 text-teal-600" />
              </div>
            </div>
          </div>
        </div>
        {/* Filters */}
        <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search repayments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Loan Filter */}
            <select
              value={filterLoan}
              onChange={(e) => setFilterLoan(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="ALL">All Loans</option>
              {uniqueLoans.map((loan) => (
                <option key={loan} value={loan}>
                  {loan}
                </option>
              ))}
            </select>

            {/* Channel Filter */}
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="ALL">All Channels</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CASH">Cash</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="ALL">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredRepayments.length} repayment
            {filteredRepayments.length !== 1 ? "s" : ""}
          </div>
        </div>
        {/* Repayments Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-green-50 border-b border-green-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan Details
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount Paid
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outstanding
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Channel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processed By
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedRepayments.map((repayment) => (
                  <tr
                    key={repayment.id}
                    className="hover:bg-orange-50 transition-colors border-l-4 border-l-orange-500"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {formatDate(repayment.repaymentDate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {repayment.loanProduct}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {repayment.loanNumber}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Percent className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {repayment.interestRate}% interest
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <p className="text-base font-bold text-red-600">
                        -{formatCurrency(repayment.amount)}
                      </p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <div>
                        <p className="text-sm font-semibold text-orange-600">
                          {formatCurrency(repayment.outstandingBalance)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          of {formatCurrency(repayment.loanAmount)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {getChannelBadge(repayment.channel)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="font-mono text-xs text-gray-600">
                        {repayment.reference || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-700">
                            {repayment.processedBy}
                          </p>
                          <p className="text-xs text-gray-500">
                            {repayment.processedByRole}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {getStatusBadge(repayment.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to{" "}
                {Math.min(endIndex, filteredRepayments.length)} of{" "}
                {filteredRepayments.length} repayments
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
        {/* Universal Transaction Dialog for Repayments */}
        {/* // ✅ Function is used correctly */}
        <UniversalTransactionDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={handleRepaymentSuccess} // ✅ CORRECT!
          transactionType="repayment"
        />
      </div>
    </div>
  );
}
