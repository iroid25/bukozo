// app/dashboard/floats/components/ReconciliationApprovalDashboard.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ReconciliationApprovalDashboard({
  pendingReconciliations = [],
  unreconciledTellers = [],
  currentUserId,
}: {
  pendingReconciliations: any[];
  unreconciledTellers: any[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [selectedReconciliation, setSelectedReconciliation] =
    useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleString("en-UG", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const handleOpenModal = (reconciliation: any, type: "approve" | "reject") => {
    setSelectedReconciliation(reconciliation);
    setActionType(type);
    setShowApprovalModal(true);
    setRejectionReason("");
    setApprovalNotes("");
  };

  const handleApprove = async () => {
    if (!selectedReconciliation) return;

    setIsProcessing(true);
    try {
      const response = await fetch(
        `/api/v1/accountant/reconciliation/${selectedReconciliation.id}/approve`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notes: approvalNotes || undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error);
      } else {
        toast.success(result.message || "Reconciliation approved successfully");
        setShowApprovalModal(false);
        setSelectedReconciliation(null);
        router.refresh();
      }
    } catch (error) {
      console.error("Approval error:", error);
      toast.error("Failed to approve reconciliation");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReconciliation) return;

    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(
        `/api/v1/accountant/reconciliation/${selectedReconciliation.id}/reject`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rejectionReason }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error);
      } else {
        toast.success(result.message || "Reconciliation rejected successfully");
        setShowApprovalModal(false);
        setSelectedReconciliation(null);
        router.refresh();
      }
    } catch (error) {
      console.error("Rejection error:", error);
      toast.error("Failed to reject reconciliation");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingReconciliations.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-600 rounded-full p-2 text-white">
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900">
                  {pendingReconciliations.length} Pending Approval
                  {pendingReconciliations.length !== 1 ? "s" : ""}
                </h3>
                <p className="text-sm text-orange-700">
                  End-of-day reconciliations awaiting your review
                </p>
              </div>
              <div className="text-3xl font-bold text-orange-600">
                {pendingReconciliations.length}
              </div>
            </div>
          </div>
        )}

        {unreconciledTellers.length > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-600 rounded-full p-2 text-white">
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
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">
                  {unreconciledTellers.length} Unreconciled Float
                  {unreconciledTellers.length !== 1 ? "s" : ""}
                </h3>
                <p className="text-sm text-red-700">
                  Tellers/Agents who haven't completed end-of-day
                </p>
              </div>
              <div className="text-3xl font-bold text-red-600">
                {unreconciledTellers.length}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pending Reconciliations Table */}
      {pendingReconciliations.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Pending End-of-Day Reconciliations
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Review and approve/reject reconciliations
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teller/Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balances
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Difference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Float Return
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingReconciliations.map((r) => {
                  const difference = Number(r.difference) || 0;
                  const isBalanced = Math.abs(difference) <= 1000;
                  const hasOverage = difference > 1000;
                  const hasShortage = difference < -1000;

                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {r.reconciledByUser?.name ||
                            r.float?.user?.name ||
                            "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.reconciledByUser?.role ||
                            r.float?.user?.role ||
                            ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {r.float?.user?.branch?.name || "N/A"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.float?.user?.branch?.location || ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs space-y-1">
                          <div>
                            <span className="text-gray-500">System:</span>
                            <span className="ml-2 font-medium">
                              {formatCurrency(Number(r.systemBalance) || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Actual:</span>
                            <span className="ml-2 font-medium">
                              {formatCurrency(Number(r.actualCash) || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">On Hand:</span>
                            <span className="ml-2 font-medium">
                              {formatCurrency(Number(r.cashOnHand) || 0)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              isBalanced
                                ? "bg-green-100 text-green-800"
                                : hasOverage
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {difference >= 0 ? "+" : ""}
                            {formatCurrency(difference)}
                          </span>
                          {hasOverage && (
                            <div className="text-xs text-orange-600">
                              To Suspense: {formatCurrency(difference)}
                            </div>
                          )}
                          {hasShortage && (
                            <div className="text-xs text-red-600">
                              Shortage: {formatCurrency(Math.abs(difference))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">
                          {formatCurrency(Number(r.floatReturned) || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(r.reconciliationDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => handleOpenModal(r, "approve")}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleOpenModal(r, "reject")}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approval/Rejection Modal */}
      {showApprovalModal && selectedReconciliation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">
                {actionType === "approve" ? "Approve" : "Reject"} Reconciliation
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Review details before{" "}
                {actionType === "approve" ? "approving" : "rejecting"}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Reconciliation Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Teller/Agent:</span>
                  <span className="font-medium">
                    {selectedReconciliation.reconciledByUser?.name ||
                      selectedReconciliation.float?.user?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Branch:</span>
                  <span className="font-medium">
                    {selectedReconciliation.float?.user?.branch?.name || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">System Balance:</span>
                  <span className="font-medium">
                    {formatCurrency(
                      Number(selectedReconciliation.systemBalance) || 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cash On Hand:</span>
                  <span className="font-medium">
                    {formatCurrency(
                      Number(selectedReconciliation.cashOnHand) || 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Float to Return:</span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(
                      Number(selectedReconciliation.floatReturned) || 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Physical Cash:</span>
                  <span className="font-medium">
                    {formatCurrency(
                      Number(selectedReconciliation.actualCash) || 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Difference:</span>
                  <span
                    className={`font-bold ${
                      Math.abs(Number(selectedReconciliation.difference)) <=
                      1000
                        ? "text-green-600"
                        : Number(selectedReconciliation.difference) > 0
                          ? "text-orange-600"
                          : "text-red-600"
                    }`}
                  >
                    {Number(selectedReconciliation.difference) >= 0 ? "+" : ""}
                    {formatCurrency(
                      Number(selectedReconciliation.difference) || 0
                    )}
                  </span>
                </div>
              </div>

              {/* Variance Explanation */}
              {Math.abs(Number(selectedReconciliation.difference)) > 1000 && (
                <div
                  className={`p-4 rounded-lg ${
                    Number(selectedReconciliation.difference) > 1000
                      ? "bg-orange-50 border border-orange-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <h3 className="font-semibold mb-2">
                    {Number(selectedReconciliation.difference) > 1000
                      ? "Overage Detected"
                      : "Shortage Detected"}
                  </h3>
                  <p className="text-sm">
                    {Number(selectedReconciliation.difference) > 1000
                      ? `Excess of ${formatCurrency(Number(selectedReconciliation.difference))} will be transferred to the suspense account.`
                      : `Shortage of ${formatCurrency(Math.abs(Number(selectedReconciliation.difference)))} will be recorded and requires investigation.`}
                  </p>
                </div>
              )}

              {/* Teller's Notes */}
              {selectedReconciliation.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teller's Notes:
                  </label>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 border border-gray-200">
                    {selectedReconciliation.notes}
                  </div>
                </div>
              )}

              {/* Approval Notes */}
              {actionType === "approve" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approval Notes (Optional):
                  </label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Add any additional notes about this approval..."
                  />
                </div>
              )}

              {/* Rejection Reason */}
              {actionType === "reject" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Explain why this reconciliation is being rejected..."
                    required
                  />
                  {!rejectionReason.trim() && (
                    <p className="text-xs text-red-600 mt-1">
                      Rejection reason is required
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-gray-200 flex gap-3 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedReconciliation(null);
                  setRejectionReason("");
                  setApprovalNotes("");
                }}
                disabled={isProcessing}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={
                  actionType === "approve" ? handleApprove : handleReject
                }
                disabled={
                  isProcessing ||
                  (actionType === "reject" && !rejectionReason.trim())
                }
                className={`flex-1 px-6 py-3 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  actionType === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : actionType === "approve" ? (
                  "Approve Reconciliation"
                ) : (
                  "Reject Reconciliation"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
