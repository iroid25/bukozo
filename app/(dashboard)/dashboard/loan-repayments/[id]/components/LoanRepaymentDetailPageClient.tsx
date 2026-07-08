// app/dashboard/loan-repayments/[id]/components/LoanRepaymentDetail.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  DollarSign,
  User,
  CreditCard,
  Calendar,
  Building,
  Phone,
  Mail,
  FileText,
  Trash2,
  Edit,
  CheckCircle,
  TrendingDown,
  Wallet,
  MapPin,
  Clock,
} from "lucide-react";
import axios from "axios";
import { formatISODate } from "@/lib/utils";

interface LoanRepaymentDetailProps {
  repayment: any;
  userRole: string;
  currentUserId: string;
}

export default function LoanRepaymentDetail({
  repayment,
  userRole,
  currentUserId,
}: LoanRepaymentDetailProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get channel badge color
  const getChannelColor = (channel: string) => {
    const colors: { [key: string]: string } = {
      "Mobile Money": "bg-purple-100 text-purple-800",
      Cash: "bg-green-100 text-green-800",
      "Bank Transfer": "bg-blue-100 text-blue-800",
      Cheque: "bg-orange-100 text-orange-800",
    };
    return colors[channel] || "bg-gray-100 text-gray-800";
  };

  // Get loan status badge color
  const getLoanStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      DISBURSED: "bg-blue-100 text-blue-800",
      REPAID: "bg-green-100 text-green-800",
      OVERDUE: "bg-red-100 text-red-800",
      REJECTED: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  // Check if user can delete (within 24 hours and is handler or admin)
  const canDelete = () => {
    const hoursSincePayment =
      (Date.now() - new Date(repayment.repaymentDate).getTime()) /
      (1000 * 60 * 60);

    return (
      hoursSincePayment <= 24 &&
      (repayment.handlerUserId === currentUserId ||
        ["ADMIN", "BRANCHMANAGER"].includes(userRole))
    );
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await axios.delete(`/api/v1/loan-repayments/${repayment.id}`);

      if (response.data.success) {
        toast.success("Repayment Deleted", {
          description: "The loan repayment has been successfully deleted.",
        });
        router.push("/dashboard/loan-repayments");
      } else {
        toast.error("Delete Failed", {
          description: response.data.error || "Failed to delete the repayment.",
        });
      }
    } catch (error: any) {
      toast.error("Error", {
        description: error.response?.data?.error || "An unexpected error occurred.",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const loan = repayment.loan;
  const member = loan.member;
  const user = member.user;
  const loanProduct = loan.loanApplication.loanProduct;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Repayment Details</h1>
            <p className="text-gray-500">
              Transaction ID: #{repayment.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canDelete() && (
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Payment Amount
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(repayment.amount)}
            </div>
            <p className="text-xs text-gray-500">
              Paid on {formatISODate(repayment.repaymentDate)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Outstanding Balance
            </CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(loan.outstandingBalance)}
            </div>
            <p className="text-xs text-gray-500">
              Remaining after this payment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loan Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <Badge className={getLoanStatusColor(loan.status)}>
              {loan.status}
            </Badge>
            <p className="text-xs text-gray-500 mt-2">
              {loan.status === "REPAID"
                ? "Loan fully paid"
                : `${((loan.amountPaid / loan.totalAmountDue) * 100).toFixed(1)}% paid`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-green-600" />
              Payment Information
            </CardTitle>
            <CardDescription>
              Details about this loan repayment transaction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Repayment ID
                  </label>
                  <p className="text-base font-medium mt-1">
                    #{repayment.id.slice(0, 12)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Payment Amount
                  </label>
                  <p className="text-base font-bold text-green-700 mt-1">
                    {formatCurrency(repayment.amount)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Payment Date
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p className="text-base font-medium">
                      {formatISODate(repayment.repaymentDate)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Payment Channel
                  </label>
                  <div className="mt-1">
                    <Badge className={getChannelColor(repayment.channel)}>
                      {repayment.channel}
                    </Badge>
                  </div>
                </div>
                {repayment.mobileMoneyRef && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Mobile Money Reference
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <p className="text-base font-mono">
                        {repayment.mobileMoneyRef}
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Processed By
                  </label>
                  <p className="text-base font-medium mt-1">
                    {repayment.handler.name}
                  </p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {repayment.handler.role}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-3">Payment Impact</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Previous Balance</p>
                  <p className="text-lg font-bold text-blue-700">
                    {formatCurrency(loan.outstandingBalance + repayment.amount)}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Payment Amount</p>
                  <p className="text-lg font-bold text-green-700">
                    -{formatCurrency(repayment.amount)}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">New Balance</p>
                  <p className="text-lg font-bold text-purple-700">
                    {formatCurrency(loan.outstandingBalance)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Member & Loan Info */}
        <div className="space-y-6">
          {/* Member Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Member Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-sm text-gray-500">
                    #{member.memberNumber}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{user.phone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Loan Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-600" />
                Loan Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Loan Product
                </label>
                <p className="text-base font-semibold mt-1">
                  {loanProduct.name}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Interest Rate
                </label>
                <p className="text-base font-medium mt-1">
                  {loanProduct.interestRate}% per annum
                </p>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Amount Granted
                </label>
                <p className="text-base font-bold text-blue-700 mt-1">
                  {formatCurrency(loan.amountGranted)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Total Due
                </label>
                <p className="text-base font-bold text-red-700 mt-1">
                  {formatCurrency(loan.totalAmountDue)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Amount Paid
                </label>
                <p className="text-base font-bold text-green-700 mt-1">
                  {formatCurrency(loan.amountPaid)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Outstanding Balance
                </label>
                <p className="text-base font-bold text-orange-700 mt-1">
                  {formatCurrency(loan.outstandingBalance)}
                </p>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Due Date
                </label>
                <p className="text-base font-medium mt-1">
                  {formatISODate(loan.dueDate)}
                </p>
              </div>
              {loan.branch && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Branch
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span className="text-base font-medium">
                      {loan.branch.name}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Loan Repayment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this loan repayment? This action
              will reverse the payment and update the loan balance. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
