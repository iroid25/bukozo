// app/dashboard/accountant/allocate-float/distribution/reconciliations/components/AccountantReconciliationPopup.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  X,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Loader2,
  FileText,
  RefreshCw,
} from "lucide-react";
interface ReconciliationPopupProps {
  accountantId: string;
  branchId?: string;
}

export default function AccountantReconciliationPopup({
  accountantId,
  branchId,
}: ReconciliationPopupProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] =
    useState<any>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // Fetch pending reconciliations from database
  const fetchPendingReconciliations = async () => {
    try {
      setLoading(true);

      // ✅ Fetch real data from database
      const response = await fetch("/api/v1/floats/reconcile", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch reconciliations");
      }

      const data = result.data || [];

      if (!data || data.length === 0) {
        setReconciliations([]);
        setIsOpen(false);
        return;
      }

      // Filter by branch if branchId is provided
      const filtered = branchId
        ? data.filter((r: any) => r.float?.user?.branchId === branchId)
        : data;

      setReconciliations(filtered);

      // Auto-open if there are pending reconciliations
      if (filtered.length > 0 && !isOpen) {
        setIsOpen(true);
      }

      // Auto-close if no more pending reconciliations
      if (filtered.length === 0 && isOpen) {
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Error fetching reconciliations:", error);
      toast.error("Failed to fetch pending reconciliations", {
        description: "Please refresh the page to try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchPendingReconciliations();

    // Poll every 30 seconds for new reconciliations (real-time updates)
    const interval = setInterval(fetchPendingReconciliations, 30000);

    return () => clearInterval(interval);
  }, [accountantId, branchId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString("en-UG", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getVarianceInfo = (reconciliation: any) => {
    const variance = reconciliation.difference;
    const TOLERANCE = 1000;

    if (Math.abs(variance) <= TOLERANCE) {
      return {
        type: "balanced",
        label: "Balanced",
        color: "green",
        icon: CheckCircle,
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        textColor: "text-green-600",
      };
    } else if (variance > TOLERANCE) {
      return {
        type: "overage",
        label: "Overage",
        color: "orange",
        icon: TrendingUp,
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
        textColor: "text-orange-600",
      };
    } else {
      return {
        type: "shortage",
        label: "Shortage",
        color: "red",
        icon: TrendingDown,
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        textColor: "text-red-600",
      };
    }
  };

  const handleApprove = (reconciliation: any) => {
    setSelectedReconciliation(reconciliation);
    setShowApprovalDialog(true);
  };

  const handleReject = (reconciliation: any) => {
    setSelectedReconciliation(reconciliation);
    setShowRejectionDialog(true);
  };

  const confirmApproval = async () => {
    if (!selectedReconciliation) return;

    setProcessing(true);

    try {
      const response = await fetch(
        `/api/v1/accountant/reconciliation/${selectedReconciliation.id}/approve`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notes: approvalNotes }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error("Approval Failed", {
          description: result.error,
        });
        return;
      }

      // Success!
      toast.success("✅ Reconciliation Approved!", {
        description: `UGX ${selectedReconciliation.actualCash.toLocaleString()} added to your vault.`,
        duration: 5000,
      });

      // Remove from list
      setReconciliations((prev) =>
        prev.filter((r) => r.id !== selectedReconciliation.id)
      );

      // Close dialogs
      setShowApprovalDialog(false);
      setSelectedReconciliation(null);
      setApprovalNotes("");

      // Refresh the page data
      router.refresh();
    } catch (error) {
      console.error("Approval error:", error);
      toast.error("Approval Failed", {
        description: "An unexpected error occurred.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const confirmRejection = async () => {
    if (!selectedReconciliation || !rejectionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    setProcessing(true);

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
        toast.error("Rejection Failed", {
          description: result.error,
        });
        return;
      }

      // Success!
      toast.success("❌ Reconciliation Rejected", {
        description: `${selectedReconciliation.float.user.name} can now resubmit.`,
        duration: 5000,
      });

      // Remove from list
      setReconciliations((prev) =>
        prev.filter((r) => r.id !== selectedReconciliation.id)
      );

      // Close dialogs
      setShowRejectionDialog(false);
      setSelectedReconciliation(null);
      setRejectionReason("");

      // Refresh the page data
      router.refresh();
    } catch (error) {
      console.error("Rejection error:", error);
      toast.error("Rejection Failed", {
        description: "An unexpected error occurred.",
      });
    } finally {
      setProcessing(false);
    }
  };

  // If no pending reconciliations, don't show popup
  if (!isOpen || reconciliations.length === 0) {
    return null;
  }

  return (
    <>
      {/* Main Popup */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-slideUp">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Clock className="h-6 w-6 animate-pulse" />
                  Pending Reconciliation Approvals
                </h2>
                <p className="text-blue-100 mt-1">
                  {reconciliations.length} reconciliation(s) awaiting your
                  approval
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchPendingReconciliations}
                  disabled={loading}
                  className="text-white hover:bg-blue-600 rounded-full p-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh"
                >
                  <RefreshCw
                    className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
                  />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-blue-600 rounded-full p-2 transition"
                  title="Minimize (will reopen if new reconciliations arrive)"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 z-10 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Loading reconciliations...
                </p>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {reconciliations.map((reconciliation) => {
                const varianceInfo = getVarianceInfo(reconciliation);
                const VarianceIcon = varianceInfo.icon;

                return (
                  <div
                    key={reconciliation.id}
                    className="border-2 border-gray-200 rounded-lg p-6 hover:border-blue-300 transition"
                  >
                    {/* Teller Info */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">
                            {reconciliation.float.user.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {reconciliation.float.user.email} •{" "}
                            {reconciliation.float.user.branch.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        {formatDate(reconciliation.reconciliationDate)}
                      </div>
                    </div>

                    {/* Amounts Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-medium">
                          System Balance
                        </p>
                        <p className="text-lg font-bold text-blue-900">
                          {formatCurrency(reconciliation.systemBalance)}
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-600 font-medium">
                          Physical Cash
                        </p>
                        <p className="text-lg font-bold text-green-900">
                          {formatCurrency(reconciliation.actualCash)}
                        </p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3">
                        <p className="text-xs text-purple-600 font-medium">
                          Cash on Hand
                        </p>
                        <p className="text-lg font-bold text-purple-900">
                          {formatCurrency(reconciliation.cashOnHand)}
                        </p>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-3">
                        <p className="text-xs text-indigo-600 font-medium">
                          Float Returned
                        </p>
                        <p className="text-lg font-bold text-indigo-900">
                          {formatCurrency(reconciliation.floatReturned)}
                        </p>
                      </div>
                    </div>

                    {/* Variance Display */}
                    <div
                      className={`${varianceInfo.bgColor} border-2 ${varianceInfo.borderColor} rounded-lg p-4 mb-4`}
                    >
                      <div className="flex items-center gap-3">
                        <VarianceIcon
                          className={`h-8 w-8 ${varianceInfo.textColor}`}
                        />
                        <div className="flex-1">
                          <p className={`font-bold ${varianceInfo.textColor}`}>
                            {varianceInfo.label}:{" "}
                            {formatCurrency(
                              Math.abs(reconciliation.difference)
                            )}
                          </p>
                          <p className={`text-sm ${varianceInfo.textColor}`}>
                            {varianceInfo.type === "balanced" &&
                              "Within acceptable tolerance (±1,000 UGX)"}
                            {varianceInfo.type === "overage" &&
                              "Excess will be sent to suspense account"}
                            {varianceInfo.type === "shortage" &&
                              "Shortage will be recorded for investigation"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {reconciliation.notes && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-gray-600 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-gray-600">
                              Teller Notes
                            </p>
                            <p className="text-sm text-gray-800">
                              {reconciliation.notes}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Impact Notice */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-800">
                        <strong>Upon Approval:</strong> UGX{" "}
                        {reconciliation.actualCash.toLocaleString()} will be
                        added to your vault, and teller's balance will be reset
                        to 0.
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(reconciliation)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="h-5 w-5" />
                        Approve & Add to Vault
                      </button>
                      <button
                        onClick={() => handleReject(reconciliation)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <XCircle className="h-5 w-5" />
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Approval Confirmation Dialog */}
      {showApprovalDialog && selectedReconciliation && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Approve Reconciliation?
                </h3>
                <p className="text-sm text-gray-600">
                  Confirm the details below
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Teller:</span>
                <span className="font-semibold">
                  {selectedReconciliation.float.user.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Amount to Vault:</span>
                <span className="font-bold text-green-700">
                  {formatCurrency(selectedReconciliation.actualCash)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Variance:</span>
                <span
                  className={`font-semibold ${selectedReconciliation.difference >= 0 ? "text-orange-600" : "text-red-600"}`}
                >
                  {selectedReconciliation.difference >= 0 ? "+" : ""}
                  {formatCurrency(selectedReconciliation.difference)}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Approval Notes (Optional)
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={3}
                placeholder="Add any comments about this approval..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApprovalDialog(false);
                  setApprovalNotes("");
                }}
                disabled={processing}
                className="flex-1 border-2 border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmApproval}
                disabled={processing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirm Approval
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Confirmation Dialog */}
      {showRejectionDialog && selectedReconciliation && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Reject Reconciliation?
                </h3>
                <p className="text-sm text-gray-600">
                  Teller will be able to resubmit
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">Teller:</p>
              <p className="font-semibold">
                {selectedReconciliation.float.user.name}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-600">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={4}
                placeholder="Explain why you're rejecting this reconciliation..."
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectionDialog(false);
                  setRejectionReason("");
                }}
                disabled={processing}
                className="flex-1 border-2 border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRejection}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
