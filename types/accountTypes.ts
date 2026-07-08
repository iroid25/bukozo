// types/accountTypes.ts

// ---------- Base DTOs used by server actions / forms ----------
export type AccountTypeBase = {
  name: string;
  interestRate: number;
  minBalance: number;
  maxWithdrawal?: number | null;
  isDefault?: boolean;
  isLoanEligible?: boolean;

  // extra business-rule fields (match Prisma schema)
  monthlyCharge?: number | null;
  flatWithdrawalFee?: number | null;
  withdrawalFeePercentage?: number | null;
  withdrawalFeeTiers?: string | null; // tiers stored as JSON string (managed on Fees page)

  withdrawalFrequencyDays?: number | null;
  maxWithdrawalsPerDay?: number | null;

  hasFixedPeriod?: boolean;
  fixedPeriodMonths?: number | null;
  maturityTransferAccountType?: string | null;

  isShareAccount?: boolean;
  canWithdraw?: boolean;
  earnsDividends?: boolean;
  ledgerAccountId?: string | null;
};

export type AccountTypeCreateDTO = AccountTypeBase;

export type AccountTypeUpdateDTO = Partial<AccountTypeBase> & {
  id: string;
};

// ---------- “Row” type used by UI listings / tables ----------
export type AccountType = AccountTypeBase & {
  id: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: { accounts: number };
  ledgerAccount?: {
    id: string;
    accountCode: string;
    accountName: string;
    fullCode?: string | null;
    ledgerType: string;
    parentId?: string | null;
    parent?: {
      id: string;
      accountCode: string;
      accountName: string;
    } | null;
  } | null;
};

// ---------- Name helpers ----------
export const isValidAccountTypeName = (name: string) => {
  const n = (name || "").trim();
  return n.length >= 3 && n.length <= 50;
};

export const formatAccountTypeName = (name: string) => {
  // Trim, compress spaces, Title Case
  const n = (name || "").trim().replace(/\s+/g, " ");
  return n.replace(/\b\w/g, (c) => c.toUpperCase());
};

export const normalizeAccountTypeName = (name: string) => (name || "").trim();

// Map common internal codes to nice display labels.
// Falls back to Title Case of whatever you pass in.
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  VOLUNTARY_SAVINGS: "Voluntary Savings",
  COMPULSORY_SAVINGS: "Compulsory Savings",
  JUNIOR_SAVINGS: "Junior Savings",
  FIXED_SAVINGS: "Fixed Savings",
  FIXED_DEPOSIT: "Fixed Savings",
  EMERGENCY_SAVINGS: "Emergency Savings",

  ORDINARY_SHARES: "Ordinary Shares",
  AFFILIATE_SHARES: "Affiliate Shares",
  ASSOCIATE_SHARES: "Associate Shares",
};

/** Pretty label for UI (case/spacing tolerant). */
export const getAccountTypeDisplayName = (name: string) => {
  const key = (name || "").trim().toUpperCase().replace(/\s+/g, "_");
  return (
    ACCOUNT_TYPE_LABELS[key] ??
    formatAccountTypeName(normalizeAccountTypeName(name))
  );
};
