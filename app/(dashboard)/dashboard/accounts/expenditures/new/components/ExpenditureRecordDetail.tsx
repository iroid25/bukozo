// app/dashboard/expenditure/[id]/components/ExpenditureRecordDetail.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  Calendar,
  User,
  Building,
  FileText,
  Receipt,
  MapPin,
  ArrowLeft,
  Edit,
  Printer,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import axios from "axios";

import {
  CategoryKind,
  PaymentMethod,
  TransactionStatus,
  RecognitionBasis,
  UserRole,
} from "@prisma/client";


interface ExpenditureRecord {
  id: string;
  amount: number;
  recordDate: string | Date;
  description: string | null;
  payee: string | null;
  paymentMethod: string | PaymentMethod;
  voucherNo: string | null;
  externalRef: string | null;
  status: string | TransactionStatus;
  basis: string | null; // ✅ Fixed: Changed from string to string | null
  recognitionBasis?: string | RecognitionBasis; // ✅ Added: Alternative field from schema
  category?: {
    id: string;
    name: string;
    code: string | null;
    kind: string | CategoryKind;
  } | null;
  branch?: {
    id: string;
    name: string;
    location: string;
  } | null;
  submittedBy?: {
    id: string;
    name: string;
    role: string | UserRole;
    email: string | null;
  } | null;
  approvedBy?: {
    id: string;
    name: string;
    role: string | UserRole;
    email: string | null;
  } | null;
  period?: {
    name: string;
    startDate: string | Date;
    endDate: string | Date;
  } | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  approvedAt?: string | Date | null;
  rejectionReason?: string | null;
}

interface ExpenditureRecordDetailProps {
  expenditureRecord: ExpenditureRecord;
  userRole: string;
  userId: string;
}

