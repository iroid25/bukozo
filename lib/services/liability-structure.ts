import { db } from "../../prisma/db.ts";
import {
  CANONICAL_SAVINGS_LEDGER_CODES,
  COMPULSORY_SAVINGS_ACCOUNT_TYPE_NAME,
  FIXED_DEPOSIT_ACCOUNT_TYPE_NAME,
  JUNIOR_SAVINGS_ACCOUNT_TYPE_NAME,
  VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
} from "@/lib/accounting/account-type-rules";

export const LIABILITY_ROOT_CODE = "200000";
export const CURRENT_LIABILITIES_CODE = "201000";
export const NON_CURRENT_LIABILITIES_CODE = "202000";

export async function ensureLiabilityStructure() {
  const root = await db.chartOfAccount.upsert({
    where: { accountCode: LIABILITY_ROOT_CODE },
    create: {
      accountCode: LIABILITY_ROOT_CODE,
      accountName: "Liabilities",
      fullCode: LIABILITY_ROOT_CODE,
      parentId: null,
      level: 0,
      ledgerType: "LIABILITIES",
      debitCredit: "CR",
      category: "Liabilities",
      isActive: true,
      isSystem: true,
    },
    update: {
      accountName: "Liabilities",
      fullCode: LIABILITY_ROOT_CODE,
      parentId: null,
      level: 0,
      ledgerType: "LIABILITIES",
      debitCredit: "CR",
      category: "Liabilities",
      isActive: true,
      isSystem: true,
    },
  });

  const current = await db.chartOfAccount.upsert({
    where: { accountCode: CURRENT_LIABILITIES_CODE },
    create: {
      accountCode: CURRENT_LIABILITIES_CODE,
      accountName: "Current liabilities",
      fullCode: CURRENT_LIABILITIES_CODE,
      parentId: root.id,
      level: 1,
      ledgerType: "LIABILITIES",
      debitCredit: "CR",
      category: "Current liabilities",
      isActive: true,
      isSystem: true,
    },
    update: {
      accountName: "Current liabilities",
      fullCode: CURRENT_LIABILITIES_CODE,
      parentId: root.id,
      level: 1,
      ledgerType: "LIABILITIES",
      debitCredit: "CR",
      category: "Current liabilities",
      isActive: true,
      isSystem: true,
    },
  });

  const nonCurrent = await db.chartOfAccount.upsert({
    where: { accountCode: NON_CURRENT_LIABILITIES_CODE },
    create: {
      accountCode: NON_CURRENT_LIABILITIES_CODE,
      accountName: "Non-current liabilities",
      fullCode: NON_CURRENT_LIABILITIES_CODE,
      parentId: root.id,
      level: 1,
      ledgerType: "LIABILITIES",
      debitCredit: "CR",
      category: "Non-current liabilities",
      isActive: true,
      isSystem: true,
    },
    update: {
      accountName: "Non-current liabilities",
      fullCode: NON_CURRENT_LIABILITIES_CODE,
      parentId: root.id,
      level: 1,
      ledgerType: "LIABILITIES",
      debitCredit: "CR",
      category: "Non-current liabilities",
      isActive: true,
      isSystem: true,
    },
  });

  const currentChildren = [
    {
      accountCode: CANONICAL_SAVINGS_LEDGER_CODES.FIXED_DEPOSIT,
      accountName: FIXED_DEPOSIT_ACCOUNT_TYPE_NAME,
    },
    {
      accountCode: CANONICAL_SAVINGS_LEDGER_CODES.JUNIOR_SAVINGS,
      accountName: JUNIOR_SAVINGS_ACCOUNT_TYPE_NAME,
    },
    {
      accountCode: CANONICAL_SAVINGS_LEDGER_CODES.VOLUNTARY_SAVINGS,
      accountName: VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
    },
    {
      accountCode: CANONICAL_SAVINGS_LEDGER_CODES.COMPULSORY_SAVINGS,
      accountName: COMPULSORY_SAVINGS_ACCOUNT_TYPE_NAME,
    },
    { accountCode: "201005", accountName: "Dividends payable" },
    { accountCode: "200600", accountName: "Loan insurance" },
  ] as const;

  const nonCurrentChildren = [
    { accountCode: "202002", accountName: "Accumulated depreciation" },
    { accountCode: "202003", accountName: "External loan" },
    { accountCode: "202004", accountName: "Founders account" },
  ] as const;

  for (const child of currentChildren) {
    await db.chartOfAccount.upsert({
      where: { accountCode: child.accountCode },
      create: {
        accountCode: child.accountCode,
        accountName: child.accountName,
        fullCode: child.accountCode,
        parentId: current.id,
        level: 2,
        ledgerType: "LIABILITIES",
        debitCredit: "CR",
        category: current.accountName,
        isActive: true,
        isSystem: true,
      },
      update: {
        accountName: child.accountName,
        fullCode: child.accountCode,
        parentId: current.id,
        level: 2,
        ledgerType: "LIABILITIES",
        debitCredit: "CR",
        category: current.accountName,
        isActive: true,
        isSystem: true,
      },
    });
  }

  for (const child of nonCurrentChildren) {
    await db.chartOfAccount.upsert({
      where: { accountCode: child.accountCode },
      create: {
        accountCode: child.accountCode,
        accountName: child.accountName,
        fullCode: child.accountCode,
        parentId: nonCurrent.id,
        level: 2,
        ledgerType: "LIABILITIES",
        debitCredit: "CR",
        category: nonCurrent.accountName,
        isActive: true,
        isSystem: true,
      },
      update: {
        accountName: child.accountName,
        fullCode: child.accountCode,
        parentId: nonCurrent.id,
        level: 2,
        ledgerType: "LIABILITIES",
        debitCredit: "CR",
        category: nonCurrent.accountName,
        isActive: true,
        isSystem: true,
      },
    });
  }

  return { root, current, nonCurrent };
}
