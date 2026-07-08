// types/reconciliation.ts

import type {
  ReconciliationStatus,
  ReconciliationType,
  UserRole,
} from "@prisma/client";

// ============================================================================
// CORE TYPES
// ============================================================================

export interface BranchInfo {
  id: string;
  name: string;
  location: string | null;
  email?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  isActive?: boolean;
  branchId?: string | null;
  branch: BranchInfo | null;
}

export interface ApproverInfo {
  id: string;
  name: string;
  role: UserRole;
}

export interface CurrentUser {
  id: string;
  name: string | null;
  role: UserRole;
  branchId: string | null;
  branch: {
    id: string;
    name: string;
    location: string | null;
  } | null;
}

// ============================================================================
// FLOAT INFO TYPE
// ============================================================================

export interface FloatInfo {
  id: string;
  userId: string;
  balance: number;
  initialAmount: number;
  currentDayStarted: Date | null;
  lastReconciliation: Date | null;
  isActiveForDay: boolean;
  pendingReconciliation: boolean;
  canStartNewDay: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: UserInfo;
}

// ============================================================================
// SUSPENSE & SHORTAGE ENTRY TYPES
// ============================================================================

export interface SuspenseEntry {
  id: string;
  type?: ReconciliationType;
  status: ReconciliationStatus;
  floatId: string;
  reconciliationDate: Date;
  actualCash: number;
  systemBalance: number;
  difference: number;
  cashOnHand: number | null;
  floatReturned: number | null;
  isBalanced: boolean;
  isEndOfDay: boolean;
  reconciliationType: string;
  notes: string | null;
  approvalDate: Date | null;
  rejectionReason: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  reconciledByUserId: string;
  approvedByUserId: string | null;
  float: {
    user: {
      id: string;
      name: string | null;
      email: string;
      role: UserRole;
      phone: string | null;
      branch: {
        id: string;
        name: string;
        location: string | null;
      } | null;
    };
  };
  approvedBy?: {
    id: string;
    name: string | null;
    role: UserRole;
  } | null;
}

export interface ShortageEntry extends SuspenseEntry {}

// ============================================================================
// BRANCH SUSPENSE AGGREGATION TYPES
// ============================================================================

export interface BranchSuspenseSummary {
  branchId: string;
  branchName: string;
  branchLocation: string | null;
  totalOverages: number;
  totalShortages: number;
  netPosition: number;
  overageCount: number;
  shortageCount: number;
  lastReconciliationDate: Date | null;
  unresolvedOverages: number;
  unresolvedShortages: number;
  overageEntries: SuspenseEntry[];
  shortageEntries: ShortageEntry[];
}

export interface CompanyWideSuspenseSummary {
  totalOverages: number;
  totalShortages: number;
  netPosition: number;
  totalBranches: number;
  branchesWithOverages: number;
  branchesWithShortages: number;
  branches: BranchSuspenseSummary[];
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface SuspenseDataResponse {
  entries: SuspenseEntry[];
  totalSuspense: number;
  count: number;
}

export interface ShortageDataResponse {
  entries: ShortageEntry[];
  totalShortage: number;
  count: number;
}

export interface BranchSuspenseResponse {
  branchSummary: BranchSuspenseSummary;
}

export interface CompanySuspenseResponse {
  companySummary: CompanyWideSuspenseSummary;
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

/**
 * Simple reconciliation statistics (from getReconciliationStats)
 */
export interface ReconciliationStatistics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

/**
 * Branch-specific reconciliation statistics (from getBranchReconciliationStatistics)
 */
export interface BranchReconciliationStatistics {
  branchId: string;
  branchName: string;
  totalReconciliations: number;
  pending: number;
  approved: number;
  rejected: number;
  today: number;
  totalSuspense: number;
  totalReturned: number;
  totalShortage: number;
  totalOverages: number;
  totalShortages: number;
  unresolvedOverages: number;
  unresolvedShortages: number;
  resolvedCount: number;
  pendingCount: number;
}

/**
 * Detailed reconciliation statistics (from getReconciliationStatistics)
 */
export interface DetailedReconciliationStatistics {
  statusCounts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    underReview: number;
  };
  balanceAnalysis: {
    balanced: number;
    unbalanced: number;
    balancedRate: string;
  };
  varianceAnalysis: {
    overages: number;
    shortages: number;
    balanced: number;
    totalOverage: number;
    totalShortage: number;
    totalVariance: number;
    avgVariance: string;
  };
  financialSummary: {
    totalSystemBalance: number;
    totalActualCash: number;
    totalVariance: number;
    totalOverage: number;
    totalShortage: number;
  };
  timeMetrics: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  performance: {
    approvalRate: string;
    balancedRate: string;
    avgApprovalTimeHours: string;
  };
  recentActivity: Array<{
    id: string;
    tellerName: string;
    date: Date;
    status: string;
    difference: number;
    isBalanced: boolean;
  }>;
}

// ============================================================================
// FILTERS
// ============================================================================

export interface ReconciliationFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  branchId?: string;
  status?: ReconciliationStatus;
  type?: ReconciliationType;
}

// ============================================================================
// ACTION TYPES
// ============================================================================

export interface ReconciliationData {
  floatId: string;
  actualCashOnHand: number;
  actualFloatAmount: number;
  reconciledByUserId: string;
  notes?: string;
}

export interface ActionResponse<T = any> {
  success?: boolean;
  error?: string;
  message?: string;
  data?: T;
}

