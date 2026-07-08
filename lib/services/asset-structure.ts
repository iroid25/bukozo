import { db } from "@/prisma/db";

export const ASSET_ROOT_CODE = "100000";
export const FIXED_ASSETS_CODE = "101000";
export const CURRENT_ASSETS_CODE = "102000";
export const MOBILE_MONEY_FLOAT_CODE = "102004";
export const CASH_AT_HAND_CODE = "101100";
export const LOAN_PORTFOLIO_CODE = "102003";

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
    { accountCode: "102001", accountName: "Cash at hand (alt)" },
    { accountCode: "102002", accountName: "Cash at bank" },
    { accountCode: MOBILE_MONEY_FLOAT_CODE, accountName: "Mobile Money Float" },
    { accountCode: "107000", accountName: "Loans" },
  ] as const;

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
    await db.chartOfAccount.upsert({
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
  }

  // Retire the old loan portfolio bucket now that repayments/disbursements
  // are tracked through 107000 Loans.
  await db.chartOfAccount.updateMany({
    where: {
      accountCode: LOAN_PORTFOLIO_CODE,
      ledgerType: "ASSETS",
    },
    data: {
      isActive: false,
      parentId: current.id,
      category: current.accountName,
      description: "Deprecated loan portfolio bucket replaced by 107000 Loans",
    },
  });

  return { root, fixed, current };
}
