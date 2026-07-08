// @ts-nocheck
// types/loanApplication.ts

import { LoanStatus } from "@prisma/client";

export interface LoanApplication {
  id: string;
  loanProductId: string;
  loanProduct: {
    id: string;
    name: string;
    minAmount: number;
    maxAmount: number;
    interestRate: number;
    repaymentPeriodDays: number;
  };
  memberId: string;
  member: {
    id: string;
    memberNumber: string;
    user: {
      name: string;
      email: string | null;
      phone: string | null;
      image: string | null;
    };
  };
  amountApplied: number;
  approvedAmount: number | null;
  applicationDate: Date;
  status: LoanStatus;
  purpose: string | null;
  approverId: string | null;
  approver: {
    id: string;
    name: string;
    role: string;
  } | null;
  approvalDate: Date | null;
  rejectionReason: string | null;
  applicantId: string | null;
  applicant: {
    id: string;
    name: string;
    role: string;
  } | null;
  allocatedTellerId: string | null;
  allocatedTeller: {
    id: string;
    name: string;
    role: string;
    email: string | null;
  } | null;
  loan: {
    id: string;
    amountGranted: number;
    totalAmountDue: number;
    outstandingBalance: number;
    disbursementDate: Date | null;
    dueDate: Date;
  } | null;
  repaymentPeriodMonths?: number | null;
  disbursementMethod?: string | null;
}

export interface Guarantor {
  fullName: string;
  membershipNumber?: string;
  phone?: string;
  relationship?: string;
  monthlyIncome?: number;
}

// types/loanApplication.ts
export interface LoanApplicationCreateDTO {
  // Existing fields...
  memberId: string;
  loanProductId: string;
  amountApplied: number;
  purpose?: string;
  loanOfficerId?: string;

  // Applicant details
  employer?: string;
  employmentStatus?: string;
  grossMonthlyIncome?: number;
  netMonthlyIncome?: number;

  // Loan details
  repaymentPeriodMonths?: number;
  repaymentStartDate?: string;
  // Loan specific details
  repaymentPeriodMonths?: number;
  repaymentStartDate?: Date;
  modeOfRepayment?: string;
  interestType?: "FLAT_RATE" | "REDUCING_BALANCE";
  interestPeriod?: "MONTHLY" | "ANNUAL";

  // Collateral
  collateralOffered?: string;
  collateralType?: string;
  collateralValue?: number;
  forcedSaleValue?: number;
  collateralLocation?: string;
  collateralDetails?: string;

  // Guarantors
  guarantors?: Array<{
    fullName: string;
    membershipNumber?: string;
    phone?: string;
    relationship?: string;
    monthlyIncome?: number;
  }>;

  // Declarations & Config
  hasExistingLoanWithSacco: boolean;
  existingLoanBalance?: number;
  hasOtherLoansWithInstitutions: boolean;
  otherLoanInstitutionName?: string;
  otherLoanBalance?: number;
  otherLoanMonthlyInstallment?: number;
  otherMonthlyObligations?: string;

  applyLoanProcessingFee: boolean;
  loanProcessingFeePercentage?: number;
  applyLoanInsurance: boolean;
  loanInsurancePercentage?: number;
  applyShareDeduction: boolean;
  shareAmount?: number;
  applyLoanApplicationFee: boolean;
  loanApplicationFeePercentage?: number;
  applyLoanStationeryFee: boolean;
  loanStationeryFeeAmount?: number;
  applyLoanCommitmentFee: boolean;
  loanCommitmentFeePercentage?: number;

  applicantDeclaration: boolean;
  applicantSignature?: string;
  applicantSignatureDate?: Date;
  guarantorAgreementAccepted: boolean;
  guarantorSignatureDate?: Date;

  // Bank & Payment info
  bankName?: string;
  bankBranch?: string;
  bankAccountNumber?: string;
  mobileMoneyNumber?: string;

  // Auto-calculated
  debtToIncomeRatio?: number;
}

export interface LoanApplicationUpdateDTO {
  id: string;
  amountApplied?: number;
  purpose?: string;
  repaymentPeriodMonths?: number;
  loanProductId?: string;
  interestType?: "FLAT_RATE" | "REDUCING_BALANCE";
}

export interface LoanApplicationDecisionDTO {
  id: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
  disbursementMethod?: any;
  amountGranted?: number;
  approvedRepaymentPeriod?: number;
  allocatedTellerId?: any;
}

export interface LoanCalculation {
  principal: number;
  interest: number;
  totalAmountDue: number;
  monthlyPayment: number;
}

