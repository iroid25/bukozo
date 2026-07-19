/**
 * Backfill script: Create missing Transaction + Deposit records for imported accounts.
 *
 * When accounts are imported via /api/v1/accounts/import, the balance is set directly
 * on the Account record but NO Transaction or Deposit records are created. This causes:
 * - Deposits page shows no history for these accounts
 * - Stats are inaccurate (missing deposit amounts)
 *
 * What this script does:
 * 1. Finds Account records with balance > 0 that have NO matching DEPOSIT Transaction
 * 2. Creates a Transaction (type=DEPOSIT, status=COMPLETED) + Deposit record for each
 * 3. Uses the account's openedAt date as the transaction date
 *
 * Usage: npx tsx scripts/backfill-imported-deposits.ts [--dry-run]
 */

import { PrismaClient, TransactionType, TransactionStatus } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n Backfill Imported Account Deposits (${DRY_RUN ? "DRY RUN" : "LIVE"})\n`);

  const accountsWithBalance = await prisma.account.findMany({
    where: {
      balance: { gt: 0 },
      status: "ACTIVE",
    },
    include: {
      transactions: {
        where: { type: TransactionType.DEPOSIT, status: TransactionStatus.COMPLETED },
        select: { id: true },
      },
      accountType: { select: { name: true } },
      member: { select: { id: true, memberNumber: true } },
      institution: { select: { id: true, institutionNumber: true } },
    },
  });

  const orphaned = accountsWithBalance.filter((a) => a.transactions.length === 0);

  console.log(`Found ${accountsWithBalance.length} active accounts with balance > 0`);
  console.log(`  - ${orphaned.length} have NO deposit Transaction (need backfill)\n`);

  if (orphaned.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const account of orphaned) {
    const balance = account.balance;
    const txRef = `IMP-BACKFILL-${account.accountNumber}-${Date.now()}`;
    const txDate = account.openedAt || new Date();

    console.log(
      `  ${account.accountNumber} (${account.accountType.name}) — UGX ${balance.toLocaleString()} — ${account.member?.memberNumber || account.institution?.institutionNumber || "N/A"}`
    );

    if (DRY_RUN) {
      skipped++;
      continue;
    }

    try {
      const txn = await prisma.transaction.create({
        data: {
          transactionRef: txRef,
          memberId: account.memberId || null,
          institutionId: account.institutionId || null,
          accountId: account.id,
          type: TransactionType.DEPOSIT,
          amount: balance,
          status: TransactionStatus.COMPLETED,
          branchId: account.branchId,
          description: "Backfill: Opening balance from import",
          processedByUserId: "cmpeium3e008qv3ogcvhb3rj9",
          channel: "CASH",
          transactionDate: txDate,
        },
      });

      await prisma.deposit.create({
        data: {
          transactionId: txn.id,
          memberId: account.memberId || null,
          institutionId: account.institutionId || null,
          accountId: account.id,
          amount: balance,
          depositDate: txDate,
          handlerUserId: "cmpeium3e008qv3ogcvhb3rj9",
          channel: "CASH",
        },
      });

      created++;
      console.log(`    ✅ Created Transaction + Deposit`);
    } catch (error) {
      console.error(`    ❌ Failed: ${error}`);
      skipped++;
    }
  }

  console.log(`\n Summary: ${created} created, ${skipped} skipped/failed\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
