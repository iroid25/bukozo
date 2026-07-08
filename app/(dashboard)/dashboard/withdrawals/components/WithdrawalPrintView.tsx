"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", minimumFractionDigits: 0 }).format(amount);

const formatDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

interface WithdrawalPrintViewProps {
  withdrawal: any;
}

export default function WithdrawalPrintView({ withdrawal }: WithdrawalPrintViewProps) {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, []);

  const ownerName = withdrawal.member?.user?.name || withdrawal.institution?.institutionName || "Unknown";
  const ownerNumber = withdrawal.member?.memberNumber || withdrawal.institution?.institutionNumber || "N/A";

  return (
    <div className="max-w-2xl mx-auto p-8 print:p-4">
      <div className="text-center mb-6 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="border-2 border-gray-300 rounded-lg p-8">
        <div className="text-center border-b-2 border-gray-300 pb-4 mb-6">
          <h1 className="text-2xl font-bold uppercase">Withdrawal Receipt</h1>
          <p className="text-sm text-gray-600">Transaction Reference: {withdrawal.transaction?.transactionRef}</p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">Amount:</span>
            <span className="text-2xl font-bold text-red-700">{formatCurrency(withdrawal.amount)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Date</p>
              <p className="font-medium">{formatDate(withdrawal.withdrawalDate)}</p>
            </div>
            <div>
              <p className="text-gray-500">Channel</p>
              <p className="font-medium">{withdrawal.channel || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <p className="font-medium">{withdrawal.transaction?.status || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Transaction ID</p>
              <p className="font-mono text-xs">{withdrawal.transaction?.id || "—"}</p>
            </div>
            {withdrawal.mobileMoneyRef && (
              <div>
                <p className="text-gray-500">Mobile Money Ref</p>
                <p className="font-medium">{withdrawal.mobileMoneyRef}</p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-semibold mb-2">Account</h3>
            <p className="font-mono">{withdrawal.account?.accountNumber || "—"}</p>
            <p className="text-sm text-gray-600">{withdrawal.account?.accountType?.name || "—"}</p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-semibold mb-2">Owner</h3>
            <p className="font-medium">{ownerName}</p>
            <p className="text-sm text-gray-600">#{ownerNumber}</p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-semibold mb-2">Processed By</h3>
            <p className="font-medium">{withdrawal.handler?.name || "—"}</p>
            <p className="text-sm text-gray-600">{withdrawal.handler?.role || "—"}</p>
          </div>
        </div>

        <div className="text-center border-t-2 border-gray-300 pt-4 mt-6 text-xs text-gray-500">
          <p>Generated on {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
