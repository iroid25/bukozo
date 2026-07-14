/**
 * Backfill script: Create missing journal entries for withdrawals.
 *
 * Actual data pattern: All WITHDRAWAL transactions have fee > 0 stored correctly,
 * but NO journal entries exist. Also, 12 orphaned FEE transactions exist with
 * relatedTransactionId: null (junk from testing).
 *
 * What this script does:
 * 1. Finds WITHDRAWAL transactions with fee > 0 but no journal entries
 * 2. Creates journal entries for both fee (Dr Savings, Cr Fee Income) and
 *    principal (Dr Savings, Cr Cash)
 * 3. Deletes orphaned FEE transactions (relatedTransactionId: null)
 *
 * Usage: npx tsx scripts/backfill-withdrawal-fees.ts [--dry-run]
 */

import { PrismaClient, TransactionType, TransactionStatus } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n🔧 Backfill Withdrawal Journal Entries (${DRY_RUN ? "DRY RUN" : "LIVE"})\n`);

  // 1. Find WITHDRAWAL transactions that already have fee stored
  const withdrawals = await prisma.transaction.findMany({
    where: {
      type: TransactionType.WITHDRAWAL,
      fee: { gt: 0 },
      status: TransactionStatus.COMPLETED,
    },
    include: {
      withdrawal: true,
      account: { include: { accountType: true } },
      member: true,
      journalEntries: true,
    },
  });

  console.log(`Found ${withdrawals.length} completed withdrawals with fee > 0`);

  // Filter to those missing journal entries
  const needsBackfill = withdrawals.filter((w) => w.journalEntries.length === 0);
  console.log(`${needsBackfill.length} need journal entries created\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < needsBackfill.length; i++) {
    const wtx = needsBackfill[i];
    const feeAmount = wtx.fee;
    const principalAmount = wtx.amount;
    const cashCode = wtx.channel?.toLowerCase() === "bank" ? "102002" : "101100";

    console.log(`  [${i + 1}/${needsBackfill.length}] ${wtx.transactionRef} — fee=${feeAmount}, amount=${principalAmount} UGX`);

    if (DRY_RUN) {
      console.log(`    Would: create fee journal entry (Dr Savings ${feeAmount}, Cr Fee Income ${feeAmount})`);
      console.log(`    Would: create principal journal entry (Dr Savings ${principalAmount}, Cr Cash ${principalAmount})`);
      successCount++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Find or create budget categories
        const parentCategory = await tx.budgetCategory.upsert({
          where: { code: "405000" },
          update: { name: "Fee income", kind: "INCOME", isActive: true },
          create: {
            name: "Fee income",
            code: "405000",
            kind: "INCOME",
            description: "Income from service and transaction fees",
            isActive: true,
          },
        });

        const feeCategory = await tx.budgetCategory.upsert({
          where: { code: "405001" },
          update: { name: "Withdrawal fee charged", kind: "INCOME", isActive: true, parentId: parentCategory.id },
          create: {
            name: "Withdrawal fee charged",
            code: "405001",
            kind: "INCOME",
            description: "Fees charged when processing withdrawals",
            isActive: true,
            parentId: parentCategory.id,
          },
        });

        // Ensure COA accounts exist
        const parentAccount = await tx.chartOfAccount.upsert({
          where: { accountCode: "405000" },
          update: { accountName: "Fee income", fullCode: "405000", ledgerType: "INCOME", debitCredit: "CR", isActive: true, level: 1, category: "INCOME" },
          create: { accountName: "Fee income", accountCode: "405000", fullCode: "405000", ledgerType: "INCOME", debitCredit: "CR", isActive: true, level: 1, category: "INCOME" },
        });

        const feeIncomeAccount = await tx.chartOfAccount.upsert({
          where: { accountCode: "405001" },
          update: { accountName: "Withdrawal fee charged", fullCode: "405001", ledgerType: "INCOME", debitCredit: "CR", isActive: true, level: 2, parentId: parentAccount.id, category: "INCOME" },
          create: { accountName: "Withdrawal fee charged", accountCode: "405001", fullCode: "405001", ledgerType: "INCOME", debitCredit: "CR", isActive: true, level: 2, parentId: parentAccount.id, category: "INCOME" },
        });

        // Create IncomeRecord for the fee (skip if already exists)
        const existingIncome = await tx.incomeRecord.findFirst({
          where: { externalRef: wtx.transactionRef },
        });

        if (!existingIncome) {
          await tx.incomeRecord.create({
            data: {
              budgetCategoryId: feeCategory.id,
              amount: feeAmount,
              recordDate: wtx.transactionDate,
              description: `Withdrawal fee (backfill) - ${wtx.transactionRef}`,
              branchId: wtx.account?.branchId ?? null,
              accountId: wtx.accountId,
              receivedByUserId: wtx.processedByUserId,
              status: TransactionStatus.COMPLETED,
              receiptNo: `BACKFILL-${Date.now()}`,
              externalRef: wtx.transactionRef,
              memberId: wtx.memberId ?? undefined,
              institutionId: wtx.institutionId ?? undefined,
            },
          });
        }

        // Find COA accounts
        const savingsAccount = await tx.chartOfAccount.findFirst({
          where: { ledgerType: "LIABILITIES", accountName: { contains: "Member Savings", mode: "insensitive" }, isActive: true },
        });

        const cashAccount = await tx.chartOfAccount.findFirst({
          where: { accountCode: cashCode, isActive: true },
        });

        // Fee journal entry: Dr Savings Liability, Cr Fee Income
        if (savingsAccount && feeIncomeAccount) {
          const entryNumber = `JE-BF-FEE-${Date.now()}`;

          await tx.journalEntry.create({
            data: {
              entryNumber,
              accountId: savingsAccount.id,
              debitAmount: feeAmount,
              creditAmount: 0,
              description: `Withdrawal fee (backfill) - ${wtx.transactionRef}`,
              reference: wtx.transactionRef,
              transactionId: wtx.id,
              createdByUserId: wtx.processedByUserId,
              entryDate: wtx.transactionDate,
              branchId: wtx.account?.branchId ?? null,
            },
          });

          await tx.journalEntry.create({
            data: {
              entryNumber,
              accountId: feeIncomeAccount.id,
              debitAmount: 0,
              creditAmount: feeAmount,
              description: `Withdrawal fee (backfill) - ${wtx.transactionRef}`,
              reference: wtx.transactionRef,
              transactionId: wtx.id,
              createdByUserId: wtx.processedByUserId,
              entryDate: wtx.transactionDate,
              branchId: wtx.account?.branchId ?? null,
            },
          });
        }

        // Principal journal entry: Dr Savings Liability, Cr Cash
        if (savingsAccount && cashAccount) {
          const entryNumber = `JE-BF-PRIN-${Date.now()}`;

          await tx.journalEntry.create({
            data: {
              entryNumber,
              accountId: savingsAccount.id,
              debitAmount: principalAmount,
              creditAmount: 0,
              description: `Withdrawal (backfill) - ${wtx.transactionRef}`,
              reference: wtx.transactionRef,
              transactionId: wtx.id,
              createdByUserId: wtx.processedByUserId,
              entryDate: wtx.transactionDate,
              branchId: wtx.account?.branchId ?? null,
            },
          });

          await tx.journalEntry.create({
            data: {
              entryNumber,
              accountId: cashAccount.id,
              debitAmount: 0,
              creditAmount: principalAmount,
              description: `Withdrawal (backfill) - ${wtx.transactionRef}`,
              reference: wtx.transactionRef,
              transactionId: wtx.id,
              createdByUserId: wtx.processedByUserId,
              entryDate: wtx.transactionDate,
              branchId: wtx.account?.branchId ?? null,
            },
          });
        }
      });

      successCount++;
    } catch (err: any) {
      console.error(`  ✗ [${i + 1}] Error: ${err.message}`);
      errorCount++;
    }
  }

  // 2. Clean up orphaned FEE transactions
  console.log("\n🧹 Cleaning up orphaned FEE transactions...\n");

  const orphanedFees = await prisma.transaction.findMany({
    where: {
      type: TransactionType.FEE,
      relatedTransactionId: null,
    },
  });

  console.log(`Found ${orphanedFees.length} orphaned FEE transactions`);

  if (orphanedFees.length > 0 && !DRY_RUN) {
    const deleteResult = await prisma.transaction.deleteMany({
      where: {
        id: { in: orphanedFees.map((f) => f.id) },
      },
    });
    console.log(`Deleted ${deleteResult.count} orphaned FEE transactions`);
  } else if (DRY_RUN) {
    console.log(`Would delete ${orphanedFees.length} orphaned FEE transactions`);
  }

  console.log(`\n✅ Done: ${successCount} backfilled, ${errorCount} errors\n`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
