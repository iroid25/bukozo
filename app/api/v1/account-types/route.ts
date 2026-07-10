// app/api/v1/account-types/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import {
  normalizeAccountTypeName,
  formatAccountTypeName,
  isValidAccountTypeName,
} from "@/types/accountTypes";
import {
  FIXED_DEPOSIT_ACCOUNT_TYPE_NAME,
  getCanonicalSavingsAccountTypeName,
  getCanonicalSavingsLedgerCode,
  VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
  getFixedDepositAccountTypeDefaults,
  getVoluntarySavingsAccountTypeDefaults,
  isFixedDepositAccountTypeName,
  isVoluntarySavingsAccountTypeName,
} from "@/lib/accounting/account-type-rules";
import { ensureLiabilityStructure } from "@/lib/services/liability-structure";
import { findActiveAccountByCodes } from "@/lib/accounting/coa-identity";

async function resolveCanonicalSavingsLedgerAccount(
  code: string,
  displayName: string,
) {
  await ensureLiabilityStructure();

  const existing = await findActiveAccountByCodes(db, [code]);
  if (existing) {
    return existing;
  }

  const currentLiabilities = await db.chartOfAccount.findFirst({
    where: { accountCode: "201000", isActive: true },
    select: { id: true },
  });

  return db.chartOfAccount.upsert({
    where: { accountCode: code },
    update: {
      accountName: displayName,
      fullCode: code,
      ledgerType: "LIABILITIES",
      debitCredit: "CR",
      category: "Current liabilities",
      parentId: currentLiabilities?.id ?? null,
      isActive: true,
    },
    create: {
      accountCode: code,
      accountName: displayName,
      fullCode: code,
      ledgerType: "LIABILITIES",
      debitCredit: "CR",
      category: "Current liabilities",
      parentId: currentLiabilities?.id ?? null,
      level: 2,
      isActive: true,
    },
    select: { id: true, accountCode: true, accountName: true },
  });
}

