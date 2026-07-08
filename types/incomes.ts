// types/incomes.ts - COMPLETE CORRECTED VERSION

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
    email: string | null;
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
    email: string | null;
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
      email: string | null;
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
// Add this to your types/incomes.ts file

// ============================================================================
// BUDGET CATEGORY TYPES (for CategoryQuickAdd component)
// ============================================================================

export interface Category {
  id: string;
  name: string;
  code: string | null;
  kind: "INCOME" | "EXPENSE";
  description: string | null;
  isActive: boolean;
  parentId: string | null;
  parent?: Category | null;
  children?: Category[];
  createdAt: Date;
  updatedAt: Date;
}

// Alternatively, if you want to reuse SimpleBudgetCategory with more fields:
export interface BudgetCategoryFull {
  id: string;
  name: string;
  code: string | null;
  kind: "INCOME" | "EXPENSE";
  description: string | null;
  isActive: boolean;
  parentId: string | null;
  parent?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  children?: BudgetCategoryFull[];
  createdAt: Date;
  updatedAt: Date;
}

// Type alias to match what your component expects
// export type Category = BudgetCategoryFull;
