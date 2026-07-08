// types/transactions.ts

import { TransactionStatus, TransactionType } from "@prisma/client";

// =====================
// ENUMS
// =====================

/**
 * Transaction Channel Enum (not in Prisma, so we define it here)
 */
export enum TransactionChannel {
  CASH = "Cash",
  MOBILE_MONEY = "Mobile Money",
  BANK_TRANSFER = "Bank Transfer",
  INTERNAL_TRANSFER = "Internal Transfer",
  CHECK = "Check",
  OTHER = "Other",
}

// =====================
// INTERFACES
// =====================

/**
 * Transaction Interface (matches Prisma output)
 */
export interface Transaction {
  id: string;
  transactionRef: string;
  memberId: string | null;
  member: {
    id: string;
    memberNumber: string;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      image: string | null;
    };
  } | null;
  institutionId?: string | null;
  institution?: {
    id: string;
    institutionNumber: string;
    institutionName: string;
    institutionEmail: string;
    institutionPhone: string;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      image: string | null;
    };
  } | null;
  accountId: string;
  account: {
    id: string;
    accountNumber: string;
    balance: number;
    accountType: {
      name: string;
    };
    branch: {
      id: string;
      name: string;
      location: string;
    };
  };
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description: string | null;
  transactionDate: Date;
  processedByUserId: string | null;
  processedByUser: {
    id: string;
    name: string;
    role: string;
  } | null;
  relatedTransactionId: string | null;
  externalReference: string | null;
  channel: string | null;
  paymentMethod: string | null;
  deposit: {
    id: string;
    channel: string;
    mobileMoneyRef: string | null;
    depositorName: string | null;
    handler: {
      name: string;
      role: string;
    };
  } | null;
  withdrawal: {
    id: string;
    channel: string;
    mobileMoneyRef: string | null;
    handler: {
      name: string;
      role: string;
    };
  } | null;
}

/**
 * Transaction Create DTO
 */
export interface TransactionCreateDTO {
  transactionRef?: string;
  memberId?: string | null;
  institutionId?: string | null;
  accountId: string;
  type: TransactionType;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  status?: TransactionStatus;
  description?: string;
  customerId?: string;
  userId: string;
  branchId?: string;
  loanId?: string;
  scheduleId?: string;
  transactionDate?: Date;
  valueDate?: Date;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  mobileMoneyRef?: string;
  externalReference?: string;
  channel?: string;
  depositorName?: string; // For deposits - who is bringing the money
}

/**
 * Transaction Update DTO
 */
export interface TransactionUpdateDTO {
  id: string;
  description?: string;
  status?: TransactionStatus;
  externalReference?: string;
  userId?: string;
  notes?: string;
}

/**
 * Transaction Reverse DTO
 */
export interface TransactionReverseDTO {
  transactionId: string;
  reason: string;
  userId: string;
}

// =====================
// TYPE HELPERS
// =====================

/**
 * Option type for select inputs
 */
export interface SelectOption {
  label: string;
  value: string;
}

/**
 * Transaction type info return type
 */
export interface TransactionTypeInfo {
  label: string;
  color: string;
  icon: string;
  description: string;
  isCredit: boolean | null;
}

/**
 * Transaction status info return type
 */
export interface TransactionStatusInfo {
  label: string;
  color: string;
  icon: string;
  description: string;
}

/**
 * Transaction channel info return type
 */
export interface TransactionChannelInfo {
  label: string;
  color: string;
  icon: string;
  description: string;
}

// =====================
// HELPER FUNCTIONS
// =====================

/**
 * Get transaction type display info with safe fallback
 */
