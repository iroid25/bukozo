"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatISODate } from "@/lib/utils";
import { Loan } from "@/types/loan";
import { History, Layers } from "lucide-react";

interface LoanRepaymentsProps {
  repayments: Loan["repayments"];
}

export default function LoanRepayments({ repayments }: LoanRepaymentsProps) {
  const formatCurrency = (amount: number) =>
    `USh ${amount.toLocaleString("en-UG", { minimumFractionDigits: 0 })}`;

  return (
    <Card className="rounded-xl border-neutral-100 shadow-sm overflow-hidden border-t-4 border-t-emerald-500">
      <CardHeader className="flex flex-row items-center justify-between border-b border-neutral-50 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              Transaction Ledger
            </CardTitle>
            <CardDescription className="text-xs font-medium italic mt-1 text-emerald-600/70 uppercase tracking-tighter">
              Real-time audit of recoveries
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 bg-neutral-100 text-neutral-600 uppercase text-[9px] font-black tracking-widest border-transparent">
            {repayments.length} SUCCESSFUL
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-neutral-50">
          <div className="px-6 py-4 bg-neutral-50/50 flex items-center gap-2 border-b border-neutral-50 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            <History className="h-3.5 w-3.5" /> Historical Recoveries
          </div>
          {repayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50/20 text-neutral-400 font-black uppercase text-[10px] tracking-widest border-b border-neutral-100">
                    <th className="px-6 py-4 text-left font-black">Ref</th>
                    <th className="px-6 py-4 text-left font-black">Amount</th>
                    <th className="px-6 py-4 text-left font-black text-rose-600">Principal</th>
                    <th className="px-6 py-4 text-left font-black text-amber-600">Interest</th>
                    <th className="px-6 py-4 text-left font-black text-blue-600">Penalty</th>
                    <th className="px-6 py-4 text-left font-black">Value Date</th>
                    <th className="px-6 py-4 text-left font-black">Processor</th>
                    <th className="px-6 py-4 text-right font-black">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {repayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="group hover:bg-neutral-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-[10px] text-muted-foreground uppercase">
                        {payment.id.slice(-6)}
                      </td>
                      <td className="px-6 py-4 font-black text-neutral-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 font-bold text-rose-700">
                        {formatCurrency(payment.principalPaid || 0)}
                      </td>
                      <td className="px-6 py-4 font-bold text-amber-700">
                        {formatCurrency(payment.interestPaid || 0)}
                      </td>
                      <td className="px-6 py-4 font-bold text-blue-700">
                        {formatCurrency(payment.penaltyPaid || 0)}
                      </td>
                      <td className="px-6 py-4 font-medium text-muted-foreground italic text-xs">
                        {formatISODate(payment.repaymentDate)}
                      </td>
                      <td className="px-6 py-4 font-medium text-neutral-600 text-xs">
                         {payment.handler?.name || "System"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 inline-block shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-30 italic grayscale scale-90">
              <History className="h-10 w-10 text-neutral-400 mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                No transaction data
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
