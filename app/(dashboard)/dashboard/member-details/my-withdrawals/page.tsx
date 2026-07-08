// // // app/(dashboard)/dashboard/my-withdrawals/page.tsx
// // import { Suspense } from "react";
// // import { TableLoading } from "@/components/ui/data-table";
// // import { getAuthUser } from "@/config/useAuth";
// // import { redirect } from "next/navigation";
// // import { db } from "@/prisma/db";

// // import MemberWithdrawalListing from "./components/MemberWithdrawalListing";
// // import { getWithdrawalsByMemberId } from "@/actions/withdraws";
// // import { getMemberWithdrawalStatistics } from "@/actions/withdrawsTest";
// // import type { Withdrawal } from "@/types/withdraw";

// // // Create an async component for data fetching
// // async function MemberWithdrawalListingWithData() {
// //   const user = await getAuthUser();

// //   if (!user) {
// //     redirect("/login");
// //   }

// //   // Get the member record for the current user
// //   const member = await db.member.findFirst({
// //     where: { userId: user.id },
// //   });

// //   if (!member) {
// //     redirect("/dashboard"); // Redirect if user is not a member
// //   }

// //   const [withdrawals, statistics] = await Promise.all([
// //     getWithdrawalsByMemberId(member.id),
// //     getMemberWithdrawalStatistics(member.id),
// //   ]);

// //   return (
// //     <MemberWithdrawalListing
// //       title={`My Withdrawals (${withdrawals.length})`}
// //       subtitle="View your withdrawal history and transaction details"
// //       withdrawals={withdrawals as any[]} // Type assertion
// //       statistics={statistics}
// //       currentUserId={user.id}
// //       memberId={member.id}
// //     />
// //   );
// // }

// // export default function MyWithdrawalsPage() {
// //   return (
// //     <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
// //       <Suspense fallback={<TableLoading />}>
// //         <MemberWithdrawalListingWithData />
// //       </Suspense>
// //     </div>
// //   );
// // }
// "use client";

// import { useState, useEffect } from "react";
// import { useSession } from "next-auth/react";
// import { format } from "date-fns";
// import {
//   ArrowDownLeft,
//   Calendar,
//   CreditCard,
//   Filter,
//   Download,
//   Search,
//   ChevronLeft,
//   ChevronRight,
// } from "lucide-react";

// interface Withdrawal {
//   id: string;
//   transactionRef: string;
//   type: string;
//   amount: number;
//   description: string;
//   transactionDate: string;
//   account: {
//     accountNumber: string;
//     accountType: {
//       name: string;
//     };
//   };
//   status: string;
//   channel: string;
//   mobileMoneyRef: string | null;
//   processedBy: string | null;
// }

// interface Summary {
//   totalWithdrawals: number;
//   withdrawalCount: number;
//   averageWithdrawal: number;
// }

// interface Pagination {
//   total: number;
//   limit: number;
//   offset: number;
//   hasMore: boolean;
// }

// export default function MyWithdrawalsPage() {
//   const { data: session } = useSession();
//   const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
//   const [summary, setSummary] = useState<Summary>({
//     totalWithdrawals: 0,
//     withdrawalCount: 0,
//     averageWithdrawal: 0,
//   });
//   const [pagination, setPagination] = useState<Pagination>({
//     total: 0,
//     limit: 50,
//     offset: 0,
//     hasMore: false,
//   });
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   // Filters
//   const [accountId, setAccountId] = useState<string>("");
//   const [startDate, setStartDate] = useState<string>("");
//   const [endDate, setEndDate] = useState<string>("");
//   const [searchTerm, setSearchTerm] = useState<string>("");
//   const [showFilters, setShowFilters] = useState(false);

//   const fetchWithdrawals = async () => {
//     try {
//       setLoading(true);
//       const params = new URLSearchParams({
//         limit: pagination.limit.toString(),
//         offset: pagination.offset.toString(),
//       });

//       if (accountId) params.append("accountId", accountId);
//       if (startDate) params.append("startDate", startDate);
//       if (endDate) params.append("endDate", endDate);

//       const response = await fetch(
//         `/api/v1/transactions/withdrawals/my-withdrawals?${params}`
//       );
//       const result = await response.json();

