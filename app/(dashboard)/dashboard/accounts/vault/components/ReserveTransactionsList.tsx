// app/dashboard/accountant/vault/components/ReserveTransactionsList.tsx
"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  transactionDate: Date;
  balanceBefore: number;
  balanceAfter: number;
  performedBy: {
    name: string;
    role: string;
  };
  relatedUser: {
    name: string;
    role: string;
  } | null;
}

interface ReserveTransactionsListProps {
  transactions?: Transaction[];
  vaultId?: string;
}

export default function ReserveTransactionsList({
  transactions: initialTransactions,
  vaultId,
}: ReserveTransactionsListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (vaultId && !initialTransactions) {
      // Fetch transactions if vaultId is provided but no transactions
      setLoading(true);
      // Transactions are now passed via props from the server component
      setLoading(false);
    }
  }, [vaultId, initialTransactions]);
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getTransactionTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      INITIAL_DEPOSIT: "Initial Deposit",
      FLOAT_ALLOCATION: "Float Allocation",
      FLOAT_RETURN: "Float Return",
      BANK_DEPOSIT: "Bank Deposit",
      BANK_WITHDRAWAL: "Bank Withdrawal",
      VAULT_TRANSFER: "Reserve Transfer",
      ADJUSTMENT: "Adjustment",
      OVERAGE_RECEIVED: "Overage Received",
      SHORTAGE_WRITTEN_OFF: "Shortage Written Off",
    };
    return typeMap[type] || type;
  };

  const getTransactionTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      INITIAL_DEPOSIT: "bg-blue-100 text-blue-800",
      FLOAT_ALLOCATION: "bg-purple-100 text-purple-800",
      FLOAT_RETURN: "bg-green-100 text-green-800",
      BANK_DEPOSIT: "bg-cyan-100 text-cyan-800",
      BANK_WITHDRAWAL: "bg-orange-100 text-orange-800",
      VAULT_TRANSFER: "bg-indigo-100 text-indigo-800",
      ADJUSTMENT: "bg-yellow-100 text-yellow-800",
      OVERAGE_RECEIVED: "bg-emerald-100 text-emerald-800",
      SHORTAGE_WRITTEN_OFF: "bg-red-100 text-red-800",
    };
    return colorMap[type] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-500">Loading transactions...</span>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date & Time</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Performed By</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell className="font-medium whitespace-nowrap">
                {format(new Date(transaction.transactionDate), "MMM dd, yyyy")}
                <br />
                <span className="text-xs text-gray-500">
                  {format(new Date(transaction.transactionDate), "hh:mm a")}
                </span>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={getTransactionTypeColor(transaction.type)}
                >
                  {getTransactionTypeLabel(transaction.type)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {transaction.amount > 0 ? (
                    <ArrowUpCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <ArrowDownCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span
                    className={
                      transaction.amount > 0
                        ? "text-green-600 font-semibold"
                        : "text-red-600 font-semibold"
                    }
                  >
                    {formatCurrency(Math.abs(transaction.amount))}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div className="text-gray-500">
                    Before: {formatCurrency(transaction.balanceBefore)}
                  </div>
                  <div className="font-medium">
                    After: {formatCurrency(transaction.balanceAfter)}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div className="font-medium">
                    {transaction.performedBy.name}
                  </div>
                  <div className="text-gray-500">
                    {transaction.performedBy.role}
                  </div>
                  {transaction.relatedUser && (
                    <div className="text-xs text-blue-600 mt-1">
                      Related: {transaction.relatedUser.name}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="max-w-xs">
                <p className="text-sm text-gray-700 truncate">
                  {transaction.description || "—"}
                </p>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
