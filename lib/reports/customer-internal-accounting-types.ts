export interface CustomerInternalAccountingRecord {
  id: string;
  branchId: string;
  branchName: string;
  memberId: string | null;
  memberNumber: string;
  memberName: string;
  accountId: string;
  accountNumber: string;
  accountType: string;
  accountStatus: string;
  currentBalance: number;
  totalDeposits: number;
  depositCount: number;
  totalWithdrawals: number;
  withdrawalCount: number;
  totalLoanDisbursements: number;
  loanCount: number;
  totalLoanRepayments: number;
  repaymentCount: number;
  netMovement: number;
  lastActivityAt: string | null;
  lastTransactionType: string | null;
  openedAt: string;
}

export interface CustomerInternalAccountingSummary {
  totalAccounts: number;
  activeAccounts: number;
  suspendedAccounts: number;
  closedAccounts: number;
  totalMembers: number;
  totalBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalLoanDisbursements: number;
  totalLoanRepayments: number;
  netMovement: number;
}

export interface CustomerInternalAccountingFilters {
  branchId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export const EMPTY_CUSTOMER_INTERNAL_ACCOUNTING_SUMMARY: CustomerInternalAccountingSummary =
  {
    totalAccounts: 0,
    activeAccounts: 0,
    suspendedAccounts: 0,
    closedAccounts: 0,
    totalMembers: 0,
    totalBalance: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalLoanDisbursements: 0,
    totalLoanRepayments: 0,
    netMovement: 0,
  };
