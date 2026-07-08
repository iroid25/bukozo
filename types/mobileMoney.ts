// types/mobileMoneyTypes.ts

import { TransactionStatus } from "@prisma/client";

/* ============================================
   MOBILE MONEY DEPOSIT TYPES
   ============================================ */

export interface MobileMoneyDeposit {
  id: string;
  transactionId: string;
  memberId: string | null;
  institutionId: string | null;
  accountId: string;
  amount: number;
  depositDate: Date;
  handlerUserId: string;
  channel: string;
  mobileMoneyRef: string | null; // ✅ Nullable to match database schema
  depositorName: string | null;

  transaction: {
    id: string;
    transactionRef: string;
    status: TransactionStatus;
    description: string | null;
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

/* ============================================
   MOBILE MONEY WITHDRAWAL TYPES
   ============================================ */

export interface MobileMoneyWithdrawal {
  id: string;
  transactionId: string;
  memberId: string | null;
  institutionId: string | null;
  accountId: string;
  amount: number;
  withdrawalDate: Date;
  handlerUserId: string;
  channel: string;
  mobileMoneyRef: string | null;

  transaction: {
    id: string;
    transactionRef: string;
    status: TransactionStatus;
    description: string | null;
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

/* ============================================
   MOBILE MONEY LOAN REPAYMENT TYPES
   ============================================ */

export interface MobileMoneyLoanRepayment {
  id: string;
  loanId: string;
  memberId: string;
  amount: number;
  repaymentDate: Date;
  handlerUserId: string;
  channel: string;
  mobileMoneyRef: string | null;

  loan: {
    id: string;
    amountGranted: number;
    outstandingBalance: number;
    loanApplication: {
      loanProduct: {
        name: string;
      };
    };
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
  };

  handler: {
    id: string;
    name: string;
    role: string;
  };
}

/* ============================================
   CREATE DTO TYPES
   ============================================ */

export interface MobileMoneyDepositCreateDTO {
  memberId?: string; // ✅ Optional - for member deposits
  institutionId?: string; // ✅ Optional - for institution deposits
  accountId: string; // ✅ Required - target account for deposit
  amount: number; // ✅ Required - deposit amount
  mobileMoneyRef: string; // ✅ Required - mobile money transaction reference (e.g., MTN ref)
  description?: string; // ✅ Optional - additional notes about the deposit
  depositorName?: string; // ✅ Optional - name of person making the deposit
}

export interface MobileMoneyWithdrawalCreateDTO {
  memberId?: string; // ✅ Optional - for member withdrawals
  institutionId?: string; // ✅ Optional - for institution withdrawals
  accountId: string; // ✅ Required - source account for withdrawal
  amount: number; // ✅ Required - withdrawal amount
  mobileMoneyRef: string; // ✅ Required - mobile money transaction reference
  description?: string; // ✅ Optional - additional notes
}

export interface MobileMoneyLoanRepaymentCreateDTO {
  memberId: string; // ✅ Required - loans are member-only
  loanId: string; // ✅ Required - loan being repaid
  amount: number; // ✅ Required - repayment amount
  mobileMoneyRef: string; // ✅ Required - mobile money reference
}

/* ============================================
   MOBILE MONEY PROVIDER ENUM & HELPERS
   ============================================ */

export enum MobileMoneyProvider {
  MTN = "MTN",
  AIRTEL = "AIRTEL",
  OTHER = "OTHER",
}

export function getMobileMoneyProviderOptions() {
  return [
    { label: "MTN Mobile Money", value: MobileMoneyProvider.MTN },
    { label: "Airtel Money", value: MobileMoneyProvider.AIRTEL },
    { label: "Other Provider", value: MobileMoneyProvider.OTHER },
  ];
}

/* ============================================
   STATISTICS TYPES
   ============================================ */

export interface MobileMoneyStatistics {
  today: {
    amount: number;
    count: number; // ✅ This is a number, not { id: number }
  };
  thisMonth: {
    amount: number;
    count: number; // ✅ This is a number
  };
  total: {
    amount: number;
    count: number; // ✅ This is a number
  };
}

/* ============================================
   HELPER TYPE GUARDS
   ============================================ */

// Type guard to check if deposit is for a member
export function isMemberDeposit(
  deposit: MobileMoneyDeposit
): deposit is MobileMoneyDeposit & {
  member: NonNullable<MobileMoneyDeposit["member"]>;
} {
  return deposit.member !== null;
}

// Type guard to check if deposit is for an institution
export function isInstitutionDeposit(
  deposit: MobileMoneyDeposit
): deposit is MobileMoneyDeposit & {
  institution: NonNullable<MobileMoneyDeposit["institution"]>;
} {
  return deposit.institution !== null;
}

// Type guard to check if withdrawal is for a member
export function isMemberWithdrawal(
  withdrawal: MobileMoneyWithdrawal
): withdrawal is MobileMoneyWithdrawal & {
  member: NonNullable<MobileMoneyWithdrawal["member"]>;
} {
  return withdrawal.member !== null;
}

// Type guard to check if withdrawal is for an institution
export function isInstitutionWithdrawal(
  withdrawal: MobileMoneyWithdrawal
): withdrawal is MobileMoneyWithdrawal & {
  institution: NonNullable<MobileMoneyWithdrawal["institution"]>;
} {
  return withdrawal.institution !== null;
}

/* ============================================
   HELPER FUNCTIONS
   ============================================ */

// Get owner name from deposit (member or institution)
export function getDepositOwnerName(deposit: MobileMoneyDeposit): string {
  if (isMemberDeposit(deposit)) {
    return deposit.member.user.name;
  }
  if (isInstitutionDeposit(deposit)) {
    return deposit.institution.institutionName;
  }
  return "Unknown";
}

// Get owner number from deposit (member or institution)
export function getDepositOwnerNumber(deposit: MobileMoneyDeposit): string {
  if (isMemberDeposit(deposit)) {
    return deposit.member.memberNumber;
  }
  if (isInstitutionDeposit(deposit)) {
    return deposit.institution.institutionNumber;
  }
  return "N/A";
}

// Get owner type from deposit
export function getDepositOwnerType(
  deposit: MobileMoneyDeposit
): "Member" | "Institution" | "Unknown" {
  if (isMemberDeposit(deposit)) {
    return "Member";
  }
  if (isInstitutionDeposit(deposit)) {
    return "Institution";
  }
  return "Unknown";
}

// Get owner email from deposit
export function getDepositOwnerEmail(
  deposit: MobileMoneyDeposit
): string | null {
  if (isMemberDeposit(deposit)) {
    return deposit.member.user.email;
  }
  if (isInstitutionDeposit(deposit)) {
    return deposit.institution.institutionEmail;
  }
  return "N/A";
}

// Get owner phone from deposit
export function getDepositOwnerPhone(
  deposit: MobileMoneyDeposit
): string | null {
  if (isMemberDeposit(deposit)) {
    return deposit.member.user.phone;
  }
  if (isInstitutionDeposit(deposit)) {
    return deposit.institution.institutionPhone;
  }
  return "N/A";
}

// Get owner name from withdrawal (member or institution)
export function getWithdrawalOwnerName(
  withdrawal: MobileMoneyWithdrawal
): string {
  if (isMemberWithdrawal(withdrawal)) {
    return withdrawal.member.user.name;
  }
  if (isInstitutionWithdrawal(withdrawal)) {
    return withdrawal.institution.institutionName;
  }
  return "Unknown";
}

// Get owner number from withdrawal (member or institution)
export function getWithdrawalOwnerNumber(
  withdrawal: MobileMoneyWithdrawal
): string {
  if (isMemberWithdrawal(withdrawal)) {
    return withdrawal.member.memberNumber;
  }
  if (isInstitutionWithdrawal(withdrawal)) {
    return withdrawal.institution.institutionNumber;
  }
  return "N/A";
}

// Get owner type from withdrawal
export function getWithdrawalOwnerType(
  withdrawal: MobileMoneyWithdrawal
): "Member" | "Institution" | "Unknown" {
  if (isMemberWithdrawal(withdrawal)) {
    return "Member";
  }
  if (isInstitutionWithdrawal(withdrawal)) {
    return "Institution";
  }
  return "Unknown";
}

// Get owner email from withdrawal
export function getWithdrawalOwnerEmail(
  withdrawal: MobileMoneyWithdrawal
): string | null {
  if (isMemberWithdrawal(withdrawal)) {
    return withdrawal.member.user.email;
  }
  if (isInstitutionWithdrawal(withdrawal)) {
    return withdrawal.institution.institutionEmail;
  }
  return "N/A";
}

// Get owner phone from withdrawal
export function getWithdrawalOwnerPhone(
  withdrawal: MobileMoneyWithdrawal
): string | null {
  if (isMemberWithdrawal(withdrawal)) {
    return withdrawal.member.user.phone;
  }
  if (isInstitutionWithdrawal(withdrawal)) {
    return withdrawal.institution.institutionPhone;
  }
  return "N/A";
}

// Get owner email from loan repayment
export function getLoanRepaymentOwnerEmail(
  repayment: MobileMoneyLoanRepayment
): string | null {
  return repayment.member.user.email;
}

// Get owner phone from loan repayment
export function getLoanRepaymentOwnerPhone(
  repayment: MobileMoneyLoanRepayment
): string | null {
  return repayment.member.user.phone;
}

// Format mobile money reference for display
export function formatMobileMoneyRef(ref: string | null): string {
  if (!ref) return "N/A";
  return ref.toUpperCase();
}

// Validate mobile money reference format
export function isValidMobileMoneyRef(ref: string): boolean {
  if (!ref || ref.trim().length === 0) return false;
  // Add your specific validation logic here
  // For example, MTN refs might have a specific format
  return ref.trim().length >= 6;
}

// Get mobile money provider from reference (basic detection)
export function detectMobileMoneyProvider(
  ref: string | null
): MobileMoneyProvider {
  if (!ref) return MobileMoneyProvider.OTHER;

  const upperRef = ref.toUpperCase();

  if (upperRef.includes("MTN") || upperRef.startsWith("MM")) {
    return MobileMoneyProvider.MTN;
  }

  if (upperRef.includes("AIRTEL") || upperRef.startsWith("AM")) {
    return MobileMoneyProvider.AIRTEL;
  }

  return MobileMoneyProvider.OTHER;
}

// Format currency for mobile money transactions
export function formatMobileMoneyAmount(
  amount: number,
  currency: string = "UGX"
): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

// Calculate mobile money transaction fee (example - adjust based on your rates)
export function calculateMobileMoneyFee(
  amount: number,
  provider: MobileMoneyProvider
): number {
  // Example fee structure - replace with your actual fees
  if (amount <= 2500) return 0;
  if (amount <= 5000) return 200;
  if (amount <= 30000) return 500;
  if (amount <= 50000) return 1000;
  if (amount <= 100000) return 1500;
  if (amount <= 500000) return 2500;
  return 5000;
}

// Check if mobile money reference is already used
export async function isMobileMoneyRefUnique(ref: string): Promise<boolean> {
  // This would typically call your database
  // Implementation depends on your data access layer
  return true; // Placeholder
}
