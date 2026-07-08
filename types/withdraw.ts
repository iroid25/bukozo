// types/withdraw.ts
import type { Prisma, TransactionStatus, UserRole } from "@prisma/client";

// =====================================================
// ENUMS
// =====================================================

export enum WithdrawalChannel {
  CASH = "CASH",
  MOBILE_MONEY = "MOBILE_MONEY",
  BANK_TRANSFER = "BANK_TRANSFER",
  CHEQUE = "CHEQUE",
}

export type WithdrawalChannelType =
  | "CASH"
  | "MOBILE_MONEY"
  | "BANK_TRANSFER"
  | "CHEQUE";

// =====================================================
// DTOs (Data Transfer Objects)
// =====================================================

export interface WithdrawalVerificationDTO {
  memberId: string;
  accountId: string;
  amount: number;
  channel: string;
  mobileMoneyRef?: string;
  description?: string;
}

export interface WithdrawalCreateDTO {
  memberId: string;
  accountId: string;
  amount: number;
  channel: string;
  mobileMoneyRef?: string;
  description?: string;
  verificationCode?: string;
  fingerprintVerified?: boolean;
  fingerprintMatchScore?: number;
}

export interface WithdrawalUpdateDTO {
  id: string;
  status?: TransactionStatus;
  channel?: string;
  mobileMoneyRef?: string;
  description?: string;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface WithdrawalActionResponse<T = any> {
  success?: boolean;
  error: string | null;
  data: T | null;
  message?: string | null;
}

export interface CreateVerificationResponse {
  verificationId: string;
  verificationCode: string;
  fee: number;
  totalAmount: number;
  expiresAt: Date;
  tellerFloatBalance: number;
  emailSent: boolean;
  smsSent: boolean;
}

export interface ProcessWithdrawalResponse {
  transaction: any;
  transactionRef: string;
  totalDeducted: number;
  fee: number;
  newFloatBalance: number;
  newAccountBalance: number;
}

// =====================================================
// STATISTICS TYPES
// =====================================================

export interface WithdrawalStatistics {
  today: {
    amount: number;
    count: {
      id: number;
    };
  };
  thisMonth: {
    amount: number;
    count: {
      id: number;
    };
  };
  total: {
    amount: number;
    count: {
      id: number;
    };
  };
}

export interface MemberWithdrawalStatistics {
  today: {
    amount: number;
    count: {
      id: number;
    };
  };
  thisMonth: {
    amount: number;
    count: {
      id: number;
    };
  };
  total: {
    amount: number;
    count: {
      id: number;
    };
  };
}

export interface WithdrawalSummary {
  totalAmount: number;
  totalCount: number;
  byChannel: Record<string, { amount: number; count: number }>;
  byStatus: Record<TransactionStatus, { amount: number; count: number }>;
  averageAmount: number;
  largestWithdrawal: number;
  smallestWithdrawal: number;
}

// =====================================================
// MAIN TYPES
// =====================================================

export interface Withdrawal {
  id: string;
  transactionId: string;
  memberId: string;
  accountId: string;
  amount: number;
  fee: number;
  withdrawalDate: Date;
  handlerUserId: string;
  channel: string;
  mobileMoneyRef: string | null;

  transaction: {
    id: string;
    status: string;
    channel: string;
    transactionRef: string;
    description: string | null;
    externalReference: string | null;
  };

  member: {
    id: string;
    memberNumber: string;
    user: {
      name: string;
      email: string;
      phone: string | null;
      image: string | null;
    };
  } | null;

  institution: {
    id: string;
    institutionName: string;
    user: {
      name: string;
      email: string;
      phone: string | null;
      image: string | null;
    };
  } | null;

  account: {
    id: string;
    accountNumber: string;
    balance: number;
    status: string;
    branchId: string;
    branch: {
      name: string;
      location: string;
    };
    accountType: {
      name: string;
    };
  };

  handler: {
    id: string;
    name: string;
    role: string;
  };
}

// Prisma-based withdrawal verification type
export type WithdrawalVerification = Prisma.WithdrawalVerificationGetPayload<{
  include: {
    member: {
      include: {
        user: {
          select: {
            name: true;
            email: true;
            phone: true;
          };
        };
      };
    };
    account: {
      include: {
        accountType: true;
        branch: true;
      };
    };
    handler: {
      select: {
        name: true;
        role: true;
      };
    };
  };
}>;

// =====================================================
// MEMBER & ACCOUNT TYPES
// =====================================================

export interface MemberAccount {
  id: string;
  accountNumber: string;
  balance: number;
  status: string;
  openedAt: Date;
  accountType: {
    id: string;
    name: string;
  };
  branch: {
    id: string;
    name: string;
    location: string;
  };
}

export interface MemberWithAccounts {
  id: string;
  memberNumber: string;
  isApproved: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    image: string | null;
  };
  accounts: Array<{
    id: string;
    accountNumber: string;
    balance: number;
    status: string;
    accountType: {
      id: string;
      name: string;
    };
    branch: {
      id: string;
      name: string;
      location: string;
    };
  }>;
}

