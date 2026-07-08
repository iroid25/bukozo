// import { useState } from "react";
// import { toast } from "sonner";

// export default function EndOfDayReconciliationForm({
//   isOpen,
//   onClose,
//   userFloat,
//   currentUserId,
//   onSubmitSuccess,
// }: {
//   isOpen: boolean;
//   onClose: () => void;
//   userFloat: { id: string; balance: number } | null;
//   currentUserId: string;
//   onSubmitSuccess: () => void;
// }) {
//   const [actualCash, setActualCash] = useState("");
//   const [floatToReturn, setFloatToReturn] = useState("");
//   const [notes, setNotes] = useState("");
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   if (!isOpen || !userFloat) return null;

//   const systemBalance = userFloat.balance;
//   const difference = actualCash ? parseFloat(actualCash) - systemBalance : 0;
//   const cashRetained =
//     actualCash && floatToReturn
//       ? parseFloat(actualCash) - parseFloat(floatToReturn)
//       : 0;

//   const handleSubmit = async (e: any) => {
//     e.preventDefault();

//     if (!actualCash || !floatToReturn) {
//       toast.error("Please fill in all required fields");
//       return;
//     }

//     if (parseFloat(floatToReturn) > parseFloat(actualCash)) {
//       toast.error("Float to return cannot exceed actual cash on hand");
//       return;
//     }

//     setIsSubmitting(true);

//     try {
//       // Import and call your server action
//       // const result = await submitEndOfDayReconciliation({
//       //   floatId: userFloat.id,
//       //   actualCash: parseFloat(actualCash),
//       //   floatToReturn: parseFloat(floatToReturn),
//       //   reconciledByUserId: currentUserId,
//       //   notes
//       // });

//       // if (result.error) {
//       //   toast.error(result.error || "Failed to submit reconciliation");
//       //   return;
//       // }

//       toast.success("End of day reconciliation submitted for approval");
//       onSubmitSuccess?.();
//       onClose();
//     } catch (error) {
//       toast.error("Failed to submit reconciliation");
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
//         <div className="p-6 border-b border-gray-200">
//           <div className="flex items-center justify-between">
//             <div>
//               <h2 className="text-2xl font-bold text-gray-900">
//                 End of Day Reconciliation
//               </h2>
//               <p className="text-sm text-gray-600 mt-1">
//                 Submit your end-of-day cash count and float return
//               </p>
//             </div>
//             <button
//               onClick={onClose}
//               className="text-gray-400 hover:text-gray-600"
//             >
//               <svg
//                 className="w-6 h-6"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M6 18L18 6M6 6l12 12"
//                 />
//               </svg>
//             </button>
//           </div>
//         </div>

//         <form onSubmit={handleSubmit} className="p-6 space-y-6">
//           {/* System Balance Info */}
//           <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm font-medium text-blue-900">
//                   System Balance
//                 </p>
//                 <p className="text-2xl font-bold text-blue-700">
//                   UGX {systemBalance.toLocaleString()}
//                 </p>
//               </div>
//               <div className="text-blue-600">
//                 <svg
//                   className="w-12 h-12"
//                   fill="none"
//                   stroke="currentColor"
//                   viewBox="0 0 24 24"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth={2}
//                     d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
//                   />
//                 </svg>
//               </div>
//             </div>
//           </div>

//           {/* Actual Cash Count */}
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-2">
//               Actual Cash on Hand <span className="text-red-500">*</span>
//             </label>
//             <div className="relative">
//               <span className="absolute left-3 top-3 text-gray-500">UGX</span>
//               <input
//                 type="number"
//                 value={actualCash}
//                 onChange={(e) => setActualCash(e.target.value)}
//                 className="w-full pl-16 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 placeholder="0"
//                 required
//                 step="1"
//                 min="0"
//               />
//             </div>
//             <p className="text-xs text-gray-500 mt-1">
//               Count all physical cash in your possession
//             </p>
//           </div>

