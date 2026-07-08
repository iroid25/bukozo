"use client";

export const dynamic = "force-dynamic";

import React from "react";
import { useParams } from "next/navigation";
import { GenericReportPage } from "@/components/reports/GenericReportPage";
import { ReportSummaryCard } from "@/components/reports/ReportSummaryCard";
import { Column } from "@/components/ui/data-table/data-table";
import { PiggyBank, Users, Activity, AlertCircle } from "lucide-react";

interface SavingsRecord {
  accountNumber: string;
  memberName: string;
  accountType: string;
  balance: string;
  status: string;
  openedDate: string;
  memberPhone?: string;
  branch?: string;
  lastTransactionDate?: string;
}

// Default columns
const defaultColumns: Column<SavingsRecord>[] = [
  { header: "Account No.", accessorKey: "accountNumber" },
  { header: "Member", accessorKey: "memberName" },
  { header: "Type", accessorKey: "accountType" },
  { header: "Balance", accessorKey: "balance" },
  { header: "Status", accessorKey: "status" },
  { header: "Date Opened", accessorKey: "openedDate" },
];

const reportConfig: Record<string, { title: string; endpoint: string; columns?: any[] }> = {
    "savings-listing": {
        title: "Savings Account Listing",
        endpoint: "/api/v1/reports/savings/account-listing"
    },
    "savings-balances": {
        title: "Savings Balances Report",
        endpoint: "/api/v1/reports/savings/account-balance",
        columns: [
            { header: "Account No.", accessorKey: "accountNumber" },
            { header: "Member", accessorKey: "memberName" },
            { header: "Current Balance", accessorKey: "balance" },
            { header: "Available", accessorKey: "availableBalance" },
            { header: "Hold Amount", accessorKey: "minBalance" },
        ]
    },
    "inactive-accounts": {
        title: "Inactive Accounts",
        endpoint: "/api/v1/reports/savings/dormant-accounts"
    },
    "dormant-accounts": {
        title: "Dormant Accounts",
        endpoint: "/api/v1/reports/savings/dormant-accounts",
        columns: [
             { header: "Account No.", accessorKey: "accountNumber" },
             { header: "Member", accessorKey: "memberName" },
             { header: "Balance", accessorKey: "balance" },
             { header: "Last Active", accessorKey: "lastTransactionDate" },
             { header: "Days Inactive", accessorKey: "daysSinceLastActivity" }
        ]
    },
    "zero-balance": {
        title: "Zero Balance Accounts",
        endpoint: "/api/v1/reports/savings/zero-balance",
        columns: [
             { header: "Account No.", accessorKey: "accountNumber" },
             { header: "Member", accessorKey: "memberName" },
             { header: "Phone", accessorKey: "memberPhone" },
             { header: "Type", accessorKey: "accountType" },
             { header: "Branch", accessorKey: "branch" },
             { header: "Balance", accessorKey: "balance" },
             { header: "Status", accessorKey: "status" },
             { header: "Last Active", accessorKey: "lastTransactionDate" }
        ]
    },
    "overdrawn": {
        title: "Overdrawn Accounts",
        endpoint: "/api/v1/reports/savings/overdrawn-accounts",
        columns: [
             { header: "Account No.", accessorKey: "accountNumber" },
             { header: "Member", accessorKey: "memberName" },
             { header: "Balance", accessorKey: "balance" },
             { header: "Overdrawn Amt", accessorKey: "overdrawnAmount" }
        ]
    },
    "savings-performance": {
        title: "Savings Performance Analysis",
        endpoint: "/api/v1/reports/savings/performance"
    },
    "savings-batch-totals": {
        title: "Savings Batch Totals",
        endpoint: "/api/v1/reports/savings/batch-totals",
        columns: [
            { header: "Batch No.", accessorKey: "batchNumber" },
            { header: "Date", accessorKey: "processedDate" },
            { header: "Processor", accessorKey: "processor" },
            { header: "Status", accessorKey: "status" },
            { header: "Transactions", accessorKey: "totalTransactions" },
            { header: "Total Amount", accessorKey: "totalAmount" },
        ]
    },
    "interest-paid": {
        title: "Interest Paid Report",
        endpoint: "/api/v1/reports/savings/interest-paid",
        columns: [
            { header: "Account No.", accessorKey: "accountNumber" },
            { header: "Member", accessorKey: "memberName" },
            { header: "Account Type", accessorKey: "accountType" },
            { header: "Interest Rate", accessorKey: "interestRate" },
            { header: "Branch", accessorKey: "branch" },
            { header: "Total Interest", accessorKey: "totalInterest" },
            { header: "Payments", accessorKey: "paymentCount" },
            { header: "Avg Payment", accessorKey: "averagePayment" },
        ]
    },
};

export default function DynamicSavingsReportPage() {
  const params = useParams();
  const reportType = params?.reportType as string;
  const config = reportConfig[reportType];

  if (!config) {
      return <div className="p-8">Report type not found: {reportType}</div>;
  }

  return (
    <GenericReportPage
      title={config.title}
      description={`Report for ${config.title}`}
      endpoint={config.endpoint}
      method="POST"
      extraParams={{ format: 'JSON' }} // Default to JSON for display
      columns={config.columns || defaultColumns}
      keyField="accountNumber"
      summaryFormatter={(summary) => (
        <>
          <ReportSummaryCard title="Total Accounts" value={summary.totalAccounts || summary.count || 0} icon={Users} />
          <ReportSummaryCard title="Total Balance" value={summary.totalBalance || summary.totalAmount || "0"} icon={PiggyBank} />
          <ReportSummaryCard title="Active" value={summary.activeAccounts || 0} icon={Activity} />
          {summary.dormantAccounts !== undefined && (
            <ReportSummaryCard title="Dormant" value={summary.dormantAccounts} icon={AlertCircle} />
          )}
          {summary.overdrawnAccounts !== undefined && (
            <ReportSummaryCard title="Overdrawn" value={summary.overdrawnAccounts} icon={AlertCircle} />
          )}
        </>
      )}
    />
  );
}