export function getTransactionTypeInfo(
  type: TransactionType | string | null | undefined
): TransactionTypeInfo {
  // Handle null/undefined
  if (!type) {
    console.warn("Transaction type is null or undefined");
    return {
      label: "Unknown",
      color: "bg-gray-100 text-gray-800",
      icon: "❓",
      description: "Unknown transaction type",
      isCredit: null,
    };
  }

  // Normalize the type
  const normalizedType = type.toString().toUpperCase();

  const typeConfig: Record<string, TransactionTypeInfo> = {
    DEPOSIT: {
      label: "Deposit",
      color: "bg-green-100 text-green-800",
      icon: "💰",
      description: "Money deposited into account",
      isCredit: true,
    },
    WITHDRAWAL: {
      label: "Withdrawal",
      color: "bg-red-100 text-red-800",
      icon: "💸",
      description: "Money withdrawn from account",
      isCredit: false,
    },
    LOAN_DISBURSEMENT: {
      label: "Loan Disbursement",
      color: "bg-blue-100 text-blue-800",
      icon: "💵",
      description: "Loan amount disbursed",
      isCredit: true,
    },
    LOAN_REPAYMENT: {
      label: "Loan Repayment",
      color: "bg-purple-100 text-purple-800",
      icon: "💳",
      description: "Loan repayment received",
      isCredit: true,
    },
    FLOAT_ALLOCATION: {
      label: "Float Allocation",
      color: "bg-orange-100 text-orange-800",
      icon: "🏦",
      description: "Float allocated to user",
      isCredit: true,
    },
    FLOAT_PURCHASE: {
      label: "Float Purchase",
      color: "bg-yellow-100 text-yellow-800",
      icon: "🛒",
      description: "Float purchased/topped up",
      isCredit: true,
    },
    FLOAT_RECONCILIATION: {
      label: "Float Reconciliation",
      color: "bg-indigo-100 text-indigo-800",
      icon: "⚖️",
      description: "Float reconciliation adjustment",
      isCredit: null,
    },
    FEE: {
      label: "Fee",
      color: "bg-orange-100 text-orange-800",
      icon: "📋",
      description: "Transaction fee",
      isCredit: false,
    },
    OTHER: {
      label: "Other",
      color: "bg-gray-100 text-gray-800",
      icon: "📄",
      description: "Other transaction type",
      isCredit: null,
    },
  };

  const result = typeConfig[normalizedType];

  if (!result) {
    console.warn(`Unknown transaction type: ${type}`);
    return {
      label: type.toString(),
      color: "bg-gray-100 text-gray-800",
      icon: "❓",
      description: "Unknown transaction type",
      isCredit: null,
    };
  }

  return result;
}

/**
 * Get transaction status display info with safe fallback
 */
export function getTransactionStatusInfo(
  status: TransactionStatus | string | null | undefined
): TransactionStatusInfo {
  // Handle null/undefined
  if (!status) {
    console.warn("Transaction status is null or undefined");
    return {
      label: "Unknown",
      color: "bg-gray-100 text-gray-800",
      icon: "❓",
      description: "Unknown status",
    };
  }

  // Normalize the status
  const normalizedStatus = status.toString().toUpperCase();

  const statusConfig: Record<string, TransactionStatusInfo> = {
    PENDING: {
      label: "Pending",
      color: "bg-yellow-100 text-yellow-800",
      icon: "⏳",
      description: "Transaction is being processed",
    },
    COMPLETED: {
      label: "Completed",
      color: "bg-green-100 text-green-800",
      icon: "✅",
      description: "Transaction completed successfully",
    },
    APPROVED: {
      label: "Approved",
      color: "bg-blue-100 text-blue-800",
      icon: "✓",
      description: "Transaction approved",
    },
    FAILED: {
      label: "Failed",
      color: "bg-red-100 text-red-800",
      icon: "❌",
      description: "Transaction failed to process",
    },
    REVERSED: {
      label: "Reversed",
      color: "bg-gray-100 text-gray-800",
      icon: "↩️",
      description: "Transaction has been reversed",
    },
  };

  const result = statusConfig[normalizedStatus];

  if (!result) {
    console.warn(`Unknown transaction status: ${status}`);
    return {
      label: status.toString(),
      color: "bg-gray-100 text-gray-800",
      icon: "❓",
      description: "Unknown status",
    };
  }

  return result;
}

/**
 * Get transaction channel display info with safe fallback
 */
