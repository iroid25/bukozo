// app/dashboard/accountant/reconciliations/[id]/ReconciliationDetailsClient.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Calendar,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatISODate } from "@/lib/utils";
import { ReconciliationStatus } from "@prisma/client";

interface ReconciliationDetailsClientProps {
  reconciliation: any;
  currentUser: any;
}

export default function ReconciliationDetailsClient({
  reconciliation,
  currentUser,
}: ReconciliationDetailsClientProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showApprovalForm, setShowApprovalForm] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (dateString: string | Date) => {
    return new Date(dateString).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canApproveOrReject =
    reconciliation.status === ReconciliationStatus.PENDING &&
    (currentUser.role === "ACCOUNTANT" || currentUser.role === "ADMIN");

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(
        `/api/v1/accountant/reconciliation/${reconciliation.id}/approve`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notes: approvalNotes || "Approved by accountant",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error("Approval failed", {
          description: result.error,
        });
      } else {
        toast.success("Reconciliation approved successfully", {
          description: `Float balance updated to ${formatCurrency(
            result.data?.newFloatBalance || 0
          )}. ${
            result.data?.floatReturned
              ? `${formatCurrency(result.data.floatReturned)} returned to vault.`
              : ""
          }`,
        });
        router.push("/dashboard/accountant/reconciliations");
        router.refresh();
      }
    } catch (error) {
      toast.error("Approval failed", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Rejection reason required", {
        description: "Please provide a reason for rejection",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(
        `/api/v1/accountant/reconciliation/${reconciliation.id}/reject`,
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
        toast.error("Rejection failed", {
          description: result.error,
        });
      } else {
        toast.success("Reconciliation rejected", {
          description: "Teller has been notified and can resubmit",
        });
        router.push("/dashboard/accountant/reconciliations");
        router.refresh();
      }
    } catch (error) {
      toast.error("Rejection failed", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Reconciliations</span>
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                Reconciliation Details
              </h1>
              <p className="text-sm text-gray-600">
                {reconciliation.reconciliationType === "END_OF_DAY"
                  ? "End of Day"
                  : reconciliation.reconciliationType === "START_OF_DAY"
                    ? "Start of Day"
                    : "Regular"}{" "}
                Reconciliation
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {reconciliation.status === ReconciliationStatus.APPROVED && (
                <Badge className="bg-green-100 text-green-800 w-fit">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approved
                </Badge>
              )}
              {reconciliation.status === ReconciliationStatus.REJECTED && (
                <Badge className="bg-red-100 text-red-800 w-fit">
                  <XCircle className="h-4 w-4 mr-1" />
                  Rejected
                </Badge>
              )}
              {reconciliation.status === ReconciliationStatus.PENDING && (
                <Badge className="bg-blue-100 text-blue-800 w-fit">
                  <Clock className="h-4 w-4 mr-1" />
                  Pending Review
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Teller Information */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Teller/Agent Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-medium text-gray-900">
                {reconciliation.float.user.name}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Role</p>
              <p className="font-medium text-gray-900">
                {reconciliation.float.user.role}
              </p>
            </div>
            {reconciliation.float.user.branch && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Branch</p>
                  <p className="font-medium text-gray-900">
                    {reconciliation.float.user.branch.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="font-medium text-gray-900">
                    {reconciliation.float.user.branch.location}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Reconciliation Details */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Financial Details
          </h2>

          <div className="space-y-6">
            {/* Balance Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">System Balance</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(reconciliation.systemBalance)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Actual Cash</p>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(reconciliation.actualCash)}
                </p>
              </div>
              <div
                className={`p-4 rounded-lg ${
                  reconciliation.difference === 0
                    ? "bg-green-50"
                    : reconciliation.difference > 0
                      ? "bg-blue-50"
                      : "bg-red-50"
                }`}
              >
                <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                  Difference
                  {reconciliation.difference === 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : reconciliation.difference > 0 ? (
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                </p>
                <p
                  className={`text-xl font-bold ${
                    reconciliation.difference === 0
                      ? "text-green-600"
                      : reconciliation.difference > 0
                        ? "text-blue-600"
                        : "text-red-600"
                  }`}
                >
                  {reconciliation.difference === 0
                    ? "Balanced"
                    : `${reconciliation.difference > 0 ? "+" : ""}${formatCurrency(
                        reconciliation.difference
                      )}`}
                </p>
              </div>
            </div>

            {/* End of Day Details */}
            {reconciliation.isEndOfDay && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Cash on Hand</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatCurrency(reconciliation.cashOnHand || 0)}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Float Returned</p>
                  <p className="text-xl font-bold text-purple-600">
                    {formatCurrency(reconciliation.floatReturned || 0)}
                  </p>
                </div>
              </div>
            )}

            {/* Balance Status */}
            <div
              className={`p-4 rounded-lg border-2 ${
                reconciliation.isBalanced
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {reconciliation.isBalanced ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <p className="font-semibold text-gray-900">
                  {reconciliation.isBalanced ? "Balanced" : "Unbalanced"}
                </p>
              </div>
              <p className="text-sm text-gray-700">
                {reconciliation.isBalanced
                  ? "The reconciliation is within acceptable tolerance (±1,000 UGX)"
                  : `There is a variance of ${formatCurrency(
                      Math.abs(reconciliation.difference)
                    )} that needs to be reviewed`}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Timeline
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Submitted</p>
                <p className="text-sm text-gray-600">
                  {formatISODate(reconciliation.reconciliationDate.toString())}{" "}
                  at {formatTime(reconciliation.reconciliationDate)}
                </p>
                <p className="text-sm text-gray-500">
                  By {reconciliation.reconciledByUser.name}
                </p>
              </div>
            </div>

            {reconciliation.approvalDate && (
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-full ${
                    reconciliation.status === ReconciliationStatus.APPROVED
                      ? "bg-green-100"
                      : "bg-red-100"
                  }`}
                >
                  {reconciliation.status === ReconciliationStatus.APPROVED ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {reconciliation.status === ReconciliationStatus.APPROVED
                      ? "Approved"
                      : "Rejected"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatISODate(reconciliation.approvalDate.toString())} at{" "}
                    {formatTime(reconciliation.approvalDate)}
                  </p>
                  {reconciliation.approvedBy && (
                    <p className="text-sm text-gray-500">
                      By {reconciliation.approvedBy.name}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {(reconciliation.notes || reconciliation.rejectionReason) && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              Notes
            </h2>
            {reconciliation.notes && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Teller Notes:
                </p>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  {reconciliation.notes}
                </p>
              </div>
            )}
            {reconciliation.rejectionReason && (
              <div>
                <p className="text-sm font-medium text-red-700 mb-1">
                  Rejection Reason:
                </p>
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded">
                  {reconciliation.rejectionReason}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {canApproveOrReject && !showRejectForm && !showApprovalForm && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Actions
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setShowApprovalForm(true)}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve Reconciliation
              </Button>
              <Button
                onClick={() => setShowRejectForm(true)}
                disabled={isProcessing}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject Reconciliation
              </Button>
            </div>

            {!reconciliation.isBalanced && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900">
                      Warning: Unbalanced Reconciliation
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Approving will adjust the float balance by{" "}
                      {formatCurrency(Math.abs(reconciliation.difference))}.
                      Please verify all details before approving.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Approval Form */}
        {showApprovalForm && canApproveOrReject && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Approve Reconciliation
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="approvalNotes" className="text-sm font-medium">
                  Approval Notes (Optional)
                </Label>
                <Textarea
                  id="approvalNotes"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add any additional notes for this approval..."
                  className="mt-1 min-h-[100px]"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isProcessing ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm Approval
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowApprovalForm(false);
                    setApprovalNotes("");
                  }}
                  disabled={isProcessing}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Form */}
        {showRejectForm && canApproveOrReject && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Reject Reconciliation
            </h2>
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="rejectionReason"
                  className="text-sm font-medium"
                >
                  Rejection Reason *
                </Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide a clear reason for rejection..."
                  className="mt-1 min-h-[100px]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be sent to the teller for review
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleReject}
                  disabled={isProcessing || !rejectionReason.trim()}
                  variant="destructive"
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Confirm Rejection
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason("");
                  }}
                  disabled={isProcessing}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
