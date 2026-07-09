"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatISODate, cn } from "@/lib/utils";
import { Loan, getLoanHealth, getLoanDuration } from "@/types/loan";
import { LoanCalculationResult } from "@/lib/loan-calculations";
import {
  DollarSign,
  TrendingUp,
  CheckCircle,
  Zap,
  Activity,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface LoanOverviewProps {
  loan: Loan & {
     interestAmount?: number | null;
  };
  schedule: LoanCalculationResult;
}

export default function LoanOverview({ loan, schedule }: LoanOverviewProps) {
  const health = getLoanHealth(loan);
  const duration = getLoanDuration(loan.disbursementDate, loan.dueDate);

  const formatCurrency = (amount: number) =>
    `USh ${amount.toLocaleString("en-UG", { minimumFractionDigits: 0 })}`;

  const getPaymentCompliance = () => {
    // Safety check: if not disbursed, we can't calculate compliance based on time
    if (!loan.disbursementDate) {
      return { timePercentage: 0, paymentPercentage: 0, isOnTrack: true };
    }

    const now = new Date();
    const start = new Date(loan.disbursementDate);
    const end = new Date(loan.dueDate);

    if (now < start)
      return { timePercentage: 0, paymentPercentage: 0, isOnTrack: true };
    
    const totalDue = schedule.totalAmountRepaid;
    
    if (now > end)
      return {
        timePercentage: 100,
        paymentPercentage: (loan.amountPaid / totalDue) * 100,
        isOnTrack: loan.outstandingBalance === 0,
      };

    const totalTime = end.getTime() - start.getTime();
    const timeElapsed = now.getTime() - start.getTime();
    // Avoid division by zero if start == end (unlikely but possible)
    const timePercentage =
      totalTime > 0 ? (timeElapsed / totalTime) * 100 : 100;
    const paymentPercentage = (loan.amountPaid / totalDue) * 100;

    return {
      timePercentage: Math.min(timePercentage, 100),
      paymentPercentage,
      isOnTrack: paymentPercentage >= timePercentage,
    };
  };

  const compliance = getPaymentCompliance();

  const stats = [
    {
      label: "Original Principal",
      value: loan.amountGranted,
      icon: DollarSign,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Principal Paid",
      value: loan.principalPaid || 0,
      icon: CheckCircle,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      label: "Interest Income",
      value: loan.interestPaid || 0,
      icon: TrendingUp,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Interest Forecast",
      value: schedule.totalInterest,
      icon: TrendingUp,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Total Recovered",
      value: loan.amountPaid,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Active Balance",
      value: loan.outstandingBalance,
      icon: Zap,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
  ];

  const totalDue = schedule.totalAmountRepaid;

  return (
    <div className="space-y-8">
      {/* High-Impact Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card
            key={i}
            className="border-neutral-100 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-neutral-900">
                    {formatCurrency(stat.value)}
                  </p>
                  <div className="pt-1">
                    {stat.label === "Active Balance" ? (
                      <div className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold border-rose-100 bg-rose-50 text-rose-600">
                        {Math.round(
                          (loan.outstandingBalance / totalDue) * 100
                        )}
                        % REMAINING
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                        {Math.round((stat.value / totalDue) * 100)}%
                        OF TOTAL
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`p-3 rounded-lg ${stat.bg} ${stat.color} shrink-0`}
                >
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Compliance & Health */}
      <Card className="rounded-xl border-neutral-100 shadow-sm overflow-hidden border-t-4 border-t-indigo-500">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-500" />
              Portfolio Recovery Sync
            </div>
            <div
              className={cn(
                "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold",
                compliance.isOnTrack
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : "bg-rose-50 text-rose-700 border-rose-100"
              )}
            >
              {compliance.isOnTrack ? "ON TRACK" : "BEHIND TARGET"}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Repayment Weight
                </span>
                <div className="text-2xl font-black text-neutral-800">
                  {Math.round(health.paymentPercentage)}%
                </div>
              </div>
              <span className="text-xs font-medium text-muted-foreground italic">
                Target: {Math.round(compliance.timePercentage)}%
              </span>
            </div>
            <Progress
              value={health.paymentPercentage}
              className="h-2 bg-neutral-100"
              indicatorClassName="bg-indigo-600 rounded-full"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Contractual Time
                </span>
                <div className="text-2xl font-black text-neutral-800">
                  {Math.round(compliance.timePercentage)}%
                </div>
              </div>
              <span className="text-xs font-medium text-muted-foreground italic">
                {duration} Total
              </span>
            </div>
            <Progress
              value={compliance.timePercentage}
              className="h-2 bg-neutral-100"
              indicatorClassName="bg-neutral-800 rounded-full"
            />
          </div>

          <div
            className={cn(
              "flex items-center gap-4 p-5 rounded-2xl border transition-colors",
              compliance.isOnTrack
                ? "bg-emerald-50/50 border-emerald-100"
                : "bg-rose-50/50 border-rose-100"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-xl text-white",
                compliance.isOnTrack ? "bg-emerald-500" : "bg-rose-500"
              )}
            >
              {compliance.isOnTrack ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="font-black text-sm uppercase tracking-tight">
                Sync Status:{" "}
                {compliance.isOnTrack
                  ? "Healthy Compliance"
                  : "Critical Variance"}
              </div>
              <p className="text-xs text-muted-foreground font-medium italic mt-0.5">
                {compliance.isOnTrack
                  ? "Member contributions are currently ahead of or aligned with linear amortization."
                  : "Recovery rate is lagging behind contractual time elapsed. Immediate engagement recommended."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
