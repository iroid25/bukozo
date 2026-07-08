"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Wallet,
  ArrowRight,
  Check,
  AlertCircle,
} from "lucide-react";

// Types
interface Transfer {
  id: string;
  fromAccount: {
    accountNumber: string;
    accountName: string;
  };
  toAccount: {
    accountNumber: string;
    accountName: string;
  };
  amount: number;
  status: string;
  createdAt: string;
  description?: string;
}

interface Account {
  id: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  accountType: string;
}

export default function Transfers() {
  // Dummy accounts data
  const [accounts] = useState<Account[]>([
    {
      id: "1",
      accountNumber: "ACC001234",
      accountName: "Savings Account",
      balance: 5000000,
      accountType: "SAVINGS",
    },
    {
      id: "2",
      accountNumber: "ACC001235",
      accountName: "Current Account",
      balance: 2500000,
      accountType: "CURRENT",
    },
    {
      id: "3",
      accountNumber: "ACC001236",
      accountName: "Fixed Deposit",
      balance: 10000000,
      accountType: "FIXED_DEPOSIT",
    },
  ]);

  // Dummy transfers data
  const [transfers] = useState<Transfer[]>([
    {
      id: "1",
      fromAccount: {
        accountNumber: "ACC001234",
        accountName: "Savings Account",
      },
      toAccount: {
        accountNumber: "ACC001235",
        accountName: "Current Account",
      },
      amount: 500000,
      status: "completed",
      createdAt: "2024-12-01T10:30:00",
      description: "Monthly allocation",
    },
    {
      id: "2",
      fromAccount: {
        accountNumber: "ACC001235",
        accountName: "Current Account",
      },
      toAccount: {
        accountNumber: "ACC001236",
        accountName: "Fixed Deposit",
      },
      amount: 1000000,
      status: "completed",
      createdAt: "2024-11-28T14:20:00",
      description: "Investment transfer",
    },
    {
      id: "3",
      fromAccount: {
        accountNumber: "ACC001234",
        accountName: "Savings Account",
      },
      toAccount: {
        accountNumber: "ACC001235",
        accountName: "Current Account",
      },
      amount: 250000,
      status: "pending",
      createdAt: "2024-12-02T09:15:00",
      description: "Pending verification",
    },
    {
      id: "4",
      fromAccount: {
        accountNumber: "ACC001236",
        accountName: "Fixed Deposit",
      },
      toAccount: {
        accountNumber: "ACC001234",
        accountName: "Savings Account",
      },
      amount: 750000,
      status: "completed",
      createdAt: "2024-11-25T16:45:00",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<"form" | "confirm" | "success">(
    "form"
  );

  // Form states
  const [formData, setFormData] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    description: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const itemsPerPage = 10;

  const handleOpenModal = () => {
    setShowModal(true);
    setModalStep("form");
    resetForm();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalStep("form");
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      fromAccountId: "",
      toAccountId: "",
      amount: "",
      description: "",
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // From Account validation
    if (!formData.fromAccountId) {
      errors.fromAccountId = "Please select source account";
    }

    // To Account validation
    if (!formData.toAccountId) {
      errors.toAccountId = "Please select destination account";
    } else if (formData.fromAccountId === formData.toAccountId) {
      errors.toAccountId = "Cannot transfer to the same account";
    }

    // Amount validation
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.amount = "Amount must be greater than 0";
    } else {
      const fromAccount = accounts.find(
        (acc) => acc.id === formData.fromAccountId
      );
      if (fromAccount && parseFloat(formData.amount) > fromAccount.balance) {
        errors.amount = "Insufficient balance";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setModalStep("confirm");
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setModalStep("success");
    }, 2000);
  };

  const handleSuccessClose = () => {
    handleCloseModal();
    // In real app, refresh transfers list here
  };

  const filteredTransfers = transfers.filter((transfer) => {
    const matchesSearch =
      transfer.fromAccount.accountNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transfer.fromAccount.accountName
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transfer.toAccount.accountNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transfer.toAccount.accountName
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || transfer.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage);
  const paginatedTransfers = filteredTransfers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const fromAccount = accounts.find((acc) => acc.id === formData.fromAccountId);
  const toAccount = accounts.find((acc) => acc.id === formData.toAccountId);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Account Transfers
            </h1>
            <p className="text-gray-600 mt-1 text-sm md:text-base">
              Transfer funds between your accounts
            </p>
          </div>
          <button
            onClick={handleOpenModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-br from-green-500 to-green-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
            New Transfer
          </button>
        </div>

        {/* Account Cards - Quick Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium text-gray-700">
                      {account.accountName}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {account.accountNumber}
                  </p>
                  <p className="text-lg md:text-xl font-bold text-gray-900">
                    {account.balance.toLocaleString()} UGX
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by account..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Transfers Table/List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          ) : paginatedTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 p-4">
              <ArrowLeftRight className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium text-center">
                No transfers found
              </p>
              <p className="text-sm text-center">
                Try adjusting your filters or make a new transfer
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        From Account
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        →
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        To Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedTransfers.map((transfer) => (
                      <tr
                        key={transfer.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            {new Date(transfer.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {transfer.fromAccount.accountName}
                            </div>
                            <div className="text-gray-500">
                              {transfer.fromAccount.accountNumber}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <ArrowRight className="w-5 h-5 text-green-600 mx-auto" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {transfer.toAccount.accountName}
                            </div>
                            <div className="text-gray-500">
                              {transfer.toAccount.accountNumber}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          {transfer.amount.toLocaleString()} UGX
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                              transfer.status
                            )}`}
                          >
                            {transfer.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {transfer.description || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-200">
                {paginatedTransfers.map((transfer) => (
                  <div key={transfer.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(transfer.createdAt).toLocaleDateString()}
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          transfer.status
                        )}`}
                      >
                        {transfer.status}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">From</p>
                          <p className="text-sm font-medium text-gray-900">
                            {transfer.fromAccount.accountName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {transfer.fromAccount.accountNumber}
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div className="flex-1 bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">To</p>
                          <p className="text-sm font-medium text-gray-900">
                            {transfer.toAccount.accountName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {transfer.toAccount.accountNumber}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-lg font-bold text-green-600">
                          {transfer.amount.toLocaleString()} UGX
                        </span>
                        {transfer.description && (
                          <span className="text-xs text-gray-500">
                            {transfer.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white px-4 md:px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-200">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                {modalStep === "form" && "New Transfer"}
                {modalStep === "confirm" && "Confirm Transfer"}
                {modalStep === "success" && "Transfer Successful"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 md:p-6">
              {modalStep === "form" && (
                <form onSubmit={handleContinue} className="space-y-6">
                  {/* From Account */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      From Account <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.fromAccountId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fromAccountId: e.target.value,
                        })
                      }
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                        formErrors.fromAccountId
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    >
                      <option value="">Select source account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.accountName} - {account.accountNumber}{" "}
                          (Balance: {account.balance.toLocaleString()} UGX)
                        </option>
                      ))}
                    </select>
                    {formErrors.fromAccountId && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors.fromAccountId}
                      </p>
                    )}
                  </div>

                  {/* To Account */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      To Account <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.toAccountId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          toAccountId: e.target.value,
                        })
                      }
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                        formErrors.toAccountId
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    >
                      <option value="">Select destination account</option>
                      {accounts
                        .filter((acc) => acc.id !== formData.fromAccountId)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.accountName} - {account.accountNumber}
                          </option>
                        ))}
                    </select>
                    {formErrors.toAccountId && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors.toAccountId}
                      </p>
                    )}
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount (UGX) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      placeholder="Enter amount"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                        formErrors.amount ? "border-red-500" : "border-gray-300"
                      }`}
                    />
                    {fromAccount && (
                      <p className="text-sm text-gray-600 mt-1">
                        Available balance:{" "}
                        {fromAccount.balance.toLocaleString()} UGX
                      </p>
                    )}
                    {formErrors.amount && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors.amount}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Add a note for this transfer"
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="w-full sm:flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              )}

              {modalStep === "confirm" && (
                <div className="space-y-6">
                  {/* Transfer Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 md:p-6 space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Amount</span>
                      <span className="text-2xl font-bold text-gray-900">
                        {parseFloat(formData.amount).toLocaleString()} UGX
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-2">From</p>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="font-medium text-gray-900">
                          {fromAccount?.accountName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {fromAccount?.accountNumber}
                        </p>
                        <p className="text-sm text-gray-600 mt-2">
                          Current Balance:{" "}
                          {fromAccount?.balance.toLocaleString()} UGX
                        </p>
                        <p className="text-sm font-medium text-orange-600">
                          New Balance:{" "}
                          {(
                            (fromAccount?.balance || 0) -
                            parseFloat(formData.amount || "0")
                          ).toLocaleString()}{" "}
                          UGX
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <ArrowRight className="w-6 h-6 text-green-600" />
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-2">To</p>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="font-medium text-gray-900">
                          {toAccount?.accountName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {toAccount?.accountNumber}
                        </p>
                        <p className="text-sm text-gray-600 mt-2">
                          Current Balance: {toAccount?.balance.toLocaleString()}{" "}
                          UGX
                        </p>
                        <p className="text-sm font-medium text-green-600">
                          New Balance:{" "}
                          {(
                            (toAccount?.balance || 0) +
                            parseFloat(formData.amount || "0")
                          ).toLocaleString()}{" "}
                          UGX
                        </p>
                      </div>
                    </div>

                    {formData.description && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          Description
                        </p>
                        <p className="text-sm text-gray-700">
                          {formData.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Warning */}
                  <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">
                        Please confirm transfer details
                      </p>
                      <p className="text-yellow-700">
                        This action cannot be undone. Please verify all details
                        before proceeding.
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setModalStep("form")}
                      className="w-full sm:flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full sm:flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Processing...
                        </>
                      ) : (
                        "Confirm Transfer"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {modalStep === "success" && (
                <div className="text-center py-8 space-y-6">
                  <div className="flex justify-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-10 h-10 text-green-600" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Transfer Successful!
                    </h3>
                    <p className="text-gray-600">
                      Your transfer has been completed successfully
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 space-y-3 text-left">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount Transferred</span>
                      <span className="font-bold text-gray-900">
                        {parseFloat(formData.amount).toLocaleString()} UGX
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">From</span>
                      <span className="font-medium text-gray-900">
                        {fromAccount?.accountName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">To</span>
                      <span className="font-medium text-gray-900">
                        {toAccount?.accountName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date</span>
                      <span className="font-medium text-gray-900">
                        {new Date().toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleSuccessClose}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
