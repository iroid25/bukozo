"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  CreditCard,
  DollarSign,
  FileText,
  Mail,
  Phone,
  RefreshCw,
  Repeat,
  TrendingDown,
  TrendingUp,
  User,
  Building,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Statement, StatementData } from "@/types/statements";
import { formatISODate } from "@/lib/utils";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";

interface StatementDetailProps {
  statement: Statement;
  statementData: StatementData;
  userRole: string;
  currentUserId: string;
}

export default function StatementDetail({
  statement,
  statementData,
}: StatementDetailProps) {
  const router = useRouter();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const isInstitution = statementData.subjectType === "INSTITUTION";
  const subjectName = isInstitution
    ? statementData.institution?.institutionName || "Institution"
    : statementData.member?.user.name || "Member";
  const subjectReference = isInstitution
    ? statementData.institution?.institutionNumber || "N/A"
    : statementData.member?.memberNumber || "N/A";
  const subjectEmail = isInstitution
    ? statementData.institution?.institutionEmail || "N/A"
    : statementData.member?.user.email || "N/A";
  const subjectPhone = isInstitution
    ? statementData.institution?.institutionPhone ||
      statementData.institution?.primaryContactPhone ||
      "N/A"
    : statementData.member?.user.phone || "N/A";
  const subjectAddress = isInstitution
    ? statementData.institution?.postalAddress || "N/A"
    : statementData.member?.user.address || "N/A";

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);

  const getAccountTypeDisplayName = (name: string) => {
    const displayNames: Record<string, string> = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  };

  const getTransactionTypeInfo = (type: string) => {
    switch (type) {
      case "DEPOSIT":
        return { icon: TrendingUp, color: "text-green-600", bg: "bg-green-100" };
      case "WITHDRAWAL":
        return { icon: TrendingDown, color: "text-red-600", bg: "bg-red-100" };
      case "LOAN_DISBURSEMENT":
        return { icon: DollarSign, color: "text-blue-600", bg: "bg-blue-100" };
      case "LOAN_REPAYMENT":
        return { icon: Repeat, color: "text-purple-600", bg: "bg-purple-100" };
      default:
        return { icon: FileText, color: "text-gray-600", bg: "bg-gray-100" };
    }
  };

  const handleRegenerateStatement = async () => {
    setIsRegenerating(true);
    try {
      toast.success("Statement regeneration started");
      setTimeout(() => {
        setIsRegenerating(false);
        router.refresh();
      }, 2000);
    } catch {
      toast.error("Failed to regenerate statement");
      setIsRegenerating(false);
    }
  };

  const totalDeposits = statementData.deposits.reduce(
    (sum, deposit) => sum + deposit.amount,
    0,
  );
  const totalWithdrawals = statementData.withdrawals.reduce(
    (sum, withdrawal) => sum + withdrawal.amount,
    0,
  );
  const totalLoanRepayments = statementData.loanRepayments.reduce(
    (sum, repayment) => sum + repayment.amount,
    0,
  );
  const totalAccountBalance = statementData.accountBalances.reduce(
    (sum, account) => sum + account.currentBalance,
    0,
  );

  return (
    <div className="container mx-auto space-y-6 py-6">
      <ReportHeader
        title={isInstitution ? "Institution Account Statement" : "Member Account Statement"}
        subtitle={`Statement for ${subjectName} (#${subjectReference})`}
        period={`${format(new Date(statement.startDate), "PPP")} - ${format(
          new Date(statement.endDate || statement.startDate),
          "PPP",
        )}`}
      >
        <div className="hidden print:flex flex-col items-end text-xs text-muted-foreground">
          <span>{REPORT_HEADER_DETAILS.registrationNumber}</span>
          <span>{REPORT_HEADER_DETAILS.email}</span>
        </div>
      </ReportHeader>

      <div className="print:hidden flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bank Statement Details
            </h1>
            <p className="text-gray-500">
              Statement for {subjectName} (#{subjectReference})
            </p>
          </div>
        </div>

        {!statement.fileUrl && (
          <Button onClick={handleRegenerateStatement} disabled={isRegenerating}>
            {isRegenerating ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {isRegenerating ? "Generating..." : "Generate PDF"}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Statement Status</h3>
                <p className="text-sm text-gray-500">
                  Generated on {formatISODate(statement.statementDate)} at{" "}
                  {format(new Date(statement.statementDate), "HH:mm")}
                </p>
              </div>
            </div>

            {statement.fileUrl ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                <CheckCircle className="mr-1 h-4 w-4" />
                PDF Available
              </Badge>
            ) : (
              <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                <AlertCircle className="mr-1 h-4 w-4" />
                PDF Generating
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isInstitution ? "Institution Information" : "Member Information"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  {isInstitution ? "Institution Name" : "Member Name"}
                </p>
                <p className="font-medium">{subjectName}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">
                {isInstitution ? "Institution Number" : "Member Number"}
              </p>
              <p className="font-medium">#{subjectReference}</p>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{subjectEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{subjectPhone}</p>
              </div>
            </div>
          </div>

          {subjectAddress !== "N/A" && (
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{subjectAddress}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Statement Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-gray-500">Period Start</p>
              <p className="font-medium text-lg">{formatISODate(statement.periodStart)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Period End</p>
              <p className="font-medium text-lg">{formatISODate(statement.periodEnd)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Scope</p>
              <p className="font-medium text-lg">
                {statement.accountScope === "SINGLE_ACCOUNT"
                  ? "Specific Account"
                  : "All Accounts"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Duration</p>
              <p className="font-medium text-lg">
                {Math.ceil(
                  (new Date(statement.periodEnd).getTime() -
                    new Date(statement.periodStart).getTime()) /
                    (1000 * 60 * 60 * 24),
                )}{" "}
                days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Account Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {statementData.accountBalances.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{account.accountNumber}</p>
                    <p className="text-sm text-gray-500">
                      {getAccountTypeDisplayName(account.accountType.name)} •{" "}
                      {account.branch.name}
                      {account.activeHoldCount
                        ? ` • On Hold (${account.activeHoldCount})`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-lg">
                    {formatCurrency(account.currentBalance)}
                  </p>
                  <p className="text-sm text-gray-500">Current Balance</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <MetricCard
          title="Total Deposits"
          value={formatCurrency(totalDeposits)}
          note={`${statementData.deposits.length} transactions`}
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          tone="text-green-700"
        />
        <MetricCard
          title="Total Withdrawals"
          value={formatCurrency(totalWithdrawals)}
          note={`${statementData.withdrawals.length} transactions`}
          icon={<TrendingDown className="h-4 w-4 text-red-600" />}
          tone="text-red-700"
        />
        <MetricCard
          title="Loan Repayments"
          value={formatCurrency(totalLoanRepayments)}
          note={`${statementData.loanRepayments.length} transactions`}
          icon={<Repeat className="h-4 w-4 text-purple-600" />}
          tone="text-purple-700"
        />
        <MetricCard
          title="Total Balance"
          value={formatCurrency(totalAccountBalance)}
          note={
            statement.accountScope === "SINGLE_ACCOUNT"
              ? "Selected account balance"
              : "All accounts combined"
          }
          icon={<DollarSign className="h-4 w-4 text-blue-600" />}
          tone="text-blue-700"
        />
      </div>

      <ActivityCard
        title="Deposit Activity"
        emptyText="No deposits found for this period"
        rows={statementData.deposits.map((deposit) => ({
          id: deposit.id,
          label: `${deposit.account.accountNumber} • ${formatISODate(deposit.depositDate)}`,
          sublabel: `Deposited By: ${deposit.depositedBy || "Unknown"} • Processed By: ${
            deposit.processedBy || deposit.handler.name
          }`,
          amount: `+${formatCurrency(deposit.amount)}`,
          tone: "text-green-600",
        }))}
      />

      <ActivityCard
        title="Withdrawal Activity"
        emptyText="No withdrawals found for this period"
        rows={statementData.withdrawals.map((withdrawal) => ({
          id: withdrawal.id,
          label: `${withdrawal.account.accountNumber} • ${formatISODate(
            withdrawal.withdrawalDate,
          )}`,
          sublabel: `Withdrawn By: ${withdrawal.withdrawnBy || "Unknown"} • Processed By: ${
            withdrawal.processedBy || withdrawal.handler.name
          }`,
          amount: `-${formatCurrency(withdrawal.amount)}`,
          tone: "text-red-600",
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statementData.transactions.length > 0 ? (
            <div className="space-y-4">
              {statementData.transactions.map((transaction) => {
                const typeInfo = getTransactionTypeInfo(transaction.type);
                const TypeIcon = typeInfo.icon;

                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${typeInfo.bg} ${typeInfo.color}`}
                      >
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{transaction.transactionRef}</p>
                          <Badge variant="outline" className="text-xs">
                            {transaction.type.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          {transaction.account.accountNumber} •{" "}
                          {formatISODate(transaction.transactionDate)}
                        </p>
                        {transaction.description && (
                          <p className="mt-1 text-sm text-gray-600">
                            {transaction.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-medium ${
                          transaction.type === "DEPOSIT" ||
                          transaction.type === "LOAN_DISBURSEMENT"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.type === "DEPOSIT" ||
                        transaction.type === "LOAN_DISBURSEMENT"
                          ? "+"
                          : "-"}
                        {formatCurrency(transaction.amount)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {transaction.performedBy ||
                          transaction.processedByUser?.name ||
                          "System"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p>No transactions found for this period</p>
            </div>
          )}
        </CardContent>
      </Card>

      {statement.generatedByUser && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                Generated by {statement.generatedByUser.name} (
                {statement.generatedByUser.role})
              </span>
              <span>
                on {formatISODate(statement.statementDate)} at{" "}
                {format(new Date(statement.statementDate), "HH:mm")}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  note,
  icon,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone}`}>{value}</div>
        <p className="text-xs text-gray-500">{note}</p>
      </CardContent>
    </Card>
  );
}

function ActivityCard({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: Array<{
    id: string;
    label: string;
    sublabel: string;
    amount: string;
    tone: string;
  }>;
  emptyText: string;
}) {
  if (!rows.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{row.label}</p>
                  <p className="text-sm text-gray-500">{row.sublabel}</p>
                </div>
                <p className={`font-medium ${row.tone}`}>{row.amount}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
