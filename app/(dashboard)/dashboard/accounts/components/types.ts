// types/account.ts

export interface User {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone?: string;
  image?: string;
}

export interface Member {
  memberNumber: string;
  registrationDate: string;
  user: User;
}

export interface AccountType {
  name: string;
  interestRate: number;
  minBalance: number;
  maxWithdrawal?: number;
}

export interface Branch {
  name: string;
  location: string;
  contactPhone?: string;
}

export interface TransactionUser {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
}

export interface Transaction {
  id: string;
  transactionRef: string;
  type: string;
  amount: number;
  status: string;
  description?: string;
  transactionDate: string;
  channel?: string;
  processedByUser?: TransactionUser;
}

export interface Deposit {
  id: string;
  amount: number;
  depositDate: string;
  channel: string;
  mobileMoneyRef?: string;
  handler: TransactionUser;
}

export interface Withdrawal {
  id: string;
  amount: number;
  withdrawalDate: string;
  channel: string;
  mobileMoneyRef?: string;
  handler: TransactionUser;
}

export interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  status: string;
  openedAt: string;
  closedAt?: string;
  member: Member;
  accountType: AccountType;
  branch: Branch;
  transactions: Transaction[];
  deposits: Deposit[];
  withdrawals: Withdrawal[];
}

export interface AccountSummary {
  totalDeposits: number;
  totalWithdrawals: number;
  depositsCount: number;
  withdrawalsCount: number;
  transactionCount: number;
  recentTransactions?: Transaction[];
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface PaginatedDeposits {
  deposits: Deposit[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface PaginatedWithdrawals {
  withdrawals: Withdrawal[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// Enum types from Prisma schema
export enum AccountStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DORMANT = "DORMANT",
  CLOSED = "CLOSED",
  SUSPENDED = "SUSPENDED",
}

export enum TransactionType {
  DEPOSIT = "DEPOSIT",
  WITHDRAWAL = "WITHDRAWAL",
  LOAN_DISBURSEMENT = "LOAN_DISBURSEMENT",
  LOAN_REPAYMENT = "LOAN_REPAYMENT",
  FLOAT_ALLOCATION = "FLOAT_ALLOCATION",
  FLOAT_PURCHASE = "FLOAT_PURCHASE",
  FLOAT_RECONCILIATION = "FLOAT_RECONCILIATION",
  OTHER = "OTHER",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REVERSED = "REVERSED",
}

export enum AccountTypeEnum {
  VOLUNTARY_SAVINGS = "VOLUNTARY_SAVINGS",
  FIXED_DEPOSIT = "FIXED_DEPOSIT",
  EMERGENCY_SAVINGS = "EMERGENCY_SAVINGS",
}
