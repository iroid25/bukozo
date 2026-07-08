// app/api/v1/account-types/[id]/route.ts
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

// GET /api/v1/account-types/[id] - Fetch a single account type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const accountType = await db.accountType.findUnique({
      where: { id },
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
    });

    if (!accountType) {
      return NextResponse.json(
        { error: "Account type not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        ...accountType,
        name: normalizeAccountTypeName(accountType.name),
      },
    });
  } catch (error) {
    console.error("Error fetching account type:", error);
    return NextResponse.json(
      { error: "Failed to fetch account type" },
      { status: 500 }
    );
  }
}

// PUT /api/v1/account-types/[id] - Update an account type
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (!["ADMIN", "ACCOUNTANT"].includes(userRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Check if account type exists
    const existing = await db.accountType.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Account type not found" },
        { status: 404 }
      );
    }

    let formattedName: string | undefined;

    // Validate & format name if provided
    if (body.name !== undefined) {
      if (!isValidAccountTypeName(body.name)) {
        return NextResponse.json(
          { error: "Account type name must be 3–50 chars" },
          { status: 400 }
        );
      }
      formattedName = formatAccountTypeName(body.name);
    }

    const targetName = formattedName ?? existing.name;
    const isVoluntarySavings = isVoluntarySavingsAccountTypeName(targetName);
    const isFixedDeposit = isFixedDepositAccountTypeName(targetName);
    const productDefaults = isVoluntarySavings
      ? getVoluntarySavingsAccountTypeDefaults(
          body.withdrawalFeeTiers ?? existing.withdrawalFeeTiers ?? null,
        )
      : isFixedDeposit
        ? getFixedDepositAccountTypeDefaults()
        : null;
    const canonicalName = isVoluntarySavings
      ? VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME
      : isFixedDeposit
        ? FIXED_DEPOSIT_ACCOUNT_TYPE_NAME
        : formattedName;
    const canonicalSavingsLedgerCode = getCanonicalSavingsLedgerCode(targetName);
    const canonicalSavingsDisplayName = getCanonicalSavingsAccountTypeName(targetName);

    if (canonicalSavingsLedgerCode) {
      await ensureLiabilityStructure();
    }

    const canonicalSavingsLedgerAccount = canonicalSavingsLedgerCode
      ? await db.chartOfAccount.findFirst({
          where: {
            accountCode: canonicalSavingsLedgerCode,
            ledgerType: "LIABILITIES",
            isActive: true,
          },
          select: { id: true, accountCode: true, accountName: true },
        })
      : null;

    if (canonicalSavingsLedgerCode && !canonicalSavingsLedgerAccount) {
      return NextResponse.json(
        {
          error: `Unable to resolve the canonical savings ledger account for ${canonicalSavingsDisplayName || targetName}`,
        },
        { status: 500 },
      );
    }

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

    if (body.name !== undefined) {
      const duplicateName = canonicalName ?? formattedName;

      // Check for duplicate name (case-insensitive), excluding current record
      const dupe = await db.accountType.findFirst({
        where: {
          name: { equals: duplicateName, mode: "insensitive" },
          NOT: { id },
        },
      });
      if (dupe) {
        return NextResponse.json(
          { error: "Account type with this name exists" },
          { status: 409 }
        );
      }
    }

    // Validations
    if (
      body.interestRate != null &&
      (body.interestRate < 0 || body.interestRate > 100)
    ) {
      return NextResponse.json(
        { error: "Interest must be 0–100%" },
        { status: 400 }
      );
    }

    if (body.minBalance != null && body.minBalance < 0) {
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

    // Build update data object
    const updateData: any = { updatedAt: new Date() };

    if (canonicalName !== undefined) updateData.name = canonicalName;
    if (body.interestRate !== undefined)
      updateData.interestRate = body.interestRate;
    if (body.interestPeriod !== undefined)
      updateData.interestPeriod = body.interestPeriod;
    if (body.minBalance !== undefined) updateData.minBalance = body.minBalance;
    if (body.maxWithdrawal !== undefined)
      updateData.maxWithdrawal = body.maxWithdrawal;
    if (body.isLoanEligible !== undefined)
      updateData.isLoanEligible = body.isLoanEligible;
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;

    if (productDefaults) {
      updateData.monthlyCharge = productDefaults.monthlyCharge;
      updateData.flatWithdrawalFee = productDefaults.flatWithdrawalFee;
      updateData.withdrawalFeePercentage =
        productDefaults.withdrawalFeePercentage;
      updateData.withdrawalFeeTiers = productDefaults.withdrawalFeeTiers;
    } else {
      if (body.monthlyCharge !== undefined)
        updateData.monthlyCharge = body.monthlyCharge;
      if (body.flatWithdrawalFee !== undefined)
        updateData.flatWithdrawalFee = body.flatWithdrawalFee;
      if (body.withdrawalFeePercentage !== undefined)
        updateData.withdrawalFeePercentage = body.withdrawalFeePercentage;
      if (body.withdrawalFeeTiers !== undefined)
        updateData.withdrawalFeeTiers = body.withdrawalFeeTiers;
    }

    if (productDefaults) {
      updateData.withdrawalFrequencyDays =
        productDefaults.withdrawalFrequencyDays;
      updateData.hasFixedPeriod = productDefaults.hasFixedPeriod;
      updateData.fixedPeriodMonths = productDefaults.fixedPeriodMonths;
      updateData.maturityTransferAccountType =
        productDefaults.maturityTransferAccountType;
      updateData.isShareAccount = productDefaults.isShareAccount;
      updateData.canWithdraw = productDefaults.canWithdraw;
      updateData.earnsDividends = productDefaults.earnsDividends;
    } else {
      if (body.withdrawalFrequencyDays !== undefined)
        updateData.withdrawalFrequencyDays =
          body.withdrawalFrequencyDays ?? null;
      if (body.maxWithdrawalsPerDay !== undefined)
        updateData.maxWithdrawalsPerDay = body.maxWithdrawalsPerDay ?? null;

      if (body.hasFixedPeriod !== undefined)
        updateData.hasFixedPeriod = !!body.hasFixedPeriod;
      if (body.fixedPeriodMonths !== undefined)
        updateData.fixedPeriodMonths = body.fixedPeriodMonths ?? null;
      if (body.maturityTransferAccountType !== undefined)
        updateData.maturityTransferAccountType =
          (body.maturityTransferAccountType || null) as string | null;

      if (body.isShareAccount !== undefined)
        updateData.isShareAccount = !!body.isShareAccount;
      if (body.canWithdraw !== undefined)
        updateData.canWithdraw = !!body.canWithdraw;
      if (body.earnsDividends !== undefined)
        updateData.earnsDividends = !!body.earnsDividends;
    }
    if (body.sharePrice !== undefined)
      updateData.sharePrice = body.sharePrice ?? null;

    if (body.ledgerAccountId !== undefined)
      updateData.ledgerAccountId = body.ledgerAccountId || null;

    if (canonicalSavingsLedgerAccount) {
      updateData.ledgerAccountId = canonicalSavingsLedgerAccount.id;
    }

    // Update account type
    const updated = await db.accountType.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      data: {
        ...updated,
        name: normalizeAccountTypeName(updated.name),
      },
      message: "Account type updated successfully",
    });
  } catch (error) {
    console.error("Error updating account type:", error);
    return NextResponse.json(
      { error: "Failed to update account type" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/account-types/[id] - Delete an account type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (!["ADMIN", "ACCOUNTANT"].includes(userRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if account type exists and has related accounts
    const withCount = await db.accountType.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            accounts: true,
          },
        },
      },
    });

    if (!withCount) {
      return NextResponse.json(
        { error: "Account type not found" },
        { status: 404 }
      );
    }

    if (withCount._count.accounts > 0) {
      return NextResponse.json(
        {
          error: `Has ${withCount._count.accounts} accounts; cannot delete.`,
        },
        { status: 400 }
      );
    }

    // Delete account type
    await db.accountType.delete({ where: { id } });

    return NextResponse.json({
      message: "Account type deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting account type:", error);
    return NextResponse.json(
      { error: "Failed to delete account type" },
      { status: 500 }
    );
  }
}
