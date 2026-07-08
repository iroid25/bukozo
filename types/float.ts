// @ts-nocheck
// types/float.ts

import { TransactionType, UserRole } from "@prisma/client";

export enum FloatTransactionType {
  ALLOCATION = "FLOAT_ALLOCATION",
  PURCHASE = "FLOAT_PURCHASE",
  DEPOSIT = "DEPOSIT",
  WITHDRAWAL = "WITHDRAWAL",
  RECONCILIATION = "FLOAT_RECONCILIATION",
  OTHER = "OTHER",
}
// TransactionType

export interface UserFloat {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    image: string | null;
    branchId: string | null;
    branch: {
      name: string;
      location: string;
    } | null;
  };
  balance: number;
  lastReconciliation: Date | null;
  floatTransactions: Array<{
    id: string;
    type: TransactionType;
    amount: number;
    transactionDate: Date;
    description: string | null;
    performedByUser: {
      name: string;
      role: string;
    };
  }>;
  floatReconciliation: Array<{
    id: string;
    reconciliationDate: Date;
    actualCash: number;
    systemBalance: number;
    difference: number;
    isBalanced: boolean;
    reconciledByUser: {
      name: string;
      role: string;
    };
  }>;
}

export interface FloatTransaction {
  id: string;
  floatId: string;
  float: {
    user: {
      name: string;
      role: string;
      branchId: string | null;
      branch: {
        name: string;
        location: string;
      } | null;
    };
  };
  type: TransactionType;
  amount: number;
  transactionDate: Date;
  description: string | null;
  relatedTransactionId: string | null;
  performedByUserId: string;
  performedByUser: {
    id: string;
    name: string;
    role: string;
  };
}

export interface FloatAllocation {
  id: string;
  branchId: string;
  branch: {
    id: string;
    name: string;
    location: string;
  };
  tellerAgentId: string;
  tellerAgent: {
    id: string;
    name: string;
    role: string;
    email: string;
    phone: string | null;
  };
  amount: number;
  allocationDate: Date;
  allocatedBy: string;
  // allocatedByUser: {
  //   name: string;
  //   role: string;
  // };
  description: string | null;
}

export interface FloatReconciliation {
  id: string;
  floatId: string;
  float: {
    user: {
      name: string;
      role: string;
      branchId: string | null;
      branch: {
        name: string;
        location: string;
      } | null;
    };
  };
  reconciliationDate: Date;
  actualCash: number;
  systemBalance: number;
  difference: number;
  isBalanced: boolean;
  reconciledByUserId: string;
  reconciledByUser: {
    id: string;
    name: string;
    role: string;
  };
}

// DTOs for creating/updating float records
export interface FloatAllocationCreateDTO {
  tellerAgentId: string;
  branchId: string;
  amount: number;
  description?: string;
}

export interface FloatReconciliationCreateDTO {
  floatId: string;
  actualCash: number;
}

export interface FloatTransactionCreateDTO {
  floatId: string;
  type: FloatTransactionType;
  amount: number;
  description?: string;
  relatedTransactionId?: string;
}

// Helper function to get transaction type display info
export const getFloatTransactionTypeInfo = (type: TransactionType) => {
  const typeConfig = {
    [TransactionType.FLOAT_ALLOCATION]: {
      label: "Float Allocation",
      color: "bg-blue-100 text-blue-800",
      icon: "💰",
      description: "Float allocated to user",
    },
    [TransactionType.FLOAT_PURCHASE]: {
      label: "Float Purchase",
      color: "bg-green-100 text-green-800",
      icon: "🛒",
      description: "Float purchased/topped up",
    },
    [TransactionType.DEPOSIT]: {
      label: "Member Deposit",
      color: "bg-emerald-100 text-emerald-800",
      icon: "📥",
      description: "Member deposit processed",
    },
    [TransactionType.WITHDRAWAL]: {
      label: "Member Withdrawal",
      color: "bg-red-100 text-red-800",
      icon: "📤",
      description: "Member withdrawal processed",
    },
    [TransactionType.FLOAT_RECONCILIATION]: {
      label: "Reconciliation",
      color: "bg-purple-100 text-purple-800",
      icon: "⚖️",
      description: "Float reconciliation adjustment",
    },
    [TransactionType.LOAN_DISBURSEMENT]: {
      label: "Loan Disbursement",
      color: "bg-orange-100 text-orange-800",
      icon: "💸",
      description: "Loan disbursement transaction",
    },
    [TransactionType.LOAN_REPAYMENT]: {
      label: "Loan Repayment",
      color: "bg-indigo-100 text-indigo-800",
      icon: "💳",
      description: "Loan repayment transaction",
    },
    [TransactionType.SHARES_PURCHASE]: {
      label: "Share Purchase",
      color: "bg-teal-100 text-teal-800",
      icon: "📈",
      description: "Cash received for share purchase",
    },
    [TransactionType.OTHER]: {
      label: "Other",
      color: "bg-gray-100 text-gray-800",
      icon: "📋",
      description: "Other float transaction",
    },
  } as const;
  // @ts-ignore
  return typeConfig[type] ?? { label: type.replace(/_/g, " "), color: "bg-gray-100 text-gray-800", icon: "📋", description: "" };
};

