// @ts-nocheck
// Re-initiate repayment breakdown logic - v1.0.1
// FILE: app/(dashboard)/dashboard/loan-repayments/initiate/InitiateRepaymentClient.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  DollarSign,
  User,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Filter,
  Shield,
  PieChart,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface InitiateRepaymentClientProps {
  activeLoans: any[];
  pendingRequests: any[];
  currentUserId: string;
  currentUserRole: string;
}

function calculatePenaltyDueForPreview(loan: any) {
  if (loan?.status !== "OVERDUE") return 0;

  const daysOverdue = Math.floor(
    (new Date().getTime() - new Date(loan.dueDate).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  if (daysOverdue <= 0) return 0;

  let penaltyRate = 0.02;
  if (daysOverdue >= 180) penaltyRate = 0.24;
  else if (daysOverdue >= 90) penaltyRate = 0.12;
  else if (daysOverdue >= 60) penaltyRate = 0.09;
  else if (daysOverdue >= 30) penaltyRate = 0.06;

  const calculatedPenalty = (loan?.outstandingBalance || 0) * penaltyRate;
  return Math.max(0, calculatedPenalty - (loan?.penaltyPaid || 0));
}

function getScheduleRemainingAmounts(schedule: any) {
  const paidAmount = Number(schedule?.paidAmount || 0);
  const scheduledInterest = Number(schedule?.interestPayment || 0);
  const scheduledPrincipal = Number(schedule?.principalPayment || 0);

  const paidInterest = Math.min(paidAmount, scheduledInterest);
  const paidPrincipal = Math.min(
    Math.max(0, paidAmount - paidInterest),
    scheduledPrincipal,
  );

  return {
    interestRemaining: Math.max(0, scheduledInterest - paidInterest),
    principalRemaining: Math.max(0, scheduledPrincipal - paidPrincipal),
  };
}

function getRepaymentAllocationPreview(loan: any, amount: number) {
  const safeAmount = Math.max(0, Number(amount || 0));
  const product = loan?.loanApplication?.loanProduct;
  const productRate = product?.interestRate || 0;
  const interestPeriod = product?.interestPeriod || "ANNUAL";

  let remaining = safeAmount;
  const penalty = Math.min(remaining, calculatePenaltyDueForPreview(loan));
  remaining -= penalty;

  let interest = 0;
  let principal = 0;
  let fullPeriodsCovered = 0;
  let partialPeriod: number | null = null;

  const schedules = Array.isArray(loan?.schedules)
    ? [...loan.schedules]
        .filter((schedule) => schedule?.status !== "PAID")
        .sort((a, b) => Number(a.period || 0) - Number(b.period || 0))
    : [];

  for (const schedule of schedules) {
    if (remaining <= 0.009) break;

    const { interestRemaining, principalRemaining } =
      getScheduleRemainingAmounts(schedule);
    const periodTotal = interestRemaining + principalRemaining;

    if (periodTotal <= 0.009) continue;

    let usedInPeriod = 0;

    const interestApplied = Math.min(remaining, interestRemaining);
    interest += interestApplied;
    remaining -= interestApplied;
    usedInPeriod += interestApplied;

    const principalApplied = Math.min(remaining, principalRemaining);
    principal += principalApplied;
    remaining -= principalApplied;
    usedInPeriod += principalApplied;

    if (usedInPeriod >= periodTotal - 0.009) {
      fullPeriodsCovered += 1;
    } else if (usedInPeriod > 0.009 && partialPeriod === null) {
      partialPeriod = Number(schedule.period || 0);
    }
  }

  if (remaining > 0.009) {
    const outstandingPrincipal = Math.max(
      0,
      Number((loan?.amountGranted || 0) - (loan?.principalPaid || 0)),
    );
    const outstandingInterest = Math.max(
      0,
      Number((loan?.outstandingBalance || 0) - outstandingPrincipal),
    );
    const principalLeft = Math.max(0, outstandingPrincipal - principal);
    const interestLeft = Math.max(0, outstandingInterest - interest);

    const extraInterest = Math.min(remaining, interestLeft);
    interest += extraInterest;
    remaining -= extraInterest;

    const extraPrincipal = Math.min(remaining, principalLeft);
    principal += extraPrincipal;
    remaining -= extraPrincipal;
  }

  return {
    interest: Number(interest.toFixed(2)),
    penalty: Number(penalty.toFixed(2)),
    principal: Number(principal.toFixed(2)),
    monthlyInterestRate:
      Number(
        (
          interestPeriod === "ANNUAL" ? productRate / 12 : productRate
        ).toFixed(4),
      ) || 0,
    fullPeriodsCovered,
    partialPeriod,
  };
}

function getLoanScheduleBalances(loan: any) {
  const schedules = Array.isArray(loan?.schedules) ? loan.schedules : [];

  if (schedules.length === 0) {
    const principalBalance = Math.max(
      0,
      Number((loan?.amountGranted || 0) - (loan?.principalPaid || 0)),
    );
    const interestBalance = Math.max(
      0,
      Number((loan?.interestAmount || 0) - (loan?.interestPaid || 0)),
    );

    return {
      principalBalance,
      interestBalance,
      outstandingBalance:
        interestBalance + principalBalance || Number(loan?.outstandingBalance || 0),
      totalScheduledAmount: Number(loan?.totalAmountDue || 0),
    };
  }

  let principalBalance = 0;
  let interestBalance = 0;
  let totalScheduledAmount = 0;

  for (const schedule of schedules) {
    const scheduledInterest = Number(schedule?.interestPayment || 0);
    const scheduledPrincipal = Number(schedule?.principalPayment || 0);
    const paidAmount = Number(schedule?.paidAmount || 0);

    const paidInterest = Math.min(paidAmount, scheduledInterest);
    const paidPrincipal = Math.min(
      Math.max(0, paidAmount - paidInterest),
      scheduledPrincipal,
    );

    interestBalance += Math.max(0, scheduledInterest - paidInterest);
    principalBalance += Math.max(0, scheduledPrincipal - paidPrincipal);
    totalScheduledAmount += Number(schedule?.totalPayment || 0);
  }

  return {
    principalBalance: Number(principalBalance.toFixed(2)),
    interestBalance: Number(interestBalance.toFixed(2)),
    outstandingBalance: Number((principalBalance + interestBalance).toFixed(2)),
    totalScheduledAmount: Number(totalScheduledAmount.toFixed(2)),
  };
}

export default function InitiateRepaymentClient({
  activeLoans,
  pendingRequests,
  currentUserId,
  currentUserRole,
}: InitiateRepaymentClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [showRepaymentDialog, setShowRepaymentDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();

  // Load loan from query param
  React.useEffect(() => {
    const loanId = searchParams.get("loanId");
    if (loanId && activeLoans.length > 0) {
      const loan = activeLoans.find(l => l.id === loanId);
      if (loan) {
        handleInitiateRepayment(loan);
      }
    }
  }, [searchParams, activeLoans]);

  // Repayment form state
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [notes, setNotes] = useState("");
  
  // Allocation state
  const [allocation, setAllocation] = useState({
    interest: 0,
    penalty: 0,
    principal: 0,
    monthlyInterestRate: 0,
    fullPeriodsCovered: 0,
    partialPeriod: null as number | null,
  });
  const [isManualAllocation, setIsManualAllocation] = useState(false);

  // Verification state
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [currentRequestId, setCurrentRequestId] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [memberInfo, setMemberInfo] = useState<{
    name: string;
    email: string | null;
    phone: string;
  } | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);

  // Filter active loans
  const filteredLoans = useMemo(() => {
    if (!searchQuery.trim() && statusFilter === "all") return activeLoans;

    return activeLoans.filter((loan) => {
      const matchesSearch =
        !searchQuery.trim() ||
        (loan.member?.user?.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (loan.member?.memberNumber || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (loan.loanApplication?.loanProduct?.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "disbursed" && loan.status === "DISBURSED") ||
        (statusFilter === "overdue" && loan.status === "OVERDUE");

      return matchesSearch && matchesStatus;
    });
  }, [activeLoans, searchQuery, statusFilter]);

  // Get loan status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, any> = {
      DISBURSED: {
        label: "Active",
        className: "bg-green-100 text-green-800 border-green-200",
        icon: CheckCircle,
      },
      OVERDUE: {
        label: "Overdue",
        className: "bg-red-100 text-red-800 border-red-200",
        icon: AlertCircle,
      },
    };

    const { label, className, icon: Icon } = config[status] || config.DISBURSED;

    return (
      <Badge variant="outline" className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  // Get request status badge
  const getRequestStatusBadge = (status: string) => {
    const config: Record<string, any> = {
      PENDING: {
        label: "Pending Approval",
        className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        icon: Clock,
      },
      APPROVED: {
        label: "Approved",
        className: "bg-green-100 text-green-800 border-green-200",
        icon: CheckCircle,
      },
      REJECTED: {
        label: "Rejected",
        className: "bg-red-100 text-red-800 border-red-200",
        icon: XCircle,
      },
      EXPIRED: {
        label: "Expired",
        className: "bg-gray-100 text-gray-800 border-gray-200",
        icon: Clock,
      },
    };

    const { label, className, icon: Icon } = config[status] || config.PENDING;

    return (
      <Badge variant="outline" className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  // Handle initiate repayment
  const handleInitiateRepayment = (loan: any) => {
    setSelectedLoan(loan);
    setSelectedAccountId(
      loan.member.accounts.length > 0 ? loan.member.accounts[0].id : ""
    );
    setRepaymentAmount(loan.outstandingBalance.toString());
    setNotes("");
    setAllocation(getRepaymentAllocationPreview(loan, loan.outstandingBalance));
    setShowRepaymentDialog(true);
    return;
    // Calculate split using loan product interest rate
    const amount = loan.outstandingBalance;
    const product = loan.loanApplication?.loanProduct;
    const productRate = product?.interestRate || 0;
    const interestPeriod = product?.interestPeriod || "ANNUAL";
    
    let rem = amount;
    let int = 0;
    let prin = 0;
    let pen = 0;
    
    // 1. Penalty (2% of outstanding, ONLY if overdue)
    let penDue = 0;
    if (loan.status === "OVERDUE") {
      const daysOverdue = Math.floor((new Date().getTime() - new Date(loan.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        // Multi-tiered penalty structure
        let penaltyRate = 0.02;
        if (daysOverdue >= 180) penaltyRate = 0.24;
        else if (daysOverdue >= 90) penaltyRate = 0.12;
        else if (daysOverdue >= 60) penaltyRate = 0.09;
        else if (daysOverdue >= 30) penaltyRate = 0.06;
        
        const calculatedPenalty = loan.outstandingBalance * penaltyRate;
        penDue = Math.max(0, calculatedPenalty - (loan.penaltyPaid || 0));
      }
    }
    pen = Math.min(rem, penDue);
    rem -= pen;
    
    // 2. Interest from product rate applied to repayment amount
    let monthlyRate: number;
    if (interestPeriod === "ANNUAL") {
      monthlyRate = productRate / 12 / 100; // e.g. 30% p.a. → 2.5% per month
    } else {
      monthlyRate = productRate / 100; // Already monthly
    }
    // Prioritize the exact interest amount from the next pending schedule
    const scheduledInterest = loan?.schedules?.[0]?.interestPayment;
    let interestDue = 0;
    
    if (scheduledInterest !== undefined && scheduledInterest !== null) {
      interestDue = Number(scheduledInterest);
    } else {
      const interestType =
        loan?.interestType || product?.interestType || "FLAT_RATE";
      const interestBase = interestType === "REDUCING_BALANCE" 
          ? (loan?.outstandingBalance || 0) 
          : (loan?.amountGranted || 0);
      interestDue = interestBase * monthlyRate;
    }

    int = Math.min(rem, Math.max(0, interestDue));
    rem -= int;
    
    // 3. Principal = whatever remains
    prin = Math.max(0, rem);
    
    setAllocation({
      interest: Number(int.toFixed(2)),
      penalty: Number(pen.toFixed(2)),
      principal: Number(prin.toFixed(2)),
      monthlyInterestRate: (monthlyRate || 0) * 100
    });
    
    setShowRepaymentDialog(true);
  };

  // Find selected account for balance checking
  const selectedAccount = selectedLoan?.member.accounts.find(
    (acc: any) => acc.id === selectedAccountId
  );

  const maxAllowed = selectedLoan ? Math.min(
    selectedLoan.outstandingBalance,
    selectedAccount ? selectedAccount.balance : Infinity
  ) : 0;

  // Handle amount change with capping
  const handleAmountChange = (val: string) => {
    let num = parseFloat(val) || 0;
    if (num > maxAllowed) {
      num = maxAllowed;
      toast.info("Amount capped", {
        description: `Maximum allowed based on balance and account: ${formatCurrency(maxAllowed)}`
      });
    }
    setRepaymentAmount(num.toString());
  };

  // Update allocation when amount changes (if not manual)
  React.useEffect(() => {
    if (!selectedLoan || isManualAllocation) return;
    
    const amount = parseFloat(repaymentAmount) || 0;
    setAllocation(getRepaymentAllocationPreview(selectedLoan, amount));
    return;
    const product = selectedLoan.loanApplication?.loanProduct;
    const productRate = product?.interestRate || 0;
    const interestPeriod = product?.interestPeriod || "ANNUAL";
    
    let rem = amount;
    let int = 0;
    let prin = 0;
    let pen = 0;
    
    // 1. Penalty (2% of outstanding, ONLY if overdue)
    let penDue = 0;
    if (selectedLoan.status === "OVERDUE") {
      const daysOverdue = Math.floor((new Date().getTime() - new Date(selectedLoan.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        // Multi-tiered penalty structure
        let penaltyRate = 0.02;
        if (daysOverdue >= 180) penaltyRate = 0.24;
        else if (daysOverdue >= 90) penaltyRate = 0.12;
        else if (daysOverdue >= 60) penaltyRate = 0.09;
        else if (daysOverdue >= 30) penaltyRate = 0.06;

        const calculatedPenalty = selectedLoan.outstandingBalance * penaltyRate;
        penDue = Math.max(0, calculatedPenalty - (selectedLoan.penaltyPaid || 0));
      }
    }
    pen = Math.min(rem, penDue);
    rem -= pen;
    
    // 2. Interest from product rate applied to repayment amount
    let monthlyRate: number;
    if (interestPeriod === "ANNUAL") {
      monthlyRate = productRate / 12 / 100; // e.g. 30% p.a. → 2.5% per month
    } else {
      monthlyRate = productRate / 100; // Already monthly
    }
    // Prioritize the exact interest amount from the next pending schedule
    const scheduledInterest = selectedLoan?.schedules?.[0]?.interestPayment;
    let interestDue = 0;
    
    if (scheduledInterest !== undefined && scheduledInterest !== null) {
      interestDue = Number(scheduledInterest);
    } else {
      const interestType =
        selectedLoan?.interestType ||
        product?.interestType ||
        "FLAT_RATE";
      const interestBase = interestType === "REDUCING_BALANCE" 
          ? (selectedLoan?.outstandingBalance || 0) 
          : (selectedLoan?.amountGranted || 0);
      interestDue = interestBase * monthlyRate;
    }

    int = Math.min(rem, Math.max(0, interestDue));
    rem -= int;
    
    // 3. Principal = whatever remains
    prin = Math.max(0, rem);
    
    setAllocation({
      interest: Number(int.toFixed(2)),
      penalty: Number(pen.toFixed(2)),
      principal: Number(prin.toFixed(2))
    });
  }, [repaymentAmount, selectedLoan, isManualAllocation]);

  const handleAllocationChange = (field: keyof typeof allocation, value: string) => {
    setIsManualAllocation(true);
    const numValue = parseFloat(value) || 0;
    
    setAllocation(prev => {
      // Since interest and principal are read-only now, 
      // this only really triggers for penalty.
      const newPenalty = field === "penalty" ? numValue : prev.penalty;
      const amount = parseFloat(repaymentAmount) || 0;
      
      // Interest is fixed by product rate (prev.interest)
      // Balance the principal: Principal = Total - Interest - Penalty
      const principal = Math.max(0, amount - prev.interest - newPenalty);
      
      return {
        ...prev,
        penalty: newPenalty,
        principal: Number(principal.toFixed(2))
      };
    });
  };

  const resetToAutoAllocation = () => {
    setIsManualAllocation(false);
    // Trigger the effect immediately by re-running the logic or just letting the effect catch it
  };

  // Handle submit repayment request
  // In InitiateRepaymentClient.tsx, update the handleSubmitRequest function:

  const handleSubmitRequest = async () => {
    console.log("🚀 Starting repayment request submission");

    if (!selectedAccountId) {
      toast.error("Please select an account");
      return;
    }

    const amount = parseFloat(repaymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amount > Number((selectedLoan.outstandingBalance + 0.1).toFixed(2))) {
      toast.error("Amount exceeds outstanding balance", {
        description: `Maximum allowed: ${formatCurrency(selectedLoan.outstandingBalance)}`
      });
      return;
    }

    const selectedAccount = selectedLoan.member.accounts.find(
      (acc: any) => acc.id === selectedAccountId
    );

    if (selectedAccount && amount > selectedAccount.balance) {
      toast.error("Insufficient account balance", {
        description: `Available: ${formatCurrency(selectedAccount.balance)}, Required: ${formatCurrency(amount)}`
      });
      return;
    }

    console.log("📤 Sending request with data:", {
      loanId: selectedLoan.id,
      accountId: selectedAccountId,
      amount: amount,
      notes: notes.trim() || undefined,
    });

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/loan-repayments/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: selectedLoan.id,
          accountId: selectedAccountId,
          amount: amount,
          notes: notes.trim() || undefined,
          interestAmount: allocation.interest,
          penaltyAmount: allocation.penalty,
          principalAmount: allocation.principal,
          isInstitution: !!selectedLoan.isInstitution,
        }),
      });

      const result = await response.json();
      console.log("📥 Response received:", result);

      if (!result.success || result.error) {
        console.error("❌ Request failed:", result.error);
        toast.error(result.error || "Failed to create repayment request");
      } else {
        console.log("✅ Request successful");
        
        // CHECK FOR IMMEDIATE PROCESSING
        if (result.processedImmediately) {
          toast.success("Repayment processed successfully (Auto-approved)");
          setShowRepaymentDialog(false);
          setRepaymentAmount("");
          setNotes("");
          setSelectedAccountId("");
          router.refresh();
          return;
        }

        toast.success("Verification code sent to member!");

        // Store request info and show verification dialog
        setCurrentRequestId(result.requestId);
        setMemberInfo({
          name: result.memberName,
          email: result.memberEmail,
          phone: result.memberPhone,
        });
        setShowRepaymentDialog(false);
        setShowVerificationDialog(true);
      }
    } catch (error) {
      console.error("❌ Exception caught:", error);
      toast.error("Failed to create repayment request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle verify code
  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    setIsVerifying(true);

    try {
      const response = await fetch("/api/v1/loan-repayments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: currentRequestId,
          verificationCode: verificationCode,
        }),
      });

      const result = await response.json();

      if (!result.success || result.error) {
        toast.error(result.error || "Verification failed");
      } else {
        toast.success("Repayment processed successfully!");
        setShowVerificationDialog(false);
        setVerificationCode("");
        setCurrentRequestId("");
        setMemberInfo(null);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to verify code");
    } finally {
      setIsVerifying(false);
    }
  };

  // Calculate statistics
  const stats = {
    totalLoans: activeLoans.length,
    totalOutstanding: activeLoans.reduce(
      (sum, loan) => sum + getLoanScheduleBalances(loan).outstandingBalance,
      0
    ),
    totalInterestBalance: activeLoans.reduce(
      (sum, loan) => sum + getLoanScheduleBalances(loan).interestBalance,
      0
    ),
    overdueLoans: activeLoans.filter((loan) => loan.status === "OVERDUE")
      .length,
    pendingRequests: pendingRequests.length,
  };
  const selectedLoanBalances = selectedLoan
    ? getLoanScheduleBalances(selectedLoan)
    : null;

  return (
    <>
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLoans}</div>
            <p className="text-xs text-muted-foreground">
              Loans with outstanding balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Outstanding
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalOutstanding)}
            </div>
            <p className="text-xs text-muted-foreground">
              Unpaid schedule balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Interest Balance
            </CardTitle>
            <PieChart className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalInterestBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Unpaid schedule interest
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Loans</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdueLoans}</div>
            <p className="text-xs text-muted-foreground">Loans past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Requests
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting member approval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="active-loans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active-loans">Active Loans</TabsTrigger>
          <TabsTrigger value="pending-requests">
            Pending Requests ({stats.pendingRequests})
          </TabsTrigger>
        </TabsList>

        {/* Active Loans Tab */}
        <TabsContent value="active-loans" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Active Loans</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select a loan to initiate repayment request
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by member, loan..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="disbursed">Active</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredLoans.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No loans found</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {searchQuery
                      ? "Try adjusting your search query"
                      : "There are no active loans at the moment"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLoans.map((loan) => {
                    const loanBalances = getLoanScheduleBalances(loan);
                    return (
                    <Card
                      key={loan.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          {/* Top Row: Member Info & Action Button */}
                          <div className="flex items-start justify-between gap-4">
                            {/* Left: Member Info */}
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <User className="h-6 w-6 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-semibold text-lg">
                                    {loan.member.user.name}
                                  </h4>
                                  {getStatusBadge(loan.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {loan.member.memberNumber} •{" "}
                                  {loan.member.user.email}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {loan.loanApplication.loanProduct.name}
                                </p>
                              </div>
                            </div>

                            {/* Right: Action Button */}
                            <div className="flex-shrink-0">
                                <Button
                                  onClick={() => handleInitiateRepayment(loan)}
                                  disabled={loan.member.accounts.length === 0}
                                  size="default"
                                  className="whitespace-nowrap"
                                >
                                <Send className="h-4 w-4 mr-2" />
                                Initiate Payment
                              </Button>
                            </div>
                          </div>

                          {/* Middle Row: Loan Financial Details */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-3 rounded-lg">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Outstanding
                              </p>
                              <p className="font-bold text-red-600 text-base">
                                {formatCurrency(loanBalances.outstandingBalance)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Interest Balance
                              </p>
                              <p className="font-semibold text-orange-600 text-base">
                                {formatCurrency(loanBalances.interestBalance)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Total Due
                              </p>
                              <p className="font-semibold text-base">
                                {formatCurrency(loanBalances.totalScheduledAmount || loan.totalAmountDue)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Paid
                              </p>
                              <p className="font-semibold text-green-600 text-base">
                                {formatCurrency(loan.amountPaid)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Due Date
                              </p>
                              <p className="font-semibold text-base">
                                {format(new Date(loan.dueDate), "MMM dd, yyyy")}
                              </p>
                            </div>
                          </div>

                          {/* Member Accounts Section */}
                          {loan.member.accounts.length > 0 ? (
                            <div>
                              <p className="text-xs text-muted-foreground mb-2 font-medium">
                                Available Accounts:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {loan.member.accounts.map((account: any) => (
                                  <div
                                    key={account.id}
                                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm"
                                  >
                                    <CreditCard className="h-4 w-4 text-gray-600" />
                                    <span className="font-medium">
                                      {account.accountNumber}
                                    </span>
                                    <span className="text-muted-foreground">
                                      •
                                    </span>
                                    <span className="font-semibold text-green-600">
                                      {formatCurrency(account.balance)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-sm text-red-600 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                No active accounts available for this member
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )})}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Requests Tab */}
        <TabsContent value="pending-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Repayment Requests</CardTitle>
              <p className="text-sm text-muted-foreground">
                Requests awaiting member approval
              </p>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">
                    No pending requests
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    All repayment requests have been processed
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <Card key={request.id} className="bg-yellow-50/50">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-lg">
                              {request.loan.member.user.name}
                            </h4>
                            {getRequestStatusBadge(request.status)}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground mb-1">
                                Amount
                              </p>
                              <p className="font-bold text-red-600 text-base">
                                {formatCurrency(request.amount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">
                                Account
                              </p>
                              <p className="font-medium">
                                {request.account.accountNumber}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">
                                Requested
                              </p>
                              <p className="font-medium">
                                {format(
                                  new Date(request.requestedAt),
                                  "MMM dd, HH:mm"
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">
                                Expires
                              </p>
                              <p className="font-medium">
                                {format(
                                  new Date(request.expiresAt),
                                  "MMM dd, HH:mm"
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Allocation Breakdown for Pending Request */}
                          <div className="flex gap-4 text-[11px] font-medium bg-white/50 p-2 rounded border border-yellow-200/50">
                            <div className="flex gap-1">
                              <span className="text-muted-foreground uppercase">Prin:</span>
                              <span className="text-blue-700">{formatCurrency(request.principalPaid || 0)}</span>
                            </div>
                            <div className="flex gap-1">
                              <span className="text-muted-foreground uppercase">Int:</span>
                              <span className="text-orange-700">{formatCurrency(request.interestPaid || 0)}</span>
                            </div>
                            <div className="flex gap-1">
                              <span className="text-muted-foreground uppercase">Pen:</span>
                              <span className="text-red-700">{formatCurrency(request.penaltyPaid || 0)}</span>
                            </div>
                          </div>

                          {request.notes && (
                            <div className="bg-white p-3 rounded border border-yellow-200">
                              <p className="text-xs text-muted-foreground mb-1">
                                Note:
                              </p>
                              <p className="text-sm">{request.notes}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Repayment Dialog */}
      <Dialog open={showRepaymentDialog} onOpenChange={setShowRepaymentDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Initiate Loan Repayment</DialogTitle>
            <DialogDescription>
              Request automatic repayment from member's account. Member will
              receive verification code via email and SMS.
            </DialogDescription>
          </DialogHeader>

          {selectedLoan && (
            <div className="space-y-4">
              {/* Member & Loan Info */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold mb-3 text-blue-900">
                  Loan Details
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Member</p>
                    <p className="font-medium">
                      {selectedLoan.member.user.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Member Number</p>
                    <p className="font-medium">
                      {selectedLoan.member.memberNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Loan Product</p>
                    <p className="font-medium">
                      {selectedLoan.loanApplication.loanProduct.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Outstanding Balance</p>
                    <p className="font-bold text-red-600">
                      {formatCurrency(selectedLoanBalances?.outstandingBalance || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Interest Balance</p>
                    <p className="font-bold text-orange-600">
                      {formatCurrency(selectedLoanBalances?.interestBalance || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Principal Balance</p>
                    <p className="font-bold text-blue-600">
                      {formatCurrency(selectedLoanBalances?.principalBalance || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Selection */}
              <div className="space-y-2">
                <Label htmlFor="account">
                  Select Account <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                >
                  <SelectTrigger id="account">
                    <SelectValue placeholder="Choose account to deduct from" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedLoan.member.accounts
                      .filter((account: any) => !account.accountType.name.toLowerCase().includes("share"))
                      .map((account: any) => (
                        <SelectItem key={account.id} value={account.id} disabled={account.balance <= 0}>
                          {account.accountNumber} ({account.accountType.name}) -
                          Balance: {formatCurrency(account.balance)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Repayment Amount <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    UGX
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    value={repaymentAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="pl-14"
                    max={maxAllowed}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className={repaymentAmount && parseFloat(repaymentAmount) >= maxAllowed ? "text-orange-600 font-medium" : ""}>
                    Max Allowed: {formatCurrency(maxAllowed)}
                  </span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => handleAmountChange(maxAllowed.toString())}
                  >
                    Use max allowed
                  </Button>
                </div>
              </div>

              {/* Repayment Allocation Breakdown */}
              {selectedLoan && parseFloat(repaymentAmount) > 0 && (
                <div className="space-y-4 border rounded-xl p-6 bg-slate-50/50 border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-blue-600" />
                      <h4 className="font-bold text-base text-slate-800 tracking-tight">Repayment Allocation Breakdown</h4>
                    </div>
                    {isManualAllocation && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={resetToAutoAllocation}
                        className="text-blue-600 hover:text-blue-700 text-xs h-7 px-2 hover:bg-blue-50"
                      >
                        <Filter className="h-3 w-3 mr-1" />
                        Auto-allocate
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Interest Card */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden group">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-400" />
                      <Label htmlFor="interest" className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 block pl-2 flex justify-between items-center">
                        <span>Interest Paid</span>
                        {allocation.monthlyInterestRate > 0 && (
                          <span className="text-[9px] text-orange-500 lowercase normal-case font-medium">({allocation.monthlyInterestRate.toFixed(1)}% monthly)</span>
                        )}
                      </Label>
                      <div className="flex items-center pl-2">
                        <Input
                          id="interest"
                          type="number"
                          value={allocation.interest}
                          readOnly
                          disabled
                          className="border-none p-0 h-9 text-2xl font-bold text-orange-600 focus-visible:ring-0 bg-transparent w-full cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Penalty Card */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden group">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />
                      <Label htmlFor="penalty" className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 block pl-2">Penalty Paid</Label>
                      <div className="flex items-center pl-2">
                        <Input
                          id="penalty"
                          type="number"
                          value={allocation.penalty}
                          onChange={(e) => handleAllocationChange("penalty", e.target.value)}
                          className="border-none p-0 h-9 text-2xl font-bold text-red-600 focus-visible:ring-0 bg-transparent w-full"
                        />
                      </div>
                    </div>

                    {/* Principal Card */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden group">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
                      <Label htmlFor="principal" className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 block pl-2">Principal Paid</Label>
                      <div className="flex items-center pl-2">
                        <Input
                          id="principal"
                          type="number"
                          value={allocation.principal}
                          readOnly
                          disabled
                          className="border-none p-0 h-9 text-2xl font-bold text-blue-600 focus-visible:ring-0 bg-transparent w-full cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mt-2 px-3 py-2 bg-blue-50/50 rounded border border-blue-100/50">
                    {(allocation.fullPeriodsCovered > 0 || allocation.partialPeriod) && (
                      <div className="pl-7 text-[12px] font-semibold text-blue-700">
                        {allocation.fullPeriodsCovered > 0
                          ? `Covers ${allocation.fullPeriodsCovered} full repayment period${allocation.fullPeriodsCovered === 1 ? "" : "s"}`
                          : "No full repayment period covered yet"}
                        {allocation.partialPeriod
                          ? ` and part of period ${allocation.partialPeriod}`
                          : ""}
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="text-[12px] text-blue-700/80 leading-relaxed font-medium">
                        <strong>Allocation Default:</strong> repayment is allocated period by period from the unpaid schedule, with each period applying interest first and then principal. This lets interest scale when the payment covers multiple periods.
                      </div>
                    </div>
                    {Math.abs(parseFloat(repaymentAmount) - (allocation.interest + allocation.penalty + allocation.principal)) > 0.01 && (
                      <div className="text-red-600 font-bold flex items-center gap-1.5 animate-pulse pl-7">
                        <XCircle className="h-4 w-4" />
                        <span className="text-[12px]">Total mismatch: {formatCurrency(Math.abs(parseFloat(repaymentAmount) - (allocation.interest + allocation.penalty + allocation.principal)))}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional information..."
                  rows={3}
                />
              </div>

              {/* Warning */}
              {["LOANOFFICER", "ADMIN", "BRANCHMANAGER"].includes(currentUserRole) ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">Instant Processing:</p>
                      <p>
                        As {currentUserRole}, this transaction will be processed immediately without requiring member verification.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold mb-1">Before submitting:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>
                          Member will receive verification code via email and SMS
                        </li>
                        <li>
                          You'll need to enter the code to complete transaction
                        </li>
                        <li>Code expires in 30 minutes</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowRepaymentDialog(false)}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitRequest}
                  disabled={
                    isSubmitting ||
                    !selectedAccountId ||
                    !repaymentAmount ||
                    parseFloat(repaymentAmount) <= 0
                  }
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending Request...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Code
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Verification Code Dialog */}
      <Dialog
        open={showVerificationDialog}
        onOpenChange={setShowVerificationDialog}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Enter Verification Code
            </DialogTitle>
            <DialogDescription>
              Ask the member for the 6-digit code sent to their email and phone
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Member Info */}
            {memberInfo && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-sm text-blue-900 mb-2">
                  Member Information:
                </h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-gray-600">Name:</span>{" "}
                    <span className="font-medium">{memberInfo.name}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">Email:</span>{" "}
                    <span className="font-medium">{memberInfo.email}</span>
                  </p>
                  {memberInfo.phone && (
                    <p>
                      <span className="text-gray-600">Phone:</span>{" "}
                      <span className="font-medium">{memberInfo.phone}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Code Input */}
            <div className="space-y-2">
              <Label htmlFor="verification-code">
                Verification Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="verification-code"
                type="text"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, ""))
                }
                maxLength={6}
                className="text-center text-2xl tracking-widest font-bold"
                autoFocus
              />
              <p className="text-xs text-gray-500">
                Ask the member to check their email or SMS for the code
              </p>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-800">
                  <p className="font-semibold mb-1">Important:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Code expires in 30 minutes</li>
                    <li>
                      Amount will be deducted immediately after verification
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowVerificationDialog(false);
                  setVerificationCode("");
                }}
                disabled={isVerifying}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerifyCode}
                disabled={isVerifying || verificationCode.length !== 6}
                className="flex-1"
              >
                {isVerifying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Verify & Process
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
