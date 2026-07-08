// types/loan-product.ts

export interface User {
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone?: string;
}

export interface Member {
  memberNumber: string;
  user: User;
}

export interface Approver {
  name: string;
  firstName: string;
  lastName: string;
}

export interface Loan {
  id: string;
  amountGranted: number;
  status: string;
  disbursementDate: string;
  outstandingBalance: number;
}

export interface LoanApplication {
  id: string;
  amountApplied: number;
  applicationDate: string;
  status: string;
  purpose?: string;
  approvalDate?: string;
  rejectionReason?: string;
  member: Member;
  approver?: Approver;
  loan?: Loan;
}

export interface LoanProduct {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  repaymentPeriodDays: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  loanApplications: LoanApplication[];
}
export interface LoanProductCreateDTO {
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  repaymentPeriodDays: number;
  description?: string;
  isActive: boolean;
}
export interface LoanProductStats {
  totalApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  pendingApplications: number;
  totalDisbursed: number;
  totalLoansCount: number;
  activeLoans: number;
  outstandingBalance: number;
  approvalRate: number;
}

export interface PaginatedLoanApplications {
  applications: LoanApplication[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// Form data interface for loan product updates
export interface LoanProductFormData {
  name: string;
  minAmount: string;
  maxAmount: string;
  interestRate: string;
  repaymentPeriodDays: string;
  description: string;
  isActive: boolean;
}

// API response interfaces
export interface LoanProductUpdateResponse {
  success: boolean;
  data?: LoanProduct;
  error?: string;
  details?: string[];
}

export interface LoanProductStatusResponse {
  success: boolean;
  data?: LoanProduct;
  message?: string;
  error?: string;
}

export interface LoanProductDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Enum types from Prisma schema
export enum LoanStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  DISBURSED = "DISBURSED",
  REPAID = "REPAID",
  OVERDUE = "OVERDUE",
}

// Validation schema type
export interface LoanProductValidationSchema {
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  repaymentPeriodDays: number;
  description?: string;
  isActive: boolean;
}
