// ============================================================================
// types/incomes.ts - COMPLETE WORKING VERSION
// ============================================================================

import {
  AccountStatus,
  TransactionStatus,
  PaymentMethod,
} from "@prisma/client";

// ============================================================================
// SIMPLE TYPES FOR FORMS & COMPONENTS
// ============================================================================

export interface SimpleAccount {
  id: string;
  accountNumber: string;
  balance: number;
  status: AccountStatus;
  accountType: {
    id: string;
    name: string;
    minBalance: number;
  };
  member: {
    id: string;
    memberNumber: string;
    user: {
      name: string;
    };
  } | null;
  institution: {
    id: string;
    institutionNumber: string;
    institutionName: string;
  } | null;
}

export interface SimpleMember {
  id: string;
  memberNumber: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

export interface SimpleInstitution {
  id: string;
  institutionNumber: string;
  institutionName: string;
  institutionPhone?: string;
  institutionContact?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

export interface SimpleBudgetCategory {
  id: string;
  name: string;
  code?: string | null;
  kind: string;
  parentId?: string | null;
  parent?: {
    id: string;
    name: string;
  } | null;
  children?: SimpleBudgetCategory[];
}

export interface SimpleBranch {
  id: string;
  name: string;
  location: string;
}

// ============================================================================
// INCOME RECORD TYPES
// ============================================================================

export interface IncomeRecordWithRelations {
  id: string;
  budgetCategoryId: string | null;
  budgetCategory?: {
    id: string;
    name: string;
    code?: string | null;
    parent?: {
      id: string;
      name: string;
    } | null;
  } | null;
  amount: number;
  date: Date;
  recordDate: Date;
  description?: string | null;
  paymentMethod: PaymentMethod;
  receiptNo?: string | null;
  receiptNumber?: string | null;
  externalRef?: string | null;
  referenceNumber?: string | null;
  depositorName?: string | null;
  depositorContact?: string | null;
  notes?: string | null;
  status: TransactionStatus;
  branchId?: string | null;
  branch?: {
    id: string;
    name: string;
    location: string;
  } | null;
  memberId?: string | null;
  member?: {
    id: string;
    memberNumber: string;
    user: {
      name: string;
      email: string;
      phone: string | null;
    };
  } | null;
  accountId?: string | null;
  account?: {
    id: string;
    accountNumber: string;
    accountType: {
      name: string;
    };
  } | null;
  receivedByUserId: string;
  receivedBy?: {
    id: string;
    name: string;
    role: string;
  } | null;
  periodId?: string | null;
  period?: {
    name: string;
    startDate: Date;
    endDate: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Statistics {
  totalIncome: number;
  todayIncome: number;
  thisMonthIncome: number;
  totalRecords: number;
  todayRecords: number;
  averageIncome: number;
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    parentName?: string;
    count: number;
    amount: number;
  }[];
  branchBreakdown: {
    branchId: string | null;
    branchName: string;
    count: number;
    amount: number;
  }[];
  paymentMethodBreakdown: {
    method: PaymentMethod;
    count: number;
    amount: number;
  }[];
}

// ============================================================================
// types/accounts.ts - COMPLETE WORKING VERSION
// ============================================================================

import { Prisma, AccountStatus as AccStatus } from "@prisma/client";

// ✅ Account type - Uses Prisma's generated types
export type Account = Prisma.AccountGetPayload<{
  include: {
    member: {
      include: {
        user: true;
      };
    };
    institution: {
      include: {
        user: true;
      };
    };
    accountType: true;
    branch: true;
    _count: {
      select: {
        transactions: true;
        deposits: true;
        withdrawals: true;
      };
    };
  };
}>;

// ✅ Account Status Info type
export interface AccountStatusInfo {
  label: string;
  color: string;
  icon: string;
}

// ============================================================================
// DTO TYPES
// ============================================================================

export interface AccountCreateDTO {
  memberId?: string;
  institutionId?: string;
  accountTypeId: string;
  branchId: string;
  initialDeposit?: number;
  initialDepositReceiptNo?: string;
  fingerprintTemplate?: string;
  customAccountNumber?: string;
  sharesCount?: number;
  fixingStartDate?: Date;
  fixingEndDate?: Date;
  expectedInterest?: number;
  fundingSourceAccountId?: string;
  jointMemberIds?: string[];
}

export interface AccountUpdateDTO {
  id: string;
  status?: AccStatus;
  branchId?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getAccountStatusInfo(status: AccStatus): AccountStatusInfo {
  switch (status) {
    case AccStatus.ACTIVE:
      return {
        label: "Active",
        color: "bg-green-100 text-green-800",
        icon: "✓",
      };
    case AccStatus.INACTIVE:
      return {
        label: "Inactive",
        color: "bg-yellow-100 text-yellow-800",
        icon: "⏸",
      };
    case AccStatus.CLOSED:
      return {
        label: "Closed",
        color: "bg-red-100 text-red-800",
        icon: "✕",
      };
    case AccStatus.SUSPENDED:
      return {
        label: "Suspended",
        color: "bg-orange-100 text-orange-800",
        icon: "⚠",
      };
    default:
      return {
        label: "Unknown",
        color: "bg-gray-100 text-gray-800",
        icon: "?",
      };
  }
}

export function getAccountOwnerType(
  account: Account
): "member" | "institution" | "unknown" {
  if (account.member) return "member";
  if (account.institution) return "institution";
  return "unknown";
}

export function getAccountOwnerName(account: Account): string {
  if (account.member) return account.member.user.name;
  if (account.institution) return account.institution.institutionName;
  return "Unknown";
}

export function getAccountOwnerNumber(account: Account): string {
  if (account.member) return account.member.memberNumber;
  if (account.institution) return account.institution.institutionNumber;
  return "N/A";
}
