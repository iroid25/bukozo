"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Calendar, CreditCard, User } from "lucide-react";
import { formatISODate } from "@/lib/utils";

export type DepositTransaction = {
  id: string;
  transactionRef: string;
  type: string;
  amount: number;
  description: string | null;
  transactionDate: string;
  account: {
    accountNumber: string;
    accountType: {
      name: string;
    };
  };
  status: string;
  channel: string | null;
  processedBy: string | null;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
};

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { variant: any; label: string }> = {
    COMPLETED: { variant: "default", label: "Completed" },
    PENDING: { variant: "secondary", label: "Pending" },
    FAILED: { variant: "destructive", label: "Failed" },
    REVERSED: { variant: "outline", label: "Reversed" },
  };

  const config = statusConfig[status] || {
    variant: "outline",
    label: status,
  };

  return (
    <Badge variant={config.variant} className="font-medium">
      {config.label}
    </Badge>
  );
};

export const depositColumns: ColumnDef<DepositTransaction>[] = [
  {
    accessorKey: "transactionDate",
    header: "Date & Time",
    cell: ({ row }) => {
      const date = row.getValue("transactionDate") as string;
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">
            {formatISODate(new Date(date))}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "transactionRef",
    header: "Reference",
    cell: ({ row }) => {
      const ref = row.getValue("transactionRef") as string;
      return <span className="font-mono text-sm text-gray-600">{ref}</span>;
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const txn = row.original;
      return (
        <div>
          <p className="text-sm font-medium text-gray-900">
            {txn.description || "No description"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Type: {txn.type === "DEPOSIT" ? "Deposit" : "Loan Disbursement"}
          </p>
          {txn.channel && (
            <p className="text-xs text-gray-500">Channel: {txn.channel}</p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "account",
    header: "Account",
    cell: ({ row }) => {
      const txn = row.original;
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <CreditCard className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {txn.account.accountType.name}
            </p>
            <p className="text-xs text-gray-500">
              {txn.account.accountNumber}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = row.getValue("amount") as number;
      return (
        <p className="text-lg font-bold text-emerald-600 whitespace-nowrap text-right">
          +{formatCurrency(amount)}
        </p>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return <div className="text-center">{getStatusBadge(status)}</div>;
    },
  },
  {
    accessorKey: "processedBy",
    header: "Processed By",
    cell: ({ row }) => {
      const processedBy = row.getValue("processedBy") as string | null;
      return processedBy ? (
        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
          <User className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{processedBy}</span>
        </div>
      ) : (
        <span className="text-xs text-gray-400">System</span>
      );
    },
  },
];
