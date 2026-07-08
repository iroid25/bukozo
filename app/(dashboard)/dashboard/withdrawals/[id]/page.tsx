"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  TrendingDown,
  User,
  CreditCard,
  DollarSign,
  Calendar,
  FileText,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { formatISODate } from "@/lib/utils";
import { getWithdrawalChannelInfo } from "@/types/withdraw";
import PrintReceiptButton from "../../deposits/components/PrintReceiptButton";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);

const getAccountTypeDisplayName = (name: string) => {
  const displayNames: { [key: string]: string } = {
    VOLUNTARY_SAVINGS: "Voluntary Savings",
    FIXED_DEPOSIT: "Fixed Deposit",
    EMERGENCY_SAVINGS: "Emergency Savings",
  };
  return displayNames[name] || name;
};

export default function WithdrawalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [withdrawal, setWithdrawal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/v1/withdrawals/${id}`);
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      setWithdrawal(json.data);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!withdrawal) {
    return (
      <div className="container mx-auto py-12">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
              <TrendingDown className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Withdrawal Not Found</h1>
          <p className="text-gray-600 max-w-md mx-auto">
            The withdrawal transaction you're looking for doesn't exist or may have been removed.
          </p>
          <Link href="/dashboard/withdrawals">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Withdrawals
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!withdrawal.member) {
    return (
      <div className="container mx-auto py-12">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertCircle className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Invalid Withdrawal Data</h1>
          <p className="text-gray-600 max-w-md mx-auto">
            This withdrawal is missing member information. Please contact support.
          </p>
          <Link href="/dashboard/withdrawals">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Withdrawals
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const user = session?.user as any;
  const channelInfo = getWithdrawalChannelInfo(withdrawal.channel);
  const isAdmin = user?.role === "ADMIN";
  const isManager = user?.role === "BRANCHMANAGER";

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/withdrawals">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Withdrawals
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingDown className="h-8 w-8 text-red-600" />
              Withdrawal Details
            </h1>
            <p className="text-gray-600 mt-1">
              Transaction Reference: {withdrawal.transaction.transactionRef}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PrintReceiptButton id={id} prefix="withdrawals" />
          {(isAdmin || isManager) && (
            <>
              <Link href={`/dashboard/members/${withdrawal.memberId}`}>
                <Button variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  View Member
                </Button>
              </Link>
              <Link href={`/dashboard/accounts/${withdrawal.accountId}`}>
                <Button variant="outline" size="sm">
                  <CreditCard className="h-4 w-4 mr-2" />
                  View Account
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-red-600" />
                Transaction Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Transaction Reference:</span>
                    <span className="font-mono font-medium">{withdrawal.transaction.transactionRef}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Withdrawal Amount:</span>
                    <span className="text-2xl font-bold text-red-600">
                      {formatCurrency(withdrawal.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Payment Channel:</span>
                    <Badge className={channelInfo.color}>
                      {channelInfo.icon} {channelInfo.label}
                    </Badge>
                  </div>
                  {withdrawal.mobileMoneyRef && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Mobile Money Ref:</span>
                      <span className="font-mono text-sm">{withdrawal.mobileMoneyRef}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Transaction Status:</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {withdrawal.transaction.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Withdrawal Date:</span>
                    <span className="font-medium">{formatISODate(withdrawal.withdrawalDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Transaction Type:</span>
                    <span className="font-medium text-red-600">WITHDRAWAL</span>
                  </div>
                </div>
              </div>

              {withdrawal.transaction.description && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-600 font-medium">Description:</span>
                    </div>
                    <p className="text-gray-800 bg-gray-50 p-3 rounded-lg">
                      {withdrawal.transaction.description}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Member Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Member Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
                  {withdrawal.member.user?.image ? (
                    <img
                      src={withdrawal.member.user.image}
                      alt={withdrawal.member.user?.name || "Member"}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8" />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {withdrawal.member.user?.name || "Unknown Member"}
                    </h3>
                    <p className="text-gray-600">Member #{withdrawal.member.memberNumber}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Email:</span>
                        <span className="font-medium">{withdrawal.member.user?.email || "N/A"}</span>
                      </div>
                      {withdrawal.member.user?.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Phone:</span>
                          <span className="font-medium">{withdrawal.member.user.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Member Since:</span>
                        <span className="font-medium">{formatISODate(withdrawal.member.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Status:</span>
                        <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-600" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Account Number:</span>
                    <span className="font-mono font-medium">{withdrawal.account.accountNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Account Type:</span>
                    <span className="font-medium">
                      {getAccountTypeDisplayName(withdrawal.account.accountType.name)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Current Balance:</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(withdrawal.account.balance)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Branch:</span>
                    <span className="font-medium">{withdrawal.account.branch.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Location:</span>
                    <span className="font-medium">{withdrawal.account.branch.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Account Status:</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {withdrawal.account.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Handler Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-purple-600" />
                Processed By
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{withdrawal.handler?.name}</p>
                    <Badge variant="outline" className="text-xs">{withdrawal.handler?.role}</Badge>
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Processed on {formatISODate(withdrawal.withdrawalDate)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Transaction Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 flex-shrink-0">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Withdrawal Processed</p>
                    <p className="text-sm text-gray-600">{formatISODate(withdrawal.withdrawalDate)}</p>
                    <p className="text-sm text-gray-500">Amount: {formatCurrency(withdrawal.amount)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Transaction Created</p>
                    <p className="text-sm text-gray-500">Ref: {withdrawal.transaction.transactionRef}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Important Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Important Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p>This withdrawal transaction has been completed and cannot be reversed.</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p>The account balance has been updated to reflect this withdrawal.</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <p>For any disputes, contact the branch manager or system administrator.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