//           {/* Float to Return */}
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-2">
//               Float to Return to System <span className="text-red-500">*</span>
//             </label>
//             <div className="relative">
//               <span className="absolute left-3 top-3 text-gray-500">UGX</span>
//               <input
//                 type="number"
//                 value={floatToReturn}
//                 onChange={(e) => setFloatToReturn(e.target.value)}
//                 className="w-full pl-16 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 placeholder="0"
//                 required
//                 step="1"
//                 min="0"
//                 max={actualCash || 0}
//               />
//             </div>
//             <p className="text-xs text-gray-500 mt-1">
//               Amount to return to admin after day's work
//             </p>
//           </div>

//           {/* Calculations Summary */}
//           {actualCash && floatToReturn && (
//             <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
//               <h3 className="font-semibold text-gray-900">Summary</h3>

//               <div className="flex justify-between items-center text-sm">
//                 <span className="text-gray-600">System Balance:</span>
//                 <span className="font-medium">
//                   UGX {systemBalance.toLocaleString()}
//                 </span>
//               </div>

//               <div className="flex justify-between items-center text-sm">
//                 <span className="text-gray-600">Actual Cash:</span>
//                 <span className="font-medium">
//                   UGX {parseFloat(actualCash).toLocaleString()}
//                 </span>
//               </div>

//               <div
//                 className={`flex justify-between items-center text-sm pt-2 border-t ${
//                   Math.abs(difference) > 1000
//                     ? "border-red-200"
//                     : "border-gray-200"
//                 }`}
//               >
//                 <span className="text-gray-600">Difference:</span>
//                 <span
//                   className={`font-bold ${
//                     Math.abs(difference) <= 1000
//                       ? "text-green-600"
//                       : difference > 0
//                       ? "text-orange-600"
//                       : "text-red-600"
//                   }`}
//                 >
//                   {difference >= 0 ? "+" : ""}UGX {difference.toLocaleString()}
//                 </span>
//               </div>

//               {Math.abs(difference) > 1000 && (
//                 <div className="bg-orange-50 border border-orange-200 rounded p-3">
//                   <div className="flex items-start gap-2">
//                     <svg
//                       className="w-5 h-5 text-orange-600 mt-0.5"
//                       fill="none"
//                       stroke="currentColor"
//                       viewBox="0 0 24 24"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth={2}
//                         d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
//                       />
//                     </svg>
//                     <div className="text-xs text-orange-800">
//                       <p className="font-medium">
//                         Significant Variance Detected
//                       </p>
//                       <p>
//                         This reconciliation requires admin review and approval
//                       </p>
//                     </div>
//                   </div>
//                 </div>
//               )}

//               <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
//                 <span className="text-gray-600">Float to Return:</span>
//                 <span className="font-medium text-blue-600">
//                   UGX {parseFloat(floatToReturn).toLocaleString()}
//                 </span>
//               </div>

//               <div className="flex justify-between items-center text-sm">
//                 <span className="text-gray-600">Cash Retained:</span>
//                 <span className="font-medium">
//                   UGX {cashRetained.toLocaleString()}
//                 </span>
//               </div>
//             </div>
//           )}

//           {/* Notes */}
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-2">
//               Notes (Optional)
//             </label>
//             <textarea
//               value={notes}
//               onChange={(e) => setNotes(e.target.value)}
//               rows={3}
//               className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               placeholder="Any comments or explanations about the day's transactions..."
//             />
//           </div>

//           {/* Warning Message */}
//           <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
//             <div className="flex items-start gap-3">
//               <svg
//                 className="w-6 h-6 text-yellow-600 mt-0.5"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
//                 />
//               </svg>
//               <div className="text-sm text-yellow-800">
//                 <p className="font-medium">Important</p>
//                 <ul className="list-disc list-inside mt-2 space-y-1">
//                   <li>This reconciliation requires admin approval</li>
//                   <li>You cannot start a new day until approved</li>
//                   <li>Ensure all counts are accurate before submitting</li>
//                 </ul>
//               </div>
//             </div>
//           </div>