export function getTransactionChannelInfo(
  channel: string | null | undefined
): TransactionChannelInfo {
  // Handle null/undefined - default to Cash
  if (!channel) {
    return {
      label: "Cash",
      color: "bg-green-100 text-green-800",
      icon: "💵",
      description: "Cash transaction",
    };
  }

  // Normalize the channel (remove spaces, uppercase)
  const normalizedChannel = channel
    .toString()
    .toUpperCase()
    .replace(/\s+/g, "_");

  const channelConfig: Record<string, TransactionChannelInfo> = {
    CASH: {
      label: "Cash",
      color: "bg-green-100 text-green-800",
      icon: "💵",
      description: "Cash transaction",
    },
    MOBILE_MONEY: {
      label: "Mobile Money",
      color: "bg-blue-100 text-blue-800",
      icon: "📱",
      description: "Mobile money transfer",
    },
    BANK_TRANSFER: {
      label: "Bank Transfer",
      color: "bg-purple-100 text-purple-800",
      icon: "🏦",
      description: "Bank transfer",
    },
    BANK: {
      label: "Bank",
      color: "bg-purple-100 text-purple-800",
      icon: "🏦",
      description: "Bank transaction",
    },
    INTERNAL_TRANSFER: {
      label: "Internal Transfer",
      color: "bg-cyan-100 text-cyan-800",
      icon: "🔄",
      description: "Internal account transfer",
    },
    CHECK: {
      label: "Check",
      color: "bg-orange-100 text-orange-800",
      icon: "📝",
      description: "Check payment",
    },
    CHEQUE: {
      label: "Cheque",
      color: "bg-orange-100 text-orange-800",
      icon: "📝",
      description: "Cheque payment",
    },
    CARD: {
      label: "Card",
      color: "bg-orange-100 text-orange-800",
      icon: "💳",
      description: "Card payment",
    },
    DEBIT_CARD: {
      label: "Debit Card",
      color: "bg-orange-100 text-orange-800",
      icon: "💳",
      description: "Debit card payment",
    },
    CREDIT_CARD: {
      label: "Credit Card",
      color: "bg-pink-100 text-pink-800",
      icon: "💳",
      description: "Credit card payment",
    },
    ONLINE: {
      label: "Online",
      color: "bg-indigo-100 text-indigo-800",
      icon: "🌐",
      description: "Online payment",
    },
    OTHER: {
      label: "Other",
      color: "bg-gray-100 text-gray-800",
      icon: "💳",
      description: "Other payment method",
    },
  };

  const result = channelConfig[normalizedChannel];

  if (!result) {
    console.warn(`Unknown channel: ${channel}`);
    return {
      label: channel,
      color: "bg-gray-100 text-gray-800",
      icon: "💳",
      description: "Other payment method",
    };
  }

  return result;
}

/**
 * Check if transaction can be reversed
 */
export function canReverseTransaction(
  transaction: Transaction | any,
  userRole: string,
  currentUserId: string
): boolean {
  if (!transaction) return false;

  // Only completed transactions can be reversed
  if (
    transaction.status !== TransactionStatus.COMPLETED &&
    transaction.status !== "COMPLETED"
  ) {
    return false;
  }

  // Only within 24 hours
  const transactionDate = new Date(transaction.transactionDate);
  const hoursSinceTransaction =
    (Date.now() - transactionDate.getTime()) / (1000 * 60 * 60);

  if (hoursSinceTransaction > 24) {
    return false;
  }

  // Only processor or admin can reverse
  const isProcessor = transaction.processedByUserId === currentUserId;
  const isAdmin = userRole === "ADMIN" || userRole === "BRANCHMANAGER";

  return isProcessor || isAdmin;
}

/**
 * Determine if transaction affects balance positively
 */
export function isPositiveTransaction(
  type: TransactionType | string | null | undefined,
  amount: number
): boolean {
  if (!type) return amount > 0;

  const typeInfo = getTransactionTypeInfo(type);

  if (typeInfo.isCredit === null) {
    // For ambiguous types, use amount sign
    return amount > 0;
  }

  return typeInfo.isCredit;
}

/**
 * Format transaction reference for display
 */
export function formatTransactionReference(
  transactionRef: string | null | undefined,
  externalReference?: string | null
): string {
  if (!transactionRef) return "N/A";

  if (externalReference) {
    return `${transactionRef} (${externalReference})`;
  }

  return transactionRef;
}

