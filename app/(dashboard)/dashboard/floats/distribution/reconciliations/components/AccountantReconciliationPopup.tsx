// ============================================================================
// components/AccountantReconciliationPopup.tsx
// Real production component that connects to your backend
// ============================================================================
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  X,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  User,
  Calendar,
  TrendingUp,
  TrendingDown,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

interface Transaction {
  deposits: { count: number; amount: number };
  withdrawals: { count: number; amount: number };
  expenditures: { count: number; amount: number };
}

interface Reconciliation {
  id: string;
  reconciliationId: string;
  tellerName: string;
  tellerRole: string;
  branchName: string;
  systemBalance: number;
  actualCash: number;
  variance: number;
  isBalanced: boolean;
  hasOverage: boolean;
  hasShortage: boolean;
  timestamp: Date;
  status: string;
  transactions: Transaction;
}

interface AccountantReconciliationPopupProps {
  accountantId: string;
  branchId?: string;
  onReconciliationProcessed?: () => void;
}

const TOLERANCE = 1000;
const POLL_INTERVAL = 30000; // 30 seconds

export default function AccountantReconciliationPopup({
  accountantId,
  branchId,
  onReconciliationProcessed,
}: AccountantReconciliationPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [selectedRecon, setSelectedRecon] = useState<Reconciliation | null>(
    null
  );
  const [showDetail, setShowDetail] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionForm, setShowRejectionForm] = useState<string | null>(
    null
  );
  const [approvalNotes, setApprovalNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch pending reconciliations
  const fetchReconciliations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/reconciliation/pending-notifications");

      if (!response.ok) {
        throw new Error("Failed to fetch reconciliations");
      }

      const result = await response.json();

      if (result.success) {
        setReconciliations(result.data.reconciliations || []);

        // Show toast if new reconciliations arrived
        if (result.data.reconciliations.length > reconciliations.length) {
          toast.info("New reconciliation request", {
            description: `${result.data.reconciliations.length} pending approval(s)`,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching reconciliations:", error);
    } finally {
      setLoading(false);
    }
  }, [reconciliations.length]);

  // Poll for new reconciliations
  useEffect(() => {
    fetchReconciliations();
    const interval = setInterval(fetchReconciliations, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchReconciliations]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTimeAgo = (date: Date | string) => {
    const d = new Date(date);
    const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getVarianceColor = (variance: number) => {
    const isBalanced = Math.abs(variance) <= TOLERANCE;
    const hasOverage = variance > TOLERANCE;

    if (isBalanced) return "text-green-600 bg-green-50 border-green-200";
    if (hasOverage) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getVarianceIcon = (variance: number) => {
    const isBalanced = Math.abs(variance) <= TOLERANCE;
    const hasOverage = variance > TOLERANCE;

    if (isBalanced) return <CheckCircle className="h-5 w-5" />;
    if (hasOverage) return <TrendingUp className="h-5 w-5" />;
    return <TrendingDown className="h-5 w-5" />;
  };

  const getVarianceLabel = (variance: number) => {
    const isBalanced = Math.abs(variance) <= TOLERANCE;
    if (isBalanced) return "Balanced";
    return variance > 0 ? "Overage" : "Shortage";
  };

  const handleApprove = async (reconId: string) => {
    setProcessing(true);

    try {
      const response = await fetch("/api/reconciliation/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reconciliationId: reconId,
          approvalNotes,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Reconciliation Approved", {
          description: `${result.data.tellerName}'s reconciliation approved. ${formatCurrency(result.data.totalPhysical)} added to vault.`,
        });

        // Remove from list
        setReconciliations((prev) => prev.filter((r) => r.id !== reconId));
        setShowDetail(false);
        setSelectedRecon(null);
        setApprovalNotes("");

        // Trigger refresh
        if (onReconciliationProcessed) {
          onReconciliationProcessed();
        }
      } else {
        toast.error("Approval Failed", {
          description: result.error || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error("Error approving reconciliation:", error);
      toast.error("Approval Failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (reconId: string) => {
    if (!rejectionReason || rejectionReason.trim().length < 10) {
      toast.error("Invalid Rejection", {
        description:
          "Please provide a detailed rejection reason (minimum 10 characters)",
      });
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch("/api/reconciliation/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reconciliationId: reconId,
          rejectionReason,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const recon = reconciliations.find((r) => r.id === reconId);
        toast.warning("Reconciliation Rejected", {
          description: `${recon?.tellerName}'s reconciliation rejected. Teller can resubmit.`,
        });

        // Remove from list
        setReconciliations((prev) => prev.filter((r) => r.id !== reconId));
        setShowDetail(false);
        setSelectedRecon(null);
        setShowRejectionForm(null);
        setRejectionReason("");

        // Trigger refresh
        if (onReconciliationProcessed) {
          onReconciliationProcessed();
        }
      } else {
        toast.error("Rejection Failed", {
          description: result.error || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error("Error rejecting reconciliation:", error);
      toast.error("Rejection Failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleViewDetails = (recon: Reconciliation) => {
    setSelectedRecon(recon);
    setShowDetail(true);
  };

  return (
    <>
      {/* Floating Notification Bell */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-4 rounded-full shadow-lg transition-all ${
            reconciliations.length > 0
              ? "bg-orange-500 hover:bg-orange-600 animate-pulse"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
          aria-label="Reconciliation notifications"
        >
          <Bell className="h-6 w-6 text-white" />
          {reconciliations.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-bounce">
              {reconciliations.length}
            </span>
          )}
        </button>
      </div>

      {/* Popup Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 z-50 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">EOD Reconciliations</h3>
                <p className="text-sm text-gray-600">
                  {reconciliations.length} pending approval
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Reconciliation List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && reconciliations.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3 animate-spin" />
                <p className="text-gray-600">Loading...</p>
              </div>
            ) : reconciliations.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">All caught up!</p>
                <p className="text-sm text-gray-500 mt-1">
                  No pending reconciliations
                </p>
              </div>
            ) : (
              reconciliations.map((recon) => (
                <div
                  key={recon.id}
                  className={`border rounded-lg p-4 transition-all hover:shadow-md ${getVarianceColor(recon.variance)}`}
                >
                  {/* Teller Info */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">
                          {recon.tellerName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {recon.tellerRole} • {recon.branchName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getVarianceIcon(recon.variance)}
                      <span className="text-xs font-bold">
                        {getVarianceLabel(recon.variance)}
                      </span>
                    </div>
                  </div>

                  {/* Amounts */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">
                        System Balance
                      </p>
                      <p className="text-sm font-bold">
                        {formatCurrency(recon.systemBalance)}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Actual Cash</p>
                      <p className="text-sm font-bold">
                        {formatCurrency(recon.actualCash)}
                      </p>
                    </div>
                  </div>

                  {/* Variance */}
                  <div className="bg-white rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Variance</span>
                      <span
                        className={`text-lg font-bold ${
                          recon.isBalanced
                            ? "text-green-600"
                            : recon.hasOverage
                              ? "text-orange-600"
                              : "text-red-600"
                        }`}
                      >
                        {recon.variance >= 0 ? "+" : ""}
                        {formatCurrency(recon.variance)}
                      </span>
                    </div>
                  </div>

                  {/* Transaction Summary */}
                  <div className="bg-white rounded-lg p-3 mb-3 space-y-2">
                    <p className="text-xs font-medium text-gray-700 mb-2">
                      Today's Transactions
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-600">Deposits</p>
                        <p className="font-bold text-green-600">
                          {recon.transactions.deposits.count}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Withdrawals</p>
                        <p className="font-bold text-blue-600">
                          {recon.transactions.withdrawals.count}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Expenses</p>
                        <p className="font-bold text-red-600">
                          {recon.transactions.expenditures.count}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                    <Calendar className="h-3 w-3" />
                    <span>{formatTimeAgo(recon.timestamp)}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewDetails(recon)}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Review
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedRecon && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Reconciliation Review
                </h2>
                <button
                  onClick={() => {
                    setShowDetail(false);
                    setSelectedRecon(null);
                    setShowRejectionForm(null);
                    setRejectionReason("");
                    setApprovalNotes("");
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-lg">
                    {selectedRecon.tellerName}
                  </p>
                  <p className="text-gray-600">
                    {selectedRecon.tellerRole} • {selectedRecon.branchName}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Transaction Breakdown */}
              <div>
                <h3 className="font-bold text-gray-900 mb-4">
                  Transaction Summary
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-900">
                        Deposits
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {selectedRecon.transactions.deposits.count}
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      {formatCurrency(
                        selectedRecon.transactions.deposits.amount
                      )}
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        Withdrawals
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">
                      {selectedRecon.transactions.withdrawals.count}
                    </p>
                    <p className="text-sm text-blue-600 mt-1">
                      {formatCurrency(
                        selectedRecon.transactions.withdrawals.amount
                      )}
                    </p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-red-900">
                        Expenses
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">
                      {selectedRecon.transactions.expenditures.count}
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      {formatCurrency(
                        selectedRecon.transactions.expenditures.amount
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Balance Reconciliation */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 mb-4">
                  Balance Reconciliation
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">System Balance</span>
                    <span className="font-bold text-lg">
                      {formatCurrency(selectedRecon.systemBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Actual Cash Counted</span>
                    <span className="font-bold text-lg">
                      {formatCurrency(selectedRecon.actualCash)}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                    <span className="font-bold text-gray-900">Variance</span>
                    <span
                      className={`font-bold text-xl ${
                        selectedRecon.isBalanced
                          ? "text-green-600"
                          : selectedRecon.hasOverage
                            ? "text-orange-600"
                            : "text-red-600"
                      }`}
                    >
                      {selectedRecon.variance >= 0 ? "+" : ""}
                      {formatCurrency(selectedRecon.variance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Info */}
              {!selectedRecon.isBalanced && (
                <div
                  className={`rounded-lg p-4 ${
                    selectedRecon.hasOverage
                      ? "bg-orange-50 border border-orange-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className={`h-5 w-5 mt-0.5 ${
                        selectedRecon.hasOverage
                          ? "text-orange-600"
                          : "text-red-600"
                      }`}
                    />
                    <div className="flex-1">
                      <p
                        className={`font-bold mb-1 ${
                          selectedRecon.hasOverage
                            ? "text-orange-900"
                            : "text-red-900"
                        }`}
                      >
                        {selectedRecon.hasOverage
                          ? "Overage Detected"
                          : "Shortage Detected"}
                      </p>
                      <p
                        className={`text-sm ${
                          selectedRecon.hasOverage
                            ? "text-orange-700"
                            : "text-red-700"
                        }`}
                      >
                        {selectedRecon.hasOverage
                          ? "Excess amount will be transferred to branch suspense account"
                          : "Shortage will be recorded and investigated"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Approval Notes */}
              {!showRejectionForm && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approval Notes (Optional)
                  </label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Add any notes about this reconciliation..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              )}

              {/* Rejection Form */}
              {showRejectionForm && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-red-900 mb-2">
                    Rejection Reason (Required) *
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide a detailed reason for rejection (minimum 10 characters)..."
                    className="w-full p-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    rows={4}
                  />
                  <p className="text-xs text-red-600 mt-2">
                    {rejectionReason.length}/10 characters minimum
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              {!showRejectionForm ? (
                <>
                  <button
                    onClick={() => setShowRejectionForm(selectedRecon.id)}
                    disabled={processing}
                    className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="h-5 w-5" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedRecon.id)}
                    disabled={processing}
                    className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {processing ? (
                      <>Processing...</>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Approve & Add to Vault
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowRejectionForm(null);
                      setRejectionReason("");
                    }}
                    disabled={processing}
                    className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReject(selectedRecon.id)}
                    disabled={processing || rejectionReason.length < 10}
                    className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {processing ? (
                      <>Processing...</>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5" />
                        Confirm Rejection
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
