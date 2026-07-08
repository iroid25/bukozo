import { PrismaClient, AccountLedgerType } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

type ParsedAccount = {
  accountCode: string;
  accountName: string;
  ledgerType?: string;
  product?: string;
  debitCredit?: string;
  currency?: string;
};

function parseAccountCode(fullCode: string): { code: string; name: string } | null {
  const match = fullCode.match(/^(\d+)\s+(.+)$/);
  if (!match) return null;
  return { code: match[1], name: match[2].trim() };
}

function isNumericAccountCode(value: string): boolean {
  return /^\d+$/.test(String(value || "").trim());
}

function extractNumericPrefix(value: string): string | null {
  const match = String(value || "").trim().match(/^(\d{3,8})\b/);
  return match ? match[1] : null;
}

function mapLedgerType(type: string): AccountLedgerType {
  const normalized = String(type || "").toUpperCase().trim();
  if (normalized === "ASSETS") return AccountLedgerType.ASSETS;
  if (normalized === "LIABILITIES") return AccountLedgerType.LIABILITIES;
  if (normalized === "EQUITY") return AccountLedgerType.EQUITY;
  if (normalized === "INCOME") return AccountLedgerType.INCOME;
  return AccountLedgerType.EXPENDITURES;
}

function determineLevel(code: string): number {
  if (code.endsWith("0000") && code.length === 6) return 1;
  if (code.endsWith("000") && code.length === 6) return 2;
  return 3;
}

function getParentCode(code: string, level: number): string | null {
  if (level === 1) return null;
  if (level === 2) return code.substring(0, 3) + "000";
  if (level === 3) return code.substring(0, 4) + "00";
  return null;
}

function inferLedgerTypeFromCode(code: string): AccountLedgerType {
  const firstDigit = code.charAt(0);
  if (firstDigit === "1") return AccountLedgerType.ASSETS;
  if (firstDigit === "2") return AccountLedgerType.LIABILITIES;
  if (firstDigit === "3") return AccountLedgerType.EQUITY;
  if (firstDigit === "4") return AccountLedgerType.INCOME;
  return AccountLedgerType.EXPENDITURES;
}

async function backupCurrentChartOfAccounts() {
  const backupDir = path.join(process.cwd(), "progress");
  const backupPath = path.join(backupDir, `chart-of-accounts-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const accounts = await prisma.chartOfAccount.findMany({
    orderBy: { accountCode: "asc" },
  });

  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(accounts, null, 2), "utf8");
  console.log(`Backup written to ${backupPath}`);
}

async function clearCOADependencies() {
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

async function deleteExistingChartOfAccounts() {
  const deleted = await prisma.chartOfAccount.deleteMany({});
  console.log(`Deleted chart of accounts: ${deleted.count}`);
}

async function seedCleanChartOfAccounts() {
  const filePath = path.join(process.cwd(), "parsed_accounts.json");
  const rawData = JSON.parse(fs.readFileSync(filePath, "utf8")) as ParsedAccount[];
  const uniqueRows = new Map<string, ParsedAccount>();
  for (const item of rawData) {
    const code = extractNumericPrefix(item.accountCode);
    if (!code || uniqueRows.has(code)) continue;
    uniqueRows.set(code, item);
  }
  const validRows = [...uniqueRows.values()];

  console.log(`Seeding ${validRows.length} numeric chart of accounts from parsed_accounts.json...`);

  for (const item of validRows) {
    const parsed = parseAccountCode(item.accountCode);
    if (!parsed) continue;

    const { code, name } = parsed;
    const level = determineLevel(code);
    const parentCode = getParentCode(code, level);

    let parentId: string | null = null;
    if (parentCode) {
      const parent = await prisma.chartOfAccount.findFirst({
        where: { accountCode: parentCode },
      });
      if (parent) parentId = parent.id;
    }

    const ledgerType = item.ledgerType
      ? mapLedgerType(item.ledgerType)
      : inferLedgerTypeFromCode(code);

    await prisma.chartOfAccount.create({
      data: {
        accountCode: code,
        accountName: name,
        fullCode: item.accountCode,
        parentId,
        level,
        ledgerType,
        category: level === 2 ? name : null,
        product: item.product || null,
        currency: item.currency || "UGX",
        debitCredit: item.debitCredit || null,
        isSystem: true,
        isActive: true,
      },
    });
  }

  const allAccounts = await prisma.chartOfAccount.findMany();
  const codeMap = new Set(allAccounts.map((account) => account.accountCode));

  for (const account of allAccounts) {
    const parsed = parseAccountCode(`${account.accountCode} ${account.accountName}`);
    if (!parsed) continue;

    const level = determineLevel(parsed.code);
    const parentCode = getParentCode(parsed.code, level);
    if (!parentCode || !codeMap.has(parentCode)) continue;

    const parent = allAccounts.find((candidate) => candidate.accountCode === parentCode);
    if (!parent) continue;

    await prisma.chartOfAccount.update({
      where: { id: account.id },
      data: {
        parentId: parent.id,
        level: (parent.level || 0) + 1,
      },
    });
  }

  console.log("Clean chart of accounts seeded.");
}

async function main() {
  console.log("Starting full Chart of Accounts reset...");

  await backupCurrentChartOfAccounts();
  await clearCOADependencies();
  await deleteExistingChartOfAccounts();
  await seedCleanChartOfAccounts();

  console.log("Chart of Accounts reset completed successfully.");
}

main()
  .catch((error) => {
    console.error("Chart of Accounts reset failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