export default function ExpenditureRecordDetail({
  expenditureRecord,
  userRole,
  userId,
}: ExpenditureRecordDetailProps) {
  const router = useRouter();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (date: string | Date) => {
    return format(new Date(date), "PPP");
  };

  // Handle print
  const handlePrint = () => {
    setIsPrinting(true);
    window.print();
    setIsPrinting(false);
  };

  // Handle approve
  const handleApprove = async () => {
    try {
      setIsApproving(true);
      const response = await axios.post(`/api/v1/expenditure/${expenditureRecord.id}/approve`, {
        status: "COMPLETED",
      });

      if (response.data.success) {
        toast.success("Expenditure approved successfully!");
        router.push("/dashboard/accounts/expenditures");
        router.refresh();
      }
    } catch (error: any) {
      console.error("Failed to approve expenditure:", error);
      const errorMessage = error.response?.data?.error || "Failed to approve expenditure";
      toast.error(errorMessage);
    } finally {
      setIsApproving(false);
    }
  };

  // Handle reject
  const handleReject = async () => {
    const reason = prompt("Please enter reason for rejection:");
    if (!reason) return;

    try {
      setIsApproving(true);
      const response = await axios.post(`/api/v1/expenditure/${expenditureRecord.id}/approve`, {
        status: "FAILED",
        rejectionReason: reason,
      });

      if (response.data.success) {
        toast.success("Expenditure rejected!");
        router.push("/dashboard/accounts/expenditures");
        router.refresh();
      }
    } catch (error: any) {
      console.error("Failed to reject expenditure:", error);
      const errorMessage = error.response?.data?.error || "Failed to reject expenditure";
      toast.error(errorMessage);
    } finally {
      setIsApproving(false);
    }
  };

  // Handle edit
  const handleEdit = () => {
    router.push(`/dashboard/accounts/expenditures/${expenditureRecord.id}/edit`);
  };

  // Get status icon and color
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          color: "bg-green-100 text-green-800",
          label: "Approved",
        };
      case "PENDING":
        return {
          icon: <Clock className="h-4 w-4" />,
          color: "bg-yellow-100 text-yellow-800",
          label: "Pending Approval",
        };
      case "FAILED":
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: "bg-red-100 text-red-800",
          label: "Rejected",
        };
      default:
        return {
          icon: <Clock className="h-4 w-4" />,
          color: "bg-gray-100 text-gray-800",
          label: status,
        };
    }
  };

  const statusInfo = getStatusInfo(expenditureRecord.status);
  const normalizedRole = userRole.toUpperCase();
  const canApprove =
    (normalizedRole === "ADMIN" || normalizedRole === "ACCOUNTANT" || normalizedRole === "BRANCHMANAGER" || normalizedRole === "BRANCH_MANAGER") &&
    (expenditureRecord.status === "PENDING" || expenditureRecord.status === "APPROVED");

  // ✅ Get recognition basis (use basis field or recognitionBasis, fallback to "CASH")
  const recognitionBasis =
    expenditureRecord.basis || expenditureRecord.recognitionBasis || "CASH";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Expenditure Record Details
            </h1>
            <p className="text-muted-foreground">
              {expenditureRecord.voucherNo ||
                `Record #${expenditureRecord.id.slice(0, 8)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canApprove && (
            <>
              <Button
                variant="default"
                size="sm"
                className="gap-2 bg-green-600 hover:bg-green-700"
                onClick={handleApprove}
                disabled={isApproving}
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={handleReject}
                disabled={isApproving}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          {(normalizedRole === "ADMIN" || normalizedRole === "ACCOUNTANT" || normalizedRole === "BRANCHMANAGER") && 
           (expenditureRecord.status === "PENDING" || expenditureRecord.status === "APPROVED") && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleEdit}>
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handlePrint}
            disabled={isPrinting}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Main Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Transaction Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Transaction Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Amount */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-4xl font-bold text-red-600">
                  {formatCurrency(expenditureRecord.amount)}
                </p>
              </div>

              <Separator />

              {/* Category & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Category</p>
                  <div>
                    <p className="font-medium">
                      {expenditureRecord.category?.name || "Uncategorized"}
                    </p>
                    {expenditureRecord.category?.code && (
                      <p className="text-sm text-muted-foreground">
                        Code: {expenditureRecord.category.code}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    className={`${statusInfo.color} flex w-fit items-center gap-1`}
                  >
                    {statusInfo.icon}
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>

              {/* Date and Basis */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Transaction Date
                  </p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">
                      {formatDate(expenditureRecord.recordDate)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Recognition Basis
                  </p>
                  <Badge variant="outline">{recognitionBasis}</Badge>
                </div>
              </div>

              {/* Payee & Payment Method */}
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Payee</p>
                  <p className="font-medium">
                    {expenditureRecord.payee || (
                      <span className="text-muted-foreground">
                        Not specified
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Payment Method
                  </p>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">
                      {expenditureRecord.paymentMethod}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Description */}
              {expenditureRecord.description && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{expenditureRecord.description}</p>
                  </div>
                </>
              )}

              {/* Rejection Reason */}
              {expenditureRecord.status === "FAILED" &&
                expenditureRecord.rejectionReason && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground text-red-600">
                        Rejection Reason
                      </p>
                      <p className="text-sm p-3 bg-red-50 border border-red-200 rounded-md">
                        {expenditureRecord.rejectionReason}
                      </p>
                    </div>
                  </>
                )}
            </CardContent>
          </Card>

          {/* Submitted By & Approved By */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personnel Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {expenditureRecord.submittedBy && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Submitted By</p>
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Name:
                      </span>
                      <span className="font-medium">
                        {expenditureRecord.submittedBy.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Role:
                      </span>
                      <Badge variant="secondary">
                        {expenditureRecord.submittedBy.role}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Email:
                      </span>
                      <span className="font-medium">
                        {expenditureRecord.submittedBy.email}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {expenditureRecord.approvedBy && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Approved By</p>
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Name:
                      </span>
                      <span className="font-medium">
                        {expenditureRecord.approvedBy.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Role:
                      </span>
                      <Badge variant="secondary">
                        {expenditureRecord.approvedBy.role}
                      </Badge>
                    </div>
                    {expenditureRecord.approvedAt && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Approved On:
                        </span>
                        <span className="font-medium">
                          {formatDate(expenditureRecord.approvedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Additional Info */}
        <div className="space-y-6">
          {/* References */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                References
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Voucher Number</p>
                <p className="font-mono text-sm font-medium">
                  {expenditureRecord.voucherNo || (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </p>
              </div>

              {expenditureRecord.externalRef && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    External Reference
                  </p>
                  <p className="font-mono text-sm font-medium">
                    {expenditureRecord.externalRef}
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Record ID</p>
                <p className="font-mono text-xs text-muted-foreground break-all">
                  {expenditureRecord.id}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Branch Information */}
          {expenditureRecord.branch && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Branch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="font-medium">{expenditureRecord.branch.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {expenditureRecord.branch.location}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Period Information */}
          {expenditureRecord.period && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Financial Period
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="font-medium">{expenditureRecord.period.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(expenditureRecord.period.startDate)} -{" "}
                    {formatDate(expenditureRecord.period.endDate)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          {(expenditureRecord.createdAt || expenditureRecord.updatedAt) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {expenditureRecord.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">
                      {formatDate(expenditureRecord.createdAt)}
                    </span>
                  </div>
                )}
                {expenditureRecord.updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span className="font-medium">
                      {formatDate(expenditureRecord.updatedAt)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