//       if (result.success) {
//         setWithdrawals(result.data.withdrawals);
//         setSummary(result.data.summary);
//         setPagination(result.data.pagination);
//       } else {
//         setError(result.error || "Failed to fetch withdrawals");
//       }
//     } catch (err) {
//       setError("An error occurred while fetching withdrawals");
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (session?.user) {
//       fetchWithdrawals();
//     }
//   }, [session, pagination.offset, accountId, startDate, endDate]);

//   const handlePreviousPage = () => {
//     if (pagination.offset > 0) {
//       setPagination((prev) => ({
//         ...prev,
//         offset: Math.max(0, prev.offset - prev.limit),
//       }));
//     }
//   };

//   const handleNextPage = () => {
//     if (pagination.hasMore) {
//       setPagination((prev) => ({
//         ...prev,
//         offset: prev.offset + prev.limit,
//       }));
//     }
//   };

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case "COMPLETED":
//         return "bg-green-100 text-green-800";
//       case "PENDING":
//         return "bg-yellow-100 text-yellow-800";
//       case "FAILED":
//         return "bg-red-100 text-red-800";
//       default:
//         return "bg-gray-100 text-gray-800";
//     }
//   };

//   const getChannelIcon = (channel: string) => {
//     switch (channel) {
//       case "CASH":
//         return "💵";
//       case "MOBILE_MONEY":
//         return "📱";
//       case "BANK_TRANSFER":
//         return "🏦";
//       default:
//         return "💳";
//     }
//   };

//   const filteredWithdrawals = withdrawals.filter((withdrawal) => {
//     if (!searchTerm) return true;
//     const searchLower = searchTerm.toLowerCase();
//     return (
//       withdrawal.transactionRef.toLowerCase().includes(searchLower) ||
//       withdrawal.description.toLowerCase().includes(searchLower) ||
//       withdrawal.account.accountNumber.toLowerCase().includes(searchLower)
//     );
//   });

//   if (loading && withdrawals.length === 0) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
//       </div>
//     );
//   }

//   return (
//     <div className="container mx-auto px-4 py-8">
//       {/* Header */}
//       <div className="mb-8">
//         <h1 className="text-3xl font-bold text-gray-900 mb-2">
//           My Withdrawals
//         </h1>
//         <p className="text-gray-600">
//           View and manage your withdrawal transaction history
//         </p>
//       </div>

//       {/* Summary Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
//         <div className="bg-white rounded-lg shadow-md p-6">
//           <div className="flex items-center justify-between">
//             <div>
//               <p className="text-sm text-gray-600 mb-1">Total Withdrawals</p>
//               <p className="text-2xl font-bold text-gray-900">
//                 {formatCurrency(summary.totalWithdrawals)}
//               </p>
//             </div>
//             <div className="bg-red-100 p-3 rounded-full">
//               <ArrowDownLeft className="w-6 h-6 text-red-600" />
//             </div>
//           </div>
//         </div>

//         <div className="bg-white rounded-lg shadow-md p-6">
//           <div className="flex items-center justify-between">
//             <div>
//               <p className="text-sm text-gray-600 mb-1">
//                 Number of Withdrawals
//               </p>
//               <p className="text-2xl font-bold text-gray-900">
//                 {summary.withdrawalCount}
//               </p>
//             </div>
//             <div className="bg-purple-100 p-3 rounded-full">
//               <CreditCard className="w-6 h-6 text-purple-600" />
//             </div>
//           </div>
//         </div>

//         <div className="bg-white rounded-lg shadow-md p-6">
//           <div className="flex items-center justify-between">
//             <div>
//               <p className="text-sm text-gray-600 mb-1">Average Withdrawal</p>
//               <p className="text-2xl font-bold text-gray-900">
//                 {formatCurrency(summary.averageWithdrawal)}
//               </p>
//             </div>
//             <div className="bg-blue-100 p-3 rounded-full">
//               <Calendar className="w-6 h-6 text-blue-600" />
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Filters and Search */}
//       <div className="bg-white rounded-lg shadow-md p-6 mb-6">
//         <div className="flex flex-col md:flex-row gap-4 items-end">
//           <div className="flex-1">
//             <label className="block text-sm font-medium text-gray-700 mb-2">
//               Search
//             </label>
//             <div className="relative">
//               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
//               <input
//                 type="text"
//                 placeholder="Search by reference, description, or account..."
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//                 className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               />
//             </div>
//           </div>

