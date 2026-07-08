// @ts-nocheck
// types/loan.ts
import { LoanStatus } from "@prisma/client";

export interface Loan {
  id: string;
  isInstitution?: boolean;
  loanApplicationId: string;
  loanApplication: {
    id: string;
    purpose: string | null;
    applicationDate: Date;
    interestType?: "FLAT_RATE" | "REDUCING_BALANCE" | null;
    loanOfficer?: {
      id: string;
      name: string;
      email?: string | null;
      role?: string | null;
    } | null;
    allocatedTeller?: {
      id: string;
      name: string;
      role?: string | null;
    } | null;
    loanProduct: {
      name: string;
      interestRate: number;
      repaymentPeriodDays: number;
      interestType: "FLAT_RATE" | "REDUCING_BALANCE";
    };
  };
  memberId: string;
  member: {
    id: string;
    memberNumber: string;
    user: {
      name: string;
      email: string;
      phone: string | null;
      image: string | null;
    };
  };
  amountGranted: number;
  interestRate: number;
  interestPeriod?: "MONTHLY" | "ANNUAL" | null;
  totalAmountDue: number;
  amountPaid: number;
  outstandingBalance: number;
  interestAmount: number | null;
  interestPaid: number;
  penaltyPaid: number;
  principalPaid: number;
  disbursementDate: Date;
  dueDate: Date;
  status: LoanStatus;
  disbursedByUserId: string;
  disbursedByUser: {
    id: string;
    name: string;
    role: string;
  };
  allocatedTellerId?: string | null;
  allocatedTeller?: {
    id: string;
    name: string;
    role?: string | null;
  } | null;
  branchId: string | null;
  branch: {
    id: string;
    name: string;
    location: string;
  } | null;
  repayments: Array<{
    id: string;
    amount: number;
    repaymentDate: Date;
    principalPaid?: number | null;
    interestPaid?: number | null;
    penaltyPaid?: number | null;
    handler: {
      name: string;
      role: string;
    };
  }>;
  _count?: {
    repayments: number;
  };
  schedules?: Array<{
    id: string;
    period: number;
    dueDate: Date;
    principalPayment: number;
    interestPayment: number;
    totalPayment: number;
    remainingBalance: number;
    status: string;
    paidAmount: number;
    paidDate?: Date | null;
  }>;
}

export interface LoanUpdateDTO {
  id: string;
  status?: LoanStatus;
  dueDate?: Date;
}

// Helper function to get loan status display info
export const getLoanStatusInfo = (status: LoanStatus) => {
  const statusConfig: Record<
    LoanStatus,
    {
      label: string;
      color: string;
      icon: string;
      description: string;
    }
  > = {
    [LoanStatus.DISBURSED]: {
      label: "Active",
      color: "bg-blue-100 text-blue-800",
      icon: "💰",
      description: "Loan is active and disbursed",
    },
    [LoanStatus.REPAID]: {
      label: "Fully Repaid",
      color: "bg-green-100 text-green-800",
      icon: "✅",
      description: "Loan has been fully repaid",
    },
    [LoanStatus.OVERDUE]: {
      label: "Overdue",
      color: "bg-red-100 text-red-800",
      icon: "⚠️",
      description: "Loan payment is overdue",
    },
    [LoanStatus.PENDING]: {
      label: "Pending",
      color: "bg-yellow-100 text-yellow-800",
      icon: "⏳",
      description: "Loan is pending approval",
    },
    [LoanStatus.APPROVED]: {
      label: "Approved",
      color: "bg-green-100 text-green-800",
      icon: "✓",
      description: "Loan has been approved",
    },
    [LoanStatus.REJECTED]: {
      label: "Rejected",
      color: "bg-gray-100 text-gray-800",
      icon: "❌",
      description: "Loan application was rejected",
    },
    [LoanStatus.WRITTEN_OFF]: {
      label: "Written Off",
      color: "bg-purple-100 text-purple-800",
      icon: "📝",
      description: "Loan has been written off",
    },
  };

  return statusConfig[status];
};

// Helper function to calculate loan health/risk
export const getLoanHealth = (loan: Loan) => {
  if (!loan.disbursementDate) {
    return {
      score: 100,
      status: "Pending",
      color: "text-blue-600",
      paymentPercentage: 0,
      timePercentage: 0,
    };
  }

  const paymentPercentage = (loan.amountPaid / loan.totalAmountDue) * 100;
  const timeElapsed =
    new Date().getTime() - new Date(loan.disbursementDate).getTime();
  const totalTime =
    new Date(loan.dueDate).getTime() -
    new Date(loan.disbursementDate).getTime();
  const timePercentage = totalTime > 0 ? (timeElapsed / totalTime) * 100 : 0;

  // Calculate health score
  let healthScore = 100;
  let healthStatus = "Good";
  let healthColor = "text-green-600";

  if (loan.status === LoanStatus.OVERDUE) {
    healthScore = 0;
    healthStatus = "Critical";
    healthColor = "text-red-600";
  } else if (loan.status === LoanStatus.WRITTEN_OFF) {
    healthScore = 0;
    healthStatus = "Written Off";
    healthColor = "text-purple-600";
  } else if (timePercentage > 80 && paymentPercentage < 50) {
    healthScore = 25;
    healthStatus = "Poor";
    healthColor = "text-red-600";
  } else if (timePercentage > 60 && paymentPercentage < 40) {
    healthScore = 50;
    healthStatus = "Fair";
    healthColor = "text-yellow-600";
  } else if (paymentPercentage >= timePercentage) {
    healthScore = 100;
    healthStatus = "Excellent";
    healthColor = "text-green-600";
  }

  return {
    score: healthScore,
    status: healthStatus,
    color: healthColor,
    paymentPercentage: Math.round(paymentPercentage),
    timePercentage: Math.round(Math.min(timePercentage, 100)),
  };
};

// Helper function to check if loan is overdue
export const isLoanOverdue = (loan: Loan): boolean => {
  return new Date() > loan.dueDate && loan.outstandingBalance > 0;
};

// Helper function to get days until due date
export const getDaysUntilDue = (dueDate: Date): number => {
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Helper function to format loan duration
export const getLoanDuration = (
  disbursementDate: Date | null,
  dueDate: Date,
): string => {
  if (!disbursementDate) return "Pending Disbursement";

  const diffTime =
    new Date(dueDate).getTime() - new Date(disbursementDate).getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 30) {
    return `${diffDays} days`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? "s" : ""}`;
  } else {
    const years = Math.floor(diffDays / 365);
    const remainingMonths = Math.floor((diffDays % 365) / 30);
    return `${years} year${years > 1 ? "s" : ""}${remainingMonths > 0 ? ` ${remainingMonths} month${remainingMonths > 1 ? "s" : ""}` : ""}`;
  }
};
