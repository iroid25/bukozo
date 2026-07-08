"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  ArrowLeft,
  User,
  CreditCard,
  DollarSign,
  Calendar,
  FileText,
  Calculator,
  Smartphone,
  Building,
  Phone,
  Mail,
  Clock,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

import {
  LoanRepayment,
  getChannelInfo,
  formatPaymentReference,
  getLoanStatusFromBalance,
  calculateRepaymentImpact,
} from "@/types/loanRepayment";
import axios from "axios";
import TextInput from "@/components/FormInputs/TextInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import { useForm } from "react-hook-form";
import { cn, formatISODate } from "@/lib/utils";

interface Props {
  loanRepayment: any;
  userRole: string;
  currentUserId: string;
}

export default function LoanRepaymentDetail({
  loanRepayment,
  userRole,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const channelInfo = getChannelInfo(loanRepayment.channel);
  const loanStatus = getLoanStatusFromBalance(
    loanRepayment.loan.outstandingBalance,
    loanRepayment.loan.dueDate
  );

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Check if can edit/delete (within 24 hours)
  const canModify = () => {
    const hoursSincePayment =
      (Date.now() - new Date(loanRepayment.repaymentDate).getTime()) / (1000 * 60 * 60);
    const isHandler = loanRepayment.handlerUserId === currentUserId;
    const isAdmin = userRole === "ADMIN";

    return hoursSincePayment <= 24 && (isHandler || isAdmin);
  };

  // Form for editing repayment
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
    watch: watchEdit,
  } = useForm({
    defaultValues: {
      amount: loanRepayment.amount,
      channel: loanRepayment.channel,
      mobileMoneyRef: loanRepayment.mobileMoneyRef || "",
    },
  });

  const watchedEditValues = watchEdit();

  // Handle edit repayment
  const handleEditRepayment = async (data: {
    amount: number;
    channel: string;
    mobileMoneyRef: string;
  }) => {
    try {
      setLoading(true);

      const response = await axios.patch(`/api/v1/loan-repayments/${loanRepayment.id}`, {
        amount: Number(data.amount),
        channel: data.channel,
        mobileMoneyRef:
          data.channel === "Mobile Money"
            ? data.mobileMoneyRef.trim()
            : undefined,
      });

      if (!response.data.success) {
        toast.error("Failed to update repayment", {
          description: response.data.error,
        });
        return;
      }

      toast.success("Repayment updated successfully");
      setEditMode(false);
      router.refresh();
    } catch (error: any) {
      toast.error("Something went wrong", {
        description: error.response?.data?.error || "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle delete repayment
  const handleDeleteRepayment = async () => {
    try {
      setLoading(true);

      const response = await axios.delete(`/api/v1/loan-repayments/${loanRepayment.id}`);

      if (!response.data.success) {
        toast.error("Failed to delete repayment", {
          description: response.data.error,
        });
        return;
      }

      toast.success("Repayment deleted successfully");
      setDeleteDialogOpen(false);
      router.push("/dashboard/loan-repayments");
    } catch (error: any) {
      toast.error("Something went wrong", {
        description: error.response?.data?.error || "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate impact of edited amount
  const getEditImpact = () => {
    if (!editMode || !watchedEditValues.amount) return null;

    const originalAmount = loanRepayment.amount;
    const newAmount = Number(watchedEditValues.amount);
    const amountDifference = newAmount - originalAmount;
    const currentBalance = loanRepayment.loan.outstandingBalance;
    const newBalance = Math.max(0, currentBalance + amountDifference);

    return {
      originalAmount,
      newAmount,
      amountDifference,
      newBalance,
      isIncrease: amountDifference > 0,
    };
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Loan Repayment Details</h1>
            <p className="text-gray-600">Payment ID: {loanRepayment.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge className={`${channelInfo.color} text-base px-3 py-1`}>
            {channelInfo.icon} {channelInfo.label}
          </Badge>

          {canModify() && (
            <div className="flex gap-2">
              {!editMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditMode(true);
                    resetEdit({
                      amount: loanRepayment.amount,
                      channel: loanRepayment.channel,
                      mobileMoneyRef: loanRepayment.mobileMoneyRef || "",
                    });
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {editMode ? (
                <form
                  onSubmit={handleSubmitEdit(handleEditRepayment)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                      register={registerEdit}
                      errors={editErrors}
                      label="Payment Amount"
                      name="amount"
                      type="number"
                      icon={DollarSign}
                    />

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Payment Channel
                      </label>
                      <select
                        {...registerEdit("channel")}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Mobile Money">Mobile Money</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Check">Check</option>
                      </select>
                    </div>
                  </div>

                  {watchedEditValues.channel === "Mobile Money" && (
                    <TextInput
                      register={registerEdit}
                      errors={editErrors}
                      label="Mobile Money Reference"
                      name="mobileMoneyRef"
                      icon={Smartphone}
                    />
                  )}

                  {getEditImpact() && (
                    <div className="p-4 bg-blue-50 rounded-lg border">
                      <h4 className="font-medium text-blue-900 mb-2">
                        Edit Impact
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">
                            Original Amount:
                          </span>
                          <p className="font-medium">
                            {formatCurrency(getEditImpact()!.originalAmount)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">New Amount:</span>
                          <p className="font-medium text-blue-600">
                            {formatCurrency(getEditImpact()!.newAmount)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Difference:</span>
                          <p
                            className={`font-medium ${
                              getEditImpact()!.isIncrease
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {getEditImpact()!.isIncrease ? "+" : ""}
                            {formatCurrency(getEditImpact()!.amountDifference)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">
                            New Loan Balance:
                          </span>
                          <p className="font-medium text-purple-600">
                            {formatCurrency(getEditImpact()!.newBalance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <SubmitButton title="Save Changes" loading={loading} />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Payment Amount
                        </label>
                        <p className="text-3xl font-bold text-green-600">
                          {formatCurrency(loanRepayment.amount)}
                        </p>
                      </div>

                      <div className="pt-2">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">
                          Payment Breakdown
                        </label>
                        <div className="space-y-2 text-sm bg-gray-50 p-3 rounded-md border border-gray-100">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Principal:</span>
                            <span className="font-medium">{formatCurrency(loanRepayment.principalPaid || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Interest:</span>
                            <span className="font-medium text-blue-600">{formatCurrency(loanRepayment.interestPaid || 0)}</span>
                          </div>
                          {(loanRepayment.penaltyPaid || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Penalty:</span>
                              <span className="font-medium text-red-600">{formatCurrency(loanRepayment.penaltyPaid || 0)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="text-sm font-medium text-gray-500">
                          Payment Date & Time
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="font-medium">
                              {formatISODate(loanRepayment.repaymentDate)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(
                                loanRepayment.repaymentDate
                              ).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Payment Channel
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-lg">{channelInfo.icon}</span>
                          <p className="font-medium">{channelInfo.label}</p>
                        </div>
                      </div>

                      {loanRepayment.mobileMoneyRef && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Reference Number
                          </label>
                          <div className="flex items-center gap-2 mt-1">
                            <Smartphone className="h-4 w-4 text-gray-400" />
                            <p className="font-mono text-gray-800">
                              {loanRepayment.mobileMoneyRef}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Loan Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Related Loan Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Loan Product
                    </label>
                    <p className="font-medium">
                      {loanRepayment.loan.loanApplication.loanProduct.name}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Amount Granted
                    </label>
                    <p className="font-medium text-lg">
                      {formatCurrency(loanRepayment.loan.amountGranted)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Interest Rate
                    </label>
                    <p className="font-medium">
                      {
                        loanRepayment.loan.loanApplication.loanProduct
                          .interestRate
                      }
                      % per annum
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Current Status
                    </label>
                    <Badge className={loanStatus.color}>
                      {loanStatus.icon} {loanStatus.label}
                    </Badge>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Outstanding Balance
                    </label>
                    <p className="font-medium text-lg text-red-600">
                      {formatCurrency(loanRepayment.loan.outstandingBalance)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Due Date
                    </label>
                    <p className="font-medium">
                      {formatISODate(loanRepayment.loan.dueDate)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          {loanRepayment.loan.repayments.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Other Payments for this Loan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loanRepayment.loan.repayments
                    .filter((payment: any) => payment.id !== loanRepayment.id)
                    .slice(0, 5)
                    .map((payment: any) => (
                      <div
                        key={payment.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded border"
                      >
                        <div>
                          <p className="font-medium">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-sm text-gray-500">
                            by {payment.handler.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            {formatISODate(payment.repaymentDate)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(
                              payment.repaymentDate
                            ).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Member Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Member Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                  {loanRepayment.loan.member.user.image ? (
                    <img
                      src={loanRepayment.loan.member.user.image}
                      alt={loanRepayment.loan.member.user.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-gray-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {loanRepayment.loan.member.user.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    #{loanRepayment.loan.member.memberNumber}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                {loanRepayment.loan.member.user.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      {loanRepayment.loan.member.user.email}
                    </span>
                  </div>
                )}

                {loanRepayment.loan.member.user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      {loanRepayment.loan.member.user.phone}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Processing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Processing Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Processed by
                </label>
                <p className="font-medium">{loanRepayment.handler.name}</p>
                <p className="text-sm text-gray-500">
                  {loanRepayment.handler.role}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  Payment Reference
                </label>
                <p className="font-mono text-sm">
                  {formatPaymentReference(
                    loanRepayment.channel,
                    loanRepayment.mobileMoneyRef
                  )}
                </p>
              </div>

              {canModify() && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">Modification Window</p>
                      <p>
                        This payment can be edited or deleted within 24 hours of
                        creation.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Loan Repayment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this payment? This action will
              revert the loan balance and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Warning:</p>
                  <p>
                    Deleting this payment of{" "}
                    {formatCurrency(loanRepayment.amount)} will increase the
                    loan balance back to{" "}
                    {formatCurrency(
                      loanRepayment.loan.outstandingBalance +
                        loanRepayment.amount
                    )}
                    .
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteRepayment}
                disabled={loading}
              >
                {loading ? "Deleting..." : "Delete Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
