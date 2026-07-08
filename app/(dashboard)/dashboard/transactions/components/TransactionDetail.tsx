// app/dashboard/transactions/components/TransactionDetail.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  User,
  Building2,
  CreditCard,
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getTransactionTypeInfo,
  getTransactionStatusInfo,
  getTransactionChannelInfo,
  canReverseTransaction,
} from "@/types/transactions";

export interface TransactionDetailsProps {
  transaction: any; // Using any for flexibility with Prisma types
  relatedData: {
    reversals: any[];
    fees: any[];
    related: any[];
  };
  auditLog: any[];
  accountHistory: any[];
}

export default function TransactionDetails({
  transaction,
  relatedData,
  auditLog,
  accountHistory,
}: TransactionDetailsProps) {
  const router = useRouter();
  const [isReversing, setIsReversing] = useState(false);

  const typeInfo = getTransactionTypeInfo(transaction.type);
  const statusInfo = getTransactionStatusInfo(transaction.status);
  const channelInfo = getTransactionChannelInfo(
    transaction.channel || transaction.paymentMethod
  );

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (date: Date | string) => {
    return format(new Date(date), "PPpp");
  };

  // Get owner info (member or institution)
  const getOwnerInfo = () => {
    if (transaction.member) {
      return {
        type: "Member",
        name: transaction.member.user.name,
        number: transaction.member.memberNumber,
        email: transaction.member.user.email,
        phone: transaction.member.user.phone,
        image: transaction.member.user.image,
      };
    } else if (transaction.institution) {
      return {
        type: "Institution",
        name: transaction.institution.institutionName,
        number: transaction.institution.institutionNumber,
        email: transaction.institution.institutionEmail,
        phone: transaction.institution.institutionPhone,
        image: null,
      };
    }
    return null;
  };

  const ownerInfo = getOwnerInfo();

  const handleDownloadReceipt = () => {
    window.location.href = `/api/v1/transactions/${transaction.id}/receipt`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Transaction Details</h1>
            <p className="text-gray-500 text-sm">
              Reference: {transaction.transactionRef}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handleDownloadReceipt}
          >
            <Download className="h-4 w-4" />
            Download Receipt
          </Button>

          {canReverseTransaction(transaction, "ADMIN", "") && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              disabled={isReversing}
            >
              <RotateCcw className="h-4 w-4" />
              Reverse Transaction
            </Button>
          )}
        </div>
      </div>

      {/* Main Transaction Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Transaction Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Transaction Type</p>
                  <Badge className={`mt-1 ${typeInfo.color}`}>
                    {typeInfo.icon} {typeInfo.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge className={`mt-1 ${statusInfo.color}`}>
                    {statusInfo.icon} {statusInfo.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(transaction.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Channel</p>
                  <Badge className={`mt-1 ${channelInfo.color}`}>
                    {channelInfo.icon} {channelInfo.label}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Transaction Date</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">
                      {formatDate(transaction.transactionDate)}
                    </span>
                  </div>
                </div>
                {transaction.valueDate && (
                  <div>
                    <p className="text-sm text-gray-500">Value Date</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">
                        {formatDate(transaction.valueDate)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {transaction.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-gray-500">Description</p>
                    <p className="mt-1">{transaction.description}</p>
                  </div>
                </>
              )}

              {(transaction.paymentReference ||
                transaction.externalReference) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    {transaction.paymentReference && (
                      <div>
                        <p className="text-sm text-gray-500">
                          Payment Reference
                        </p>
                        <p className="mt-1 font-mono text-sm">
                          {transaction.paymentReference}
                        </p>
                      </div>
                    )}
                    {transaction.externalReference && (
                      <div>
                        <p className="text-sm text-gray-500">
                          External Reference
                        </p>
                        <p className="mt-1 font-mono text-sm">
                          {transaction.externalReference}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Account Number</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">
                      {transaction.account.accountNumber}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Account Type</p>
                  <p className="mt-1 font-medium">
                    {transaction.account.accountType.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Balance</p>
                  <p className="mt-1 font-medium text-lg">
                    {formatCurrency(transaction.account.balance)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Branch</p>
                  <p className="mt-1 font-medium">
                    {transaction.account.branch.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {transaction.account.branch.location}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Owner Information */}
          {ownerInfo && (
            <Card>
              <CardHeader>
                <CardTitle>{ownerInfo.type} Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={ownerInfo.image || undefined} />
                    <AvatarFallback>
                      {ownerInfo.type === "Member" ? (
                        <User className="h-8 w-8" />
                      ) : (
                        <Building2 className="h-8 w-8" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-lg">{ownerInfo.name}</p>
                    <p className="text-sm text-gray-500">
                      {ownerInfo.type} #{ownerInfo.number}
                    </p>
                  </div>
                  <Badge variant="outline">{ownerInfo.type}</Badge>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="mt-1">{ownerInfo.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="mt-1">{ownerInfo.phone || "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Information */}
          <Card>
            <CardHeader>
              <CardTitle>Processing Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {transaction.processedByUser && (
                <div>
                  <p className="text-sm text-gray-500">Processed By</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Avatar>
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {transaction.processedByUser.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {transaction.processedByUser.role}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {transaction.deposit && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-gray-500">Deposit Handler</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Avatar>
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {transaction.deposit.handler.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {transaction.deposit.handler.role}
                        </p>
                      </div>
                    </div>
                    {transaction.deposit.mobileMoneyRef && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Mobile Money Reference
                        </p>
                        <p className="mt-1 font-mono text-sm">
                          {transaction.deposit.mobileMoneyRef}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {transaction.withdrawal && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-gray-500">Withdrawal Handler</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Avatar>
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {transaction.withdrawal.handler.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {transaction.withdrawal.handler.role}
                        </p>
                      </div>
                    </div>
                    {transaction.withdrawal.mobileMoneyRef && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Mobile Money Reference
                        </p>
                        <p className="mt-1 font-mono text-sm">
                          {transaction.withdrawal.mobileMoneyRef}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Additional Info */}
        <div className="space-y-6">
          {/* Related Transactions */}
          {(relatedData.reversals.length > 0 ||
            relatedData.fees.length > 0 ||
            relatedData.related.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Related Transactions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {relatedData.reversals.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-600 mb-2">
                      Reversals
                    </p>
                    {relatedData.reversals.map((reversal) => (
                      <div
                        key={reversal.id}
                        className="p-3 bg-red-50 rounded-lg mb-2"
                      >
                        <p className="text-sm font-medium">
                          {reversal.transactionRef}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(reversal.transactionDate)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {relatedData.fees.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-orange-600 mb-2">
                      Fees
                    </p>
                    {relatedData.fees.map((fee) => (
                      <div
                        key={fee.id}
                        className="p-3 bg-orange-50 rounded-lg mb-2"
                      >
                        <p className="text-sm font-medium">
                          {formatCurrency(fee.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {fee.description || "Transaction fee"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {relatedData.related.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-2">
                      Related
                    </p>
                    {relatedData.related.map((related) => (
                      <div
                        key={related.id}
                        className="p-3 bg-blue-50 rounded-lg mb-2 cursor-pointer hover:bg-blue-100"
                        onClick={() =>
                          router.push(`/dashboard/transactions/${related.id}`)
                        }
                      >
                        <p className="text-sm font-medium">
                          {related.transactionRef}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(related.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Audit Log */}
          {auditLog.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {auditLog.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="text-xs text-gray-500">
                        by {log.user.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(log.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Account History */}
          {accountHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Account Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {accountHistory.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    onClick={() =>
                      router.push(`/dashboard/transactions/${tx.id}`)
                    }
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.transactionRef}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getTransactionTypeInfo(tx.type).label}
                        </p>
                      </div>
                      <p
                        className={`text-sm font-medium ${
                          tx.type === "DEPOSIT"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {tx.type === "DEPOSIT" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(tx.transactionDate)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