//           {/* Action Buttons */}
//           <div className="flex gap-3 pt-4">
//             <button
//               type="button"
//               onClick={onClose}
//               className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
//               disabled={isSubmitting}
//             >
//               Cancel
//             </button>
//             <button
//               type="submit"
//               disabled={isSubmitting || !actualCash || !floatToReturn}
//               className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
//             >
//               {isSubmitting ? (
//                 <span className="flex items-center justify-center gap-2">
//                   <svg
//                     className="animate-spin h-5 w-5"
//                     fill="none"
//                     viewBox="0 0 24 24"
//                   >
//                     <circle
//                       className="opacity-25"
//                       cx="12"
//                       cy="12"
//                       r="10"
//                       stroke="currentColor"
//                       strokeWidth="4"
//                     ></circle>
//                     <path
//                       className="opacity-75"
//                       fill="currentColor"
//                       d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
//                     ></path>
//                   </svg>
//                   Submitting...
//                 </span>
//               ) : (
//                 "Submit for Approval"
//               )}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

// app/dashboard/floats/components/EndOfDayReconciliationForm.tsx
// @ts-nocheck
// app/components/float/EndOfDayReconciliationForm.tsx
// components/floats/EndOfDayReconciliationForm.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowDown,
  ArrowUp,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";

interface FloatTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  transactionDate: Date;
  performedByUser: {
    name: string;
    role: string;
  };
}

interface TransactionSummary {
  startingBalance: number;
  currentBalance: number;
  transactions: FloatTransaction[];
  totalDeposits: number;
  totalWithdrawals: number;
  transactionCount: number;
}