// GET /api/v1/account-types - Fetch all account types
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const ledgerType = searchParams.get("ledgerType") || undefined;
    const linkedOnly = searchParams.get("linkedOnly") === "true";
    const classificationCode = searchParams.get("classificationCode") || undefined;

    const accountTypes = await db.accountType.findMany({
      where: {
        ...(linkedOnly ? { ledgerAccountId: { not: null } } : {}),
        ...(ledgerType || classificationCode
          ? {
              ledgerAccount: {
                ...(ledgerType ? { ledgerType: ledgerType as any } : {}),
                ...(classificationCode
                  ? {
                      OR: [
                        { accountCode: classificationCode },
                        { parent: { accountCode: classificationCode } },
                      ],
                    }
                  : {}),
              },
            }
          : {}),
      },
      include: {
        ledgerAccount: {
          include: {
            parent: {
              select: {
                id: true,
                accountCode: true,
                accountName: true,
              },
            },
          },
        },
        _count: {
          select: {
            accounts: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Normalize account type names
    const normalized = accountTypes.map((x) => ({
      ...x,
      name: normalizeAccountTypeName(x.name),
    }));

    return NextResponse.json({
      data: normalized,
    });
  } catch (error) {
    console.error("Error fetching account types:", error);
    return NextResponse.json(
      { error: "Failed to fetch account types" },
      { status: 500 }
    );
  }
}

// POST /api/v1/account-types - Create a new account type
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate & format name
    if (!isValidAccountTypeName(body.name)) {
      return NextResponse.json(
        { error: "Account type name must be 3–50 chars" },
        { status: 400 }
      );
    }

    const name = formatAccountTypeName(body.name);
    const isVoluntarySavings = isVoluntarySavingsAccountTypeName(name);
    const isFixedDeposit = isFixedDepositAccountTypeName(name);
    const productDefaults = isVoluntarySavings
      ? getVoluntarySavingsAccountTypeDefaults(body.withdrawalFeeTiers ?? null)
      : isFixedDeposit
        ? getFixedDepositAccountTypeDefaults()
        : null;
    const effectiveName = isVoluntarySavings
      ? VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME
      : isFixedDeposit
        ? FIXED_DEPOSIT_ACCOUNT_TYPE_NAME
        : name;
    const canonicalSavingsLedgerCode = getCanonicalSavingsLedgerCode(effectiveName);
    const canonicalSavingsDisplayName = getCanonicalSavingsAccountTypeName(effectiveName);

    if (canonicalSavingsLedgerCode) {
      await ensureLiabilityStructure();
    }

    const duplicateName = effectiveName;

    // Check for duplicate (case-insensitive)
    const dupe = await db.accountType.findFirst({
      where: { name: { equals: duplicateName, mode: "insensitive" } },
    });

    if (dupe) {
      return NextResponse.json(
        { error: "Account type already exists" },
        { status: 409 }
      );
    }

    const canonicalSavingsLedgerAccount = canonicalSavingsLedgerCode
      ? await resolveCanonicalSavingsLedgerAccount(
          canonicalSavingsLedgerCode,
          canonicalSavingsDisplayName || effectiveName,
        )
      : null;

    if (
      canonicalSavingsLedgerAccount &&
      body.ledgerAccountId &&
      body.ledgerAccountId !== canonicalSavingsLedgerAccount.id
    ) {
      return NextResponse.json(
        {
          error: `Savings products must link to the canonical ledger account ${canonicalSavingsLedgerAccount.accountCode} - ${canonicalSavingsLedgerAccount.accountName}`,
        },
        { status: 400 },
      );
    }

    const resolvedLedgerAccountId =
      canonicalSavingsLedgerAccount?.id ?? body.ledgerAccountId ?? null;

    // Core validations
    const interestRate = body.interestRate ?? 0;
    if (interestRate < 0 || interestRate > 100) {
      return NextResponse.json(
        { error: "Interest must be 0–100%" },
        { status: 400 }
      );
    }

    const minBalance = body.minBalance ?? 0;
    if (minBalance < 0) {
      return NextResponse.json(
        { error: "Minimum balance cannot be negative" },
        { status: 400 }
      );
    }

    if (body.maxWithdrawal != null && body.maxWithdrawal < 0) {
      return NextResponse.json(
        { error: "Max withdrawal cannot be negative" },
        { status: 400 }
      );
    }

    // Charges / fees validations
    if (body.monthlyCharge != null && body.monthlyCharge < 0) {
      return NextResponse.json(
        { error: "Monthly charge cannot be negative" },
        { status: 400 }
      );
    }

    if (body.flatWithdrawalFee != null && body.flatWithdrawalFee < 0) {
      return NextResponse.json(
        { error: "Flat withdrawal fee cannot be negative" },
        { status: 400 }
      );
    }

    if (
      body.withdrawalFrequencyDays != null &&
      body.withdrawalFrequencyDays < 0
    ) {
      return NextResponse.json(
        { error: "Cooldown (days) cannot be negative" },
        { status: 400 }
      );
    }

    if (body.maxWithdrawalsPerDay != null && body.maxWithdrawalsPerDay < 0) {
      return NextResponse.json(
        { error: "Max withdrawals per day cannot be negative" },
        { status: 400 }
      );
    }

    if (body.fixedPeriodMonths != null && body.fixedPeriodMonths < 0) {
      return NextResponse.json(
        { error: "Fixed period (months) cannot be negative" },
        { status: 400 }
      );
    }

    // Create Account Type and sync to COA
    const result = await db.$transaction(async (tx) => {
      const created = await tx.accountType.create({
        data: {
          name: effectiveName,
          interestRate,
          interestPeriod: body.interestPeriod ?? "MONTHLY",
          minBalance,
          maxWithdrawal: body.maxWithdrawal ?? null,
          isLoanEligible: body.isLoanEligible ?? true,
          isDefault: body.isDefault ?? false,

          // Extra fields (all match Prisma schema)
          monthlyCharge: productDefaults?.monthlyCharge ?? body.monthlyCharge ?? null,
          flatWithdrawalFee: productDefaults?.flatWithdrawalFee ?? body.flatWithdrawalFee ?? null,
          withdrawalFeePercentage: productDefaults?.withdrawalFeePercentage ?? body.withdrawalFeePercentage ?? null,
          withdrawalFeeTiers: productDefaults?.withdrawalFeeTiers ?? body.withdrawalFeeTiers ?? null,

          withdrawalFrequencyDays: productDefaults?.withdrawalFrequencyDays ?? body.withdrawalFrequencyDays ?? null,
          maxWithdrawalsPerDay: body.maxWithdrawalsPerDay ?? null,

          hasFixedPeriod: productDefaults?.hasFixedPeriod ?? body.hasFixedPeriod ?? false,
          fixedPeriodMonths: productDefaults?.fixedPeriodMonths ?? body.fixedPeriodMonths ?? null,
          maturityTransferAccountType: (
            productDefaults?.maturityTransferAccountType ??
            body.maturityTransferAccountType ??
            null
          ) as string | null,

          isShareAccount: productDefaults?.isShareAccount ?? body.isShareAccount ?? false,
          canWithdraw: productDefaults?.canWithdraw ?? body.canWithdraw ?? true,
          earnsDividends: productDefaults?.earnsDividends ?? body.earnsDividends ?? false,
          sharePrice: body.sharePrice ?? null,
          ledgerAccountId: resolvedLedgerAccountId,
        },
      });

      // If a ledgerAccountId was explicitly provided, do not generate a duplicate automatic COA node
      if (!resolvedLedgerAccountId) {
        // Sync to Chart of Accounts (Hub)
        // Liability (Savings) or Equity (Shares)
        // Shares -> EQUITY, Savings -> LIABILITIES
        const isEquity = body.isShareAccount;
        const ledgerType = isEquity ? "EQUITY" : "LIABILITIES";
        const debitCredit = "CR"; // Both are Credit nature

        // Generate COA Code
        // Liabilities: 2xxxx, Equity: 3xxxx
        const prefix = isEquity ? "3" : "2"; 
        
        const count = await tx.chartOfAccount.count({
          where: { ledgerType }
        });
        const nextNum = (count + 1).toString().padStart(4, '0');
        const generatedCode = `${prefix}${nextNum}`;

        const newCoa = await tx.chartOfAccount.create({
          data: {
            accountName: `Control Account - ${created.name}`, // Clarity that this is a control account
            accountCode: generatedCode,
            fullCode: generatedCode,
            ledgerType: ledgerType,
            debitCredit: debitCredit, // Liabilities/Equity are naturally Credit
            isActive: true, // Account Types usually active upon creation
            level: 1,
            description: `Auto-generated Control Account for ${created.name}`,
            category: isEquity ? "Share Capital" : "Member Deposits", // Logical grouping
            product: created.name // Link to product name
          }
        });
        
        // Link the auto-generated COA to the AccountType
        await tx.accountType.update({
          where: { id: created.id },
          data: { ledgerAccountId: newCoa.id }
        });
      }

      return created;
    });

    // Return with normalized name
    return NextResponse.json(
      {
        data: {
          ...result,
          name: normalizeAccountTypeName(result.name),
        },
        message: "Account type created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating account type:", error);
    return NextResponse.json(
      { error: "Failed to create account type" },
      { status: 500 }
    );
  }
}
