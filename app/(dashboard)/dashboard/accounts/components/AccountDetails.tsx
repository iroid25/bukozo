"use client";

import { useState } from "react";
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  Phone,
  Mail,
  User,
  Users,
  Building,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  MoreHorizontal,
  XCircle,
  RefreshCcw,
} from "lucide-react";
import AccountFeeSettingsDialog from "./AccountFeeSettingsDialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import MemberDepositModal from "./MemberDepositModal";
import { Plus } from "lucide-react";

interface AccountDetailsProps {
  account: {
    id: string;
    accountNumber: string;
    balance: number;
    status: string;
    openedAt: Date;
    closedAt?: Date | null;
    fixingStartDate?: Date | null;
    fixingEndDate?: Date | null;
    expectedInterest?: number | null;
    customFlatWithdrawalFee?: number | null;
    customWithdrawalFeePercentage?: number | null;
    owner:
      | {
          type: "member";
          id: string;
          memberNumber: string;
          registrationDate: Date;
          user: {
            id: string;
            name: string;
            firstName: string;
            lastName: string;
            email: string | null;
            phone?: string | null;
            image?: string | null;
          };
        }
      | {
          type: "institution";
          id: string;
          institutionNumber: string;
          registrationDate: Date;
          institutionName: string;
          user: {
            id: string;
            name: string;
            firstName: string;
            lastName: string;
            email: string | null;
            phone?: string | null;
            image?: string | null;
          };
        };
    accountType: {
      name: string;
      interestRate: number;
      minBalance: number;
      hasFixedPeriod: boolean;
      maxWithdrawal?: number | null;
      flatWithdrawalFee?: number | null;
      withdrawalFeePercentage?: number | null;
      isShareAccount: boolean;
      sharePrice?: number | null;
    };
    sharesCount?: number | null;
    jointMembers?: Array<{
      id: string;
      member: {
        id: string;
        memberNumber: string;
        user: {
          id: string;
          name: string;
          email: string | null;
          phone?: string | null;
          image?: string | null;
        };
      };
    }>;
    branch: {
      name: string;
      location: string;
      contactPhone?: string | null;
    };
    transactions: Array<{
      id: string;
      transactionRef: string;
      type: string;
      amount: number;
      status: string;
      description?: string | null;
      transactionDate: string | Date;
      channel?: string | null;
      processedByUser?: {
        id: string;
        name: string;
        firstName: string;
        lastName: string;
      } | null;
    }>;
    deposits: Array<{
      id: string;
      amount: number;
      depositDate: Date;
      channel: string;
      mobileMoneyRef?: string | null;
      handler: {
        id: string;
        name: string;
        firstName: string;
        lastName: string;
      };
    }>;
    withdrawals: Array<{
      id: string;
      amount: number;
      withdrawalDate: Date;
      channel: string;
      mobileMoneyRef?: string | null;
      handler: {
        id: string;
        name: string;
        firstName: string;
        lastName: string;
      };
    }>;
  };
  summary: {
    totalDeposits: number;
    totalWithdrawals: number;
    depositsCount: number;
    withdrawalsCount: number;
    transactionCount: number;
  };
}