//           <button
//             onClick={() => setShowFilters(!showFilters)}
//             className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
//           >
//             <Filter className="w-5 h-5" />
//             {showFilters ? "Hide Filters" : "Show Filters"}
//           </button>
//         </div>

//         {showFilters && (
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-2">
//                 Start Date
//               </label>
//               <input
//                 type="date"
//                 value={startDate}
//                 onChange={(e) => setStartDate(e.target.value)}
//                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               />
//             </div>

//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-2">
//                 End Date
//               </label>
//               <input
//                 type="date"
//                 value={endDate}
//                 onChange={(e) => setEndDate(e.target.value)}
//                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               />
//             </div>

//             <div className="flex items-end">
//               <button
//                 onClick={() => {
//                   setStartDate("");
//                   setEndDate("");
//                   setAccountId("");
//                 }}
//                 className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
//               >
//                 Clear Filters
//               </button>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Error Message */}
//       {error && (
//         <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
//           {error}
//         </div>
//       )}

//       {/* Withdrawals Table */}
//       <div className="bg-white rounded-lg shadow-md overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="w-full">
//             <thead className="bg-gray-50 border-b border-gray-200">
//               <tr>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Date
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Reference
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Account
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Description
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Channel
//                 </th>
//                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Amount
//                 </th>
//                 <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Status
//                 </th>
//               </tr>
//             </thead>
//             <tbody className="bg-white divide-y divide-gray-200">
//               {filteredWithdrawals.length === 0 ? (
//                 <tr>
//                   <td colSpan={7} className="px-6 py-12 text-center">
//                     <ArrowDownLeft className="w-12 h-12 text-gray-400 mx-auto mb-4" />
//                     <p className="text-gray-500 text-lg">
//                       No withdrawals found
//                     </p>
//                     <p className="text-gray-400 text-sm mt-2">
//                       {searchTerm || startDate || endDate
//                         ? "Try adjusting your filters"
//                         : "Your withdrawal history will appear here"}
//                     </p>
//                   </td>
//                 </tr>
//               ) : (
//                 filteredWithdrawals.map((withdrawal) => (
//                   <tr
//                     key={withdrawal.id}
//                     className="hover:bg-gray-50 transition-colors"
//                   >
//                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                       {format(
//                         new Date(withdrawal.transactionDate),
//                         "MMM dd, yyyy"
//                       )}
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
//                       {withdrawal.transactionRef}
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                       <div>
//                         <div className="font-medium">
//                           {withdrawal.account.accountNumber}
//                         </div>
//                         <div className="text-gray-500 text-xs">
//                           {withdrawal.account.accountType.name}
//                         </div>
//                       </div>
//                     </td>
//                     <td className="px-6 py-4 text-sm text-gray-900">
//                       <div className="max-w-xs truncate">
//                         {withdrawal.description}
//                       </div>
//                       {withdrawal.mobileMoneyRef && (
//                         <div className="text-xs text-gray-500 mt-1">
//                           Ref: {withdrawal.mobileMoneyRef}
//                         </div>
//                       )}
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                       <span className="flex items-center gap-2">
//                         <span>{getChannelIcon(withdrawal.channel)}</span>
//                         <span className="capitalize">
//                           {withdrawal.channel?.replace("_", " ").toLowerCase()}
//                         </span>
//                       </span>
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-red-600">
//                       -{formatCurrency(withdrawal.amount)}
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-center">
//                       <span
//                         className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
//                           withdrawal.status
//                         )}`}
//                       >
//                         {withdrawal.status}
//                       </span>
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>

//         {/* Pagination */}
//         {filteredWithdrawals.length > 0 && (
//           <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
//             <div className="text-sm text-gray-700">
//               Showing{" "}
//               <span className="font-medium">{pagination.offset + 1}</span> to{" "}
//               <span className="font-medium">
//                 {Math.min(
//                   pagination.offset + pagination.limit,
//                   pagination.total
//                 )}
//               </span>{" "}
//               of <span className="font-medium">{pagination.total}</span> results
//             </div>
//             <div className="flex gap-2">
//               <button
//                 onClick={handlePreviousPage}
//                 disabled={pagination.offset === 0}
//                 className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
//               >
//                 <ChevronLeft className="w-4 h-4" />
//                 Previous
//               </button>
//               <button
//                 onClick={handleNextPage}
//                 disabled={!pagination.hasMore}
//                 className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
//               >
//                 Next
//                 <ChevronRight className="w-4 h-4" />
//               </button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  Calendar,
  CreditCard,
  Filter,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Wallet,
  Smartphone,
  Building2,
} from "lucide-react";