export default function EndOfDayReconciliationForm({
  isOpen,
  onClose,
  userFloat,
  currentUserId,
  onSubmitSuccess,
  tolerance = 1000,
}: {
  isOpen: boolean;
  onClose: () => void;
  userFloat: { id: string; balance: number } | null;
  currentUserId: string;
  onSubmitSuccess: () => void;
  tolerance?: number;
}) {
  const [actualCash, setActualCash] = useState("");
  const [floatToReturn, setFloatToReturn] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transactionSummary, setTransactionSummary] =
    useState<TransactionSummary | null>(null);

  // Load transaction summary when modal opens
  useEffect(() => {
    if (isOpen && userFloat) {
      loadTransactionSummary();
    }
  }, [isOpen, userFloat]);

  const loadTransactionSummary = async () => {
    if (!userFloat) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/floats/users/${currentUserId}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (response.ok && result.success && result.data) {
        setTransactionSummary(result.data);
      } else {
        toast.error(result.error || "Failed to load transaction summary");
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transaction data");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !userFloat) return null;

  const systemBalance = userFloat.balance;
  const cashOnHandNum = actualCash ? parseFloat(actualCash) : 0;
  const floatToReturnNum = floatToReturn ? parseFloat(floatToReturn) : 0;
  const totalPhysicalCash = cashOnHandNum + floatToReturnNum;
  const variance = totalPhysicalCash - systemBalance;

  const varianceStatus = useMemo(() => {
    if (Math.abs(variance) <= tolerance) {
      return {
        tone: "text-green-600",
        bg: "bg-green-50 border-green-200",
        label: "Balanced âœ“",
      };
    }
    if (variance > 0) {
      return {
        tone: "text-orange-600",
        bg: "bg-orange-50 border-orange-200",
        label: "Overage (excess cash â†’ suspense)",
      };
    }
    return {
      tone: "text-red-600",
      bg: "bg-red-50 border-red-200",
      label: "Shortage (missing cash)",
    };
  }, [variance, tolerance]);

  const suspenseAmount = variance > tolerance ? variance : 0;
  const shortageAmount = variance < -tolerance ? Math.abs(variance) : 0;
  const cashToKeep = Math.max(0, cashOnHandNum - suspenseAmount);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!actualCash || !floatToReturn) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (floatToReturnNum > totalPhysicalCash) {
      toast.error("Float to return cannot exceed total physical cash");
      return;
    }

    if (Math.abs(variance) > tolerance && !notes.trim()) {
      toast.error(
        `Please provide an explanation for variances over UGX ${tolerance.toLocaleString()}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/floats/reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          floatId: userFloat.id,
          actualCashOnHand: cashOnHandNum,
          actualFloatAmount: floatToReturnNum,
          notes: notes.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error || "Failed to submit reconciliation");
        return;
      }

      toast.success("End of day reconciliation submitted for approval");
      onSubmitSuccess?.();
      onClose();

      // Reset form
      setActualCash("");
      setFloatToReturn("");
      setNotes("");
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Failed to submit reconciliation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (date: Date) => {
    return format(new Date(date), "hh:mm a");
  };

  const deposits =
    transactionSummary?.transactions.filter((t) => t.amount > 0) || [];
  const withdrawals =
    transactionSummary?.transactions.filter((t) => t.amount < 0) || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white p-6 border-b border-gray-200 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                End of Day Reconciliation
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Review today's transactions and submit your cash count
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              type="button"
            >
              âœ•
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">
              Loading transaction data...
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Transaction Summary Cards */}
            {transactionSummary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600 font-medium">
                        Starting Balance
                      </p>
                      <p className="text-xl font-bold text-blue-900 mt-1">
                        {formatCurrency(transactionSummary.startingBalance)}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-blue-400" />
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-green-600 font-medium">
                        Total Deposits
                      </p>
                      <p className="text-xl font-bold text-green-900 mt-1">
                        +{formatCurrency(transactionSummary.totalDeposits)}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        {deposits.length} txns
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-400" />
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-red-600 font-medium">
                        Total Withdrawals
                      </p>
                      <p className="text-xl font-bold text-red-900 mt-1">
                        -{formatCurrency(transactionSummary.totalWithdrawals)}
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        {withdrawals.length} txns
                      </p>
                    </div>
                    <TrendingDown className="w-8 h-8 text-red-400" />
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-600 font-medium">
                        Expected Balance
                      </p>
                      <p className="text-xl font-bold text-purple-900 mt-1">
                        {formatCurrency(transactionSummary.currentBalance)}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        System calculated
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-purple-400" />
                  </div>
                </div>
              </div>
            )}

            {/* Transaction History */}
            {transactionSummary &&
              transactionSummary.transactions.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h3 className="font-semibold text-gray-900">
                      Today's Transactions (
                      {transactionSummary.transactionCount})
                    </h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {transactionSummary.transactions.map((txn) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              txn.amount > 0
                                ? "bg-green-100 text-green-600"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {txn.amount > 0 ? (
                              <ArrowDown className="w-5 h-5" />
                            ) : (
                              <ArrowUp className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {txn.description}
                            </p>
                            <p className="text-xs text-gray-500">
                              {txn.type} â€¢ {formatTime(txn.transactionDate)} â€¢{" "}
                              {txn.performedByUser.name}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`text-lg font-bold ${
                            txn.amount > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {txn.amount > 0 ? "+" : ""}
                          {formatCurrency(Math.abs(txn.amount))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* System Balance */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900">
                System Balance (Expected)
              </p>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(systemBalance)}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                This is what your float should be based on today's transactions
              </p>
            </div>

            {/* Cash on hand */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Physical Cash On Hand <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500 font-medium">
                  UGX
                </span>
                <input
                  type="number"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className="w-full pl-16 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                  placeholder="0"
                  required
                  step="1000"
                  min="0"
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Count all physical cash you currently have
              </p>
            </div>

            {/* Float to return */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Float to Return to Vault <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500 font-medium">
                  UGX
                </span>
                <input
                  type="number"
                  value={floatToReturn}
                  onChange={(e) => setFloatToReturn(e.target.value)}
                  className="w-full pl-16 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                  placeholder="0"
                  required
                  step="1000"
                  min="0"
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Amount you are returning to the vault at end of day
              </p>
            </div>

            {/* Reconciliation Summary */}
            {actualCash !== "" && floatToReturn !== "" && (
              <div
                className={`border rounded-lg overflow-hidden ${varianceStatus.bg}`}
              >
                <div className="bg-white/50 px-4 py-3 border-b">
                  <h3 className="font-semibold text-gray-900">
                    Reconciliation Summary
                  </h3>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Cash On Hand:</span>
                    <span className="font-semibold">
                      {formatCurrency(cashOnHandNum)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Float to Return:</span>
                    <span className="font-semibold text-blue-600">
                      {formatCurrency(floatToReturnNum)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm border-t pt-2 font-semibold">
                    <span>Total Physical Cash:</span>
                    <span className="text-blue-700">
                      {formatCurrency(totalPhysicalCash)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span>System Balance:</span>
                    <span className="font-medium">
                      {formatCurrency(systemBalance)}
                    </span>
                  </div>

                  <div
                    className={`flex justify-between text-sm border-t pt-2 font-bold`}
                  >
                    <span>Variance:</span>
                    <span className={varianceStatus.tone}>
                      {variance >= 0 ? "+" : ""}
                      {formatCurrency(variance)}
                    </span>
                  </div>

                  <div
                    className={`mt-3 p-3 rounded-lg ${varianceStatus.bg} border`}
                  >
                    <p className={`font-semibold ${varianceStatus.tone} mb-2`}>
                      Status: {varianceStatus.label}
                    </p>

                    {Math.abs(variance) <= tolerance && (
                      <p className="text-sm text-green-700">
                        Your count matches the system balance (within Â±
                        {formatCurrency(tolerance)} tolerance).
                      </p>
                    )}

                    {variance > tolerance && (
                      <div className="text-sm space-y-2">
                        <p className="text-orange-700">
                          You have{" "}
                          <strong>{formatCurrency(suspenseAmount)}</strong> in
                          excess cash.
                        </p>
                        <div className="bg-white/70 rounded p-2 border border-orange-300">
                          <p className="font-semibold text-orange-800 mb-1">
                            What happens:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-orange-800">
                            <li>
                              Overage â†’ Suspense account:{" "}
                              {formatCurrency(suspenseAmount)}
                            </li>
                            <li>
                              Cash you keep tomorrow:{" "}
                              {formatCurrency(cashToKeep)}
                            </li>
                            <li>Accountant will investigate the source</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    {variance < -tolerance && (
                      <div className="text-sm space-y-2">
                        <p className="text-red-700">
                          You are short{" "}
                          <strong>{formatCurrency(shortageAmount)}</strong>.
                        </p>
                        <div className="bg-white/70 rounded p-2 border border-red-300">
                          <p className="font-semibold text-red-800 mb-1">
                            Important:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-red-800">
                            <li>Shortage will be recorded</li>
                            <li>Requires immediate investigation</li>
                            <li>Manager will be notified</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes{" "}
                {Math.abs(variance) > tolerance && (
                  <span className="text-red-600">
                    (required for variance over {formatCurrency(tolerance)})
                  </span>
                )}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder={
                  Math.abs(variance) > tolerance
                    ? `Explain the variance over ${formatCurrency(tolerance)}...`
                    : "Any comments or explanations about today's reconciliation..."
                }
                disabled={isSubmitting}
              />
            </div>

            {/* Important Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-semibold text-yellow-900 mb-2">âš ï¸ Important</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                <li>This reconciliation requires accountant approval</li>
                <li>You cannot start a new day until approved</li>
                <li>Ensure all amounts are accurate before submitting</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  actualCash === "" ||
                  floatToReturn === "" ||
                  (Math.abs(variance) > tolerance && !notes.trim())
                }
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  "Submit for Approval"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