/**
 * Get transaction priority for display
 */
export function getTransactionPriority(
  type: TransactionType | string,
  amount: number
): "high" | "medium" | "low" {
  const normalizedType = type.toString().toUpperCase();

  // High priority for large amounts or loan-related transactions
  if (
    amount >= 1000000 || // 1M UGX or more
    normalizedType === "LOAN_DISBURSEMENT" ||
    normalizedType === "LOAN_REPAYMENT"
  ) {
    return "high";
  }

  // Medium priority for moderate amounts or float operations
  if (
    amount >= 100000 || // 100K UGX or more
    normalizedType === "FLOAT_ALLOCATION" ||
    normalizedType === "FLOAT_RECONCILIATION"
  ) {
    return "medium";
  }

  return "low";
}

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number,
  currency: string = "UGX"
): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate transaction impact on account balance
 */
export function calculateTransactionImpact(
  type: TransactionType | string,
  amount: number,
  currentBalance: number
): {
  newBalance: number;
  balanceChange: number;
  isPositive: boolean;
} {
  const isPositive = isPositiveTransaction(type, amount);
  const balanceChange = isPositive ? amount : -amount;
  const newBalance = Math.max(0, currentBalance + balanceChange);

  return {
    newBalance,
    balanceChange,
    isPositive,
  };
}

// =====================
// FORM OPTIONS
// =====================

/**
 * Get transaction type options for forms
 */
export function getTransactionTypeOptions(): SelectOption[] {
  return [
    { label: "Deposit", value: TransactionType.DEPOSIT },
    { label: "Withdrawal", value: TransactionType.WITHDRAWAL },
    { label: "Loan Disbursement", value: TransactionType.LOAN_DISBURSEMENT },
    { label: "Loan Repayment", value: TransactionType.LOAN_REPAYMENT },
    { label: "Fee", value: TransactionType.FEE },
    { label: "Other", value: TransactionType.OTHER },
  ];
}

/**
 * Get transaction status options for forms
 */
export function getTransactionStatusOptions(): SelectOption[] {
  return [
    { label: "Pending", value: TransactionStatus.PENDING },
    { label: "Completed", value: TransactionStatus.COMPLETED },
    { label: "Approved", value: TransactionStatus.APPROVED },
    { label: "Failed", value: TransactionStatus.FAILED },
    { label: "Reversed", value: TransactionStatus.REVERSED },
  ];
}

/**
 * Get transaction channel options for forms
 */
export function getTransactionChannelOptions(): SelectOption[] {
  return [
    { label: "Cash", value: TransactionChannel.CASH },
    { label: "Mobile Money", value: TransactionChannel.MOBILE_MONEY },
    { label: "Bank Transfer", value: TransactionChannel.BANK_TRANSFER },
    { label: "Internal Transfer", value: TransactionChannel.INTERNAL_TRANSFER },
    { label: "Check", value: TransactionChannel.CHECK },
    { label: "Other", value: TransactionChannel.OTHER },
  ];
}

// =====================
// VALIDATION HELPERS
// =====================

/**
 * Validate withdrawal amount against balance
 */
export function validateWithdrawalAmount(
  amount: number,
  accountBalance: number,
  minBalance: number = 0
): { valid: boolean; message: string | null } {
  if (amount <= 0) {
    return {
      valid: false,
      message: "Amount must be greater than zero",
    };
  }

  const remainingBalance = accountBalance - amount;

  if (remainingBalance < minBalance) {
    return {
      valid: false,
      message: `Insufficient balance. Available: ${formatCurrency(accountBalance - minBalance)}`,
    };
  }

  return {
    valid: true,
    message: null,
  };
}

/**
 * Validate transaction amount (general)
 */
export function validateTransactionAmount(
  amount: number,
  maxAmount?: number
): { valid: boolean; message: string | null } {
  if (amount <= 0) {
    return {
      valid: false,
      message: "Amount must be greater than zero",
    };
  }

  if (maxAmount && amount > maxAmount) {
    return {
      valid: false,
      message: `Amount exceeds maximum limit of ${formatCurrency(maxAmount)}`,
    };
  }

  return {
    valid: true,
    message: null,
  };
}
