// POST /api/v1/account-types/initialize
// Upserts all BUTCS savings and share products with correct configurations.
// Safe to call multiple times — idempotent.
import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import {
  CANONICAL_SAVINGS_LEDGER_CODES,
  VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
  getCanonicalSavingsLedgerCode,
} from "@/lib/accounting/account-type-rules";
import { ensureLiabilityStructure } from "@/lib/services/liability-structure";

const VOLUNTARY_TIERS = JSON.stringify([
  { max: 50000,  fee: 300  },
  { max: 200000, fee: 500  },
  { max: 500000, fee: 700  },
  { max: null,   fee: 1000 },
]);

const JUNIOR_TIERS = JSON.stringify([
  { max: 50000,  fee: 300  },
  { max: 200000, fee: 500  },
  { max: 500000, fee: 700  },
  { max: null,   fee: 1000 },
]);

const LOAN_INSURANCE_PRODUCT = {
  name: "Loan Insurance",
  interestRate: 0,
  interestPeriod: "MONTHLY",
  minBalance: 0,
  isDefault: false,
  isLoanEligible: false,
  canWithdraw: false,
  monthlyCharge: 0,
  withdrawalFeeTiers: null,
  flatWithdrawalFee: null,
  withdrawalFrequencyDays: null,
  hasFixedPeriod: false,
  fixedPeriodMonths: null,
  maturityTransferAccountType: null,
  isShareAccount: false,
  earnsDividends: false,
};

const BUTCS_PRODUCTS = [
  {
    name: VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
    interestRate: 0,
    interestPeriod: "MONTHLY",
    minBalance: 5000,
    isDefault: true,
    isLoanEligible: true,
    canWithdraw: true,
    monthlyCharge: 500,
    withdrawalFeeTiers: VOLUNTARY_TIERS,
    flatWithdrawalFee: null,
    withdrawalFrequencyDays: null,
    hasFixedPeriod: false,
    fixedPeriodMonths: null,
    maturityTransferAccountType: null,
    isShareAccount: false,
    earnsDividends: false,
  },
  {
    name: "Compulsory Savings",
    interestRate: 18,
    interestPeriod: "ANNUALLY",
    minBalance: 0,
    isDefault: false,
    isLoanEligible: true,
    canWithdraw: false,
    monthlyCharge: 0,
    withdrawalFeeTiers: null,
    flatWithdrawalFee: null,
    withdrawalFrequencyDays: null,
    hasFixedPeriod: false,
    fixedPeriodMonths: null,
    maturityTransferAccountType: null,
    isShareAccount: false,
    earnsDividends: false,
  },
  {
    // Single Fixed Savings product — term (3/6/9/12 months) is chosen when opening an account
    name: "Fixed Savings",
    interestRate: 10,
    interestPeriod: "ANNUALLY",
    minBalance: 500000,
    isDefault: false,
    isLoanEligible: false,
    canWithdraw: false,
    monthlyCharge: 0,
    withdrawalFeeTiers: null,
    flatWithdrawalFee: null,
    withdrawalFrequencyDays: null,
    hasFixedPeriod: true,
    fixedPeriodMonths: null,   // term selected at account opening, stored on account.fixingEndDate
    maturityTransferAccountType: VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
    isShareAccount: false,
    earnsDividends: false,
    sharePrice: null,
  },
  {
    name: "Junior Savings",
    interestRate: 10,
    interestPeriod: "ANNUALLY",
    minBalance: 0,
    isDefault: false,
    isLoanEligible: false,
    canWithdraw: true,
    monthlyCharge: 0,
    withdrawalFeeTiers: JUNIOR_TIERS,
    flatWithdrawalFee: null,
    withdrawalFrequencyDays: 120,
    hasFixedPeriod: false,
    fixedPeriodMonths: null,
    maturityTransferAccountType: null,
    isShareAccount: false,
    earnsDividends: false,
    sharePrice: null,
  },
  {
    name: "Joint Savings",
    interestRate: 0,
    interestPeriod: "MONTHLY",
    minBalance: 5000,
    isDefault: false,
    isLoanEligible: true,
    canWithdraw: true,
    monthlyCharge: 500,
    withdrawalFeeTiers: VOLUNTARY_TIERS,
    flatWithdrawalFee: null,
    withdrawalFrequencyDays: null,
    hasFixedPeriod: false,
    fixedPeriodMonths: null,
    maturityTransferAccountType: null,
    isShareAccount: false,
    earnsDividends: false,
    sharePrice: null,
  },
  // ── Share products ──────────────────────────────────────────────────────────
  // All shares: UGX 20,000 per share, dividend from annual surplus, not withdrawable
  {
    name: "Ordinary Shares",
    interestRate: 0,          // dividend rate is variable (surplus-based), not fixed
    interestPeriod: "ANNUALLY",
    minBalance: 20000,        // minimum one share
    isDefault: false,
    isLoanEligible: false,
    canWithdraw: false,
    monthlyCharge: 0,
    withdrawalFeeTiers: null,
    flatWithdrawalFee: null,
    withdrawalFrequencyDays: null,
    hasFixedPeriod: false,
    fixedPeriodMonths: null,
    maturityTransferAccountType: null,
    isShareAccount: true,
    earnsDividends: true,
    sharePrice: 20000,
  },
  {
    name: "Affiliate Shares",
    interestRate: 0,
    interestPeriod: "ANNUALLY",
    minBalance: 20000,
    isDefault: false,
    isLoanEligible: false,
    canWithdraw: false,
    monthlyCharge: 0,
    withdrawalFeeTiers: null,
    flatWithdrawalFee: null,
    withdrawalFrequencyDays: null,
    hasFixedPeriod: false,
    fixedPeriodMonths: null,
    maturityTransferAccountType: null,
    isShareAccount: true,
    earnsDividends: true,
    sharePrice: 20000,
  },
  {
    name: "Associate Shares",
    interestRate: 0,
    interestPeriod: "ANNUALLY",
    minBalance: 20000,
    isDefault: false,
    isLoanEligible: false,
    canWithdraw: false,
    monthlyCharge: 0,
    withdrawalFeeTiers: null,
    flatWithdrawalFee: null,
    withdrawalFrequencyDays: null,
    hasFixedPeriod: false,
    fixedPeriodMonths: null,
    maturityTransferAccountType: null,
    isShareAccount: true,
    earnsDividends: true,
    sharePrice: 20000,
  },
];