// Helper function to get reconciliation status
export const getReconciliationStatus = (
  actualCash: number,
  systemBalance: number,
  toleranceAmount: number = 1000 // 1000 UGX tolerance
) => {
  const difference = Math.abs(actualCash - systemBalance);
  const isBalanced = difference <= toleranceAmount;

  if (isBalanced) {
    return {
      status: "BALANCED",
      label: "Balanced",
      color: "bg-green-100 text-green-800",
      icon: "✅",
      severity: "success",
    };
  }

  if (difference <= toleranceAmount * 5) {
    // 5000 UGX - minor discrepancy
    return {
      status: "MINOR_DISCREPANCY",
      label: "Minor Discrepancy",
      color: "bg-yellow-100 text-yellow-800",
      icon: "⚠️",
      severity: "warning",
    };
  }

  return {
    status: "MAJOR_DISCREPANCY",
    label: "Major Discrepancy",
    color: "bg-red-100 text-red-800",
    icon: "❌",
    severity: "error",
  };
};

// Helper function to calculate float utilization
export const calculateFloatUtilization = (
  currentBalance: number,
  totalAllocated: number
) => {
  if (totalAllocated === 0) return 0;
  const utilized = totalAllocated - currentBalance;
  return Math.max(0, (utilized / totalAllocated) * 100);
};

// Helper function to get float status based on balance
export const getFloatStatus = (
  balance: number,
  lastReconciliation: Date | null,
  hoursThreshold: number = 24
) => {
  const isLowBalance = balance < 50000; // 50,000 UGX threshold
  const needsReconciliation = lastReconciliation
    ? (Date.now() - lastReconciliation.getTime()) / (1000 * 60 * 60) >
      hoursThreshold
    : true;

  if (balance <= 0) {
    return {
      status: "EMPTY",
      label: "Empty Float",
      color: "bg-red-100 text-red-800",
      icon: "🚫",
      priority: "high",
    };
  }

  if (isLowBalance) {
    return {
      status: "LOW",
      label: "Low Balance",
      color: "bg-yellow-100 text-yellow-800",
      icon: "⚠️",
      priority: "medium",
    };
  }

  if (needsReconciliation) {
    return {
      status: "NEEDS_RECONCILIATION",
      label: "Needs Reconciliation",
      color: "bg-blue-100 text-blue-800",
      icon: "⚖️",
      priority: "medium",
    };
  }

  return {
    status: "ACTIVE",
    label: "Active",
    color: "bg-green-100 text-green-800",
    icon: "✅",
    priority: "low",
  };
};

// Helper function to get user role display for float operations
// Helper function to get user role display for float operations
export const getFloatUserRoleInfo = (role: UserRole) => {
  const roleConfig = {
    TELLER: {
      label: "Teller",
      color: "bg-blue-100 text-blue-800",
      icon: "👤",
      canReceiveFloat: true,
      canReconcile: true,
    },
    AGENT: {
      label: "Agent",
      color: "bg-green-100 text-green-800",
      icon: "🎯",
      canReceiveFloat: true,
      canReconcile: true,
    },
    ADMIN: {
      label: "Admin",
      color: "bg-purple-100 text-purple-800",
      icon: "👑",
      canReceiveFloat: false,
      canReconcile: true,
    },
    BRANCHMANAGER: {
      label: "Branch Manager",
      color: "bg-teal-100 text-teal-800",
      icon: "👔",
      canReceiveFloat: false,
      canReconcile: true,
    },
    LOANOFFICER: {
      label: "Loan Officer",
      color: "bg-indigo-100 text-indigo-800",
      icon: "💼",
      canReceiveFloat: false,
      canReconcile: true,
    },
    ACCOUNTANT: {
      // Add this missing role
      label: "Accountant",
      color: "bg-cyan-100 text-cyan-800",
      icon: "📊",
      canReceiveFloat: false,
      canReconcile: true,
    },
    AUDITOR: {
      label: "Auditor", // Fix the typo: was "auditor "
      color: "bg-slate-100 text-slate-800",
      icon: "🔍",
      canReceiveFloat: false,
      canReconcile: true,
    },
    MEMBER: {
      label: "Member",
      color: "bg-emerald-100 text-emerald-800",
      icon: "👥",
      canReceiveFloat: false,
      canReconcile: false,
    },
  } as const;

  return (
    roleConfig[role] || {
      label: role,
      color: "bg-gray-100 text-gray-800",
      icon: "👤",
      canReceiveFloat: false,
      canReconcile: false,
    }
  );
};
// Get float transaction type options for forms
export const getFloatTransactionTypeOptions = () => [
  { label: "Float Allocation", value: FloatTransactionType.ALLOCATION },
  { label: "Float Purchase", value: FloatTransactionType.PURCHASE },
  { label: "Member Deposit", value: FloatTransactionType.DEPOSIT },
  { label: "Member Withdrawal", value: FloatTransactionType.WITHDRAWAL },
  { label: "Reconciliation", value: FloatTransactionType.RECONCILIATION },
  { label: "Other", value: FloatTransactionType.OTHER },
];
