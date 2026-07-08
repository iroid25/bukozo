// types/loanProduct.ts
export interface LoanProduct {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  repaymentPeriodDays: number;
  description: string | null;
  isActive: boolean;
  interestType: "FLAT_RATE" | "REDUCING_BALANCE";
  interestPeriod: "MONTHLY" | "ANNUAL";
  createdAt: Date;
  updatedAt: Date;
  ledgerAccountId: string | null;
  interestAccountId: string | null;
  penaltyAccountId: string | null;
  feeAccountId: string | null;
  _count?: {
    loanApplications: number;
  };
}

export interface LoanProductCreateDTO {
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  repaymentPeriodDays: number;
  description?: string;
  isActive: boolean;
  interestType?: "FLAT_RATE" | "REDUCING_BALANCE";
  ledgerAccountId?: string | null;
  interestAccountId?: string | null;
  penaltyAccountId?: string | null;
  feeAccountId?: string | null;
}
// export interface LoanProductCreateDTO {
//   name: string;
//   minAmount: number;
//   maxAmount: number;
//   interestRate: number;
//   repaymentPeriodDays: number;
//   description?: string;
//   isActive: boolean;
// }
export interface LoanProductUpdateDTO extends Partial<LoanProductCreateDTO> {
  id: string;
}

// Helper function to get repayment period display
export const getRepaymentPeriodDisplay = (days: number): string => {
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  if (days === 30) return "1 month";
  if (days < 365) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    if (remainingDays === 0) {
      return months === 1 ? "1 month" : `${months} months`;
    }
    return `${months} month${months > 1 ? "s" : ""} ${remainingDays} day${
      remainingDays > 1 ? "s" : ""
    }`;
  }
  const years = Math.floor(days / 365);
  const remainingDays = days % 365;
  if (remainingDays === 0) {
    return years === 1 ? "1 year" : `${years} years`;
  }
  return `${years} year${years > 1 ? "s" : ""} ${Math.floor(
    remainingDays / 30
  )} month${Math.floor(remainingDays / 30) > 1 ? "s" : ""}`;
};

// Common repayment period options for forms
export const getRepaymentPeriodOptions = () => [
  { value: 7, label: "1 Week (7 days)" },
  { value: 14, label: "2 Weeks (14 days)" },
  { value: 30, label: "1 Month (30 days)" },
  { value: 60, label: "2 Months (60 days)" },
  { value: 90, label: "3 Months (90 days)" },
  { value: 120, label: "4 Months (120 days)" },
  { value: 180, label: "6 Months (180 days)" },
  { value: 365, label: "1 Year (365 days)" },
  { value: 730, label: "2 Years (730 days)" },
];
