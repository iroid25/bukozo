"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Loan } from "@/types/loan";
import LoanHeader from "./LoanHeader";
import LoanOverview from "./LoanOverview";
import LoanRepayments from "./LoanRepayments";
import LoanSchedule from "./LoanSchedule";
import LoanCollateral from "./LoanCollateral";
import LoanProfile from "./LoanProfile";
import { useMemo } from "react";
import { calculateLoanSchedule } from "@/lib/loan-calculations";

interface LoanDetailViewProps {
  loan: Loan & {
    allocatedTellerId?: string | null;
    allocatedTeller?: any | null;
    disbursementMethod?:
      | "CASH"
      | "MOBILE_MONEY"
      | "BANK_TRANSFER"
      | string
      | null;
    interestAmount?: number | null;
    interestType?: string | null;
    interestPeriod?: "MONTHLY" | "ANNUAL" | null;
    gracePeriod?: number | null;
    loanApplication: {
      id: string;
      purpose: string | null;
      applicationDate: Date;
      repaymentStartDate?: Date | null;
      loanProduct: {
        name: string;
        interestRate: number;
        interestType: string;
        repaymentPeriodDays: number;
        minAmount: number;
        maxAmount: number;
      };
      applicant?: { name: string; role: string };
      approver?: { name: string; role: string };
      collateralType?: string | null;
      collateralValue?: number | null;
      collateralDetails?: string | null;
      collateralLocation?: string | null;
      collateralOffered?: string | null;
      forcedSaleValue?: number | null;
      guarantors?: any;
    };
    member: {
      id: string;
      memberNumber: string;
      user: {
        name: string;
        email: string | null;
        phone: string | null;
        image: string | null;
      };
      accounts: Array<{
        id: string;
        accountNumber: string;
        balance: number;
        accountType: { name: string };
        branch: { name: string; location: string };
      }>;
    };
    repayments: Array<{
      id: string;
      amount: number;
      repaymentDate: Date;
      principalPaid?: number | null;
      interestPaid?: number | null;
      penaltyPaid?: number | null;
      handler: { name: string; role: string };
    }>;
    disbursedByUser: { name: string; role: string };
    branch?: { name: string; location: string } | null;
  };
  userRole: string;
  currentUserId: string;
}

export default function LoanDetailView({
  loan,
  userRole,
  currentUserId,
}: LoanDetailViewProps) {
  const schedule = useMemo(() => {
    if (loan.schedules && loan.schedules.length > 0) {
      const getVal = (v: any, fallback: any = 0) =>
        v === undefined || v === null ? fallback : Number(v);
      const totalInterest = loan.schedules.reduce(
        (sum, s) => sum + getVal(s.interestPayment),
        0
      );
      const totalPrincipal = loan.schedules.reduce(
        (sum, s) => sum + getVal(s.principalPayment),
        0
      );

      return {
        schedule: loan.schedules.map((s: any) => ({
          period: s.period,
          dueDate: new Date(s.dueDate),
          principalPayment: getVal(s.principalPayment),
          interestPayment: getVal(s.interestPayment),
          totalPayment: getVal(s.totalPayment),
          remainingBalance: getVal(s.remainingBalance),
          paidAmount: getVal(s.paidAmount),
          status: s.status as any,
        })),
        totalPrincipal,
        totalInterest,
        totalAmountRepaid: totalPrincipal + totalInterest,
      };
    }

    const months = Math.max(
      1,
      Math.round(
        (loan.loanApplication.loanProduct.repaymentPeriodDays || 30) / 30
      )
    );

    const interestType = (loan.interestType ||
      loan.loanApplication.loanProduct.interestType ||
      "FLAT_RATE") as "FLAT_RATE" | "REDUCING_BALANCE";

    // Get interest period from loan, fallback to product's interest period
    const interestPeriod = loan.interestPeriod || 
      (loan.loanApplication.loanProduct as any).interestPeriod || 
      "MONTHLY";

    return calculateLoanSchedule({
      amountGranted: loan.amountGranted,
      interestRate: loan.interestRate,
      repaymentPeriodMonths: months,
      interestType,
      gracePeriod: loan.gracePeriod || 0,
      disbursementDate: new Date(
        loan.loanApplication.repaymentStartDate ||
          loan.disbursementDate ||
          new Date()
      ),
      interestPeriod: interestPeriod as "MONTHLY" | "ANNUAL",
      payments: (loan.repayments || []).map((r) => ({
        amount: r.amount,
        paymentDate: r.repaymentDate,
        principalPaid: r.principalPaid || 0,
        interestPaid: r.interestPaid || 0,
        penaltyPaid: r.penaltyPaid || 0,
      }))
    });
  }, [loan]);

  return (
    <div className="space-y-8 pb-10">
      <LoanHeader
        loan={loan}
        userRole={userRole}
        currentUserId={currentUserId}
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-neutral-100 p-1 rounded-xl">
          <TabsTrigger
            value="overview"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 font-bold text-xs uppercase tracking-wider px-6"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="repayments"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 font-bold text-xs uppercase tracking-wider px-6"
          >
            Repayments
          </TabsTrigger>
          <TabsTrigger
            value="schedule"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 font-bold text-xs uppercase tracking-wider px-6"
          >
            Schedule
          </TabsTrigger>
          <TabsTrigger
            value="collateral"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 font-bold text-xs uppercase tracking-wider px-6"
          >
            Security
          </TabsTrigger>
          <TabsTrigger
            value="profile"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 font-bold text-xs uppercase tracking-wider px-6"
          >
            Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 animate-in slide-in-from-left-2 duration-300">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            <div className="xl:col-span-3 space-y-8">
              <LoanOverview loan={loan} schedule={schedule} />
              <LoanRepayments repayments={(loan.repayments || []).slice(0, 5)} />
            </div>
            <div className="space-y-6">
              <LoanProfile member={loan.member} />
              <LoanSchedule loan={loan} calculatedSchedule={schedule} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="repayments" className="animate-in slide-in-from-left-2 duration-300">
           <LoanRepayments repayments={loan.repayments} />
        </TabsContent>

        <TabsContent value="schedule" className="animate-in slide-in-from-left-2 duration-300">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <LoanSchedule loan={loan} calculatedSchedule={schedule} />
           </div>
        </TabsContent>

        <TabsContent value="collateral" className="animate-in slide-in-from-left-2 duration-300">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <LoanCollateral loanApplication={loan.loanApplication} />
           </div>
        </TabsContent>
        
        <TabsContent value="profile" className="animate-in slide-in-from-left-2 duration-300">
           <div className="max-w-md">
              <LoanProfile member={loan.member} />
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
