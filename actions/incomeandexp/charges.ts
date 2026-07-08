"use server";

import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import {
  TransactionStatus,
  TransactionType,
  VaultTransactionType,
  Prisma,
} from "@prisma/client";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { MONTHLY_FEE_CHARGED_CODE, MONTHLY_FEE_CHARGED_NAME } from "@/lib/services/income-structure";

// ---- helpers ----

/** Get or create an INCOME category by code. */
async function getOrCreateIncomeCategory(code: string, name: string) {
  let cat = await db.budgetCategory.findFirst({
    where: { code, kind: "INCOME" },
  });
  if (!cat) {
    cat = await db.budgetCategory.create({
      data: { name, code, kind: "INCOME", isActive: true, parentId: null },
    });
  }
  return cat;
}

async function getCurrentOpenPeriod() {
  return db.financialPeriod.findFirst({
    where: {
      isClosed: false,
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
  });
}

/**
 * Ensure an "Accountant Vault" exists for the given custodian.
 * We accept either the top-level Prisma client (db) or a TransactionClient (tx).
 */
async function ensureAccountantVault(
  accountantUserId: string,
  client: Prisma.TransactionClient | typeof db = db
) {
  const suffix = accountantUserId.slice(0, 6);

  let vault = await client.vault.findFirst({
    where: { custodianUserId: accountantUserId, isActive: true },
  });

  if (!vault) {
    vault = await client.vault.create({
      data: {
        name: `Accountant Vault — ${suffix}`,
        custodianUserId: accountantUserId,
        balance: 0,
        physicalCash: 0,
        isActive: true,
      },
    });
  }

  return vault;
}

/**
 * Credit the vault with income, ensuring it also appears in vault transactions.
 * If you pass a Prisma TransactionClient, we use it; otherwise we create our own transaction.
 */
export async function recordIncomeToVault(
  opts: {
    amount: number;
    description?: string;
    performedByUserId: string;
    relatedUserId?: string | null;
  },
  tx?: Prisma.TransactionClient
) {
  const { amount, description, performedByUserId, relatedUserId = null } = opts;

  if (tx) {
    // Use existing transaction
    const vault = await ensureAccountantVault(performedByUserId, tx);
    const before = vault.balance;
    const after = before + amount;

    await tx.vault.update({
      where: { id: vault.id },
      data: { balance: after },
    });

    await tx.vaultTransaction.create({
      data: {
        vaultId: vault.id,
        type: VaultTransactionType.OVERAGE_RECEIVED,
        amount,
        balanceBefore: before,
        balanceAfter: after,
        description: description ?? "Income posted",
        performedByUserId,
        relatedUserId: relatedUserId ?? undefined,
      },
    });
  } else {
    // Create our own transaction using the top-level client
    await db.$transaction(async (tdb: Prisma.TransactionClient) => {
      const vault = await ensureAccountantVault(performedByUserId, tdb);
      const before = vault.balance;
      const after = before + amount;

      await tdb.vault.update({
        where: { id: vault.id },
        data: { balance: after },
      });

      await tdb.vaultTransaction.create({
        data: {
          vaultId: vault.id,
          type: VaultTransactionType.OVERAGE_RECEIVED,
          amount,
          balanceBefore: before,
          balanceAfter: after,
          description: description ?? "Income posted",
          performedByUserId,
          relatedUserId: relatedUserId ?? undefined,
        },
      });
    });
  }

  return { ok: true };
}

/**
 * ✅ FIXED: Run monthly charges for all ACTIVE accounts with accountType.monthlyCharge > 0
 * Now supports both member and institution accounts
 * Produces:
 * - Transaction (FEE)
 * - IncomeRecord
 * - Vault credit (OVERAGE_RECEIVED)
 */
export async function runMonthlyCharges(params: { accountantUserId: string }) {
  const { accountantUserId } = params;

  const [category, period] = await Promise.all([
    getOrCreateIncomeCategory("INC-AMC", "Monthly Account Charge"),
    getCurrentOpenPeriod(),
  ]);

  // ✅ Include both member AND institution
  const accounts = await db.account.findMany({
    where: {
      status: "ACTIVE",
      accountType: { monthlyCharge: { not: null, gt: 0 } },
    },
    include: {
      member: { include: { user: true } },
      institution: { include: { user: true } }, // ✅ ADD THIS
      accountType: true,
      branch: true,
    },
  });

  let charged = 0;
  let skipped = 0;
  let totalAmount = 0;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Ensure vault within the same transaction
    const vault = await ensureAccountantVault(accountantUserId, tx);
    let runningVaultBalance = vault.balance;

    for (const acc of accounts) {
      const fee = acc.accountType.monthlyCharge || 0;
      if (fee <= 0) continue;

      // Skip if insufficient account balance
      if (acc.balance < fee) {
        skipped++;
        continue;
      }

      // ✅ Get the owner user ID (member or institution)
      const ownerUserId = acc.member?.user.id || acc.institution?.user.id;

      // ✅ Skip if no owner found (shouldn't happen, but safety check)
      if (!ownerUserId) {
        console.warn(`Account ${acc.accountNumber} has no owner, skipping`);
        skipped++;
        continue;
      }

      const ref = `AMC-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;

      // Create transaction record
      const txn = await tx.transaction.create({
        data: {
          transactionRef: ref,
          memberId: acc.memberId,
          institutionId: acc.institutionId, // ✅ ADD THIS
          accountId: acc.id,
          type: TransactionType.FEE,
          amount: fee,
          status: TransactionStatus.COMPLETED,
          description: `Monthly account charge - ${acc.accountType.name}`,
          processedByUserId: accountantUserId,
          transactionDate: new Date(),
          channel: "System",
        },
      });

      // Deduct from account
      await tx.account.update({
        where: { id: acc.id },
        data: { balance: { decrement: fee } },
      });

      // Income record for operational reporting
      await tx.incomeRecord.create({
        data: {
          budgetCategoryId: category.id,
          amount: fee,
          date: new Date(),
          description: `Monthly account charge - ${acc.accountNumber}`,
          paymentMethod: "CASH",
          receivedByUserId: accountantUserId,
          branchId: acc.branchId || undefined,
          memberId: acc.memberId || undefined,
          accountId: acc.id,
          status: "COMPLETED",
          recordDate: new Date(),
          referenceNumber: ref,
        },
      });

      // Income tracked via GL journal entry below (Dr Savings, Cr Fee Income)
      // Credit the vault
      const before = runningVaultBalance;
      const after = before + fee;

      await tx.vault.update({
        where: { id: vault.id },
        data: { balance: after },
      });

      await tx.vaultTransaction.create({
        data: {
          vaultId: vault.id,
          type: VaultTransactionType.OVERAGE_RECEIVED,
          amount: fee,
          balanceBefore: before,
          balanceAfter: after,
          description: `Monthly charge from ${acc.accountNumber}`,
          performedByUserId: accountantUserId,
          relatedUserId: ownerUserId, // ✅ FIXED: Use the safely extracted ID
        },
      });

      // GL journal entry: Dr Savings Liability, Cr Fee Income
      const savingsGL = await tx.chartOfAccount.findFirst({
        where: {
          ledgerType: "LIABILITIES",
          accountName: { contains: "SAVINGS", mode: "insensitive" },
          isActive: true,
        },
      });

      if (savingsGL) {
        const feeIncomeGL = await tx.chartOfAccount.upsert({
          where: { accountCode: MONTHLY_FEE_CHARGED_CODE },
          update: {
            accountName: MONTHLY_FEE_CHARGED_NAME,
            fullCode: MONTHLY_FEE_CHARGED_CODE,
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 2,
            category: "INCOME",
            description: "Fees charged monthly on savings accounts",
          },
          create: {
            accountCode: MONTHLY_FEE_CHARGED_CODE,
            accountName: MONTHLY_FEE_CHARGED_NAME,
            fullCode: MONTHLY_FEE_CHARGED_CODE,
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 2,
            category: "INCOME",
            description: "Fees charged monthly on savings accounts",
          },
        });

        const entryNumber = `JE-AMC-${Date.now()}-${acc.id.slice(0, 6)}`;

        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: savingsGL.id,
            debitAmount: fee,
            creditAmount: 0,
            description: `Monthly account charge - ${acc.accountNumber}`,
            entryDate: new Date(),
            reference: ref,
            branchId: acc.branchId || undefined,
            createdByUserId: accountantUserId,
          },
        });

        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: feeIncomeGL.id,
            debitAmount: 0,
            creditAmount: fee,
            description: `Monthly account charge - ${acc.accountNumber}`,
            entryDate: new Date(),
            reference: ref,
            branchId: acc.branchId || undefined,
            createdByUserId: accountantUserId,
          },
        });

        await tx.chartOfAccount.update({
          where: { id: savingsGL.id },
          data: buildAccountBalanceUpdate(savingsGL, { debitAmount: fee }),
        });

        await tx.chartOfAccount.update({
          where: { id: feeIncomeGL.id },
          data: buildAccountBalanceUpdate(feeIncomeGL, { creditAmount: fee }),
        });
      }

      runningVaultBalance = after;

      charged++;
      totalAmount += fee;
    }
  });

  revalidatePath("/dashboard/accountant/vault");
  revalidatePath("/dashboard/income");
  revalidatePath("/dashboard/accounts/incomes");

  return { charged, skipped, totalAmount };
}
