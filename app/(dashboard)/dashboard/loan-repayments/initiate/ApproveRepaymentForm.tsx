// FILE: app/approve-repayment/ApproveRepaymentForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Shield, AlertTriangle } from "lucide-react";

export default function ApproveRepaymentForm({ request }: { request: any }) {
  const router = useRouter();
  const [verificationCode, setVerificationCode] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);

  const handleApprove = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    setIsApproving(true);

    try {
      const response = await fetch("/api/v1/loanRepaymentRequests/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: request.approvalToken,
          verificationCode: verificationCode,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Repayment approved successfully!");
        setTimeout(() => router.push("/dashboard/my-loans"), 2000);
      } else {
        toast.error(result.error || "Failed to approve repayment");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsRejecting(true);

    try {
      const response = await fetch("/api/v1/loanRepaymentRequests/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: request.approvalToken,
          reason: rejectionReason,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Repayment request rejected");
        setTimeout(() => router.push("/dashboard/my-loans"), 2000);
      } else {
        toast.error(result.error || "Failed to reject request");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              Loan Repayment Approval Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Request Details */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold mb-3 text-blue-900">
                Repayment Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Loan Product:</span>
                  <span className="font-medium">
                    {request.loan.loanApplication.loanProduct.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Repayment Amount:</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(request.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">From Account:</span>
                  <span className="font-medium">
                    {request.account.accountNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Account Balance:</span>
                  <span className="font-medium">
                    {formatCurrency(request.account.balance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Outstanding Loan:</span>
                  <span className="font-medium">
                    {formatCurrency(request.loan.outstandingBalance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Requested By:</span>
                  <span className="font-medium">
                    {request.requestedBy.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Requested At:</span>
                  <span className="font-medium">
                    {new Date(request.requestedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {!showRejectForm ? (
              <>
                {/* Verification Code Input */}
                <div className="space-y-2">
                  <Label htmlFor="code">
                    Enter Verification Code
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.replace(/\D/g, ""))
                    }
                    maxLength={6}
                    className="text-center text-2xl tracking-widest font-bold"
                  />
                  <p className="text-xs text-gray-500">
                    Check your email or SMS for the verification code
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleApprove}
                    disabled={isApproving || verificationCode.length !== 6}
                    className="flex-1"
                  >
                    {isApproving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve Repayment
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectForm(true)}
                    disabled={isApproving}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Rejection Form */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">
                      Reason for Rejection
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Textarea
                      id="reason"
                      placeholder="Please explain why you're rejecting this request..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectForm(false)}
                      disabled={isRejecting}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={isRejecting || !rejectionReason.trim()}
                      className="flex-1"
                    >
                      {isRejecting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        "Confirm Rejection"
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Important:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      This request will expire on{" "}
                      {new Date(request.expiresAt).toLocaleString()}
                    </li>
                    <li>
                      {formatCurrency(request.amount)} will be deducted from
                      your account
                    </li>
                    <li>Transaction cannot be reversed after approval</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
