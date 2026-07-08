// app/dashboard/income/[id]/components/IncomeRecordDetail.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  CreditCard,
  MapPin,
  ArrowLeft,
  Edit,
  Printer,
  Download,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";

interface IncomeRecord {
  id: string;
  amount: number;
  recordDate: string | Date;
  description: string | null;
  receiptNo: string | null;
  externalRef: string | null;
  status: string;
  recognitionBasis: string;
  paymentMethod?: string;

  // ✅ Make category optional since it might not exist
  category?: {
    id: string;
    name: string;
    kind: string;
    description?: string | null;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  } | null;

  budgetCategory?: {
    id: string;
    name: string;
    code: string | null;
    kind: string;
  } | null;

  branch?: {
    id: string;
    name: string;
    location: string;
  } | null;
  member?: {
    id: string;
    memberNumber: string;
    user: {
      name: string;
      email: string | null;
      phone: string | null;
    };
  } | null;
  account?: {
    id: string;
    accountNumber: string;
    accountType: {
      name: string;
    };
  } | null;
  receivedBy?: {
    id: string;
    name: string;
    role: string;
    email: string | null;
  } | null;
  period?: {
    name: string;
    startDate: string | Date;
    endDate: string | Date;
  } | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  depositorName?: string | null;
  depositorContact?: string | null;
}

interface IncomeRecordDetailProps {
  incomeRecord: IncomeRecord;
  userRole: string;
}

export default function IncomeRecordDetail({
  incomeRecord,
  userRole,
}: IncomeRecordDetailProps) {
  const router = useRouter();
  const [isPrinting, setIsPrinting] = useState(false);

  // ✅ Get category from either budgetCategory or category (fallback)
  const categoryName =
    incomeRecord.budgetCategory?.name ||
    incomeRecord.category?.name ||
    "Uncategorized";
  const categoryCode = incomeRecord.budgetCategory?.code;

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

  // Get status icon and color
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          color: "bg-green-100 text-green-800",
          label: "Completed",
        };
      case "PENDING":
        return {
          icon: <Clock className="h-4 w-4" />,
          color: "bg-yellow-100 text-yellow-800",
          label: "Pending",
        };
      case "FAILED":
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: "bg-red-100 text-red-800",
          label: "Failed",
        };
      default:
        return {
          icon: <Clock className="h-4 w-4" />,
          color: "bg-gray-100 text-gray-800",
          label: status,
        };
    }
  };

  const statusInfo = getStatusInfo(incomeRecord.status);

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
              Income Record Details
            </h1>
            <p className="text-muted-foreground">
              {incomeRecord.receiptNo ||
                `Record #${incomeRecord.id.slice(0, 8)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(userRole === "ADMIN" || userRole === "ACCOUNTANT") && (
            <Button variant="outline" size="sm" className="gap-2">
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
                <p className="text-4xl font-bold text-green-600">
                  {formatCurrency(incomeRecord.amount)}
                </p>
              </div>

              <Separator />

              {/* Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Category</p>
                  <div>
                    <p className="font-medium">{categoryName}</p>
                    {categoryCode && (
                      <p className="text-sm text-muted-foreground">
                        Code: {categoryCode}
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
                      {formatDate(incomeRecord.recordDate)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Recognition Basis
                  </p>
                  <Badge variant="outline">
                    {incomeRecord.recognitionBasis}
                  </Badge>
                </div>
              </div>

              {/* Payment Method */}
              {incomeRecord.paymentMethod && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Payment Method
                    </p>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">
                        {incomeRecord.paymentMethod}
                      </Badge>
                    </div>
                  </div>
                </>
              )}

              {/* Description */}
              {incomeRecord.description && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{incomeRecord.description}</p>
                  </div>
                </>
              )}

              {/* Depositor Information */}
              {(incomeRecord.depositorName ||
                incomeRecord.depositorContact) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Depositor Information</p>
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                      {incomeRecord.depositorName && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Name:
                          </span>
                          <span className="font-medium">
                            {incomeRecord.depositorName}
                          </span>
                        </div>
                      )}
                      {incomeRecord.depositorContact && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Contact:
                          </span>
                          <span className="font-medium">
                            {incomeRecord.depositorContact}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Member & Account Information */}
          {(incomeRecord.member || incomeRecord.account) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Member & Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {incomeRecord.member && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Member Details</p>
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Name:
                        </span>
                        <span className="font-medium">
                          {incomeRecord.member.user.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Member Number:
                        </span>
                        <span className="font-medium">
                          {incomeRecord.member.memberNumber}
                        </span>
                      </div>
                      {incomeRecord.member.user.email && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Email:
                          </span>
                          <span className="font-medium">
                            {incomeRecord.member.user.email}
                          </span>
                        </div>
                      )}
                      {incomeRecord.member.user.phone && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Phone:
                          </span>
                          <span className="font-medium">
                            {incomeRecord.member.user.phone}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {incomeRecord.account && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Account Details</p>
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Account Number:
                          </span>
                          <span className="font-medium font-mono">
                            {incomeRecord.account.accountNumber}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Type:
                        </span>
                        <span className="font-medium">
                          {incomeRecord.account.accountType.name}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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
                <p className="text-sm text-muted-foreground">Receipt Number</p>
                <p className="font-mono text-sm font-medium">
                  {incomeRecord.receiptNo || (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </p>
              </div>

              {incomeRecord.externalRef && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    External Reference
                  </p>
                  <p className="font-mono text-sm font-medium">
                    {incomeRecord.externalRef}
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Record ID</p>
                <p className="font-mono text-xs text-muted-foreground break-all">
                  {incomeRecord.id}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Branch Information */}
          {incomeRecord.branch && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Branch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="font-medium">{incomeRecord.branch.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {incomeRecord.branch.location}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Period Information */}
          {incomeRecord.period && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Financial Period
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="font-medium">{incomeRecord.period.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(incomeRecord.period.startDate)} -{" "}
                    {formatDate(incomeRecord.period.endDate)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Received By */}
          {incomeRecord.receivedBy && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Received By
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1">
                  <p className="font-medium">{incomeRecord.receivedBy.name}</p>
                  <Badge variant="secondary">
                    {incomeRecord.receivedBy.role}
                  </Badge>
                </div>
                {incomeRecord.receivedBy.email && (
                  <p className="text-sm text-muted-foreground">
                    {incomeRecord.receivedBy.email}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          {(incomeRecord.createdAt || incomeRecord.updatedAt) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {incomeRecord.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">
                      {formatDate(incomeRecord.createdAt)}
                    </span>
                  </div>
                )}
                {incomeRecord.updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span className="font-medium">
                      {formatDate(incomeRecord.updatedAt)}
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
