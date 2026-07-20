export const VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME = "Voluntary Savings";
export const FIXED_DEPOSIT_ACCOUNT_TYPE_NAME = "Fixed Savings";
export const JUNIOR_SAVINGS_ACCOUNT_TYPE_NAME = "Junior Savings";
export const COMPULSORY_SAVINGS_ACCOUNT_TYPE_NAME = "Compulsory Savings";
export const JOINT_SAVINGS_ACCOUNT_TYPE_NAME = "Joint Savings";
export const INSURANCE_POOL_ACCOUNT_TYPE_NAME = "Insurance Pool";

export const CANONICAL_SAVINGS_LEDGER_CODES = {
  FIXED_DEPOSIT: "201001",
  JUNIOR_SAVINGS: "201002",
  VOLUNTARY_SAVINGS: "201003",
  COMPULSORY_SAVINGS: "201004",
  JOINT_SAVINGS: "201005",
} as const;

const VOLUNTARY_SAVINGS_NAME_KEYS = new Set([
  "VOLUNTARY_SAVINGS",
  "VOLUNTARY SAVINGS",
  "VOLUNTARY SAVINGS ACCOUNT",
  "SAVINGS ACCOUNT",
]);

const FIXED_DEPOSIT_NAME_KEYS = new Set([
  "FIXED_SAVINGS",
  "FIXED SAVINGS",
  "FIXED DEPOSIT",
  "FIXED DEPOSIT SAVINGS",
]);

const JUNIOR_SAVINGS_NAME_KEYS = new Set([
  "JUNIOR_SAVINGS",
  "JUNIOR SAVINGS",
  "JUNIOR SAVINGS ACCOUNT",
]);

const JOINT_SAVINGS_NAME_KEYS = new Set([
  "JOINT_SAVINGS",
  "JOINT SAVINGS",
  "JOINT ACCOUNT",
  "JOINT",
]);

const COMPULSORY_SAVINGS_NAME_KEYS = new Set([
  "COMPULSORY_SAVINGS",
  "COMPULSORY SAVINGS",
  "COMPULSORY SAVINGS ACCOUNT",
]);

export type AccountTypeProductDefaults = {
  monthlyCharge: number;
  flatWithdrawalFee: number | null;
  withdrawalFeePercentage: number | null;
  withdrawalFeeTiers: string | null;
  withdrawalFrequencyDays: number | null;
  hasFixedPeriod: boolean;
  fixedPeriodMonths: number | null;
  maturityTransferAccountType: string | null;
  isDefault: boolean;
  isLoanEligible: boolean;
  canWithdraw: boolean;
  isShareAccount: boolean;
  earnsDividends: boolean;
};

export function normalizeAccountTypeKey(name: string | null | undefined): string {
  return (name || "").trim().toUpperCase().replace(/\s+/g, "_");
}

export function isVoluntarySavingsAccountTypeName(
  name: string | null | undefined,
): boolean {
  const key = normalizeAccountTypeKey(name);
  return VOLUNTARY_SAVINGS_NAME_KEYS.has(key.replace(/_/g, " "))
    || key === "VOLUNTARY_SAVINGS";
}

export function isFixedDepositAccountTypeName(
  name: string | null | undefined,
): boolean {
  const key = normalizeAccountTypeKey(name);
  return FIXED_DEPOSIT_NAME_KEYS.has(key.replace(/_/g, " "))
    || key === "FIXED_SAVINGS"
    || key.includes("FIXED_SAVINGS")
    || key.includes("FIXED_DEPOSIT");
}

export function isJuniorSavingsAccountTypeName(
  name: string | null | undefined,
): boolean {
  const key = normalizeAccountTypeKey(name);
  return JUNIOR_SAVINGS_NAME_KEYS.has(key.replace(/_/g, " "));
}

export function isJointSavingsAccountTypeName(
  name: string | null | undefined,
): boolean {
  const key = normalizeAccountTypeKey(name);
  return JOINT_SAVINGS_NAME_KEYS.has(key.replace(/_/g, " "))
    || key === "JOINT_SAVINGS"
    || key.includes("JOINT");
}

export function isCompulsorySavingsAccountTypeName(
  name: string | null | undefined,
): boolean {
  const key = normalizeAccountTypeKey(name);
  return COMPULSORY_SAVINGS_NAME_KEYS.has(key.replace(/_/g, " "));
}

export function isVoluntarySavingsAccountType<
  T extends { name?: string | null },
>(accountType: T | null | undefined): boolean {
  return isVoluntarySavingsAccountTypeName(accountType?.name);
}

export function isFixedDepositAccountType<
  T extends { name?: string | null },