// =====================================================
// FILTER TYPES
// =====================================================

export interface WithdrawalFilters {
  memberId?: string;
  accountId?: string;
  handlerUserId?: string;
  channel?: string;
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface VerificationFilters {
  memberId?: string;
  accountId?: string;
  isUsed?: boolean;
}

// =====================================================
// UI HELPER TYPES
// =====================================================

export interface WithdrawalChannelInfo {
  label: string;
  color: string;
  icon: string;
}

export interface TransactionStatusInfo {
  label: string;
  color: string;
  icon: string;
}

export interface ChannelOption {
  label: string;
  value: WithdrawalChannel;
}

export interface StatusOption {
  label: string;
  value: TransactionStatus;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get withdrawal channel display information
 */
export function getWithdrawalChannelInfo(
  channel: string
): WithdrawalChannelInfo {
  const channelMap: Record<string, WithdrawalChannelInfo> = {
    CASH: {
      label: "Cash",
      color: "bg-green-100 text-green-800",
      icon: "💵",
    },
    MOBILE_MONEY: {
      label: "Mobile Money",
      color: "bg-blue-100 text-blue-800",
      icon: "📱",
    },
    BANK_TRANSFER: {
      label: "Bank Transfer",
      color: "bg-purple-100 text-purple-800",
      icon: "🏦",
    },
    CHEQUE: {
      label: "Cheque",
      color: "bg-orange-100 text-orange-800",
      icon: "📝",
    },
  };

  return (
    channelMap[channel] || {
      label: channel,
      color: "bg-gray-100 text-gray-800",
      icon: "💰",
    }
  );
}

/**
 * Get transaction status display information
 */
export function getTransactionStatusInfo(
  status: TransactionStatus
): TransactionStatusInfo {
  const statusMap: Record<TransactionStatus, TransactionStatusInfo> = {
    PENDING: {
      label: "Pending",
      color: "text-yellow-600 bg-yellow-50 border-yellow-200",
      icon: "⏳",
    },
    COMPLETED: {
      label: "Completed",
      color: "text-green-600 bg-green-50 border-green-200",
      icon: "✓",
    },
    APPROVED: {
      label: "Approved",
      color: "text-blue-600 bg-blue-50 border-blue-200",
      icon: "✓",
    },
    FAILED: {
      label: "Failed",
      color: "text-red-600 bg-red-50 border-red-200",
      icon: "✗",
    },
    REVERSED: {
      label: "Reversed",
      color: "text-orange-600 bg-orange-50 border-orange-200",
      icon: "↩",
    },
  };

  return statusMap[status];
}

/**
 * Get withdrawal channel options for dropdowns
 */
export function getWithdrawalChannelOptions(): ChannelOption[] {
  return [
    {
      label: "Cash",
      value: WithdrawalChannel.CASH,
    },
    {
      label: "Mobile Money",
      value: WithdrawalChannel.MOBILE_MONEY,
    },
    {
      label: "Bank Transfer",
      value: WithdrawalChannel.BANK_TRANSFER,
    },
    {
      label: "Cheque",
      value: WithdrawalChannel.CHEQUE,
    },
  ];
}

/**
 * Get transaction status options for dropdowns
 */
export function getTransactionStatusOptions(): StatusOption[] {
  return [
    { label: "Pending", value: "PENDING" as TransactionStatus },
    { label: "Completed", value: "COMPLETED" as TransactionStatus },
    { label: "Approved", value: "APPROVED" as TransactionStatus },
    { label: "Failed", value: "FAILED" as TransactionStatus },
    { label: "Reversed", value: "REVERSED" as TransactionStatus },
  ];
}

/**
 * Check if withdrawal is successful
 */
export function isSuccessfulWithdrawal(status: TransactionStatus): boolean {
  return status === "COMPLETED" || status === "APPROVED";
}

/**
 * Check if withdrawal is pending
 */
export function isPendingWithdrawal(status: TransactionStatus): boolean {
  return status === "PENDING";
}

/**
 * Check if withdrawal has failed
 */
export function isFailedWithdrawal(status: TransactionStatus): boolean {
  return status === "FAILED" || status === "REVERSED";
}

/**
 * Get withdrawal status badge CSS classes
 */
export function getWithdrawalStatusBadgeClass(
  status: TransactionStatus
): string {
  const info = getTransactionStatusInfo(status);
  return `inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${info.color}`;
}

/**
 * Format amount as currency
 */
export function formatWithdrawalAmount(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get account type display name
 */
export function getAccountTypeDisplayName(name: string): string {
  const displayNames: Record<string, string> = {
    VOLUNTARY_SAVINGS: "Voluntary Savings",
    FIXED_DEPOSIT: "Fixed Deposit",
    EMERGENCY_SAVINGS: "Emergency Savings",
    SHARES: "Share Capital",
    LOAN: "Loan Account",
  };
  return displayNames[name] || name;
}
