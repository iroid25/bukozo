// components/MemberAccountDashboard.tsx
import React from "react";

// Types based on your database schema
export interface AccountType {
  id: string;
  name: string;
  interestRate: number;
  minBalance: number;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  status: "ACTIVE" | "INACTIVE" | "CLOSED" | "SUSPENDED";
  openedAt: Date;
  accountType: AccountType;
  branch: Branch;
  _count: {
    transactions: number;
  };
}

export interface User {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  image: string | null;
  createdAt: Date;
}

export interface LoanProduct {
  id: string;
  name: string;
  interestRate: number;
}

export interface LoanApplication {
  id: string;
  loanProduct: LoanProduct;
  amountApplied: number;
}

export interface Loan {
  id: string;
  amountGranted: number;
  outstandingBalance: number;
  amountPaid: number;
  status: string;
  disbursementDate: Date;
  dueDate: Date;
  loanApplication: LoanApplication;
  branch: {
    id: string;
    name: string;
  };
  _count: {
    repayments: number;
  };
}

export interface Transaction {
  id: string;
  transactionRef: string;
  type: string;
  amount: number;
  description: string | null;
  transactionDate: Date;
  status: string;
  channel: string | null;
}

export interface Member {
  id: string;
  memberNumber: string;
  isApproved: boolean;
  registrationDate: Date;
  user: User;
  accounts: Account[];
  loans: Loan[];
  _count: {
    accounts: number;
    loans: number;
  };
}

export interface AccountOverview {
  totalBalance: number;
  accountsCount: number;
  accountsByType: Array<{
    accountType: string;
    count: number;
    totalBalance: number;
  }>;
}

export interface LoanSummary {
  totalLoans: number;
  activeLoans: number;
  totalLoanAmount: number;
  outstandingBalance: number;
  totalRepaid: number;
  overdueLoans: number;
}

export interface MemberAccountDashboardProps {
  member: Member;
  accountOverview: AccountOverview;
  loanSummary: LoanSummary;
  recentTransactions: Transaction[];
  currentUserId: string;
}

const MemberAccountDashboard: React.FC<MemberAccountDashboardProps> = ({
  member,
  accountOverview,
  loanSummary,
  recentTransactions,
  currentUserId,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-UG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            {member.user.image ? (
              <img
                src={member.user.image}
                alt={member.user.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-gray-600 text-xl font-semibold">
                  {member.user.name?.charAt(0) ||
                    member.user.firstName?.charAt(0) ||
                    "M"}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {member.user.name ||
                  `${member.user.firstName} ${member.user.lastName}`}
              </h1>
              <p className="text-gray-600">Member #{member.memberNumber}</p>
              <p className="text-sm text-gray-500">{member.user.email}</p>
              {member.user.phone && (
                <p className="text-sm text-gray-500">{member.user.phone}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Member since</p>
            <p className="font-medium">{formatDate(member.registrationDate)}</p>
            <div className="mt-2">
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  member.isApproved
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {member.isApproved ? "Approved" : "Pending Approval"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Balance
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {formatCurrency(accountOverview.totalBalance)}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Active Accounts
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {accountOverview.accountsCount}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Loans
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {loanSummary.totalLoans}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Outstanding Balance
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {formatCurrency(loanSummary.outstandingBalance)}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts and Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">My Accounts</h3>
          </div>
          <div className="p-6">
            {member.accounts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No active accounts
              </p>
            ) : (
              <div className="space-y-4">
                {member.accounts.map((account) => (
                  <div key={account.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {account.accountType.name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {account.accountNumber}
                        </p>
                        <p className="text-sm text-gray-500">
                          {account.branch.name} - {account.branch.location}
                        </p>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                            account.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {account.status}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-medium text-gray-900">
                          {formatCurrency(account.balance)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {account._count.transactions} transactions
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Loans */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">My Loans</h3>
          </div>
          <div className="p-6">
            {member.loans.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No loans</p>
            ) : (
              <div className="space-y-4">
                {member.loans.map((loan) => (
                  <div key={loan.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {loan.loanApplication.loanProduct.name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {formatCurrency(loan.amountGranted)} granted
                        </p>
                        <p className="text-sm text-gray-500">
                          Due: {formatDate(loan.dueDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            loan.status === "REPAID"
                              ? "bg-green-100 text-green-800"
                              : loan.status === "DISBURSED"
                              ? "bg-blue-100 text-blue-800"
                              : loan.status === "OVERDUE"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {loan.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Outstanding:</span>
                        <span className="font-medium">
                          {formatCurrency(loan.outstandingBalance)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Paid:</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(loan.amountPaid)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {loan._count.repayments} repayments made
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Recent Transactions
          </h3>
        </div>
        <div className="p-6">
          {recentTransactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No recent transactions
            </p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${
                        transaction.type === "DEPOSIT"
                          ? "bg-green-500"
                          : transaction.type === "WITHDRAWAL"
                          ? "bg-red-500"
                          : transaction.type === "LOAN_DISBURSEMENT"
                          ? "bg-blue-500"
                          : "bg-gray-500"
                      }`}
                    >
                      {transaction.type === "DEPOSIT"
                        ? "+"
                        : transaction.type === "WITHDRAWAL"
                        ? "-"
                        : "L"}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {transaction.type.replace("_", " ")}
                      </p>
                      <p className="text-sm text-gray-500">
                        {transaction.description || "No description"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(transaction.transactionDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-medium ${
                        transaction.type === "DEPOSIT" ||
                        transaction.type === "LOAN_DISBURSEMENT"
                          ? "text-green-600"
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
                      {transaction.channel || "N/A"}
                    </p>
                    <span
                      className={`inline-flex px-1 py-0.5 text-xs rounded ${
                        transaction.status === "COMPLETED"
                          ? "bg-green-100 text-green-800"
                          : transaction.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {transaction.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loan Summary */}
      {loanSummary.totalLoans > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Loan Summary</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(loanSummary.totalLoanAmount)}
                </p>
                <p className="text-sm text-gray-500">Total Loan Amount</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(loanSummary.totalRepaid)}
                </p>
                <p className="text-sm text-gray-500">Total Repaid</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(loanSummary.outstandingBalance)}
                </p>
                <p className="text-sm text-gray-500">Outstanding Balance</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberAccountDashboard;
