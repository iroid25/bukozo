import { db } from "@/prisma/db";

export const ASSET_ROOT_CODE = "100000";
export const FIXED_ASSETS_CODE = "101000";
export const CURRENT_ASSETS_CODE = "102000";
export const MOBILE_MONEY_FLOAT_CODE = "102004";
export const CASH_AT_HAND_CODE = "101100";
export const LOANS_CODE = "107000";
export const RETIRED_LOAN_ASSET_CODE = "102003";

async function migrateRetiredLoanAssetToLoans(
  currentAssetsId: string,
  loansAccountId: string,
) {
  const retiredLoanAsset = await db.chartOfAccount.findFirst({
    where: {
      accountCode: RETIRED_LOAN_ASSET_CODE,
      ledgerType: "ASSETS",
    },
  });

  if (!retiredLoanAsset || retiredLoanAsset.id === loansAccountId) {
    return;
  }

  await db.$transaction(async (tx) => {
    const liveLoansAccount = await tx.chartOfAccount.findUnique({
      where: { id: loansAccountId },
    });
    const sourceLoanAsset = await tx.chartOfAccount.findUnique({
      where: { id: retiredLoanAsset.id },
    });

    if (!liveLoansAccount || !sourceLoanAsset || sourceLoanAsset.id === liveLoansAccount.id) {
      return;
    }

    await tx.journalEntry.updateMany({
      where: { accountId: sourceLoanAsset.id },
      data: { accountId: liveLoansAccount.id },
    });

    await tx.accountTransaction.updateMany({
      where: { debitAccountId: sourceLoanAsset.id },
      data: { debitAccountId: liveLoansAccount.id },
    });

    await tx.accountTransaction.updateMany({
      where: { creditAccountId: sourceLoanAsset.id },
      data: { creditAccountId: liveLoansAccount.id },
    });

    await tx.transaction.updateMany({
      where: { debitAccountId: sourceLoanAsset.id },
      data: { debitAccountId: liveLoansAccount.id },
    });

    await tx.transaction.updateMany({
      where: { creditAccountId: sourceLoanAsset.id },
      data: { creditAccountId: liveLoansAccount.id },
    });

    await tx.loanProduct.updateMany({
      where: { ledgerAccountId: sourceLoanAsset.id },
      data: { ledgerAccountId: liveLoansAccount.id },
    });

    await tx.chartOfAccount.updateMany({
      where: { parentId: sourceLoanAsset.id },
      data: { parentId: liveLoansAccount.id },
    });

    await tx.chartOfAccount.update({
      where: { id: liveLoansAccount.id },
      data: {
        balance: { increment: sourceLoanAsset.balance },
        debitBalance: { increment: sourceLoanAsset.debitBalance },
        creditBalance: { increment: sourceLoanAsset.creditBalance },
      },
    });

    await tx.chartOfAccount.update({
      where: { id: sourceLoanAsset.id },
      data: {
        balance: 0,
        debitBalance: 0,
        creditBalance: 0,
        isActive: false,
        parentId: currentAssetsId,
        category: "Current Assets",
        accountName: "Retired Loan Asset",
        fullCode: RETIRED_LOAN_ASSET_CODE,
        description: "Migrated into 107000 Loans",
      },
    });
  });
}

