// @ts-nocheck
// ============================================================================
// types/expenditure.ts
// ============================================================================

import {
  TransactionStatus,
  PaymentMethod,
  ExpenditureRecord,
  ExpenditureCategory,
  BudgetCategory,
  Branch,
  User,
  FinancialPeriod,
} from "@prisma/client";

// ============================================================================
// BASE TYPES
// ============================================================================

export type ExpenditureRecordWithRelations = ExpenditureRecord & {
  category: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  budgetCategory: {
    id: string;
    name: string;
    code: string | null;
    parentId: string | null;
  } | null;
  branch: {
    id: string;
    name: string;
    location: string | null;
  } | null;
  submittedBy: {
    id: string;
    name: string;
    role: string;
  };
  approvedBy: {
    id: string;
    name: string;
    role: string;
  } | null;
  period: {
    name: string;
    startDate: Date;
    endDate: Date;
  } | null;
};

export type ExpenditureRecordDetail = ExpenditureRecord & {
  category: ExpenditureCategory | null;
  budgetCategory: BudgetCategory | null;
  branch: Branch | null;
  submittedBy: {
    id: string;
    name: string;
    role: string;
    email: string | null;
  };
  approvedBy: {
    id: string;
    name: string;
    role: string;
    email: string | null;
  } | null;
  period: FinancialPeriod | null;
};

// ============================================================================
// DTO TYPES (Data Transfer Objects)
// ============================================================================

export interface ExpenditureRecordCreateDTO {
  categoryId: string;
  amount: number;
  recordDate: Date;
  description?: string;
  payee?: string;
  paymentMethod?: PaymentMethod;
  branchId?: string;
  voucherNo?: string;
  externalRef?: string;
  submittedByUserId: string;
}

export interface ExpenditureRecordUpdateDTO {
  id: string;
  categoryId?: string;
  amount?: number;
  description?: string;
  payee?: string;
  paymentMethod?: PaymentMethod;
  voucherNo?: string;
  status?: TransactionStatus;
}

export interface ExpenditureApprovalDTO {
  id: string;
  approvedByUserId: string;
  status: "COMPLETED" | "FAILED";
  rejectionReason?: string;
  paidByTellerId?: string;
}

// ============================================================================
// TELLER TYPES
// ============================================================================

export interface AvailableTeller {
  id: string;
  name: string;
  role: string;
  branchName?: string;
  floatBalance: number;
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  count: number;
  amount: number;
}

export interface BranchBreakdown {
  branchId: string | null;
  branchName: string;
  count: number;
  amount: number;
}

export interface ExpenditureStatistics {
  totalExpenditure: number;
  totalRecords: number;
  todayExpenditure: number;
  thisMonthExpenditure: number;
  pendingExpenditure: number;
  pendingCount: number;
  averageExpenditure: number;
  categoryBreakdown: CategoryBreakdown[];
  branchBreakdown: BranchBreakdown[];
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ExpenditureRecordResponse {
  success?: boolean;
  error: string | null;
  message?: string | null;
  data: ExpenditureRecord | ExpenditureRecordWithRelations | null;
}

export interface ExpenditureRecordsListResponse {
  success: boolean;
  error?: string;
  data: ExpenditureRecordWithRelations[];
}

export interface ExpenditureRecordDetailResponse {
  success: boolean;
  error?: string;
  data: ExpenditureRecordDetail | null;
}

export interface ExpenditureStatisticsResponse {
  success: boolean;
  error?: string;
  data: ExpenditureStatistics;
}

export interface AvailableTellersResponse {
  success: boolean;
  error?: string;
  data: AvailableTeller[];
}

export interface ExpenditureCategoriesResponse {
  success: boolean;
  error?: string;
  data: BudgetCategory[];
}

export interface BranchesResponse {
  success: boolean;
  error?: string;
  data: Array<{
    id: string;
    name: string;
    location: string | null;
  }>;
}

export interface DeleteResponse {
  error: string | null;
  data: boolean | null;
}

// ============================================================================
// FILTER & QUERY TYPES
// ============================================================================

export interface ExpenditureFilters {
  status?: TransactionStatus;
  categoryId?: string;
  branchId?: string;
  startDate?: Date;
  endDate?: Date;
  paymentMethod?: PaymentMethod;
  submittedByUserId?: string;
  approvedByUserId?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface ExpenditureSortOptions {
  field: "recordDate" | "amount" | "createdAt" | "status";
  direction: "asc" | "desc";
}

export interface ExpenditurePaginationOptions {
  page: number;
  limit: number;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface ExpenditureFormData {
  categoryId: string;
  amount: string | number;
  recordDate: string | Date;
  description?: string;
  payee?: string;
  paymentMethod: PaymentMethod;
  voucherNo?: string;
  externalRef?: string;
}

export interface ExpenditureApprovalFormData {
  status: "COMPLETED" | "FAILED";
  rejectionReason?: string;
  paidByTellerId?: string;
}

// ============================================================================
// TABLE COLUMN TYPES
// ============================================================================

export interface ExpenditureTableColumn {
  id: string;
  name: string;
  categoryName: string;
  amount: number;
  recordDate: Date;
  status: TransactionStatus;
  submittedBy: string;
  approvedBy?: string;
  branch?: string;
  payee?: string;
  voucherNo?: string;
  actions?: React.ReactNode;
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface ExpenditureAuditLog {
  id: string;
  expenditureId: string;
  action: "CREATED" | "UPDATED" | "APPROVED" | "REJECTED" | "DELETED";
  performedBy: string;
  performedAt: Date;
  changes?: Record<string, { from: any; to: any }>;
  notes?: string;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ExpenditureValidationError {
  field: string;
  message: string;
}

export interface ExpenditureValidationResult {
  isValid: boolean;
  errors: ExpenditureValidationError[];
}

// ============================================================================
// ENUM HELPERS
// ============================================================================

export const EXPENDITURE_STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  FAILED: "Failed",
  REVERSED: "Reversed",
  PROCESSING: "Processing",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  MOBILE_MONEY: "Mobile Money",
  CHEQUE: "Cheque",
  CARD: "Card",
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const EXPENDITURE_LIMITS = {
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 1000000000, // 1 billion
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_PAYEE_LENGTH: 100,
  MAX_VOUCHER_LENGTH: 50,
} as const;

export const EXPENDITURE_PERMISSIONS = {
  CREATE: ["TELLER"],
  APPROVE: ["ADMIN", "ACCOUNTANT", "BRANCHMANAGER"],
  UPDATE: ["ADMIN", "ACCOUNTANT"],
  DELETE: ["ADMIN"],
  VIEW: ["ADMIN", "ACCOUNTANT", "BRANCHMANAGER", "TELLER"],
} as const;
