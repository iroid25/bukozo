import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

type SnapshotChartOfAccount = {
  id: string;
  accountCode: string;
  accountName: string;
  fullCode: string;
  parentId: string | null;
  level: number;
  category: string | null;
  product: string | null;
  currency: string;
  debitCredit: string | null;
  description: string | null;
  notes: string | null;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  balance: number;
  debitBalance: number;
  creditBalance: number;
  ledgerType: string;
};

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "progress",
  "chart-of-accounts-backup-2026-04-25T19-49-57-476Z.json",
);

function loadSnapshot(): SnapshotChartOfAccount[] {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    throw new Error(`Snapshot not found at ${SNAPSHOT_PATH}`);
  }

  const raw = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as any[];

  return raw.map((account) => ({
    id: String(account.id),
    accountCode: String(account.accountCode ?? ""),
    accountName: String(account.accountName ?? ""),
    fullCode: String(account.fullCode ?? account.accountCode ?? ""),
    parentId: account.parentId ?? null,
    level: Number(account.level ?? 0),
    category: account.category ?? null,
    product: account.product ?? null,
    currency: String(account.currency ?? "UGX"),
    debitCredit: account.debitCredit ?? null,
    description: account.description ?? null,
    notes: account.notes ?? null,
    isActive: Boolean(account.isActive ?? true),
    isSystem: Boolean(account.isSystem ?? true),
    createdAt: account.createdAt ?? new Date().toISOString(),
    updatedAt: account.updatedAt ?? new Date().toISOString(),
    balance: Number(account.balance ?? 0),
    debitBalance: Number(account.debitBalance ?? 0),
    creditBalance: Number(account.creditBalance ?? 0),
    ledgerType: String(account.ledgerType ?? "ASSETS"),
  }));
}

async function clearDependentReferences() {
  await prisma.accountType.updateMany({
    data: { ledgerAccountId: null },
  });

  await prisma.fixedAsset.updateMany({
    data: {
      accountId: null,
      accumulatedDepreciationAccountId: null,
      depreciationExpenseAccountId: null,
    },
  });

  await prisma.loanProduct.updateMany({
    data: {
      feeAccountId: null,
      interestAccountId: null,
      ledgerAccountId: null,
      penaltyAccountId: null,
    },
  });

  await prisma.transaction.updateMany({
    data: {
      creditAccountId: null,
      debitAccountId: null,
    },
  });

  await prisma.journalEntry.deleteMany({});
  await prisma.accountTransaction.deleteMany({});
}

async function restoreChartOfAccounts() {
  const snapshot = loadSnapshot();
  const sorted = [...snapshot].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.accountCode.localeCompare(b.accountCode);
  });

  console.log(`Restoring ${snapshot.length} COA rows from snapshot...`);

  await clearDependentReferences();
  await prisma.chartOfAccount.deleteMany({});

  for (const account of sorted) {
    await prisma.chartOfAccount.create({
      data: {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        fullCode: account.fullCode,
        parentId: account.parentId,
        level: account.level,
        category: account.category,
        product: account.product,
        currency: account.currency,
        debitCredit: account.debitCredit,
        description: account.description,
        notes: account.notes,
        isActive: account.isActive,
        isSystem: account.isSystem,
        createdAt: new Date(account.createdAt),
        updatedAt: new Date(account.updatedAt),
        balance: account.balance,
        debitBalance: account.debitBalance,
        creditBalance: account.creditBalance,
        ledgerType: account.ledgerType as any,
      },
    });
  }

  console.log("Chart of Accounts restored from backup.");
}

async function main() {
  console.log("Starting Chart of Accounts restore from snapshot...");
  await restoreChartOfAccounts();
  console.log("Restore completed successfully.");
}

main()
  .catch((error) => {
    console.error("Chart of Accounts restore failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