// ============================================================================
// RECONCILIATION TYPES
// ============================================================================

/**
 * Basic Reconciliation - Minimal fields for lists and summaries
 */
export interface Reconciliation {
  id: string;
  type?: ReconciliationType;
  status: ReconciliationStatus;
  floatId: string;
  reconciliationDate: Date;
  actualCash: number;
  systemBalance: number;
  difference: number;
  cashOnHand: number | null;
  floatReturned: number | null;
  isBalanced: boolean;
  isEndOfDay: boolean;
  reconciliationType: string;
  notes: string | null;
  approvalDate: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  reconciledByUserId: string;
  approvedByUserId: string | null;
}

/**
 * Full Reconciliation - Complete with all relations
 */
export interface FullReconciliation extends Reconciliation {
  float: FloatInfo;
  reconciledByUser: UserInfo;
  approvedBy: ApproverInfo | null;
}

/**
 * Reconciliation with User - Includes only user info (lighter than FullReconciliation)
 */
export interface ReconciliationWithUser extends Reconciliation {
  float: {
    user: UserInfo;
  };
  reconciledByUser?: UserInfo;
  approvedBy?: ApproverInfo | null;
}

/**
 * Reconciliation Detail - For detailed view pages
 */
export interface ReconciliationDetail extends FullReconciliation {
  // Additional computed fields
  varianceType: "OVERAGE" | "SHORTAGE" | "BALANCED";
  varianceAmount: number;
  requiresInvestigation: boolean;
}

/**
 * Pending Reconciliation - Reconciliation awaiting approval
 */
export interface PendingReconciliation extends Reconciliation {
  status: "PENDING";
  approvalDate: null;
  approvedByUserId: null;
  rejectionReason: null;
  float: {
    user: UserInfo;
  };
  reconciledByUser?: UserInfo;
}

/**
 * Processed Reconciliation - Reconciliation that has been approved or rejected
 */
export interface ProcessedReconciliation extends Reconciliation {
  status: "APPROVED" | "REJECTED";
  approvalDate: Date;
  approvedByUserId: string;
  float: {
    user: UserInfo;
  };
  reconciledByUser?: UserInfo;
  approvedBy?: ApproverInfo;
}

// ============================================================================
// UNRECONCILED FLOAT TYPE
// ============================================================================

export interface UnreconciledFloat {
  id: string;
  userId: string;
  balance: number;
  currentDayStarted: Date | null;
  isActiveForDay: boolean;
  pendingReconciliation: boolean;
  canStartNewDay: boolean;
  user: UserInfo;
}

// ============================================================================
// RECONCILIATION SUMMARY TYPES
// ============================================================================

export interface ReconciliationSummary {
  id: string;
  reconciliationDate: Date;
  tellerName: string;
  branchName: string;
  status: ReconciliationStatus;
  systemBalance: number;
  actualCash: number;
  difference: number;
  varianceType: "OVERAGE" | "SHORTAGE" | "BALANCED";
}

export interface DailyReconciliationSummary {
  date: Date;
  totalReconciliations: number;
  balanced: number;
  overages: number;
  shortages: number;
  totalOverageAmount: number;
  totalShortageAmount: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface TellerReconciliationHistory {
  tellerId: string;
  tellerName: string;
  branchName: string;
  totalReconciliations: number;
  balancedCount: number;
  overageCount: number;
  shortageCount: number;
  totalOverageAmount: number;
  totalShortageAmount: number;
  lastReconciliationDate: Date | null;
  reconciliations: ReconciliationSummary[];
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface AdminSuspenseViewProps {
  companySummary: CompanyWideSuspenseSummary;
  statistics: ReconciliationStatistics;
  currentUser: CurrentUser;
}

export interface BranchSuspenseViewProps {
  branchSummary: BranchSuspenseSummary;
  statistics: BranchReconciliationStatistics;
  currentUser: CurrentUser;
}

// ============================================================================
// TREND DATA TYPES
// ============================================================================

export interface SuspenseTrendData {
  date: Date;
  overages: number;
  shortages: number;
  netPosition: number;
}

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

export function isFullReconciliation(
  reconciliation: any
): reconciliation is FullReconciliation {
  return (
    reconciliation &&
    typeof reconciliation === "object" &&
    "float" in reconciliation &&
    reconciliation.float !== null &&
    typeof reconciliation.float === "object" &&
    "user" in reconciliation.float &&
    "reconciledByUser" in reconciliation &&
    reconciliation.reconciledByUser !== null
  );
}

export function isReconciliationWithUser(
  reconciliation: any
): reconciliation is ReconciliationWithUser {
  return (
    reconciliation &&
    typeof reconciliation === "object" &&
    "float" in reconciliation &&
    reconciliation.float !== null &&
    typeof reconciliation.float === "object" &&
    "user" in reconciliation.float
  );
}

export function hasOverage(reconciliation: Reconciliation): boolean {
  const TOLERANCE = 1000;
  return reconciliation.difference > TOLERANCE;
}

export function hasShortage(reconciliation: Reconciliation): boolean {
  const TOLERANCE = 1000;
  return reconciliation.difference < -TOLERANCE;
}

export function isBalancedReconciliation(
  reconciliation: Reconciliation
): boolean {
  const TOLERANCE = 1000;
  return Math.abs(reconciliation.difference) <= TOLERANCE;
}
