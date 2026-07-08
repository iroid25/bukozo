"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  TrendingUp,
  User,
  CreditCard,
  DollarSign,
  Building,
  Phone,
  FileText,
  CheckCircle,
  Clock,
  MapPin,
  Hash,
  Mail,
  UserCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { formatISODate } from "@/lib/utils";
import PrintReceiptButton from "../components/PrintReceiptButton";

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

const getChannelInfo = (channel: string) => {
  const channelMap: {
    [key: string]: { label: string; color: string; icon: React.ReactNode };
  } = {
    CASH: { label: "Cash", color: "bg-green-100 text-green-800", icon: <DollarSign className="h-3 w-3" /> },
    MOBILE_MONEY: { label: "Mobile Money", color: "bg-blue-100 text-blue-800", icon: <Phone className="h-3 w-3" /> },
    BANK_TRANSFER: { label: "Bank Transfer", color: "bg-purple-100 text-purple-800", icon: <Building className="h-3 w-3" /> },
    CHEQUE: { label: "Cheque", color: "bg-orange-100 text-orange-800", icon: <FileText className="h-3 w-3" /> },
  };
  return channelMap[channel] || { label: channel, color: "bg-gray-100 text-gray-800", icon: <Hash className="h-3 w-3" /> };
};

const getStatusInfo = (status: string) => {
  const statusMap: {
    [key: string]: { label: string; color: string; icon: React.ReactNode };
  } = {
    COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
    PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3 w-3" /> },
    FAILED: { label: "Failed", color: "bg-red-100 text-red-800", icon: <Clock className="h-3 w-3" /> },
  };
  return statusMap[status] || { label: status, color: "bg-gray-100 text-gray-800", icon: <Hash className="h-3 w-3" /> };
};

export default function DepositDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [deposit, setDeposit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/v1/deposits/${id}`);
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      setDeposit(json.data);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
        <div className="container mx-auto py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-64 bg-gray-200 rounded"></div>
                <div className="h-48 bg-gray-200 rounded"></div>
              </div>
              <div className="space-y-6">
                <div className="h-48 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!deposit) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
        <div className="container mx-auto py-12 text-center">
          <p className="text-gray-500">Deposit not found.</p>
          <Link href="/dashboard/deposits">
            <Button className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Deposits
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const user = session?.user as any;
  const channelInfo = getChannelInfo(deposit.channel);
  const statusInfo = getStatusInfo(deposit.transaction.status);

  const isMemberDeposit = !!deposit.member;
  const isInstitutionDeposit = !!deposit.institution;

  const ownerName = isMemberDeposit
    ? deposit.member.user.name
    : isInstitutionDeposit
    ? deposit.institution.institutionName
    : "Unknown";

  const ownerNumber = isMemberDeposit
    ? deposit.member.memberNumber
    : isInstitutionDeposit
    ? deposit.institution.institutionNumber
    : "N/A";

  const ownerEmail = isMemberDeposit
    ? deposit.member.user.email
    : isInstitutionDeposit
    ? deposit.institution.user.email
    : "N/A";

  const ownerPhone = isMemberDeposit
    ? deposit.member.user.phone
    : isInstitutionDeposit
    ? deposit.institution.user.phone
    : null;

  const ownerImage = isMemberDeposit
    ? deposit.member.user.image
    : isInstitutionDeposit
    ? deposit.institution.user.image
    : null;

  const ownerId = isMemberDeposit
    ? deposit.member.id
    : isInstitutionDeposit
    ? deposit.institution.id
    : null;

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/deposits">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Deposits
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Deposit Details</h1>
              <p className="text-sm text-gray-500">
                Transaction Reference: {deposit.transaction.transactionRef}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PrintReceiptButton id={id} prefix="deposits" />
            <Badge className={statusInfo.color}>
              {statusInfo.icon}
              <span className="ml-1">{statusInfo.label}</span>
            </Badge>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Transaction Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Transaction Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Amount</span>
                      <span className="text-2xl font-bold text-green-700">
                        {formatCurrency(deposit.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Date</span>
                      <span className="font-medium">{formatISODate(deposit.depositDate)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status</span>
                      <Badge className={statusInfo.color}>
                        {statusInfo.icon}
                        <span className="ml-1">{statusInfo.label}</span>
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Channel</span>
                      <Badge className={channelInfo.color}>
                        {channelInfo.icon}
                        <span className="ml-1">{channelInfo.label}</span>
                      </Badge>
                    </div>
                    {deposit.mobileMoneyRef && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Mobile Money Ref</span>
                        <span className="font-medium font-mono">{deposit.mobileMoneyRef}</span>
                      </div>
                    )}
                    {deposit.depositorName && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Depositor Name</span>
                        <span className="font-medium">{deposit.depositorName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Transaction ID</span>
                      <span className="font-medium font-mono text-xs">{deposit.transaction.id}</span>
                    </div>
                  </div>
                </div>

                {deposit.transaction.description && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {deposit.transaction.description}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Owner Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isMemberDeposit ? (
                    <><User className="h-5 w-5 text-blue-600" /> Member Information</>
                  ) : (
                    <><Building className="h-5 w-5 text-purple-600" /> Institution Information</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-full ${
                      isMemberDeposit ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                    } flex-shrink-0`}
                  >
                    {ownerImage ? (
                      <img src={ownerImage} alt={ownerName} className="h-16 w-16 rounded-full object-cover" />
                    ) : isMemberDeposit ? (
                      <User className="h-8 w-8" />
                    ) : (
                      <Building className="h-8 w-8" />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{ownerName}</h3>
                      <p className="text-sm text-gray-500">
                        {isMemberDeposit ? "Member" : "Institution"} #{ownerNumber}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{ownerEmail}</span>
                      </div>
                      {ownerPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{ownerPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-green-600" />
                  Account Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-lg font-semibold text-green-900">
                    {deposit.account.accountNumber}
                  </div>
                  <div className="text-sm text-green-700">
                    {getAccountTypeDisplayName(deposit.account.accountType.name)}
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Current Balance</span>
                    <span className="font-medium">{formatCurrency(deposit.account.balance)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Min Balance</span>
                    <span className="font-medium">{formatCurrency(deposit.account.accountType.minBalance)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="font-medium">{deposit.account.branch.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {deposit.account.branch.location}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Handler Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-purple-600" />
                  Processed By
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{deposit.handler?.name}</div>
                    <Badge variant="outline" className="text-xs">
                      {deposit.handler?.role}
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  Handler ID: {deposit.handler?.id}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            {(user?.role === "ADMIN" || user?.role === "BRANCHMANAGER") && ownerId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isMemberDeposit && (
                    <Link href={`/dashboard/members/${ownerId}`}>
                      <Button variant="outline" size="sm" className="w-full bg-transparent">
                        <User className="h-4 w-4 mr-2" />
                        View Member Profile
                      </Button>
                    </Link>
                  )}
                  {isInstitutionDeposit && (
                    <Link href={`/dashboard/institutions/${ownerId}`}>
                      <Button variant="outline" size="sm" className="w-full bg-transparent">
                        <Building className="h-4 w-4 mr-2" />
                        View Institution Profile
                      </Button>
                    </Link>
                  )}
                  <Link href={`/dashboard/accounts/${deposit.account.id}`}>
                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      <Wallet className="h-4 w-4 mr-2" />
                      View Account Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
