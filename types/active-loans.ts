// types/active-loans.ts
import { LoanStatus } from "@prisma/client";

/**
 * Active Loan Response from /api/v1/loans/active
   * API Response structure for /api/v1/loans/active that still has outstanding balance
 */
export interface ActiveLoanResponse {
  // Loan details
  id: string;
  status: LoanStatus;
  amountGranted: number;
  totalAmountDue: number;
  amountPaid: number;
  outstandingBalance: number;
  interestRate: number;
  disbursementDate: Date;
  dueDate: Date;

  // Member details
  memberId: string;
  memberNumber: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string | null;

  // Loan product details
  loanProductName: string;
  loanProductId: string;

  // Branch details
  branchName: string;
  branchLocation: string;

  // Stats
  repaymentsCount: number;

  // Calculated fields
  isOverdue: boolean;
  daysOverdue: number;
}

/**
 * API Response structure for /api/active-loans
 */
export interface ActiveLoansApiResponse {
  success: boolean;
  loans: ActiveLoanResponse[];
  count: number;
  userRole: string;
  error?: string;
}

/**
 * Active Loan for Form Dropdown
 * Simplified version for select components
 */
export interface ActiveLoanOption {
  id: string;
  label: string; // Format: "MEM-001 - John Doe - Business Loan (UGX 5,000,000)"
  memberName: string;
  memberNumber: string;
  loanProductName: string;
  outstandingBalance: number;
  status: LoanStatus;
  isOverdue: boolean;
}

/**
 * Helper function to convert ActiveLoanResponse to ActiveLoanOption
 */
export const toActiveLoanOption = (
  loan: ActiveLoanResponse
): ActiveLoanOption => ({
  id: loan.id,
  label: `${loan.memberNumber} - ${loan.memberName} - ${loan.loanProductName} (UGX ${loan.outstandingBalance.toLocaleString()})`,
  memberName: loan.memberName,
  memberNumber: loan.memberNumber,
  loanProductName: loan.loanProductName,
  outstandingBalance: loan.outstandingBalance,
  status: loan.status,
  isOverdue: loan.isOverdue,
});

/**
 * Type guard to check if API response is successful
 */
export const isSuccessfulActiveLoansResponse = (
  response: any
): response is ActiveLoansApiResponse => {
  return response && response.success === true && Array.isArray(response.loans);
};

/**
 * Hook result type for useActiveLoans
 */
export interface UseActiveLoansResult {
  loans: ActiveLoanResponse[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Filter options for active loans
 */
export interface ActiveLoansFilter {
  memberNumber?: string;
  memberName?: string;
  loanProductId?: string;
  minAmount?: number;
  maxAmount?: number;
  isOverdue?: boolean;
  branchId?: string;
}

/**
 * Helper function to filter active loans
 */
export const filterActiveLoans = (
  loans: ActiveLoanResponse[],
  filter: ActiveLoansFilter
): ActiveLoanResponse[] => {
  return loans.filter((loan) => {
    if (
      filter.memberNumber &&
      !loan.memberNumber.includes(filter.memberNumber)
    ) {
      return false;
    }
    if (
      filter.memberName &&
      !loan.memberName.toLowerCase().includes(filter.memberName.toLowerCase())
    ) {
      return false;
    }
    if (filter.loanProductId && loan.loanProductId !== filter.loanProductId) {
      return false;
    }
    if (filter.minAmount && loan.outstandingBalance < filter.minAmount) {
      return false;
    }
    if (filter.maxAmount && loan.outstandingBalance > filter.maxAmount) {
      return false;
    }
    if (filter.isOverdue !== undefined && loan.isOverdue !== filter.isOverdue) {
      return false;
    }
    return true;
  });
};

/**
 * Helper function to sort active loans
 */
export type ActiveLoansSortKey =
  | "memberName"
  | "outstandingBalance"
  | "disbursementDate"
  | "dueDate"
  | "daysOverdue";

export const sortActiveLoans = (
  loans: ActiveLoanResponse[],
  sortKey: ActiveLoansSortKey,
  direction: "asc" | "desc" = "asc"
): ActiveLoanResponse[] => {
  const sorted = [...loans].sort((a, b) => {
    let compareA: any;
    let compareB: any;

    switch (sortKey) {
      case "memberName":
        compareA = a.memberName.toLowerCase();
        compareB = b.memberName.toLowerCase();
        break;
      case "outstandingBalance":
        compareA = a.outstandingBalance;
        compareB = b.outstandingBalance;
        break;
      case "disbursementDate":
        compareA = new Date(a.disbursementDate).getTime();
        compareB = new Date(b.disbursementDate).getTime();
        break;
      case "dueDate":
        compareA = new Date(a.dueDate).getTime();
        compareB = new Date(b.dueDate).getTime();
        break;
      case "daysOverdue":
        compareA = a.daysOverdue;
        compareB = b.daysOverdue;
        break;
      default:
        return 0;
    }

    if (compareA < compareB) return direction === "asc" ? -1 : 1;
    if (compareA > compareB) return direction === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
};

/**
 * Helper function to get active loans statistics
 */
export interface ActiveLoansStats {
  totalLoans: number;
  totalOutstanding: number;
  overdueLoans: number;
  totalOverdueAmount: number;
  averageLoanAmount: number;
  averageOutstanding: number;
}

export const getActiveLoansStats = (
  loans: ActiveLoanResponse[]
): ActiveLoansStats => {
  const overdueLoans = loans.filter((loan) => loan.isOverdue);

  return {
    totalLoans: loans.length,
    totalOutstanding: loans.reduce(
      (sum, loan) => sum + loan.outstandingBalance,
      0
    ),
    overdueLoans: overdueLoans.length,
    totalOverdueAmount: overdueLoans.reduce(
      (sum, loan) => sum + loan.outstandingBalance,
      0
    ),
    averageLoanAmount:
      loans.length > 0
        ? loans.reduce((sum, loan) => sum + loan.amountGranted, 0) /
          loans.length
        : 0,
    averageOutstanding:
      loans.length > 0
        ? loans.reduce((sum, loan) => sum + loan.outstandingBalance, 0) /
          loans.length
        : 0,
  };
};

/**
 * Helper to format currency
 */
export const formatCurrency = (amount: number): string => {
  return `UGX ${amount.toLocaleString()}`;
};

/**
 * Helper to format date
 */
export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Helper to get overdue status badge
 */
export const getOverdueStatusBadge = (loan: ActiveLoanResponse) => {
  if (!loan.isOverdue) {
    return {
      label: "Current",
      color: "bg-green-100 text-green-800",
      icon: "✓",
    };
  }

  if (loan.daysOverdue <= 7) {
    return {
      label: `${loan.daysOverdue} days overdue`,
      color: "bg-yellow-100 text-yellow-800",
      icon: "⚠️",
    };
  }

  if (loan.daysOverdue <= 30) {
    return {
      label: `${loan.daysOverdue} days overdue`,
      color: "bg-orange-100 text-orange-800",
      icon: "⚠️",
    };
  }

  return {
    label: `${loan.daysOverdue} days overdue`,
    color: "bg-red-100 text-red-800",
    icon: "❌",
  };
};