const LEGACY_NAMES = [
  "Savings Account",
  "Junior Savings Account",
  "Fixed Deposit",
  "Emergency Savings",
  "Share Capital",               // replaced by Ordinary / Affiliate / Associate Shares
  "Fixed Savings - 3 Months",   // consolidated into single "Fixed Savings" product
  "Fixed Savings - 6 Months",
  "Fixed Savings - 9 Months",
  "Fixed Savings - 12 Months",
];

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const results: string[] = [];

    await ensureLiabilityStructure();

    const legacyInsurancePoolAccountType = await db.accountType.findFirst({
      where: { name: "Insurance Pool" },
      include: {
        _count: { select: { accounts: true } },
      },
    });

    const canonicalSavingsAccounts = await db.chartOfAccount.findMany({
      where: {
        ledgerType: "LIABILITIES",
        accountCode: {
          in: [
            CANONICAL_SAVINGS_LEDGER_CODES.FIXED_DEPOSIT,
            CANONICAL_SAVINGS_LEDGER_CODES.JUNIOR_SAVINGS,
            CANONICAL_SAVINGS_LEDGER_CODES.VOLUNTARY_SAVINGS,
            CANONICAL_SAVINGS_LEDGER_CODES.COMPULSORY_SAVINGS,
          ],
        },
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
      },
    });

    const canonicalLedgerAccountMap = new Map(
      canonicalSavingsAccounts.map((account) => [account.accountCode, account.id]),
    );

    // Upsert all BUTCS products
    for (const product of BUTCS_PRODUCTS) {
      const { name, ...fields } = product;
      const canonicalSavingsCode = getCanonicalSavingsLedgerCode(name);
      const ledgerAccountId = canonicalSavingsCode
        ? canonicalLedgerAccountMap.get(canonicalSavingsCode) ?? null
        : null;

      await db.accountType.upsert({
        where: { name },
        update: {
          ...fields,
          ...(canonicalSavingsCode ? { ledgerAccountId } : {}),
        },
        create: {
          name,
          ...fields,
          ...(canonicalSavingsCode ? { ledgerAccountId } : {}),
        },
      });
      results.push(`? ${name}`);
    }

    const loanInsuranceGl = await db.chartOfAccount.findFirst({
      where: {
        OR: [
          { accountCode: "200600", isActive: true },
        ],
      },
      select: { id: true },
    });

    await db.accountType.upsert({
      where: { name: "Loan Insurance" },
      update: {
        ...LOAN_INSURANCE_PRODUCT,
        ledgerAccountId: loanInsuranceGl?.id ?? null,
      },
      create: {
        ...LOAN_INSURANCE_PRODUCT,
        ledgerAccountId: loanInsuranceGl?.id ?? null,
      },
    });
    results.push("? Loan Insurance");

    if (legacyInsurancePoolAccountType) {
      const loanInsuranceAccountType = await db.accountType.findFirst({
        where: { name: "Loan Insurance" },
        select: { id: true },
      });

      if (loanInsuranceAccountType && legacyInsurancePoolAccountType.id !== loanInsuranceAccountType.id) {
        if (legacyInsurancePoolAccountType._count.accounts > 0) {
          await db.account.updateMany({
            where: { accountTypeId: legacyInsurancePoolAccountType.id },
            data: { accountTypeId: loanInsuranceAccountType.id },
          });
        }

        await db.accountType.delete({
          where: { id: legacyInsurancePoolAccountType.id },
        });
      }
    }
    // Remove legacy types that have no member accounts
    const removed: string[] = [];
    for (const legacyName of LEGACY_NAMES) {
      try {
        const existing = await db.accountType.findUnique({
          where: { name: legacyName },
          include: { _count: { select: { accounts: true } } },
        });
        if (existing && existing._count.accounts === 0) {
          await db.accountType.delete({ where: { name: legacyName } });
          removed.push(legacyName);
        }
      } catch {
        // skip if not found or constraint error
      }
    }

    return NextResponse.json({
      message: "BUTCS savings and share products initialized successfully",
      upserted: results,
      removed,
    });
  } catch (error) {
    console.error("initialize account types error:", error);
    return NextResponse.json(
      { error: "Failed to initialize account types" },
      { status: 500 }
    );
  }
}