>(accountType: T | null | undefined): boolean {
  return isFixedDepositAccountTypeName(accountType?.name);
}

export function isJointSavingsAccountType<
  T extends { name?: string | null },
>(accountType: T | null | undefined): boolean {
  return isJointSavingsAccountTypeName(accountType?.name);
}

export function getCanonicalSavingsLedgerCode(
  name: string | null | undefined,
): string | null {
  const key = normalizeAccountTypeKey(name);

  if (
    VOLUNTARY_SAVINGS_NAME_KEYS.has(key.replace(/_/g, " ")) ||
    key === "VOLUNTARY_SAVINGS" ||
    key.includes("VOLUNTARY")
  ) {
    return CANONICAL_SAVINGS_LEDGER_CODES.VOLUNTARY_SAVINGS;
  }

  if (COMPULSORY_SAVINGS_NAME_KEYS.has(key.replace(/_/g, " "))) {
    return CANONICAL_SAVINGS_LEDGER_CODES.COMPULSORY_SAVINGS;
  }

  if (JUNIOR_SAVINGS_NAME_KEYS.has(key.replace(/_/g, " "))) {
    return CANONICAL_SAVINGS_LEDGER_CODES.JUNIOR_SAVINGS;
  }

  if (
    JOINT_SAVINGS_NAME_KEYS.has(key.replace(/_/g, " ")) ||
    key.includes("JOINT")
  ) {
    return CANONICAL_SAVINGS_LEDGER_CODES.JOINT_SAVINGS;
  }

  if (
    FIXED_DEPOSIT_NAME_KEYS.has(key.replace(/_/g, " ")) ||
    key.includes("FIXED_SAVINGS") ||
    key.includes("FIXED_DEPOSIT")
  ) {
    return CANONICAL_SAVINGS_LEDGER_CODES.FIXED_DEPOSIT;
  }

  return null;
}

export function getCanonicalSavingsAccountTypeName(
  name: string | null | undefined,
): string | null {
  const code = getCanonicalSavingsLedgerCode(name);

  switch (code) {
    case CANONICAL_SAVINGS_LEDGER_CODES.FIXED_DEPOSIT:
      return FIXED_DEPOSIT_ACCOUNT_TYPE_NAME;
    case CANONICAL_SAVINGS_LEDGER_CODES.JUNIOR_SAVINGS:
      return JUNIOR_SAVINGS_ACCOUNT_TYPE_NAME;
    case CANONICAL_SAVINGS_LEDGER_CODES.VOLUNTARY_SAVINGS:
      return VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME;
    case CANONICAL_SAVINGS_LEDGER_CODES.COMPULSORY_SAVINGS:
      return COMPULSORY_SAVINGS_ACCOUNT_TYPE_NAME;
    case CANONICAL_SAVINGS_LEDGER_CODES.JOINT_SAVINGS:
      return JOINT_SAVINGS_ACCOUNT_TYPE_NAME;
    default:
      return null;
  }
}

export function getVoluntarySavingsAccountTypeDefaults(
  withdrawalFeeTiers: string | null,
): AccountTypeProductDefaults {
  return {
    monthlyCharge: 500,
    flatWithdrawalFee: null,
    withdrawalFeePercentage: null,
    withdrawalFeeTiers,
    withdrawalFrequencyDays: null,
    hasFixedPeriod: false,
    fixedPeriodMonths: null,
    maturityTransferAccountType: null,
    isDefault: true,
    isLoanEligible: true,
    canWithdraw: true,
    isShareAccount: false,
    earnsDividends: false,
  };
}

export function getFixedDepositAccountTypeDefaults(): AccountTypeProductDefaults {
  return {
    monthlyCharge: 0,
    flatWithdrawalFee: null,
    withdrawalFeePercentage: null,
    withdrawalFeeTiers: null,
    withdrawalFrequencyDays: null,
    hasFixedPeriod: true,
    fixedPeriodMonths: null,
    maturityTransferAccountType: VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
    isDefault: false,
    isLoanEligible: false,
    canWithdraw: false,
    isShareAccount: false,
    earnsDividends: false,
  };
}

export function getJointSavingsAccountTypeDefaults(): AccountTypeProductDefaults {
  return {
    monthlyCharge: 500,
    flatWithdrawalFee: null,
    withdrawalFeePercentage: null,
    withdrawalFeeTiers: null,
    withdrawalFrequencyDays: null,
    hasFixedPeriod: false,
    fixedPeriodMonths: null,
    maturityTransferAccountType: null,
    isDefault: false,
    isLoanEligible: true,
    canWithdraw: true,
    isShareAccount: false,
    earnsDividends: false,
  };
}
