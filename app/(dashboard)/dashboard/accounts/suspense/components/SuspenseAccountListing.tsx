"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import type {
  SuspenseEntry,
  ShortageEntry,
  BranchReconciliationStatistics, // ✅ Changed from ReconciliationStatistics
  CurrentUser,
} from "@/types/reconciliation";

interface SuspenseAccountListingProps {
  suspenseEntries?: SuspenseEntry[];
  shortageEntries?: ShortageEntry[];
  totalSuspense?: number;
  totalShortage?: number;
  statistics?: BranchReconciliationStatistics; // ✅ Changed from ReconciliationStatistics
  currentUser?: CurrentUser;
}

export default function SuspenseAccountListing({
  suspenseEntries = [],
  shortageEntries = [],
  totalSuspense = 0,
  totalShortage = 0,
  statistics,
  currentUser,
}: SuspenseAccountListingProps) {
  const [activeTab, setActiveTab] = useState<"overages" | "shortages">(
    "overages"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "week" | "month"
  >("all");

  // Provide safe default values for statistics
  const stats: BranchReconciliationStatistics = {
    branchId: statistics?.branchId ?? "",
    branchName: statistics?.branchName ?? "",
    totalReconciliations: statistics?.totalReconciliations ?? 0,
    pending: statistics?.pending ?? 0,
    approved: statistics?.approved ?? 0,
    rejected: statistics?.rejected ?? 0,
    today: statistics?.today ?? 0,
    totalSuspense: statistics?.totalSuspense ?? totalSuspense,
    totalReturned: statistics?.totalReturned ?? 0,
    totalShortage: statistics?.totalShortage ?? totalShortage,
    totalOverages: statistics?.totalOverages ?? suspenseEntries.length,
    totalShortages: statistics?.totalShortages ?? shortageEntries.length,
    unresolvedOverages: statistics?.unresolvedOverages ?? 0,
    unresolvedShortages: statistics?.unresolvedShortages ?? 0,
    resolvedCount: statistics?.resolvedCount ?? 0,
    pendingCount: statistics?.pendingCount ?? 0,
  };

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

  // Filter entries based on search and date
  const filterEntries = <T extends SuspenseEntry | ShortageEntry>(
    entries: T[]
  ): T[] => {
    let filtered = entries;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((entry) => {
        const userName = entry.float.user.name?.toLowerCase() ?? "";
        const userEmail = entry.float.user.email.toLowerCase();
        const search = searchTerm.toLowerCase();
        return userName.includes(search) || userEmail.includes(search);
      });
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((entry) => {
        const entryDate = new Date(entry.reconciliationDate);

        if (dateFilter === "today") {
          return entryDate >= today;
        } else if (dateFilter === "week") {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return entryDate >= weekAgo;
        } else if (dateFilter === "month") {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return entryDate >= monthAgo;
        }
        return true;
      });
    }

    return filtered;
  };

  const filteredSuspenseEntries = filterEntries(suspenseEntries);
  const filteredShortageEntries = filterEntries(shortageEntries);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Suspense Account Management
          </h1>
          <p className="text-gray-500 mt-1">
            Track overages and shortages from reconciliations
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Suspense (Overages) */}
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
              {stats.totalOverages} Entries
            </span>
          </div>
          <h3 className="text-sm font-medium text-orange-900">
            Total Overages
          </h3>
          <p className="text-2xl font-bold text-orange-700 mt-1">
            {formatCurrency(totalSuspense)}
          </p>
          {stats.unresolvedOverages > 0 && (
            <p className="text-xs text-orange-600 mt-2">
              {stats.unresolvedOverages} unresolved
            </p>
          )}
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
              {stats.totalShortages} Entries
            </span>
          </div>
          <h3 className="text-sm font-medium text-red-900">Total Shortages</h3>
          <p className="text-2xl font-bold text-red-700 mt-1">
            {formatCurrency(totalShortage)}
          </p>
          {stats.unresolvedShortages > 0 && (
            <p className="text-xs text-red-600 mt-2">
              {stats.unresolvedShortages} unresolved
            </p>
          )}
        </div>

        {/* Net Position */}
        <div
          className={`bg-gradient-to-br ${
            totalSuspense - totalShortage >= 0
              ? "from-green-50 to-green-100 border-green-200"
              : "from-red-50 to-red-100 border-red-200"
          } border-2 rounded-xl p-6`}
        >
          <div className="flex items-center justify-between mb-2">
            <div
              className={`${
                totalSuspense - totalShortage >= 0
                  ? "bg-green-500"
                  : "bg-red-500"
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
                totalSuspense - totalShortage >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {totalSuspense - totalShortage >= 0 ? "Surplus" : "Deficit"}
            </span>
          </div>
          <h3
            className={`text-sm font-medium ${
              totalSuspense - totalShortage >= 0
                ? "text-green-900"
                : "text-red-900"
            }`}
          >
            Net Position
          </h3>
          <p
            className={`text-2xl font-bold mt-1 ${
              totalSuspense - totalShortage >= 0
                ? "text-green-700"
                : "text-red-700"
            }`}
          >
            {formatCurrency(Math.abs(totalSuspense - totalShortage))}
          </p>
        </div>

        {/* Total Reconciliations */}
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-blue-600">All Time</span>
          </div>
          <h3 className="text-sm font-medium text-blue-900">
            Total Reconciliations
          </h3>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            {stats.totalReconciliations}
          </p>
          <p className="text-xs text-blue-600 mt-2">
            {stats.approved} approved, {stats.pending} pending
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by Teller/Agent
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or email..."
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

          {/* Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab("overages")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "overages"
                  ? "bg-orange-50 text-orange-700 border-b-2 border-orange-500"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5"
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
                Overages ({filteredSuspenseEntries.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab("shortages")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "shortages"
                  ? "bg-red-50 text-red-700 border-b-2 border-red-500"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5"
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
                Shortages ({filteredShortageEntries.length})
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "overages" ? (
            <div className="space-y-4">
              {filteredSuspenseEntries.length === 0 ? (
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-gray-500 text-lg">
                    No overage entries found
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    Try adjusting your filters
                  </p>
                </div>
              ) : (
                filteredSuspenseEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
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
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">
                            {entry.float.user.name || "Unknown User"}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {entry.float.user.email}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {entry.float.user.branch?.name || "No Branch"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-orange-700">
                          +{formatCurrency(entry.difference)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Overage Amount
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-orange-200">
                      <div>
                        <p className="text-xs text-gray-600">System Balance</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(entry.systemBalance)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Physical Cash</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(entry.actualCash)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Reconciled On</p>
                        <p className="font-semibold text-gray-900">
                          {formatDate(entry.reconciliationDate)}
                        </p>
                      </div>
                    </div>

                    {entry.notes && (
                      <div className="mt-4 pt-4 border-t border-orange-200">
                        <p className="text-xs text-gray-600 mb-1">Notes:</p>
                        <p className="text-sm text-gray-700">{entry.notes}</p>
                      </div>
                    )}

                    {entry.approvedBy && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                        <svg
                          className="w-4 h-4 text-green-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Approved by {entry.approvedBy.name || "Unknown"}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredShortageEntries.length === 0 ? (
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-gray-500 text-lg">
                    No shortage entries found
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    Try adjusting your filters
                  </p>
                </div>
              ) : (
                filteredShortageEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-red-50 border-2 border-red-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
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
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">
                            {entry.float.user.name || "Unknown User"}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {entry.float.user.email}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {entry.float.user.branch?.name || "No Branch"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-700">
                          -{formatCurrency(Math.abs(entry.difference))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Shortage Amount
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-red-200">
                      <div>
                        <p className="text-xs text-gray-600">System Balance</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(entry.systemBalance)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Physical Cash</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(entry.actualCash)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Reconciled On</p>
                        <p className="font-semibold text-gray-900">
                          {formatDate(entry.reconciliationDate)}
                        </p>
                      </div>
                    </div>

                    {entry.notes && (
                      <div className="mt-4 pt-4 border-t border-red-200">
                        <p className="text-xs text-gray-600 mb-1">Notes:</p>
                        <p className="text-sm text-gray-700">{entry.notes}</p>
                      </div>
                    )}

                    {entry.approvedBy && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                        <svg
                          className="w-4 h-4 text-green-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Approved by {entry.approvedBy.name || "Unknown"}
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
                        Investigate
                      </button>
                      <button className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                        Mark Resolved
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
