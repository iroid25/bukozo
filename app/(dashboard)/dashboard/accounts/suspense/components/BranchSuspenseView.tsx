// "use client";

// import { useState } from "react";
// import { format } from "date-fns";
// import type {
//   BranchSuspenseSummary,
//   BranchReconciliationStatistics,
//   CurrentUser,
//   SuspenseEntry,
//   ShortageEntry,
// } from "@/types/reconciliation";

// interface BranchSuspenseViewProps {
//   branchSummary: BranchSuspenseSummary;
//   statistics: BranchReconciliationStatistics;
//   currentUser: CurrentUser & {
//     branch?: { id: string; name: string; location: string | null } | null;
//   };
// }

// export default function BranchSuspenseView({
//   branchSummary,
//   statistics,
//   currentUser,
// }: BranchSuspenseViewProps) {
//   const [activeTab, setActiveTab] = useState<"overages" | "shortages">(
//     "overages"
//   );
//   const [searchTerm, setSearchTerm] = useState("");
//   const [dateFilter, setDateFilter] = useState<
//     "all" | "today" | "week" | "month"
//   >("all");

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   const formatDate = (date: Date) => {
//     return format(new Date(date), "MMM dd, yyyy hh:mm a");
//   };

//   // Filter entries based on search and date
//   const filterEntries = <T extends SuspenseEntry | ShortageEntry>(
//     entries: T[]
//   ): T[] => {
//     let filtered = entries;

//     // Search filter
//     if (searchTerm) {
//       filtered = filtered.filter(
//         (entry) =>
//           entry.float.user.name
//             .toLowerCase()
//             .includes(searchTerm.toLowerCase()) ||
//           entry.float.user.email
//             .toLowerCase()
//             .includes(searchTerm.toLowerCase())
//       );
//     }

//     // Date filter
//     if (dateFilter !== "all") {
//       const now = new Date();
//       const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

//       filtered = filtered.filter((entry) => {
//         const entryDate = new Date(entry.reconciliationDate);

//         if (dateFilter === "today") {
//           return entryDate >= today;
//         } else if (dateFilter === "week") {
//           const weekAgo = new Date(today);
//           weekAgo.setDate(weekAgo.getDate() - 7);
//           return entryDate >= weekAgo;
//         } else if (dateFilter === "month") {
//           const monthAgo = new Date(today);
//           monthAgo.setMonth(monthAgo.getMonth() - 1);
//           return entryDate >= monthAgo;
//         }
//         return true;
//       });
//     }

//     return filtered;
//   };

//   const filteredOverageEntries = filterEntries(branchSummary.overageEntries);
//   const filteredShortageEntries = filterEntries(branchSummary.shortageEntries);

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="text-3xl font-bold text-gray-900">
//             {branchSummary.branchName} - Suspense Account
//           </h1>
//           <p className="text-gray-500 mt-1">
//             {branchSummary.branchLocation || "No location"} • Track overages and
//             shortages
//           </p>
//         </div>
//         <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
//           <p className="text-sm text-blue-600 font-medium">
//             {currentUser.name}
//           </p>
//           <p className="text-xs text-blue-500">Role: {currentUser.role}</p>
//         </div>
//       </div>

//       {/* Branch Statistics Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
//         {/* Total Overages */}
//         <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-xl p-6">
//           <div className="flex items-center justify-between mb-2">
//             <div className="bg-orange-500 rounded-full p-3">
//               <svg
//                 className="w-6 h-6 text-white"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M12 6v6m0 0v6m0-6h6m-6 0H6"
//                 />
//               </svg>
//             </div>
//             <span className="text-sm font-medium text-orange-600">
//               {branchSummary.overageCount} Entries
//             </span>
//           </div>
//           <h3 className="text-sm font-medium text-orange-900">
//             Total Overages
//           </h3>
//           <p className="text-2xl font-bold text-orange-700 mt-1">
//             {formatCurrency(branchSummary.totalOverages)}
//           </p>
//           {branchSummary.unresolvedOverages > 0 && (
//             <p className="text-xs text-orange-600 mt-2">
//               {branchSummary.unresolvedOverages} unresolved
//             </p>
//           )}
//         </div>

//         {/* Total Shortages */}
//         <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-6">
//           <div className="flex items-center justify-between mb-2">
//             <div className="bg-red-500 rounded-full p-3">
//               <svg
//                 className="w-6 h-6 text-white"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M20 12H4"
//                 />
//               </svg>
//             </div>
//             <span className="text-sm font-medium text-red-600">
//               {branchSummary.shortageCount} Entries
//             </span>
//           </div>
//           <h3 className="text-sm font-medium text-red-900">Total Shortages</h3>
//           <p className="text-2xl font-bold text-red-700 mt-1">
//             {formatCurrency(branchSummary.totalShortages)}
//           </p>
//           {branchSummary.unresolvedShortages > 0 && (
//             <p className="text-xs text-red-600 mt-2">
//               {branchSummary.unresolvedShortages} unresolved
//             </p>
//           )}
//         </div>

//         {/* Net Position */}
//         <div
//           className={`bg-gradient-to-br ${
//             branchSummary.netPosition >= 0
//               ? "from-green-50 to-green-100 border-green-200"
//               : "from-red-50 to-red-100 border-red-200"
//           } border-2 rounded-xl p-6`}
//         >
//           <div className="flex items-center justify-between mb-2">
//             <div
//               className={`${
//                 branchSummary.netPosition >= 0 ? "bg-green-500" : "bg-red-500"
//               } rounded-full p-3`}
//             >
//               <svg
//                 className="w-6 h-6 text-white"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
//                 />
//               </svg>
//             </div>
//             <span
//               className={`text-sm font-medium ${
//                 branchSummary.netPosition >= 0
//                   ? "text-green-600"
//                   : "text-red-600"
//               }`}
//             >
//               {branchSummary.netPosition >= 0 ? "Surplus" : "Deficit"}
//             </span>
//           </div>
//           <h3
//             className={`text-sm font-medium ${
//               branchSummary.netPosition >= 0 ? "text-green-900" : "text-red-900"
//             }`}
//           >
//             Net Position
//           </h3>
//           <p
//             className={`text-2xl font-bold mt-1 ${
//               branchSummary.netPosition >= 0 ? "text-green-700" : "text-red-700"
//             }`}
//           >
//             {formatCurrency(Math.abs(branchSummary.netPosition))}
//           </p>
//         </div>

//         {/* Total Reconciliations */}
//         <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6">
//           <div className="flex items-center justify-between mb-2">
//             <div className="bg-blue-500 rounded-full p-3">
//               <svg
//                 className="w-6 h-6 text-white"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
//                 />
//               </svg>
//             </div>
//             <span className="text-sm font-medium text-blue-600">
//               Branch Total
//             </span>
//           </div>
//           <h3 className="text-sm font-medium text-blue-900">
//             Total Reconciliations
//           </h3>
//           <p className="text-2xl font-bold text-blue-700 mt-1">
//             {statistics.totalReconciliations}
//           </p>
//           <p className="text-xs text-blue-600 mt-2">
//             {statistics.approved} approved, {statistics.pending} pending
//           </p>
//         </div>
//       </div>

//       {/* Filters */}
//       <div className="bg-white rounded-xl border border-gray-200 p-6">
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           {/* Search */}
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-2">
//               Search by Teller/Agent
//             </label>
//             <div className="relative">
//               <input
//                 type="text"
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//                 placeholder="Search by name or email..."
//                 className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               />
//               <svg
//                 className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
//                 />
//               </svg>
//             </div>
//           </div>

//           {/* Date Filter */}
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-2">
//               Date Range
//             </label>
//             <select
//               value={dateFilter}
//               onChange={(e) => setDateFilter(e.target.value as any)}
//               className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             >
//               <option value="all">All Time</option>
//               <option value="today">Today</option>
//               <option value="week">Last 7 Days</option>
//               <option value="month">Last 30 Days</option>
//             </select>
//           </div>
//         </div>
//       </div>

//       {/* Tabs */}
//       <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
//         <div className="border-b border-gray-200">
//           <div className="flex">
//             <button
//               onClick={() => setActiveTab("overages")}
//               className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
//                 activeTab === "overages"
//                   ? "bg-orange-50 text-orange-700 border-b-2 border-orange-500"
//                   : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
//               }`}
//             >
//               <div className="flex items-center justify-center gap-2">
//                 <svg
//                   className="w-5 h-5"
//                   fill="none"
//                   stroke="currentColor"
//                   viewBox="0 0 24 24"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth={2}
//                     d="M12 6v6m0 0v6m0-6h6m-6 0H6"
//                   />
//                 </svg>
//                 Overages ({filteredOverageEntries.length})
//               </div>
//             </button>
//             <button
//               onClick={() => setActiveTab("shortages")}
//               className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
//                 activeTab === "shortages"
//                   ? "bg-red-50 text-red-700 border-b-2 border-red-500"
//                   : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
//               }`}
//             >
//               <div className="flex items-center justify-center gap-2">
//                 <svg
//                   className="w-5 h-5"
//                   fill="none"
//                   stroke="currentColor"
//                   viewBox="0 0 24 24"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth={2}
//                     d="M20 12H4"
//                   />
//                 </svg>
//                 Shortages ({filteredShortageEntries.length})
//               </div>
//             </button>
//           </div>
//         </div>

//         {/* Tab Content */}
//         <div className="p-6">
//           {activeTab === "overages" ? (
//             <div className="space-y-4">
//               {filteredOverageEntries.length === 0 ? (
//                 <div className="text-center py-12">
//                   <svg
//                     className="w-16 h-16 text-gray-300 mx-auto mb-4"
//                     fill="none"
//                     stroke="currentColor"
//                     viewBox="0 0 24 24"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth={2}
//                       d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
//                     />
//                   </svg>
//                   <p className="text-gray-500 text-lg">
//                     No overage entries found
//                   </p>
//                   <p className="text-gray-400 text-sm mt-1">
//                     Try adjusting your filters
//                   </p>
//                 </div>
//               ) : (
//                 filteredOverageEntries.map((entry) => (
//                   <div
//                     key={entry.id}
//                     className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6 hover:shadow-md transition-shadow"
//                   >
//                     <div className="flex items-start justify-between mb-4">
//                       <div className="flex items-center gap-4">
//                         <div className="bg-orange-500 rounded-full p-3">
//                           <svg
//                             className="w-6 h-6 text-white"
//                             fill="none"
//                             stroke="currentColor"
//                             viewBox="0 0 24 24"
//                           >
//                             <path
//                               strokeLinecap="round"
//                               strokeLinejoin="round"
//                               strokeWidth={2}
//                               d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
//                             />
//                           </svg>
//                         </div>
//                         <div>
//                           <h3 className="font-bold text-gray-900">
//                             {entry.float.user.name}
//                           </h3>
//                           <p className="text-sm text-gray-600">
//                             {entry.float.user.email}
//                           </p>
//                           <p className="text-xs text-gray-500 mt-1">
//                             {entry.float.user.role}
//                           </p>
//                         </div>
//                       </div>
//                       <div className="text-right">
//                         <div className="text-2xl font-bold text-orange-700">
//                           +{formatCurrency(entry.difference)}
//                         </div>
//                         <p className="text-xs text-gray-500 mt-1">
//                           Overage Amount
//                         </p>
//                       </div>
//                     </div>

//                     <div className="grid grid-cols-3 gap-4 pt-4 border-t border-orange-200">
//                       <div>
//                         <p className="text-xs text-gray-600">System Balance</p>
//                         <p className="font-semibold text-gray-900">
//                           {formatCurrency(entry.systemBalance)}
//                         </p>
//                       </div>
//                       <div>
//                         <p className="text-xs text-gray-600">Physical Cash</p>
//                         <p className="font-semibold text-gray-900">
//                           {formatCurrency(entry.actualCash)}
//                         </p>
//                       </div>
//                       <div>
//                         <p className="text-xs text-gray-600">Reconciled On</p>
//                         <p className="font-semibold text-gray-900">
//                           {formatDate(entry.reconciliationDate)}
//                         </p>
//                       </div>
//                     </div>

//                     {entry.notes && (
//                       <div className="mt-4 pt-4 border-t border-orange-200">
//                         <p className="text-xs text-gray-600 mb-1">Notes:</p>
//                         <p className="text-sm text-gray-700">{entry.notes}</p>
//                       </div>
//                     )}

//                     {entry.approvedBy && (
//                       <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
//                         <svg
//                           className="w-4 h-4 text-green-600"
//                           fill="currentColor"
//                           viewBox="0 0 20 20"
//                         >
//                           <path
//                             fillRule="evenodd"
//                             d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
//                             clipRule="evenodd"
//                           />
//                         </svg>
//                         Approved by {entry.approvedBy.name}
//                       </div>
//                     )}
//                   </div>
//                 ))
//               )}
//             </div>
//           ) : (
//             <div className="space-y-4">
//               {filteredShortageEntries.length === 0 ? (
//                 <div className="text-center py-12">
//                   <svg
//                     className="w-16 h-16 text-gray-300 mx-auto mb-4"
//                     fill="none"
//                     stroke="currentColor"
//                     viewBox="0 0 24 24"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth={2}
//                       d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
//                     />
//                   </svg>
//                   <p className="text-gray-500 text-lg">
//                     No shortage entries found
//                   </p>
//                   <p className="text-gray-400 text-sm mt-1">
//                     Try adjusting your filters
//                   </p>
//                 </div>
//               ) : (
//                 filteredShortageEntries.map((entry) => (
//                   <div
//                     key={entry.id}
//                     className="bg-red-50 border-2 border-red-200 rounded-lg p-6 hover:shadow-md transition-shadow"
//                   >
//                     <div className="flex items-start justify-between mb-4">
//                       <div className="flex items-center gap-4">
//                         <div className="bg-red-500 rounded-full p-3">
//                           <svg
//                             className="w-6 h-6 text-white"
//                             fill="none"
//                             stroke="currentColor"
//                             viewBox="0 0 24 24"
//                           >
//                             <path
//                               strokeLinecap="round"
//                               strokeLinejoin="round"
//                               strokeWidth={2}
//                               d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
//                             />
//                           </svg>
//                         </div>
//                         <div>
//                           <h3 className="font-bold text-gray-900">
//                             {entry.float.user.name}
//                           </h3>
//                           <p className="text-sm text-gray-600">
//                             {entry.float.user.email}
//                           </p>
//                           <p className="text-xs text-gray-500 mt-1">
//                             {entry.float.user.role}
//                           </p>
//                         </div>
//                       </div>
//                       <div className="text-right">
//                         <div className="text-2xl font-bold text-red-700">
//                           -{formatCurrency(Math.abs(entry.difference))}
//                         </div>
//                         <p className="text-xs text-gray-500 mt-1">
//                           Shortage Amount
//                         </p>
//                       </div>
//                     </div>

//                     <div className="grid grid-cols-3 gap-4 pt-4 border-t border-red-200">
//                       <div>
//                         <p className="text-xs text-gray-600">System Balance</p>
//                         <p className="font-semibold text-gray-900">
//                           {formatCurrency(entry.systemBalance)}
//                         </p>
//                       </div>
//                       <div>
//                         <p className="text-xs text-gray-600">Physical Cash</p>
//                         <p className="font-semibold text-gray-900">
//                           {formatCurrency(entry.actualCash)}
//                         </p>
//                       </div>
//                       <div>
//                         <p className="text-xs text-gray-600">Reconciled On</p>
//                         <p className="font-semibold text-gray-900">
//                           {formatDate(entry.reconciliationDate)}
//                         </p>
//                       </div>
//                     </div>

//                     {entry.notes && (
//                       <div className="mt-4 pt-4 border-t border-red-200">
//                         <p className="text-xs text-gray-600 mb-1">Notes:</p>
//                         <p className="text-sm text-gray-700">{entry.notes}</p>
//                       </div>
//                     )}

//                     {entry.approvedBy && (
//                       <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
//                         <svg
//                           className="w-4 h-4 text-green-600"
//                           fill="currentColor"
//                           viewBox="0 0 20 20"
//                         >
//                           <path
//                             fillRule="evenodd"
//                             d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
//                             clipRule="evenodd"
//                           />
//                         </svg>
//                         Approved by {entry.approvedBy.name}
//                       </div>
//                     )}
//                   </div>
//                 ))
//               )}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }
// app/(dashboard)/dashboard/accounts/suspense/components/BranchSuspenseView.tsx

import { BranchSuspenseViewProps } from "@/types/reconciliation";

export default function BranchSuspenseView({
  branchSummary,
  statistics,
  currentUser,
}: BranchSuspenseViewProps) {
  return (
    <div className="space-y-6">
      {/* Branch Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-900">
          {currentUser.branch?.name || "Branch"} - Suspense Account
        </h1>
        <p className="text-gray-600 mt-1">
          {currentUser.branch?.location || "Location not specified"}
        </p>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">
            Total Reconciliations
          </h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {statistics.totalReconciliations}
          </p>
        </div>

        <div className="bg-yellow-50 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-yellow-700">Pending</h3>
          <p className="text-3xl font-bold text-yellow-900 mt-2">
            {statistics.pending}
          </p>
        </div>

        <div className="bg-green-50 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-green-700">Approved</h3>
          <p className="text-3xl font-bold text-green-900 mt-2">
            {statistics.approved}
          </p>
        </div>

        <div className="bg-red-50 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-red-700">Rejected</h3>
          <p className="text-3xl font-bold text-red-900 mt-2">
            {statistics.rejected}
          </p>
        </div>
      </div>

      {/* Suspense Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-blue-700">Total Overages</h3>
          <p className="text-3xl font-bold text-blue-900 mt-2">
            UGX {statistics.totalSuspense.toLocaleString()}
          </p>
          <p className="text-sm text-blue-600 mt-1">
            {statistics.totalOverages} transactions
          </p>
          <p className="text-xs text-blue-500 mt-1">
            {statistics.unresolvedOverages} unresolved
          </p>
        </div>

        <div className="bg-red-50 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-red-700">Total Shortages</h3>
          <p className="text-3xl font-bold text-red-900 mt-2">
            UGX {statistics.totalShortage.toLocaleString()}
          </p>
          <p className="text-sm text-red-600 mt-1">
            {statistics.totalShortages} transactions
          </p>
          <p className="text-xs text-red-500 mt-1">
            {statistics.unresolvedShortages} unresolved
          </p>
        </div>

        <div className="bg-purple-50 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-purple-700">
            Float Returned
          </h3>
          <p className="text-3xl font-bold text-purple-900 mt-2">
            UGX {statistics.totalReturned.toLocaleString()}
          </p>
          <p className="text-sm text-purple-600 mt-1">
            Total returned to vault
          </p>
        </div>
      </div>

      {/* Today's Activity */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Today's Reconciliations
        </h3>
        <p className="text-2xl font-bold text-blue-600">{statistics.today}</p>
      </div>

      {/* Overages Section */}
      {branchSummary.overageEntries.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Overages ({branchSummary.overageCount})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Teller
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {branchSummary.overageEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(entry.reconciliationDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.float.user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      +UGX {entry.difference.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          entry.status === "APPROVED"
                            ? "bg-green-100 text-green-800"
                            : entry.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shortages Section */}
      {branchSummary.shortageEntries.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Shortages ({branchSummary.shortageCount})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Teller
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {branchSummary.shortageEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(entry.reconciliationDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.float.user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      -UGX {Math.abs(entry.difference).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          entry.status === "APPROVED"
                            ? "bg-green-100 text-green-800"
                            : entry.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {branchSummary.overageEntries.length === 0 &&
        branchSummary.shortageEntries.length === 0 && (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <p className="text-gray-500 text-lg">
              No overages or shortages recorded for this branch.
            </p>
          </div>
        )}
    </div>
  );
}
