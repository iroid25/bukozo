"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  ArrowLeft,
  User,
  CreditCard,
  DollarSign,
  Calendar,
  FileText,
  Calculator,
  CheckCircle,
  Building,
  Phone,
  Mail,
  Clock,
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  History,
  MapPin,
  UserCheck,
  Banknote,
  ChevronRight,
  ShieldCheck,
  Zap,
  Briefcase,
  Activity,
  ArrowUpRight,
  Shield,
  Users,
  Info,
  Layers,
} from "lucide-react";

import {
  Loan,
  getLoanStatusInfo,
  getLoanHealth,
  getDaysUntilDue,
  isLoanOverdue,
  getLoanDuration,
} from "@/types/loan";
import PayFromAccountForm from "./PayFromAccountForm";
import { formatISODate, cn } from "@/lib/utils";
import LoanRescheduleForm from "./LoanRescheduleForm";
import DisburseLoanForm from "./DisburseLoanForm";

interface Props {
  loan: Loan & {
    allocatedTellerId?: string | null;
    allocatedTeller?: any | null;
    disbursementMethod?: "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" | string | null;
    interestAmount?: number | null;
    loanApplication: {
      id: string;
      purpose: string | null;
      applicationDate: Date;
      loanProduct: {
        name: string;
        interestRate: number;
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
      handler: { name: string; role: string };
    }>;
    disbursedByUser: { name: string; role: string };
    branch?: { name: string; location: string } | null;
  };
  userRole: string;
  currentUserId: string;
}

export default function LoanDetail({ loan, userRole, currentUserId }: Props) {
  const router = useRouter();
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"repaid" | "extend" | "pay-from-account" | null>(null);
  const [loading, setLoading] = useState(false);

  const statusInfo = getLoanStatusInfo(loan.status);
  const health = getLoanHealth(loan);
  const daysUntilDue = getDaysUntilDue(loan.dueDate);
  const isOverdue = isLoanOverdue(loan);
  const duration = getLoanDuration(loan.disbursementDate, loan.dueDate);

  const formatCurrency = (amount: number) =>
    `USh ${amount.toLocaleString("en-UG", { minimumFractionDigits: 0 })}`;

  const getAccountTypeDisplayName = (name: string) => {
    const displayNames: { [key: string]: string } = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  };

  const getPaymentCompliance = () => {
    // Safety check: if not disbursed, we can't calculate compliance based on time
    if (!loan.disbursementDate) {
        return { timePercentage: 0, paymentPercentage: 0, isOnTrack: true };
    }

    const now = new Date();
    const start = new Date(loan.disbursementDate);
    const end = new Date(loan.dueDate);
    
    if (now < start) return { timePercentage: 0, paymentPercentage: 0, isOnTrack: true };
    if (now > end) return { timePercentage: 100, paymentPercentage: (loan.amountPaid / loan.totalAmountDue) * 100, isOnTrack: loan.outstandingBalance === 0 };

    const totalTime = end.getTime() - start.getTime();
    const timeElapsed = now.getTime() - start.getTime();
    // Avoid division by zero if start == end (unlikely but possible)
    const timePercentage = totalTime > 0 ? (timeElapsed / totalTime) * 100 : 100;
    const paymentPercentage = (loan.amountPaid / loan.totalAmountDue) * 100;

    return {
      timePercentage: Math.min(timePercentage, 100),
      paymentPercentage,
      isOnTrack: paymentPercentage >= timePercentage,
    };
  };

  const compliance = getPaymentCompliance();

  const handleMarkAsRepaid = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/loans/${loan.id}/mark-repaid`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) {
        toast.error("Failed to mark loan as repaid", { description: result.error });
        return;
      }
      toast.success("Loan marked as fully repaid");
      setActionDialogOpen(false);
      setActionType(null);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const disbMethodLabel =
    loan.disbursementMethod === "MOBILE_MONEY"
      ? "Mobile Money"
      : loan.disbursementMethod === "BANK_TRANSFER"
        ? "Bank Transfer"
        : loan.disbursementMethod === "CASH"
          ? "Cash"
          : loan.disbursementMethod || "—";

  const allocatedTellerName = loan.allocatedTeller?.name || "—";
  const allocatedTellerRole = loan.allocatedTeller?.role || "";

  // Helper for Guarantors extraction
  const guarantorsData = Array.isArray(loan.loanApplication.guarantors) 
    ? loan.loanApplication.guarantors 
    : (typeof loan.loanApplication.guarantors === 'string' 
        ? JSON.parse(loan.loanApplication.guarantors) 
        : []);

  return (
    <div className="space-y-8 pb-10">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-neutral-100 rounded-full" 
                onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-500 shadow-sm flex items-center gap-1.5 ${statusInfo.color.replace('bg-', 'bg-opacity-10 text-').replace('text-', 'border-')}`}>
               <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusInfo.color}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${statusInfo.color}`}></span>
               </span>
               {statusInfo.label}
            </div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-neutral-100 px-2 py-1 rounded">#{loan.id.slice(-8)}</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
            {loan.member.user.name}
            <ChevronRight className="h-6 w-6 text-neutral-300" />
            <span className="text-gray-500">{loan.loanApplication.loanProduct.name}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground italic">
             <span className="flex items-center gap-1.5"><Building className="h-4 w-4" /> {loan.branch?.name || "Main Branch"}</span>
             <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Disbursed {formatISODate(loan.disbursementDate)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {loan.status === "APPROVED" && (
            <DisburseLoanForm 
              loan={loan} 
              memberAccounts={loan.member.accounts} 
            />
          )}

          {loan.status === "DISBURSED" && (
            <LoanRescheduleForm
              loanId={loan.id}
              currentDueDate={loan.dueDate}
            />
          )}

          {loan.status === "DISBURSED" && loan.outstandingBalance > 0 && userRole !== "TELLER" && (
             <Button
               variant="outline"
               size="lg"
               className="rounded-2xl border-neutral-200 hover:border-indigo-500 hover:text-indigo-600 shadow-sm transition-all active:scale-[0.98]"
               onClick={() => {
                 setActionType("pay-from-account");
                 setActionDialogOpen(true);
               }}
             >
               <Banknote className="h-4 w-4 mr-2" />
               Instant Collection
             </Button>
           )}

          {loan.status === "DISBURSED" && loan.outstandingBalance === 0 && (
            <Button
              variant="default"
              size="lg"
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-[0.98]"
              onClick={() => {
                setActionType("repaid");
                setActionDialogOpen(true);
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Finalize Closure
            </Button>
          )}

          <div className="h-12 w-px bg-neutral-100 mx-2 hidden lg:block" />
          <Button variant="ghost" size="icon" className="h-10 w-10 text-neutral-400 hover:text-neutral-900 border rounded-2xl">
             <ArrowUpRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Main Command Zone */}
        <div className="xl:col-span-3 space-y-8">
          
          {/* High-Impact Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             {[
               { label: "Original Principal", value: loan.amountGranted, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
               { label: "Total Interest Due", value: loan.interestAmount || (loan.totalAmountDue - loan.amountGranted), icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-50" },
               { label: "Amount Recovered", value: loan.amountPaid, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
               { label: "Active Balance", value: loan.outstandingBalance, icon: Zap, color: "text-rose-600", bg: "bg-rose-50" },
             ].map((stat, i) => (
                <Card key={i} className="border-neutral-100 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                   <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                         <div className="space-y-1">
                           <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                           <p className="text-2xl font-bold text-neutral-900">{formatCurrency(stat.value)}</p>
                           <div className="pt-1">
                              {stat.label === "Active Balance" ? (
                                 <div className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold border-rose-100 bg-rose-50 text-rose-600">
                                   {Math.round((loan.outstandingBalance / loan.totalAmountDue) * 100)}% REMAINING
                                 </div>
                              ) : (
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                    {Math.round((stat.value / loan.totalAmountDue) * 100)}% OF TOTAL
                                 </span>
                              )}
                           </div>
                         </div>
                         <div className={`p-3 rounded-lg ${stat.bg} ${stat.color} shrink-0`}>
                            <stat.icon className="h-6 w-6" />
                         </div>
                      </div>
                   </CardContent>
                </Card>
             ))}
          </div>

          {/* Operational Insights Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             {/* Payment Compliance & Health */}
             <Card className="rounded-xl border-neutral-100 shadow-sm overflow-hidden border-t-4 border-t-indigo-500">
                <CardHeader>
                   <CardTitle className="text-lg font-bold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <Activity className="h-5 w-5 text-indigo-500" />
                         Portfolio Recovery Sync
                      </div>
                      <div className={cn(
                        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold",
                        compliance.isOnTrack ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                      )}>
                         {compliance.isOnTrack ? "ON TRACK" : "BEHIND TARGET"}
                      </div>
                   </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                   <div className="space-y-4">
                      <div className="flex justify-between items-end">
                         <div className="space-y-1">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Repayment Weight</span>
                            <div className="text-2xl font-black text-neutral-800">{Math.round(health.paymentPercentage)}%</div>
                         </div>
                         <span className="text-xs font-medium text-muted-foreground italic">Target: {Math.round(compliance.timePercentage)}%</span>
                      </div>
                      <Progress value={health.paymentPercentage} className="h-2 bg-neutral-100" indicatorClassName="bg-indigo-600 rounded-full" />
                   </div>

                   <div className="space-y-4">
                      <div className="flex justify-between items-end">
                         <div className="space-y-1">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Contractual Time</span>
                            <div className="text-2xl font-black text-neutral-800">{Math.round(compliance.timePercentage)}%</div>
                         </div>
                         <span className="text-xs font-medium text-muted-foreground italic">{duration} Total</span>
                      </div>
                      <Progress value={compliance.timePercentage} className="h-2 bg-neutral-100" indicatorClassName="bg-neutral-800 rounded-full" />
                   </div>

                   <div className={cn(
                      "flex items-center gap-4 p-5 rounded-2xl border transition-colors",
                      compliance.isOnTrack ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"
                   )}>
                      <div className={cn("p-2 rounded-xl text-white", compliance.isOnTrack ? "bg-emerald-500" : "bg-rose-500")}>
                         {compliance.isOnTrack ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                      </div>
                      <div>
                         <div className="font-black text-sm uppercase tracking-tight">Sync Status: {compliance.isOnTrack ? "Healthy Compliance" : "Critical Variance"}</div>
                         <p className="text-xs text-muted-foreground font-medium italic mt-0.5">
                            {compliance.isOnTrack 
                               ? "Member contributions are currently ahead of or aligned with linear amortization." 
                               : "Recovery rate is lagging behind contractual time elapsed. Immediate engagement recommended."}
                         </p>
                      </div>
                   </div>
                </CardContent>
             </Card>

             {/* Security & Guarantees */}
             <Card className="rounded-xl border-neutral-100 shadow-sm overflow-hidden bg-neutral-50/50">
                <CardHeader>
                   <CardTitle className="text-lg font-bold flex items-center gap-2">
                       <Shield className="h-5 w-5 text-amber-500" />
                       Collateral & Guarantees
                   </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                   {loan.loanApplication.collateralType ? (
                      <div className="bg-white p-5 rounded-2xl border border-neutral-100 space-y-3 shadow-sm">
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Primary Security</span>
                            <div className="inline-flex items-center rounded-md border px-2 py-0 bg-amber-100 text-amber-700 border-transparent text-[8px] font-black uppercase">
                               {loan.loanApplication.collateralType}
                            </div>
                         </div>
                         <div className="flex items-center justify-between">
                             <div className="space-y-0.5">
                                <span className="text-xs font-bold text-neutral-500 uppercase tracking-tighter">Value Assessment</span>
                                <div className="text-xl font-black text-neutral-900">{formatCurrency(loan.loanApplication.collateralValue || 0)}</div>
                             </div>
                             {loan.loanApplication.forcedSaleValue && (
                                <div className="text-right space-y-0.5">
                                   <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Forced Sale Value</span>
                                   <div className="text-sm font-bold text-rose-600">{formatCurrency(loan.loanApplication.forcedSaleValue)}</div>
                                </div>
                             )}
                         </div>
                         <div className="pt-2">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Description</span>
                            <p className="text-xs font-medium text-neutral-600 italic leading-relaxed mt-1">
                               {loan.loanApplication.collateralDetails || "Detailed collateral specification not available."}
                            </p>
                         </div>
                      </div>
                   ) : (
                      <div className="p-10 text-center space-y-3 opacity-60">
                         <Shield className="h-10 w-10 text-neutral-300 mx-auto" />
                         <p className="text-xs font-medium italic">No primary collateral recorded for this application.</p>
                      </div>
                   )}

                   <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                         <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Guarantors Ledger</span>
                         <span className="text-[10px] font-black text-neutral-500">{guarantorsData.length} Selected</span>
                      </div>
                      <div className="space-y-2">
                         {Array.isArray(guarantorsData) && guarantorsData.length > 0 ? (
                            guarantorsData.map((g: any, i: number) => (
                               <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-100 shadow-sm group hover:border-indigo-200 transition-colors">
                                  <div className="flex items-center gap-3">
                                     <div className="h-8 w-8 rounded-full bg-neutral-50 flex items-center justify-center font-black text-[10px] text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                                        {g.name?.charAt(0) || "G"}
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="text-xs font-black text-neutral-800">{g.name || "Unnamed Guarantor"}</span>
                                        <span className="text-[10px] text-muted-foreground italic">{g.relationship || "Contact Witness"}</span>
                                     </div>
                                  </div>
                                  <span className="text-[10px] font-bold text-neutral-400">{g.phone || "No direct phone"}</span>
                               </div>
                            ))
                         ) : (
                            <div className="p-4 bg-white/40 rounded-xl border border-dashed text-center text-[10px] font-medium text-muted-foreground italic">
                               No external guarantors verified for this loan instrument.
                            </div>
                         )}
                      </div>
                   </div>
                </CardContent>
             </Card>
          </div>

          {/* Detailed Repayment Ledger */}
          <Card className="rounded-xl border-neutral-100 shadow-sm overflow-hidden border-t-4 border-t-emerald-500">
             <CardHeader className="flex flex-row items-center justify-between border-b border-neutral-50 pb-6">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Layers className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            Repayment Ledger & Forecast
                        </CardTitle>
                        <CardDescription className="text-xs font-medium italic mt-1 text-emerald-600/70 uppercase tracking-tighter">Principal reduces 107000 Loans. Interest and penalty post to income.</CardDescription>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 bg-neutral-100 text-neutral-600 uppercase text-[9px] font-black tracking-widest border-transparent">
                        {loan.repayments.length} SUCCESSFUL
                    </div>
                </div>
             </CardHeader>
             <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-5 h-full">
                    <div className="md:col-span-3 border-r border-neutral-50">
                        <div className="px-6 py-4 bg-neutral-50/50 flex items-center gap-2 border-b border-neutral-50 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            <History className="h-3.5 w-3.5" /> Historical Recoveries
                        </div>
                        <div className="grid grid-cols-1 gap-3 border-b border-neutral-50 bg-white px-6 py-4 sm:grid-cols-3">
                           <div className="rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Principal Applied</p>
                              <p className="mt-1 text-sm font-black text-rose-700">
                                 {formatCurrency(loan.repayments.reduce((sum, payment) => sum + Number(payment.principalPaid || 0), 0))}
                              </p>
                           </div>
                           <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Interest Income</p>
                              <p className="mt-1 text-sm font-black text-amber-700">
                                 {formatCurrency(loan.repayments.reduce((sum, payment) => sum + Number(payment.interestPaid || 0), 0))}
                              </p>
                           </div>
                           <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Penalty Income</p>
                              <p className="mt-1 text-sm font-black text-blue-700">
                                 {formatCurrency(loan.repayments.reduce((sum, payment) => sum + Number(payment.penaltyPaid || 0), 0))}
                              </p>
                           </div>
                        </div>
                        {loan.repayments.length > 0 ? (
                           <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                 <thead>
                                    <tr className="bg-neutral-50/20 text-neutral-400 font-black uppercase text-[10px] tracking-widest border-b border-neutral-100">
                                       <th className="px-6 py-4 text-left font-black">Ref</th>
                                       <th className="px-6 py-4 text-left font-black">Amount</th>
                                       <th className="px-6 py-4 text-left font-black text-rose-600">Principal to 107000</th>
                                       <th className="px-6 py-4 text-left font-black text-amber-600">Interest Income</th>
                                       <th className="px-6 py-4 text-left font-black text-blue-600">Penalty Income</th>
                                       <th className="px-6 py-4 text-left font-black">Value Date</th>
                                       <th className="px-6 py-4 text-left font-black">Processor</th>
                                       <th className="px-6 py-4 text-right font-black">Status</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-neutral-50">
                                    {loan.repayments.map((payment) => (
                                       <tr key={payment.id} className="group hover:bg-neutral-50/50 transition-colors">
                                          <td className="px-6 py-4 font-mono text-[10px] text-muted-foreground uppercase">{payment.id.slice(-6)}</td>
                                          <td className="px-6 py-4 font-black text-neutral-900">{formatCurrency(payment.amount)}</td>
                                          <td className="px-6 py-4 font-bold text-rose-700">{formatCurrency(payment.principalPaid || 0)}</td>
                                          <td className="px-6 py-4 font-bold text-amber-700">{formatCurrency(payment.interestPaid || 0)}</td>
                                          <td className="px-6 py-4 font-bold text-blue-700">{formatCurrency(payment.penaltyPaid || 0)}</td>
                                          <td className="px-6 py-4 font-medium text-muted-foreground italic text-xs">{formatISODate(payment.repaymentDate)}</td>
                                          <td className="px-6 py-4 font-medium text-neutral-600 text-xs">
                                             <div className="flex flex-col leading-tight">
                                                <span className="font-semibold text-neutral-700">{payment.handler?.name || "System"}</span>
                                                <span className="text-[10px] uppercase tracking-widest text-neutral-400">{payment.handler?.role || "SYSTEM"}</span>
                                             </div>
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
                              <p className="text-[10px] font-bold uppercase tracking-widest">No transaction data</p>
                           </div>
                        )}
                    </div>
                    <div className="md:col-span-2 bg-neutral-50/30">
                        <div className="px-6 py-4 bg-neutral-50/50 flex items-center gap-2 border-b border-neutral-50 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            <Calculator className="h-3.5 w-3.5" /> Amortization Forecast
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm space-y-4">
                               <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                     <Info className="h-4 w-4" />
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Next Due Window</span>
                                     <span className="text-sm font-black text-neutral-800">{formatISODate(loan.dueDate)}</span>
                                  </div>
                               </div>
                               <Separator className="bg-neutral-50" />
                               <div className="space-y-3">
                                  <div className="flex justify-between items-center text-xs">
                                     <span className="font-medium text-neutral-500 uppercase tracking-tighter">Projected Principal</span>
                                     <span className="font-black text-neutral-800">{formatCurrency(loan.amountGranted)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                     <span className="font-medium text-neutral-500 uppercase tracking-tighter">Standard Interest</span>
                                     <span className="font-black text-neutral-800">{formatCurrency((loan.interestAmount || (loan.totalAmountDue - loan.amountGranted)))}</span>
                                  </div>
                                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-neutral-200">
                                     <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Liability</span>
                                     <span className="text-lg font-black text-indigo-600">{formatCurrency(loan.totalAmountDue)}</span>
                                  </div>
                               </div>
                            </div>
                            
                            <div className="space-y-3">
                               <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                                  <AlertTriangle className="h-3.5 w-3.5" /> RISK INDICATOR
                               </div>
                               <p className="text-[10px] font-medium text-neutral-500 italic leading-relaxed">
                                  This projection assumes standard amortization. Late payments may trigger statutory penalties as per the Bukonzo Emergency Sacco credit policy.
                               </p>
                               <Button variant="outline" className="w-full text-[9px] font-black uppercase tracking-[0.2em] rounded-xl py-5 border-neutral-200 hover:bg-neutral-900 hover:text-white transition-all">
                                  Generate Full PDF Schedule
                               </Button>
                            </div>
                        </div>
                    </div>
                </div>
             </CardContent>
          </Card>
        </div>

        {/* Intelligence Sidebar */}
        <div className="space-y-6">
          {/* Member Dossier */}
          <Card className="rounded-xl border-neutral-100 shadow-sm overflow-hidden bg-white">
            <CardHeader className="border-b border-neutral-50 pb-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-500" />
                Borrower Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center overflow-hidden transition-transform hover:scale-105">
                  {loan.member.user.image ? (
                    <img
                      src={loan.member.user.image}
                      alt={loan.member.user.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-indigo-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 leading-tight">{loan.member.user.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                     <div className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100 transition-colors hover:bg-indigo-100">#{loan.member.memberNumber}</div>
                     {loan.member.user.phone && <span className="text-xs font-medium text-muted-foreground italic">{loan.member.user.phone}</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                 <div className="flex items-center gap-3 text-sm group">
                    <div className="p-2 rounded-xl bg-neutral-50 text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                       <Mail className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-neutral-600 truncate">{loan.member.user.email || "No email available"}</span>
                 </div>
                 <div className="flex items-center gap-3 text-sm group">
                    <div className="p-2 rounded-xl bg-neutral-50 text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                       <Phone className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-neutral-600">{loan.member.user.phone || "No phone contact"}</span>
                 </div>
              </div>

              <Separator className="bg-neutral-50" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Connected Accounts</h4>
                   <div className="bg-neutral-100 text-neutral-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase">{loan.member.accounts.length} ACTIVE</div>
                </div>
                <div className="space-y-3">
                  {loan.member.accounts.map((account) => (
                    <div key={account.id} className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-indigo-100 transition-all group">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-neutral-500 uppercase">{account.accountNumber}</span>
                        <span className="font-black text-neutral-900">{formatCurrency(account.balance)}</span>
                      </div>
                      <div className="text-[9px] font-bold text-neutral-400 uppercase mt-1 opacity-60 italic">
                        {getAccountTypeDisplayName(account.accountType.name)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit & Origination */}
          <Card className="rounded-xl border-neutral-100 shadow-sm overflow-hidden bg-neutral-900 text-white">
            <CardHeader className="border-b border-white/5 pb-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-400" />
                Origination Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
               {[
                 { label: "Submitted by", value: loan.loanApplication.applicant?.name, role: loan.loanApplication.applicant?.role, icon: User },
                 { label: "Authorized by", value: loan.loanApplication.approver?.name, role: loan.loanApplication.approver?.role, icon: CheckCircle },
                 { label: "Disbursed by", value: loan.disbursedByUser.name, role: loan.disbursedByUser.role, icon: Banknote },
                 { label: "Portfolio Manager", value: allocatedTellerName, role: allocatedTellerRole, icon: UserCheck },
               ].map((audit, i) => (
                  <div key={i} className="flex gap-4 group">
                     <div className="h-10 w-10 shrink-0 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                        <audit.icon className="h-4 w-4" />
                     </div>
                     <div className="space-y-1 text-left">
                        <div className="text-[9px] font-black text-white/30 uppercase tracking-widest">{audit.label}</div>
                        <div className="text-xs font-bold leading-none">{audit.value || "Automated System"}</div>
                        <div className="text-[9px] font-bold text-indigo-400 uppercase opacity-60 tracking-tight">{audit.role || "SYSTEM_AGENT"}</div>
                     </div>
                  </div>
               ))}
            </CardContent>
          </Card>

          {/* Direct Navigation */}
          <div className="grid grid-cols-2 gap-3">
             <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 rounded-3xl border-neutral-100 bg-white hover:border-indigo-500 hover:text-indigo-600 hover:shadow-lg transition-all active:scale-[0.98]"
                onClick={() => router.push(`/dashboard/loan-applications/${loan.loanApplicationId}`)}
             >
                <div className="p-2 rounded-xl bg-neutral-50"><FileText className="h-4 w-4" /></div>
                <span className="text-[10px] font-black uppercase tracking-tight">Application</span>
             </Button>
             <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 rounded-3xl border-neutral-100 bg-white hover:border-indigo-500 hover:text-indigo-600 hover:shadow-lg transition-all active:scale-[0.98]"
                onClick={() => router.push(`/dashboard/members/${loan.member.id}`)}
             >
                <div className="p-2 rounded-xl bg-neutral-50"><User className="h-4 w-4" /></div>
                <span className="text-[10px] font-black uppercase tracking-tight">Full Profile</span>
             </Button>
          </div>
        </div>
      </div>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-8 border-none ring-1 ring-neutral-100 shadow-2xl">
          <DialogHeader className="space-y-4">
            <div className="h-16 w-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 mx-auto shadow-inner shadow-indigo-100">
               {actionType === "repaid" ? <CheckCircle className="h-8 w-8" /> : <Banknote className="h-8 w-8" />}
            </div>
            <div className="text-center">
               <DialogTitle className="text-2xl font-black tracking-tighter">
                 {actionType === "repaid" ? "Finalize Loan Closure" : "Execute Savings Recovery"}
               </DialogTitle>
               <DialogDescription className="text-sm font-medium text-muted-foreground mt-2 italic px-4 leading-relaxed">
                 {actionType === "repaid" 
                   ? "You are about to formally retire this loan instrument. This will reconcile all balances and close the analytical window for this account." 
                   : "Verify member liquidity and transfer authorization. This will deduct the outstanding amount directly from the member's strategic savings account."}
               </DialogDescription>
            </div>
          </DialogHeader>

          {actionType === "pay-from-account" ? (
             <div className="mt-8">
                <PayFromAccountForm
                  loanId={loan.id}
                  totalDue={loan.totalAmountDue - loan.amountPaid}
                  memberAccounts={loan.member.accounts}
                  onSuccess={() => {
                    setActionDialogOpen(false);
                    router.refresh();
                  }}
                  onCancel={() => setActionDialogOpen(false)}
                />
             </div>
          ) : (
          <div className="flex flex-col gap-3 mt-10">
            <Button 
                onClick={handleMarkAsRepaid} 
                disabled={loading} 
                className="w-full py-7 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-base font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-[0.98]"
            >
              {loading ? "Reconciling Ledger..." : "Authorize Closure"}
            </Button>
            <Button 
                variant="ghost" 
                onClick={() => setActionDialogOpen(false)}
                className="w-full py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground hover:bg-neutral-50"
            >
              Discard Action
            </Button>
          </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
