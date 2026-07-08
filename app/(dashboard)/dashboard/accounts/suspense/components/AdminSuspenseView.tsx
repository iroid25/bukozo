"use client";

import { useState } from "react";
import { format } from "date-fns";
import type {
  CompanyWideSuspenseSummary,
  ReconciliationStatistics,
  CurrentUser,
  BranchSuspenseSummary,
} from "@/types/reconciliation";

interface AdminSuspenseViewProps {
  companySummary: CompanyWideSuspenseSummary;
  statistics: ReconciliationStatistics;
  currentUser: CurrentUser & { branch?: { id: string; name: string } | null };
}

export default function AdminSuspenseView({
  companySummary,
  statistics,
  currentUser,
}: AdminSuspenseViewProps) {
  const [selectedBranch, setSelectedBranch] =
    useState<BranchSuspenseSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<
    "name" | "overages" | "shortages" | "net"
  >("overages");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), "MMM dd, yyyy hh:mm a");
  };

  // Filter and sort branches
  const filteredBranches = companySummary.branches
    .filter((branch) =>
      branch.branchName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.branchName.localeCompare(b.branchName);
        case "overages":
          return b.totalOverages - a.totalOverages;
        case "shortages":
          return b.totalShortages - a.totalShortages;
        case "net":
          return b.netPosition - a.netPosition;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Company-Wide Suspense Account
          </h1>
          <p className="text-gray-500 mt-1">
            Aggregate view of all branches - Admin Dashboard
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <p className="text-sm text-blue-600 font-medium">
            Logged in as: {currentUser.name}
          </p>
          <p className="text-xs text-blue-500">Role: {currentUser.role}</p>
        </div>
      </div>

      {/* Company-Wide Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Overages */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-orange-500 rounded-full p-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-orange-600">
              {companySummary.branchesWithOverages} Branches
            </span>
          </div>
          <h3 className="text-sm font-medium text-orange-900">
            Total Overages (All Branches)
          </h3>
          <p className="text-2xl font-bold text-orange-700 mt-1">
            {formatCurrency(companySummary.totalOverages)}
          </p>
        </div>

        {/* Total Shortages */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-red-500 rounded-full p-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-red-600">
              {companySummary.branchesWithShortages} Branches
            </span>
          </div>
          <h3 className="text-sm font-medium text-red-900">
            Total Shortages (All Branches)
          </h3>
          <p className="text-2xl font-bold text-red-700 mt-1">
            {formatCurrency(companySummary.totalShortages)}
          </p>
        </div>

        {/* Net Position */}
        <div
          className={`bg-gradient-to-br ${
            companySummary.netPosition >= 0
              ? "from-green-50 to-green-100 border-green-200"
              : "from-red-50 to-red-100 border-red-200"
          } border-2 rounded-xl p-6`}
        >
          <div className="flex items-center justify-between mb-2">
            <div
              className={`${
                companySummary.netPosition >= 0 ? "bg-green-500" : "bg-red-500"
              } rounded-full p-3`}
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <span
              className={`text-sm font-medium ${
                companySummary.netPosition >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {companySummary.netPosition >= 0 ? "Surplus" : "Deficit"}
            </span>
          </div>
          <h3
            className={`text-sm font-medium ${
              companySummary.netPosition >= 0
                ? "text-green-900"
                : "text-red-900"
            }`}
          >
            Company Net Position
          </h3>
          <p
            className={`text-2xl font-bold mt-1 ${
              companySummary.netPosition >= 0
                ? "text-green-700"
                : "text-red-700"
            }`}
          >
            {formatCurrency(Math.abs(companySummary.netPosition))}
          </p>
        </div>

        {/* Total Branches */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-500 rounded-full p-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-blue-600">Active</span>
          </div>
          <h3 className="text-sm font-medium text-blue-900">Total Branches</h3>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            {companySummary.totalBranches}
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Branch
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by branch name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="overages">Highest Overages</option>
              <option value="shortages">Highest Shortages</option>
              <option value="net">Net Position</option>
              <option value="name">Branch Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Branch List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Branch Breakdown ({filteredBranches.length})
          </h2>
        </div>

        <div className="p-6">
          {filteredBranches.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <p className="text-gray-500 text-lg">No branches found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBranches.map((branch) => (
                <div
                  key={branch.branchId}
                  className="border-2 border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedBranch(branch)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-500 rounded-full p-3">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">
                          {branch.branchName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {branch.branchLocation || "No location"}
                        </p>
                        {branch.lastReconciliationDate && (
                          <p className="text-xs text-gray-500 mt-1">
                            Last reconciliation:{" "}
                            {formatDate(branch.lastReconciliationDate)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-2xl font-bold ${
                          branch.netPosition >= 0
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {branch.netPosition >= 0 ? "+" : ""}
                        {formatCurrency(branch.netPosition)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Net Position</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-600">Overages</p>
                      <p className="font-semibold text-orange-700">
                        {formatCurrency(branch.totalOverages)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {branch.overageCount} entries
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Shortages</p>
                      <p className="font-semibold text-red-700">
                        {formatCurrency(branch.totalShortages)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {branch.shortageCount} entries
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">
                        Unresolved Overages
                      </p>
                      <p className="font-semibold text-orange-600">
                        {branch.unresolvedOverages}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">
                        Unresolved Shortages
                      </p>
                      <p className="font-semibold text-red-600">
                        {branch.unresolvedShortages}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Branch Detail Modal */}
      {selectedBranch && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedBranch(null)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedBranch.branchName} - Detailed View
              </h2>
              <button
                onClick={() => setSelectedBranch(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Branch Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-600 font-medium">
                    Total Overages
                  </p>
                  <p className="text-2xl font-bold text-orange-700 mt-1">
                    {formatCurrency(selectedBranch.totalOverages)}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    {selectedBranch.overageCount} entries
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-600 font-medium">
                    Total Shortages
                  </p>
                  <p className="text-2xl font-bold text-red-700 mt-1">
                    {formatCurrency(selectedBranch.totalShortages)}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {selectedBranch.shortageCount} entries
                  </p>
                </div>
                <div
                  className={`${
                    selectedBranch.netPosition >= 0
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  } border rounded-lg p-4`}
                >
                  <p
                    className={`text-sm font-medium ${
                      selectedBranch.netPosition >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    Net Position
                  </p>
                  <p
                    className={`text-2xl font-bold mt-1 ${
                      selectedBranch.netPosition >= 0
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {selectedBranch.netPosition >= 0 ? "+" : ""}
                    {formatCurrency(selectedBranch.netPosition)}
                  </p>
                </div>
              </div>

              {/* Overage Entries */}
              {selectedBranch.overageEntries.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Overage Entries ({selectedBranch.overageEntries.length})
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedBranch.overageEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-orange-50 border border-orange-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {entry.float.user.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {entry.float.user.email}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(entry.reconciliationDate)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-orange-700">
                              +{formatCurrency(entry.difference)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shortage Entries */}
              {selectedBranch.shortageEntries.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Shortage Entries ({selectedBranch.shortageEntries.length})
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedBranch.shortageEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-red-50 border border-red-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {entry.float.user.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {entry.float.user.email}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(entry.reconciliationDate)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-red-700">
                              -{formatCurrency(Math.abs(entry.difference))}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
