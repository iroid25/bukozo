import { PrismaClient, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const txns = await prisma.transaction.findMany({
    where: {
      status: { in: ["COMPLETED", "APPROVED", "REVERSED"] },
    },
    include: {
      account: {
        include: {
          member: { include: { user: { select: { name: true } } } },
          institution: { select: { institutionName: true } },
          accountType: { select: { name: true } },
          branch: { select: { name: true } },
        },
      },
      processedByUser: { select: { name: true, role: true } },
      withdrawal: true,
    },
    orderBy: [{ transactionDate: "asc" }],
  });

  console.log("Total transactions:", txns.length);

  const byType: Record<string, typeof txns> = {};
  txns.forEach((t) => {
    if (!byType[t.type]) byType[t.type] = [];
    byType[t.type].push(t);
  });

  console.log("\n=== BY TYPE ===");
  Object.entries(byType).forEach(([type, items]) => {
    console.log(`  ${type}: ${items.length}`);
  });

  // WITHDRAWALS
  const withdrawals = byType["WITHDRAWAL"] || [];
  console.log(`\n=== WITHDRAWAL TRANSACTIONS (${withdrawals.length}) ===`);
  for (let i = 0; i < withdrawals.length; i++) {
    const w = withdrawals[i];
    const name = w.account?.member?.user?.name || w.account?.institution?.institutionName || "N/A";
    console.log(`\n[${i + 1}] ${w.transactionRef}`);
    console.log(`    Date:     ${w.transactionDate.toISOString().slice(0, 19)}`);
    console.log(`    Member:   ${name}`);
    console.log(`    Account:  ${w.account?.accountNumber} (${w.account?.accountType?.name})`);
    console.log(`    Branch:   ${w.account?.branch?.name || "Head Office"}`);
    console.log(`    Amount:   ${w.amount.toLocaleString()} UGX`);
    console.log(`    Fee:      ${w.fee} UGX`);
    console.log(`    Channel:  ${w.channel}`);
    console.log(`    Status:   ${w.status}`);
    console.log(`    Teller:   ${w.processedByUser?.name} (${w.processedByUser?.role})`);
    console.log(`    Has Withdrawal record: ${!!w.withdrawal}`);
    if (w.withdrawal) {
      console.log(`    Withdrawal.fee: ${w.withdrawal.fee}`);
    }

    // Check journal entries
    const jes = await prisma.journalEntry.findMany({
      where: { transactionId: w.id },
      include: { account: { select: { accountName: true, accountCode: true, ledgerType: true } } },
    });
    if (jes.length === 0) {
      console.log(`    *** NO JOURNAL ENTRIES ***`);
    } else {
      console.log(`    Journal entries (${jes.length}):`);
      jes.forEach((je) => {
        const side = je.debitAmount > 0 ? "DR" : "CR";
        const amt = je.debitAmount > 0 ? je.debitAmount : je.creditAmount;
        console.log(`      ${side} ${amt.toLocaleString()} | ${je.account?.accountCode} ${je.account?.accountName}`);
      });
    }
  }

  // FEE transactions
  const fees = byType["FEE"] || [];
  console.log(`\n=== FEE TRANSACTIONS (${fees.length}) ===`);
  for (let i = 0; i < fees.length; i++) {
    const f = fees[i];
    console.log(`\n[${i + 1}] ${f.transactionRef}`);
    console.log(`    Amount:   ${f.amount.toLocaleString()} UGX`);
    console.log(`    Related:  ${f.relatedTransactionId}`);
    console.log(`    Date:     ${f.transactionDate.toISOString().slice(0, 19)}`);
    console.log(`    Status:   ${f.status}`);
  }

  // Other types
  console.log(`\n=== OTHER TRANSACTIONS ===`);
  Object.entries(byType).forEach(([type, items]) => {
    if (type === "WITHDRAWAL" || type === "FEE") return;
    items.forEach((t) => {
      const name = t.account?.member?.user?.name || t.account?.institution?.institutionName || "N/A";
      console.log(`  [${type}] ${t.transactionRef} | ${t.amount.toLocaleString()} UGX | fee=${t.fee} | ${name} | ${t.status}`);
    });
  });

  // Income records for fees
  const irs = await prisma.incomeRecord.findMany({
    where: { description: { contains: "ithdrawal fee", mode: "insensitive" } },
  });
  console.log(`\n=== INCOME RECORDS FOR FEES (${irs.length}) ===`);
  irs.forEach((ir, i) => {
    console.log(`  [${i + 1}] ${ir.description} | ${ir.amount.toLocaleString()} UGX | ${ir.status}`);
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