// Types
interface Withdrawal {
  id: string;
  amount: number;
  channel: string;
  status: string;
  createdAt: string;
  account: {
    accountNumber: string;
    accountName: string;
  };
  description?: string;
}

interface Account {
  id: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  canWithdraw: boolean;
}

type WithdrawalType = "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER";

export default function MyWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<"select" | "form">("select");
  const [withdrawalType, setWithdrawalType] = useState<WithdrawalType | null>(
    null
  );

  // Form states
  const [formData, setFormData] = useState({
    accountId: "",
    amount: "",
    description: "",
    mobileNumber: "",
    bankName: "",
    bankAccountNumber: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const itemsPerPage = 10;

  // Fetch withdrawals
  useEffect(() => {
    fetchWithdrawals();
  }, [currentPage, statusFilter]);

  // Fetch accounts when modal opens
  useEffect(() => {
    if (showModal) {
      fetchAccounts();
    }
  }, [showModal]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(
        `/api/v1/transactions/withdrawals/my-withdrawals?${params}`
      );
      const data = await response.json();

      if (data.success) {
        setWithdrawals(data.data.withdrawals);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/v1/accounts/my-accounts");
      const data = await response.json();

      if (data.success) {
        // Filter only accounts that allow withdrawals
        const withdrawableAccounts = data.data.accounts.filter(
          (acc: Account) => acc.canWithdraw
        );
        setAccounts(withdrawableAccounts);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const handleOpenModal = () => {
    setShowModal(true);
    setModalStep("select");
    setWithdrawalType(null);
    resetForm();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalStep("select");
    setWithdrawalType(null);
    resetForm();
  };

  const handleSelectWithdrawalType = (type: WithdrawalType) => {
    setWithdrawalType(type);
    setModalStep("form");
  };

  const handleBackToSelect = () => {
    setModalStep("select");
    setWithdrawalType(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      accountId: "",
      amount: "",
      description: "",
      mobileNumber: "",
      bankName: "",
      bankAccountNumber: "",
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Account validation
    if (!formData.accountId) {
      errors.accountId = "Please select an account";
    }

    // Amount validation
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.amount = "Amount must be greater than 0";
    } else {
      const selectedAccount = accounts.find(
        (acc) => acc.id === formData.accountId
      );
      if (
        selectedAccount &&
        parseFloat(formData.amount) > selectedAccount.balance
      ) {
        errors.amount = "Insufficient balance";
      }
    }

    // Mobile Money validation
    if (withdrawalType === "MOBILE_MONEY") {
      if (!formData.mobileNumber) {
        errors.mobileNumber = "Mobile number is required";
      } else if (!/^0[7][0-9]{8}$/.test(formData.mobileNumber)) {
        errors.mobileNumber = "Invalid mobile number format (e.g., 0700123456)";
      }
    }

    // Bank Transfer validation
    if (withdrawalType === "BANK_TRANSFER") {
      if (!formData.bankName) {
        errors.bankName = "Bank name is required";
      }
      if (!formData.bankAccountNumber) {
        errors.bankAccountNumber = "Bank account number is required";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        accountId: formData.accountId,
        amount: parseFloat(formData.amount),
        channel: withdrawalType,
        description:
          formData.description ||
          `${withdrawalType?.replace("_", " ")} withdrawal`,
      };

      // Add type-specific fields
      if (withdrawalType === "MOBILE_MONEY") {
        payload.mobileMoneyNumber = formData.mobileNumber;
      } else if (withdrawalType === "BANK_TRANSFER") {
        payload.bankName = formData.bankName;
        payload.bankAccountNumber = formData.bankAccountNumber;
      }

      const response = await fetch("/api/v1/transactions/withdrawals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        alert("Withdrawal submitted successfully!");
        handleCloseModal();
        fetchWithdrawals(); // Refresh the list
      } else {
        alert(data.message || "Failed to submit withdrawal");
      }
    } catch (error) {
      console.error("Error submitting withdrawal:", error);
      alert("An error occurred while submitting the withdrawal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredWithdrawals = withdrawals.filter(
    (withdrawal) =>
      withdrawal.account.accountNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      withdrawal.account.accountName
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
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

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "CASH":
        return <Wallet className="w-4 h-4" />;
      case "MOBILE_MONEY":
        return <Smartphone className="w-4 h-4" />;
      case "BANK_TRANSFER":
        return <Building2 className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  const selectedAccount = accounts.find((acc) => acc.id === formData.accountId);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Withdrawals</h1>
            <p className="text-gray-600 mt-1">
              View and manage your withdrawal transactions
            </p>
          </div>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2  bg-gradient-to-br from-green-500 to-green-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Withdrawal
          </button>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by account number or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-5 h-5" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Withdrawals Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <ArrowDownLeft className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No withdrawals found</p>
              <p className="text-sm">
                Try adjusting your filters or add a new withdrawal
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Channel
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
                    {filteredWithdrawals.map((withdrawal) => (
                      <tr
                        key={withdrawal.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            {new Date(
                              withdrawal.createdAt
                            ).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {withdrawal.account.accountName}
                            </div>
                            <div className="text-gray-500">
                              {withdrawal.account.accountNumber}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-900">
                            {getChannelIcon(withdrawal.channel)}
                            {withdrawal.channel.replace("_", " ")}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                          -{withdrawal.amount.toLocaleString()} UGX
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                              withdrawal.status
                            )}`}
                          >
                            {withdrawal.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {withdrawal.description || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-white px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Withdrawal Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {modalStep === "select"
                  ? "Select Withdrawal Type"
                  : "Withdrawal Details"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {modalStep === "select" ? (
                // Step 1: Select Withdrawal Type
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => handleSelectWithdrawalType("CASH")}
                    className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                        <Wallet className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Cash Withdrawal
                      </h3>
                      <p className="text-sm text-gray-600">
                        Withdraw cash at our office
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectWithdrawalType("MOBILE_MONEY")}
                    className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                        <Smartphone className="w-8 h-8 text-purple-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Mobile Money
                      </h3>
                      <p className="text-sm text-gray-600">
                        Transfer to mobile money account
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectWithdrawalType("BANK_TRANSFER")}
                    className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                        <Building2 className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Bank Transfer
                      </h3>
                      <p className="text-sm text-gray-600">
                        Transfer to bank account
                      </p>
                    </div>
                  </button>
                </div>
              ) : (
                // Step 2: Withdrawal Form
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Account Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Account <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.accountId}
                      onChange={(e) =>
                        setFormData({ ...formData, accountId: e.target.value })
                      }
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.accountId
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    >
                      <option value="">Choose an account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.accountName} - {account.accountNumber}{" "}
                          (Balance: {account.balance.toLocaleString()} UGX)
                        </option>
                      ))}
                    </select>
                    {formErrors.accountId && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors.accountId}
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
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.amount ? "border-red-500" : "border-gray-300"
                      }`}
                    />
                    {selectedAccount && (
                      <p className="text-sm text-gray-600 mt-1">
                        Available balance:{" "}
                        {selectedAccount.balance.toLocaleString()} UGX
                      </p>
                    )}
                    {formErrors.amount && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors.amount}
                      </p>
                    )}
                  </div>

                  {/* Mobile Money Fields */}
                  {withdrawalType === "MOBILE_MONEY" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={formData.mobileNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            mobileNumber: e.target.value,
                          })
                        }
                        placeholder="0700123456"
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          formErrors.mobileNumber
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                      {formErrors.mobileNumber && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.mobileNumber}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Bank Transfer Fields */}
                  {withdrawalType === "BANK_TRANSFER" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bank Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.bankName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankName: e.target.value,
                            })
                          }
                          placeholder="Enter bank name"
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            formErrors.bankName
                              ? "border-red-500"
                              : "border-gray-300"
                          }`}
                        />
                        {formErrors.bankName && (
                          <p className="text-red-500 text-sm mt-1">
                            {formErrors.bankName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bank Account Number{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.bankAccountNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bankAccountNumber: e.target.value,
                            })
                          }
                          placeholder="Enter account number"
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            formErrors.bankAccountNumber
                              ? "border-red-500"
                              : "border-gray-300"
                          }`}
                        />
                        {formErrors.bankAccountNumber && (
                          <p className="text-red-500 text-sm mt-1">
                            {formErrors.bankAccountNumber}
                          </p>
                        )}
                      </div>
                    </>
                  )}

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
                      placeholder="Add a note for this withdrawal"
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={handleBackToSelect}
                      className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Withdrawal"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
