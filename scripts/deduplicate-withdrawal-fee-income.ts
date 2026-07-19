/**
 * Deduplicate withdrawal fee IncomeRecords.
 *
 * Some IncomeRecords were created by the live withdrawal code paths WITHOUT
 * setting `externalRef`, then the backfill script (backfill-withdrawal-fees.ts)
 * created a SECOND IncomeRecord for the same fee because its dedup guard
 * (`findFirst` on `externalRef`) could not find the original record.
 *
 * This script:
 * 1. Finds all IncomeRecords whose description starts with "Withdrawal Fee"
 *    and whose budgetCategory code is "405001" (withdrawal fee income).
 * 2. Groups them by (description, amount, branchId, memberId, recordDate).
 * 3. Within each group, keeps the record with the earliest `createdAt` and
 *    deletes the rest.
 * 4. Backfills `externalRef` on the surviving records by extracting the
 *    transactionRef from the description.
 *
 * Usage: npx tsx scripts/deduplicate-withdrawal-fee-income.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Deduplicate Withdrawal Fee IncomeRecords ===\n");

  const WITHDRAWAL_FEE_CODE = "405001";

  // Find the budget category for withdrawal fees
  const feeCategory = await prisma.budgetCategory.findFirst({
    where: { code: WITHDRAWAL_FEE_CODE },
  });

  if (!feeCategory) {
    console.error(`BudgetCategory with code ${WITHDRAWAL_FEE_CODE} not found.`);
    return;
  }

  // Find ALL withdrawal fee IncomeRecords (both original and backfilled)
  const allFeeRecords = await prisma.incomeRecord.findMany({
    where: {
      budgetCategoryId: feeCategory.id,
      description: { contains: "withdrawal fee", mode: "insensitive" },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${allFeeRecords.length} withdrawal fee IncomeRecords total.\n`);

  // Group by dedup key: transactionRef (extracted from description) + amount + branchId + memberId + recordDate
  const groups = new Map<string, typeof allFeeRecords>();

  for (const record of allFeeRecords) {
    const txRef = extractTransactionRef(record.description) || record.id;
    const dateKey = record.recordDate.toISOString().slice(0, 10);
    const key = [
      txRef,
      record.amount,
      record.branchId || "",
      record.memberId || "",
      dateKey,
    ].join("|");

    const group = groups.get(key) || [];
    group.push(record);
    groups.set(key, group);
  }

  let totalDuplicates = 0;
  let totalBackfilled = 0;

  for (const [key, group] of groups) {
    if (group.length <= 1) {
      // Single record — backfill externalRef if missing
      const record = group[0];
      if (!record.externalRef) {
        const txRef = extractTransactionRef(record.description);
        if (txRef) {
          await prisma.incomeRecord.update({
            where: { id: record.id },
            data: { externalRef: txRef },
          });
          totalBackfilled++;
        }
      }
      continue;
    }

    // Multiple records — keep the first (earliest createdAt), delete the rest
    const [keeper, ...duplicates] = group;
    totalDuplicates += duplicates.length;

    // Backfill externalRef on the keeper if missing
    if (!keeper.externalRef) {
      const txRef = extractTransactionRef(keeper.description);
      if (txRef) {
        await prisma.incomeRecord.update({
          where: { id: keeper.id },
          data: { externalRef: txRef },
        });
        totalBackfilled++;
      }
    }

    // Delete duplicates
    const dupIds = duplicates.map((d) => d.id);
    await prisma.incomeRecord.deleteMany({
      where: { id: { in: dupIds } },
    });

    console.log(
      `Group "${key.slice(0, 80)}...": kept ${keeper.id}, deleted ${duplicates.length} duplicate(s)`,
    );
  }

  console.log(`\n=== Summary ===`);
  console.log(`Duplicates deleted: ${totalDuplicates}`);
  console.log(`Records backfilled with externalRef: ${totalBackfilled}`);
  console.log(`Done.`);
}

function extractTransactionRef(description: string | null): string | null {
  if (!description) return null;
  // Descriptions are like "Withdrawal Fee - WTH-..." or "Withdrawal Fee (Sacco Share) - WTH-..."
  const match = description.match(/-\s*(\S+)$/);
  return match ? match[1] : null;
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