export async function ensureAssetStructure() {
  const root = await db.chartOfAccount.upsert({
    where: { accountCode: ASSET_ROOT_CODE },
    create: {
      accountCode: ASSET_ROOT_CODE,
      accountName: "Assets",
      fullCode: ASSET_ROOT_CODE,
      parentId: null,
      level: 0,
      ledgerType: "ASSETS",
      debitCredit: "DR",
      category: "Assets",
      isActive: true,
      isSystem: true,
    },
    update: {
      accountName: "Assets",
      fullCode: ASSET_ROOT_CODE,
      parentId: null,
      level: 0,
      ledgerType: "ASSETS",
      debitCredit: "DR",
      category: "Assets",
      isActive: true,
      isSystem: true,
    },
  });

  const fixed = await db.chartOfAccount.upsert({
    where: { accountCode: FIXED_ASSETS_CODE },
    create: {
      accountCode: FIXED_ASSETS_CODE,
      accountName: "Fixed Assets",
      fullCode: FIXED_ASSETS_CODE,
      parentId: root.id,
      level: 1,
      ledgerType: "ASSETS",
      debitCredit: "DR",
      category: "Fixed Assets",
      isActive: true,
      isSystem: true,
    },
    update: {
      accountName: "Fixed Assets",
      fullCode: FIXED_ASSETS_CODE,
      parentId: root.id,
      level: 1,
      ledgerType: "ASSETS",
      debitCredit: "DR",
      category: "Fixed Assets",
      isActive: true,
      isSystem: true,
    },
  });

  const current = await db.chartOfAccount.upsert({
    where: { accountCode: CURRENT_ASSETS_CODE },
    create: {
      accountCode: CURRENT_ASSETS_CODE,
      accountName: "Current Assets",
      fullCode: CURRENT_ASSETS_CODE,
      parentId: root.id,
      level: 1,
      ledgerType: "ASSETS",
      debitCredit: "DR",
      category: "Current Assets",
      isActive: true,
      isSystem: true,
    },
    update: {
      accountName: "Current Assets",
      fullCode: CURRENT_ASSETS_CODE,
      parentId: root.id,
      level: 1,
      ledgerType: "ASSETS",
      debitCredit: "DR",
      category: "Current Assets",
      isActive: true,
      isSystem: true,
    },
  });

  const fixedChildren = [
    { accountCode: "101001", accountName: "Land" },
    { accountCode: "101002", accountName: "Motor Vehicle" },
    { accountCode: "101003", accountName: "Furniture and fittings" },
  ] as const;

  const currentChildren = [
    { accountCode: CASH_AT_HAND_CODE, accountName: "Cash at hand" },
    { accountCode: "102001", accountName: "Cash equivalents" },
    { accountCode: "102002", accountName: "Cash at bank" },
    { accountCode: MOBILE_MONEY_FLOAT_CODE, accountName: "Mobile Money Float" },
    { accountCode: LOANS_CODE, accountName: "Loans" },
  ] as const;

  let loansAccount: { id: string } | null = null;

  for (const child of fixedChildren) {
    await db.chartOfAccount.upsert({
      where: { accountCode: child.accountCode },
      create: {
        accountCode: child.accountCode,
        accountName: child.accountName,
        fullCode: child.accountCode,
        parentId: fixed.id,
        level: 2,
        ledgerType: "ASSETS",
        debitCredit: "DR",
        category: fixed.accountName,
        isActive: true,
        isSystem: true,
      },
      update: {
        accountName: child.accountName,
        fullCode: child.accountCode,
        parentId: fixed.id,
        level: 2,
        ledgerType: "ASSETS",
        debitCredit: "DR",
        category: fixed.accountName,
        isActive: true,
        isSystem: true,
      },
    });
  }

  for (const child of currentChildren) {
    const account = await db.chartOfAccount.upsert({
      where: { accountCode: child.accountCode },
      create: {
        accountCode: child.accountCode,
        accountName: child.accountName,
        fullCode: child.accountCode,
        parentId: current.id,
        level: 2,
        ledgerType: "ASSETS",
        debitCredit: "DR",
        category: current.accountName,
        isActive: true,
        isSystem: true,
      },
      update: {
        accountName: child.accountName,
        fullCode: child.accountCode,
        parentId: current.id,
        level: 2,
        ledgerType: "ASSETS",
        debitCredit: "DR",
        category: current.accountName,
        isActive: true,
        isSystem: true,
      },
    });

    if (child.accountCode === LOANS_CODE) {
      loansAccount = account;
    }
  }

  if (loansAccount) {
    await migrateRetiredLoanAssetToLoans(current.id, loansAccount.id);
  }

  return { root, fixed, current };
}
