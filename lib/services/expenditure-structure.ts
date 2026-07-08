import { db } from "@/prisma/db";

export const EXPENDITURE_ROOT_CODE = "500000";
export const WRITTEN_OFF_LOANS_CODE = "500100";
export const COMMISSION_EXPENSE_CODE = "500300";

export async function ensureExpenditureStructure() {
  const root = await db.chartOfAccount.upsert({
    where: { accountCode: EXPENDITURE_ROOT_CODE },
    create: {
      accountCode: EXPENDITURE_ROOT_CODE,
      accountName: "Expenses",
      fullCode: EXPENDITURE_ROOT_CODE,
      parentId: null,
      level: 0,
      ledgerType: "EXPENDITURES",
      debitCredit: "DR",
      category: "Expenses",
      isActive: true,
      isSystem: true,
    },
    update: {
      accountName: "Expenses",
      fullCode: EXPENDITURE_ROOT_CODE,
      parentId: null,
      level: 0,
      ledgerType: "EXPENDITURES",
      debitCredit: "DR",
      category: "Expenses",
      isActive: true,
      isSystem: true,
    },
  });

  const buckets = [
    { code: WRITTEN_OFF_LOANS_CODE, name: "Written off loans" },
    { code: COMMISSION_EXPENSE_CODE, name: "Commission expense" },
  ] as const;

  for (const bucket of buckets) {
    await db.chartOfAccount.upsert({
      where: { accountCode: bucket.code },
      create: {
        accountCode: bucket.code,
        accountName: bucket.name,
        fullCode: bucket.code,
        parentId: root.id,
        level: 1,
        ledgerType: "EXPENDITURES",
        debitCredit: "DR",
        category: root.accountName,
        isActive: true,
        isSystem: true,
      },
      update: {
        accountName: bucket.name,
        fullCode: bucket.code,
        parentId: root.id,
        level: 1,
        ledgerType: "EXPENDITURES",
        debitCredit: "DR",
        category: root.accountName,
        isActive: true,
        isSystem: true,
      },
    });
  }

  return { root };
}
