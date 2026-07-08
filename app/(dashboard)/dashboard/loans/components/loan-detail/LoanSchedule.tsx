"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calculator, Info, AlertTriangle } from "lucide-react";
import { Loan } from "@/types/loan";
import { formatISODate } from "@/lib/utils";
import { LoanCalculationResult } from "@/lib/loan-calculations";

interface LoanScheduleProps {
  loan: Loan & {
    interestAmount?: number | null;
    interestType?: string | null;
  };
  calculatedSchedule: LoanCalculationResult;
}

export default function LoanSchedule({ loan, calculatedSchedule }: LoanScheduleProps) {
  const [showSchedule, setShowSchedule] = useState(false);
  const effectiveInterestType =
    loan.interestType || loan.loanApplication.loanProduct.interestType || "FLAT_RATE";
  const interestTypeLabel =
    effectiveInterestType === "REDUCING_BALANCE" ? "Reducing Balance" : "Flat Rate";

  const formatCurrency = (amount: number) =>
    `USh ${amount.toLocaleString("en-UG", { minimumFractionDigits: 0 })}`;

  const schedule = calculatedSchedule;

  return (
    <>
      <Card className="rounded-xl border-neutral-100 shadow-sm overflow-hidden border-t-4 border-t-neutral-800">
        <CardHeader className="flex flex-row items-center justify-between border-b border-neutral-50 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-600">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Amortization Forecast
              </CardTitle>
              <CardDescription className="text-xs font-medium italic mt-1 text-neutral-500 uppercase tracking-tighter">
                Projected schedule based on current terms ({interestTypeLabel})
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="md:col-span-2 bg-neutral-50/30">
            <div className="p-6 space-y-6">
              <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Info className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Next Due Window
                    </span>
                    <span className="text-sm font-black text-neutral-800">
                      {formatISODate(loan.dueDate)}
                    </span>
                  </div>
                </div>
                <Separator className="bg-neutral-50" />
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-neutral-500 uppercase tracking-tighter">
                      Projected Principal
                    </span>
                    <span className="font-black text-neutral-800">
                      {formatCurrency(loan.amountGranted)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-neutral-500 uppercase tracking-tighter">
                      Standard Interest
                    </span>
                    <span className="font-black text-neutral-800">
                      {formatCurrency(schedule.totalInterest)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-neutral-200">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Total Liability
                    </span>
                    <span className="text-lg font-black text-indigo-600">
                      {formatCurrency(schedule.totalAmountRepaid)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                  <AlertTriangle className="h-3.5 w-3.5" /> RISK INDICATOR
                </div>
                <p className="text-[10px] font-medium text-neutral-500 italic leading-relaxed">
                  This projection assumes standard amortization. Late payments may
                  trigger statutory penalties as per the Bukonzo Emergency Sacco
                  credit policy.
                </p>
                <Button
                  variant="outline"
                  className="w-full text-[9px] font-black uppercase tracking-[0.2em] rounded-xl py-5 border-neutral-200 hover:bg-neutral-900 hover:text-white transition-all"
                  onClick={() => setShowSchedule(true)}
                >
                  View Full Schedule
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSchedule} onOpenChange={setShowSchedule}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Amortization Schedule</DialogTitle>
            <DialogDescription>
              Detailed breakdown of payments over the loan term ({interestTypeLabel})
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px]">Period</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Total Payment</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.schedule.map((item) => (
                  <TableRow key={item.period}>
                    <TableCell className="font-medium">{item.period}</TableCell>
                    <TableCell>{formatISODate(item.dueDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.principalPayment)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.interestPayment)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(item.totalPayment)}</TableCell>
                    <TableCell className="text-right text-green-600 font-bold">{formatCurrency(item.paidAmount || 0)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        item.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        item.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.status || 'PENDING'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(item.remainingBalance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-muted/50 font-bold">
                <TableRow>
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{formatCurrency(schedule.totalPrincipal)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(schedule.totalInterest)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(schedule.totalAmountRepaid)}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
