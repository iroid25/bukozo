// types/deposits.ts - UPDATED WITH INSTITUTION SUPPORT

import {
  TransactionStatus,
  TransactionType,
  UserRole,
  DepositType,
} from "@prisma/client";
import { ReactNode } from "react";

// Base Deposit Type (matching Prisma schema)
export interface Deposit {
  id: string;
  transactionId: string;
  memberId: string | null;
  institutionId: string | null;
  accountId: string;
  amount: number;
  depositDate: Date;
  handlerUserId: string;
  channel: string;
  mobileMoneyRef: string | null;
  depositorName: string | null;
  institutionName: string | null;

  transaction: {
    id: string;
    transactionRef: string;
    type: TransactionType;
    status: TransactionStatus;
    description: string | null;
    amount: number;
    currency: string;
    branchId: string | null;
    notes: string | null;
  };

  member: {
    id: string;
    memberNumber: string;
    user: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      image: string | null;
    };
  } | null;

  // ✅ SIMPLIFIED INSTITUTION TYPE (remove the 3 contact fields)
  institution: {
    id: string;
    institutionNumber: string;
    institutionName: string;
    institutionType: string;
    institutionEmail: string;
    institutionPhone: string;
    user: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      image: string | null;
    };
  } | null;

  account: {
    id: string;
    accountNumber: string;
    balance: number;
    accountType: {
      id: string;
      name: string;
      minBalance: number;
    };
    branch: {
      id: string;
      name: string;
      location: string;
    };
  };

  handler: {
    id: string;
    name: string;
    role: string;
  };
}

// Deposit Create DTO
export interface DepositCreateDTO {
  memberId?: string;
  institutionId?: string;
  accountId: string;
  amount: number;
  channel: string;
  mobileMoneyRef?: string;
  description?: string;
  depositorName?: string;
  depositType?: string | DepositType;
  // Fee payment fields
  feeType?: string;
  studentName?: string;
  studentClass?: string;
  studentYear?: string;
  institutionName?: string;
  // For bank fee payment - source member account to deduct from
  sourceMemberId?: string;
  sourceAccountId?: string;
}

// Deposit Statistics
export interface DepositStatistics {
  today: {
    amount: number;
    count: number;
  };
  thisMonth: {
    amount: number;
    count: number;
  };
  total: {
    amount: number;
    count: number;
  };
}

// Channel Info with Icon
export interface ChannelInfo {
  label: string;
  color: string;
  icon: ReactNode;
}

// Get Channel Display Info
export function getChannelInfo(channel: string): ChannelInfo {
  const channelMap: Record<string, ChannelInfo> = {
    CASH: {
      label: "Cash",
      color: "bg-green-100 text-green-800 border-green-200",
      icon: "💵",
    },
    MOBILE_MONEY: {
      label: "Mobile Money",
      color: "bg-blue-100 text-blue-800 border-blue-200",
      icon: "📱",
    },
    BANK: {
      label: "Bank Transfer",
      color: "bg-purple-100 text-purple-800 border-purple-200",
      icon: "🏦",
    },
    BANK_TRANSFER: {
      label: "Bank Transfer",
      color: "bg-purple-100 text-purple-800 border-purple-200",
      icon: "🏦",
    },
  };

  return (
    channelMap[channel] || {
      label: channel,
      color: "bg-gray-100 text-gray-800 border-gray-200",
      icon: "📄",
    }
  );
}

// Format Date Helper
export function formatDepositDate(date: Date | string): string {
  const depositDate = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(depositDate);
}

// Format Currency Helper
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Get Status Badge Color
export function getStatusColor(status: TransactionStatus): string {
  const statusColors: Record<TransactionStatus, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    COMPLETED: "bg-green-100 text-green-800 border-green-200",
    APPROVED: "bg-blue-100 text-blue-800 border-blue-200",
    FAILED: "bg-red-100 text-red-800 border-red-200",
    REVERSED: "bg-gray-100 text-gray-800 border-gray-200",
  };

  return statusColors[status] || "bg-gray-100 text-gray-800 border-gray-200";
}

// Account Type Display Names
export function getAccountTypeDisplayName(name: string): string {
  const displayNames: Record<string, string> = {
    VOLUNTARY_SAVINGS: "Voluntary Savings",
    FIXED_DEPOSIT: "Fixed Deposit",
    EMERGENCY_SAVINGS: "Emergency Savings",
    SHARES: "Shares Account",
    LOAN_SAVINGS: "Loan Savings",
    CURRENT: "Current Account",
  };

  return displayNames[name] || name;
}

// Validate Deposit Amount
export function validateDepositAmount(
  amount: number,
  minAmount: number = 1000,
): { valid: boolean; error?: string } {
  if (amount <= 0) {
    return { valid: false, error: "Amount must be greater than zero" };
  }

  if (amount < minAmount) {
    return {
      valid: false,
      error: `Minimum deposit amount is UGX ${minAmount.toLocaleString()}`,
    };
  }

  return { valid: true };
}

// Member Deposit Statistics (for member view)
export interface MemberDepositStatistics {
  today: {
    amount: number;
    count: number;
  };
  thisMonth: {
    amount: number;
    count: number;
  };
  total: {
    amount: number;
    count: number;
  };
}
