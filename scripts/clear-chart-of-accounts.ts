import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function backupCurrentChartOfAccounts() {
  const backupDir = path.join(process.cwd(), "progress");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `chart-of-accounts-backup-${timestamp}.json`);

  const accounts = await prisma.chartOfAccount.findMany({
    orderBy: { accountCode: "asc" },
  });

  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(accounts, null, 2), "utf8");
  console.log(`Backup written to ${backupPath}`);
}

async function clearDependentReferences() {
  console.log("Clearing COA references from dependent tables...");

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

  const journalEntries = await prisma.journalEntry.deleteMany({});
  const accountTransactions = await prisma.accountTransaction.deleteMany({});

  console.log(`Deleted journal entries: ${journalEntries.count}`);
  console.log(`Deleted account transactions: ${accountTransactions.count}`);
}

async function clearChartOfAccounts() {
  const deleted = await prisma.chartOfAccount.deleteMany({});
  console.log(`Deleted chart of accounts: ${deleted.count}`);
}

async function main() {
  console.log("Starting Chart of Accounts clear/reset without reseeding...");

  await backupCurrentChartOfAccounts();
  await clearDependentReferences();
  await clearChartOfAccounts();

  console.log("Chart of Accounts cleared successfully. No seed data was loaded.");
}

main()
  .catch((error) => {
    console.error("Chart of Accounts clear failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
