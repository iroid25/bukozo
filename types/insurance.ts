// FILE: types/insurance.ts

import { InsuranceContributionType } from "@prisma/client";

// This is the flattened type that the UI component expects
export interface InsuranceRecord {
  id: string;
  amount: number;
  type: string; // String for UI display
  description: string;
  memberName?: string;
  memberNumber?: string;
  accountNumber?: string;
  reference?: string;
  createdAt: string; // ISO string for client components
  createdBy: string; // Just the ID
  createdByName?: string; // The actual name
}
// This is the detailed type with all relations (for internal use if needed)
export interface InsuranceRecordWithRelations {
  id: string;
  amount: number;
  type: InsuranceContributionType;
  description: string;
  reference?: string;
  createdAt: string; // Serialized for client
  updatedAt: string; // Serialized for client
  memberId: string | null;
  accountId: string;
  loanApplicationId: string | null;
  createdById: string;
  member: {
    id: string;
    memberNumber: string;
    surname: string | null;
    otherNames: string | null;
    user: {
      name: string;
      email: string;
      phone: string | null;
    };
  } | null;
  account: {
    id: string;
    accountNumber: string;
    accountType: {
      name: string;
    };
  };
  loanApplication: {
    id: string;
    amountApplied: number;
    approvedAmount: number | null;
  } | null;
  createdBy: {
    name: string;
    email: string;
  };
}

export interface InsuranceStatistics {
  totalPoolBalance: number;
  totalCollected: number;
  totalPaidOut: number;
  monthlyCollection: number;
  membersCovered: number;
  averageContribution: number;
}

// Helper type for creating new insurance contributions
export interface CreateInsurancePaymentDTO {
  amount: number;
  description: string;
  reference?: string;
  createdById: string;
}

// Helper type for member contribution queries
export interface MemberInsuranceContribution {
  id: string;
  amount: number;
  type: InsuranceContributionType;
  description: string;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
  memberId: string | null;
  accountId: string;
  loanApplicationId: string | null;
  createdById: string;
  loanApplication: {
    amountApplied: number;
    approvedAmount: number | null;
    applicationDate: string;
  } | null;
}