// Helper function to get status display info
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
    [LoanStatus.PENDING]: {
      label: "Pending Review",
      color: "bg-yellow-100 text-yellow-800",
      icon: "⏳",
      description: "Application is under review",
    },
    [LoanStatus.APPROVED]: {
      label: "Approved",
      color: "bg-green-100 text-green-800",
      icon: "✅",
      description: "Application has been approved",
    },
    [LoanStatus.REJECTED]: {
      label: "Rejected",
      color: "bg-red-100 text-red-800",
      icon: "❌",
      description: "Application has been rejected",
    },
    [LoanStatus.DISBURSED]: {
      label: "Disbursed",
      color: "bg-blue-100 text-blue-800",
      icon: "💰",
      description: "Loan has been disbursed",
    },
    [LoanStatus.REPAID]: {
      label: "Repaid",
      color: "bg-gray-100 text-gray-800",
      icon: "✔️",
      description: "Loan has been fully repaid",
    },
    [LoanStatus.OVERDUE]: {
      label: "Overdue",
      color: "bg-red-100 text-red-800",
      icon: "⚠️",
      description: "Loan payment is overdue",
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

// Get loan application status options for forms
export const getLoanStatusOptions = () => [
  { label: "Pending Review", value: LoanStatus.PENDING },
  { label: "Approved", value: LoanStatus.APPROVED },
  { label: "Rejected", value: LoanStatus.REJECTED },
];

/**
 * Calculate loan details based on amount, interest rate, period, and method
 * @param principal - Loan amount
 * @param monthlyInterestRate - Monthly interest rate (e.g., 2.5 for 2.5% per month)
 * @param repaymentPeriodMonths - Repayment period in months
 * @param interestType - Interest calculation method (FLAT_RATE or REDUCING_BALANCE)
 * @returns LoanCalculation object with all calculated values
 */
export function calculateLoanDetails(
  principal: number,
  monthlyInterestRate: number,
  repaymentPeriodMonths: number,
  interestType: "FLAT_RATE" | "REDUCING_BALANCE" = "FLAT_RATE"
): LoanCalculation {
  let interest: number;
  let monthlyPayment: number;

  if (interestType === "FLAT_RATE") {
    // Flat Rate: Interest per month = (rate/100) × Principal
    const interestPerMonth = (monthlyInterestRate / 100) * principal;
    interest = interestPerMonth * repaymentPeriodMonths;
    monthlyPayment = (principal + interest) / repaymentPeriodMonths;
  } else {
    // Reducing Balance: Interest calculated on remaining balance
    let remainingPrincipal = principal;
    let remainingMonths = repaymentPeriodMonths;
    interest = 0;
    let totalPayment = 0;

    for (let month = 1; month <= repaymentPeriodMonths; month++) {
      const interestPayment = (monthlyInterestRate / 100) * remainingPrincipal;
      const principalPayment = remainingPrincipal / remainingMonths;
      
      interest += interestPayment;
      totalPayment += principalPayment + interestPayment;
      
      remainingPrincipal -= principalPayment;
      remainingMonths--;
    }

    monthlyPayment = totalPayment / repaymentPeriodMonths;
  }

  const totalAmountDue = principal + interest;

  return {
    principal,
    interest: Math.round(interest),
    totalAmountDue: Math.round(totalAmountDue),
    monthlyPayment: Math.round(monthlyPayment),
  };
}


/**
 * Calculate Debt-to-Income ratio
 * @param monthlyPayment - Monthly loan payment
 * @param netMonthlyIncome - Net monthly income
 * @returns DTI percentage
 */
export function computeDTI(
  monthlyPayment: number,
  netMonthlyIncome: number
): number {
  if (!netMonthlyIncome || isNaN(netMonthlyIncome) || netMonthlyIncome <= 0) return 0;
  return (monthlyPayment / netMonthlyIncome) * 100;
}

/**
 * Validate loan amount against product limits
 */
export function validateLoanAmount(
  amount: number,
  minAmount: number,
  maxAmount: number
): { valid: boolean; message?: string } {
  if (amount < minAmount) {
    return {
      valid: false,
      message: `Loan amount must be at least ${minAmount}`,
    };
  }
  if (amount > maxAmount) {
    return {
      valid: false,
      message: `Loan amount cannot exceed ${maxAmount}`,
    };
  }
  return { valid: true };
}

/**
 * Validate repayment period
 */
export function validateRepaymentPeriod(
  periodMonths: number,
  maxPeriodDays: number
): { valid: boolean; message?: string } {
  const maxMonths = Math.round(maxPeriodDays / 30);

  if (periodMonths < 1) {
    return {
      valid: false,
      message: "Repayment period must be at least 1 month",
    };
  }

  if (periodMonths > maxMonths) {
    return {
      valid: false,
      message: `Repayment period cannot exceed ${maxMonths} months`,
    };
  }

  return { valid: true };
}

/**
 * Calculate risk score based on DTI and other factors
 */
export function calculateRiskScore(params: {
  dti: number;
  hasExistingLoans: boolean;
  totalSavings: number;
  loanAmount: number;
}): { score: number; rating: "LOW" | "MEDIUM" | "HIGH" } {
  let score = 100;

  // DTI impact (0-40 points)
  if (params.dti > 50) score -= 40;
  else if (params.dti > 40) score -= 30;
  else if (params.dti > 30) score -= 20;
  else if (params.dti > 20) score -= 10;

  // Existing loans impact (0-20 points)
  if (params.hasExistingLoans) score -= 20;

  // Savings-to-loan ratio (0-20 points)
  const savingsRatio = params.totalSavings / params.loanAmount;
  if (savingsRatio < 0.1) score -= 20;
  else if (savingsRatio < 0.25) score -= 10;
  else if (savingsRatio < 0.5) score -= 5;

  // Determine rating
  let rating: "LOW" | "MEDIUM" | "HIGH";
  if (score >= 80) rating = "LOW";
  else if (score >= 60) rating = "MEDIUM";
  else rating = "HIGH";

  return { score, rating };
}
