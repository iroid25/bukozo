const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // Remove old duplicate equity parents that were superseded by the restructuring
  // The new correct ones are 301000, 302000, 303000, 304000
  // The old ones are 300100, 300300, 300400 which are duplicates
  const oldCodes = ['300100', '300300', '300400'];
  
  for (const code of oldCodes) {
    // Check if it has children
    const acct = await db.chartOfAccount.findFirst({ where: { accountCode: code } });
    if (!acct) {
      console.log(`${code} not found, skipping`);
      continue;
    }
    
    const childCount = await db.chartOfAccount.count({ where: { parentId: acct.id } });
    if (childCount > 0) {
      console.log(`${code} has ${childCount} children - deactivating instead of deleting`);
      await db.chartOfAccount.update({
        where: { id: acct.id },
        data: { isActive: false }
      });
    } else {
      // Check if it has journal entries
      const journalCount = await db.journalEntry.count({ where: { accountId: acct.id } });
      if (journalCount > 0) {
        console.log(`${code} has ${journalCount} journal entries - deactivating`);
        await db.chartOfAccount.update({
          where: { id: acct.id },
          data: { isActive: false }
        });
      } else {
        console.log(`${code} has no children and no journals - deleting`);
        await db.chartOfAccount.delete({ where: { id: acct.id } });
      }
    }
  }

  // Verify final Equity state
  console.log('\n--- FINAL EQUITY STATE ---');
  const eq = await db.chartOfAccount.findMany({
    where: { accountCode: { startsWith: '30' }, isActive: true },
    select: { accountCode: true, accountName: true, level: true },
    orderBy: { accountCode: 'asc' }
  });
  console.table(eq);
}

main()
  .catch(e => console.error(e))
  .finally(() => db.$disconnect());
