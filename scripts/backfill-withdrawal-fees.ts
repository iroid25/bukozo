/**
 * Backfill script: Fix Path B withdrawals where fee was stored in a separate
 * FEE-type Transaction instead of on the main WITHDRAWAL transaction.
 *
 * What this script does:
 * 1. Finds WITHDRAWAL transactions where fee=0 but a linked FEE transaction exists
 * 2. Copies fee amount from the FEE transaction to the WITHDRAWAL transaction
 * 3. Copies fee amount to the Withdrawal record
 * 4. Creates missing journal entries for both fee and principal
 * 5. Removes the orphaned FEE transactions
 *
 * Usage: npx tsx scripts/backfill-withdrawal-fees.ts [--dry-run]
 */

import { PrismaClient, TransactionType, TransactionStatus } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n🔧 Backfill Withdrawal Fees (${DRY_RUN ? "DRY RUN" : "LIVE"})\n`);

  // 1. Find WITHDRAWAL transactions with fee=0 that have a linked FEE transaction
  const orphanedWithdrawals = await prisma.transaction.findMany({
    where: {
      type: TransactionType.WITHDRAWAL,
      fee: 0,
      status: TransactionStatus.COMPLETED,
    },
    include: {
      withdrawal: true,
      account: { include: { accountType: true } },
      member: true,
      institution: true,
    },
  });

  // Filter to only those that have a matching FEE transaction
  const needsBackfill: typeof orphanedWithdrawals = [];
  const feeTransactionsToDelete: string[] = [];

  for (const wtx of orphanedWithdrawals) {
    const feeTx = await prisma.transaction.findFirst({
      where: {
        type: TransactionType.FEE,
        relatedTransactionId: wtx.id,
      },
    });

    if (feeTx && feeTx.amount > 0) {
      needsBackfill.push(wtx);
      feeTransactionsToDelete.push(feeTx.id);
    }
  }

  console.log(`Found ${needsBackfill.length} withdrawals needing backfill\n`);

  if (needsBackfill.length === 0) {
    console.log("Nothing to backfill!");
    await prisma.$disconnect();
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < needsBackfill.length; i++) {
    const wtx = needsBackfill[i];
    const feeTxId = feeTransactionsToDelete[i];

    try {
      const feeTx = await prisma.transaction.findUnique({
        where: { id: feeTxId },
      });

      if (!feeTx) {
        console.log(`  ⚠ [${i + 1}] FEE transaction ${feeTxId} not found, skipping`);
        continue;
      }

      const feeAmount = feeTx.amount;
      const cashCode = wtx.channel?.toLowerCase() === "bank" ? "102002" : "101100";

      console.log(`  [${i + 1}/${needsBackfill.length}] ${wtx.transactionRef} — fee=${feeAmount} UGX`);

      if (DRY_RUN) {
        console.log(`    Would: update Transaction fee=${feeAmount}`);
        console.log(`    Would: update Withdrawal fee=${feeAmount}`);
        console.log(`    Would: create fee journal entry (Dr Savings, Cr Fee Income)`);
        console.log(`    Would: create principal journal entry (Dr Savings, Cr Cash)`);
        console.log(`    Would: delete FEE transaction ${feeTxId}`);
        successCount++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        // Update main WITHDRAWAL transaction with fee
        await tx.transaction.update({
          where: { id: wtx.id },
          data: { fee: feeAmount },
        });

        // Update Withdrawal record with fee
        if (wtx.withdrawal) {
          await tx.withdrawal.update({
            where: { id: wtx.withdrawal.id },
            data: { fee: feeAmount },
          });
        }

        // Find or create budget category for withdrawal fees
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
          update: {
            name: "Withdrawal fee charged",
            kind: "INCOME",
            isActive: true,
            parentId: parentCategory.id,
          },
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
          update: {
            accountName: "Fee income",
            fullCode: "405000",
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 1,
            category: "INCOME",
          },
          create: {
            accountName: "Fee income",
            accountCode: "405000",
            fullCode: "405000",
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 1,
            category: "INCOME",
          },
        });

        const feeIncomeAccount = await tx.chartOfAccount.upsert({
          where: { accountCode: "405001" },
          update: {
            accountName: "Withdrawal fee charged",
            fullCode: "405001",
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 2,
            parentId: parentAccount.id,
            category: "INCOME",
          },
          create: {
            accountName: "Withdrawal fee charged",
            accountCode: "405001",
            fullCode: "405001",
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 2,
            parentId: parentAccount.id,
            category: "INCOME",
          },
        });

        // Create IncomeRecord for the fee
        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: feeCategory.id,
            amount: feeAmount,
            recordDate: new Date(),
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

        // Fee journal entry: Dr Savings Liability, Cr Fee Income
        const savingsAccount = await tx.chartOfAccount.findFirst({
          where: {
            ledgerType: "LIABILITIES",
            accountName: { contains: "Member Savings", mode: "insensitive" },
            isActive: true,
          },
        });

        const cashAccount = await tx.chartOfAccount.findFirst({
          where: { accountCode: cashCode, isActive: true },
        });

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
              debitAmount: wtx.amount,
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
              creditAmount: wtx.amount,
              description: `Withdrawal (backfill) - ${wtx.transactionRef}`,
              reference: wtx.transactionRef,
              transactionId: wtx.id,
              createdByUserId: wtx.processedByUserId,
              entryDate: wtx.transactionDate,
              branchId: wtx.account?.branchId ?? null,
            },
          });
        }

        // Delete the orphaned FEE transaction
        await tx.transaction.delete({ where: { id: feeTxId } });
      });

      successCount++;
    } catch (err: any) {
      console.error(`  ✗ [${i + 1}] Error: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n✅ Done: ${successCount} backfilled, ${errorCount} errors\n`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