export default function AccountDetails({
  account,
  summary,
}: AccountDetailsProps) {
  const [activeTab, setActiveTab] = useState("transactions");
  const [transactionFilter, setTransactionFilter] = useState("all");
  const [isBreaking, setIsBreaking] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const router = useRouter();

  const handleBreakDeposit = async () => {
    if (!confirm("Are you sure you want to break this fixed deposit prematurely? All expected interest will be forfeited.")) return;
    
    setIsBreaking(true);
    try {
      const response = await fetch(`/api/v1/accounts/${encodeURIComponent(account.id)}/early-withdrawal`, {
        method: "POST",
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json?.error || "Failed to process early withdrawal");
      } else {
        toast.success("Fixed deposit broken successfully. Funds returned to savings.");
        router.refresh();
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsBreaking(false);
    }
  };

  const handleReactivateDormantAccount = async () => {
    if (
      !confirm(
        "Are you sure you want to reactivate this dormant account? UGX 10,000 will be collected."
      )
    )
      return;

    setIsReactivating(true);
    try {
      const response = await fetch(
        `/api/v1/accounts/${encodeURIComponent(account.id)}/reactivate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            remarks: "Reactivation processed from account details",
          }),
        }
      );
      const json = await response.json();

      if (!response.ok) {
        toast.error(json?.error || "Failed to reactivate account");
      } else {
        toast.success("Account reactivated successfully");
        router.refresh();
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsReactivating(false);
    }
  };

  // Helper functions for owner data
  const getOwnerName = () => {
    if (account.owner.type === "member") {
      return account.owner.user.name;
    }
    return account.owner.institutionName;
  };

  const getOwnerNumber = () => {
    if (account.owner.type === "member") {
      return `Member #${account.owner.memberNumber}`;
    }
    return `Institution #${account.owner.institutionNumber}`;
  };

  const getOwnerType = () => {
    return account.owner.type === "member" ? "Account Holder" : "Institution";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: Date | string) => {
    return new Date(dateString).toLocaleDateString("en-UG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      ACTIVE: "bg-green-100 text-green-800",
      INACTIVE: "bg-yellow-100 text-yellow-800",
      DORMANT: "bg-orange-100 text-orange-800",
      CLOSED: "bg-red-100 text-red-800",
      SUSPENDED: "bg-gray-100 text-gray-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status as keyof typeof statusClasses] || "bg-gray-100 text-gray-800"}`}
      >
        {status}
      </span>
    );
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "DEPOSIT":
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case "WITHDRAWAL":
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "DEPOSIT":
        return "text-green-600";
      case "WITHDRAWAL":
        return "text-red-600";
      default:
        return "text-blue-600";
    }
  };

  const filteredTransactions = account.transactions.filter((transaction) => {
    if (transactionFilter === "all") return true;
    return transaction.type === transactionFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Account {account.accountNumber}
              </h1>
              <p className="text-gray-600">
                {account.accountType.name} • {account.branch.name}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <AccountFeeSettingsDialog
                accountId={account.id}
                accountNumber={account.accountNumber}
                accountTypeName={account.accountType.name}
                currentFlatFee={account.customFlatWithdrawalFee ?? null}
                currentPercentage={account.customWithdrawalFeePercentage ?? null}
                defaultFlatFee={account.accountType.flatWithdrawalFee ?? null}
                defaultPercentage={
                  account.accountType.withdrawalFeePercentage ?? null
                }
              />
              {!account.accountType.hasFixedPeriod && account.status === "ACTIVE" && (
                <button
                  onClick={() => setDepositModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Deposit (Mobile Money)
                </button>
              )}
              {account.accountType.hasFixedPeriod && account.status === "ACTIVE" && (
                <button
                  onClick={handleBreakDeposit}
                  disabled={isBreaking}
                  className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  {isBreaking ? "Processing..." : "Break Deposit"}
                </button>
              )}
              {account.status === "DORMANT" && (
                <button
                  onClick={handleReactivateDormantAccount}
                  disabled={isReactivating}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {isReactivating ? "Reactivating..." : "Reactivate"}
                </button>
              )}
              {getStatusBadge(account.status)}
            </div>
          </div>
        </div>

        <MemberDepositModal
          isOpen={depositModalOpen}
          onClose={() => setDepositModalOpen(false)}
          accountId={account.id}
          accountNumber={account.accountNumber}
          ownerPhone={account.owner.user.phone}
          memberId={account.owner.type === "member" ? account.owner.id : null}
          institutionId={account.owner.type === "institution" ? account.owner.id : null}
        />

        {/* Account Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">
                Current Balance
              </h3>
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(account.balance)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Min: {formatCurrency(account.accountType.minBalance)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">
                Total Deposits
              </h3>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalDeposits)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {summary.depositsCount} transactions
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">
                Total Withdrawals
              </h3>
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalWithdrawals)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {summary.withdrawalsCount} transactions
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">
                Interest Rate
              </h3>
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {account.accountType.interestRate}%
            </p>
            <p className="text-xs text-gray-600 mt-1">Per annum</p>
          </div>
        </div>

        {/* Owner Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            {getOwnerType()}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
                {account.owner.user.image ? (
                  <img
                    src={account.owner.user.image}
                    alt={getOwnerName()}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : account.owner.type === "member" ? (
                  <User className="h-8 w-8 text-blue-600" />
                ) : (
                  <Building className="h-8 w-8 text-blue-600" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{getOwnerName()}</h3>
                <p className="text-sm text-gray-500">{getOwnerNumber()}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <div className="flex items-center mt-1">
                <Mail className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">
                  {account.owner.user.email}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Phone</label>
              <div className="flex items-center mt-1">
                <Phone className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">
                  {account.owner.user.phone || "N/A"}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">
                Branch
              </label>
              <div className="flex items-center mt-1">
                <Building className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">
                  {account.branch.name}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">
                Location
              </label>
              <div className="flex items-center mt-1">
                <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">
                  {account.branch.location}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">
                Account Opened
              </label>
              <div className="flex items-center mt-1">
                <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">
                  {formatDate(account.openedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Joint Members */}
        {account.jointMembers && account.jointMembers.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              Joint Account Holders ({account.jointMembers.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {account.jointMembers.map((jm) => (
                <div key={jm.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                  <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
                    {jm.member.user.image ? (
                      <img
                        src={jm.member.user.image}
                        alt={jm.member.user.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{jm.member.user.name}</h3>
                    <p className="text-sm text-gray-500">#{jm.member.memberNumber}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions Section */}
        <div className="bg-white rounded-lg shadow-sm">
          {/* Tabs */}
          <div className="border-b border-gray-200 px-6">
            <div className="flex space-x-8">
              {[
                {
                  id: "transactions",
                  label: "All Transactions",
                  count: summary.transactionCount,
                },
                {
                  id: "deposits",
                  label: "Deposits",
                  count: summary.depositsCount,
                },
                {
                  id: "withdrawals",
                  label: "Withdrawals",
                  count: summary.withdrawalsCount,
                },
                { id: "summary", label: "Summary" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === "transactions" && (
              <div>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <select
                    value={transactionFilter}
                    onChange={(e) => setTransactionFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    <option value="DEPOSIT">Deposits</option>
                    <option value="WITHDRAWAL">Withdrawals</option>
                    <option value="LOAN_DISBURSEMENT">
                      Loan Disbursements
                    </option>
                    <option value="LOAN_REPAYMENT">Loan Repayments</option>
                  </select>
                </div>

                {/* Transactions Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaction
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredTransactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getTransactionIcon(transaction.type)}
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {transaction.transactionRef}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {transaction.description || "No description"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`text-sm font-medium ${getTransactionTypeColor(transaction.type)}`}
                            >
                              {transaction.type.replace("_", " ")}
                            </span>
                            {transaction.channel && (
                              <div className="text-xs text-gray-500">
                                {transaction.channel}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(transaction.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                transaction.status === "COMPLETED"
                                  ? "bg-green-100 text-green-800"
                                  : transaction.status === "PENDING"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {transaction.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(transaction.transactionDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button className="text-gray-400 hover:text-gray-600">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredTransactions.length === 0 && (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No transactions found</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "deposits" && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Channel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Handler
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {account.deposits.map((deposit) => (
                      <tr key={deposit.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          {formatCurrency(deposit.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {deposit.channel}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {deposit.handler.firstName} {deposit.handler.lastName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(deposit.depositDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {deposit.mobileMoneyRef || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {account.deposits.length === 0 && (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No deposits found</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "withdrawals" && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Channel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Handler
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {account.withdrawals.map((withdrawal) => (
                      <tr key={withdrawal.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                          -{formatCurrency(withdrawal.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {withdrawal.channel}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {withdrawal.handler.firstName}{" "}
                          {withdrawal.handler.lastName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(withdrawal.withdrawalDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {withdrawal.mobileMoneyRef || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {account.withdrawals.length === 0 && (
                  <div className="text-center py-12">
                    <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No withdrawals found</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "summary" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4">
                    Account Overview
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Account Type:</span>
                      <span className="font-medium text-blue-900">
                        {account.accountType.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Current Balance:</span>
                      <span className="font-bold text-blue-900">
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Interest Rate:</span>
                      <span className="font-medium text-blue-900">
                        {account.accountType.interestRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Min Balance:</span>
                      <span className="font-medium text-blue-900">
                        {formatCurrency(account.accountType.minBalance)}
                      </span>
                    </div>
                    {account.accountType.isShareAccount && (
                       <div className="flex justify-between border-t border-blue-200 pt-2 mt-2">
                        <span className="text-blue-700 font-bold">Shares Owned:</span>
                        <span className="font-bold text-blue-900">
                          {account.sharesCount || 0}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-900 mb-4">
                    Deposit Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-green-700">Total Deposits:</span>
                      <span className="font-bold text-green-900">
                        {formatCurrency(summary.totalDeposits)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">
                        Number of Deposits:
                      </span>
                      <span className="font-medium text-green-900">
                        {summary.depositsCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Average Deposit:</span>
                      <span className="font-medium text-green-900">
                        {formatCurrency(
                          summary.depositsCount > 0
                            ? summary.totalDeposits / summary.depositsCount
                            : 0
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-red-900 mb-4">
                    Withdrawal Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-red-700">Total Withdrawals:</span>
                      <span className="font-bold text-red-900">
                        {formatCurrency(summary.totalWithdrawals)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-700">
                        Number of Withdrawals:
                      </span>
                      <span className="font-medium text-red-900">
                        {summary.withdrawalsCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-700">Average Withdrawal:</span>
                      <span className="font-medium text-red-900">
                        {formatCurrency(
                          summary.withdrawalsCount > 0
                            ? summary.totalWithdrawals /
                                summary.withdrawalsCount
                            : 0
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 md:col-span-2 lg:col-span-3">
                  <h3 className="text-lg font-semibold text-purple-900 mb-4">
                    Account Activity
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-900">
                        {summary.transactionCount}
                      </div>
                      <div className="text-purple-700">Total Transactions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-900">
                        {formatCurrency(
                          summary.totalDeposits - summary.totalWithdrawals
                        )}
                      </div>
                      <div className="text-purple-700">Net Flow</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-900">
                        {formatDate(account.openedAt).split(",")[0]}
                      </div>
                      <div className="text-purple-700">Account Opened</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
