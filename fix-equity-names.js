const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // Fix Equity category names to client's exact spec
  const updates = [
    { code: '301000', name: 'STATUTORY RESERVES' },
    { code: '302000', name: 'GRANTS AND DONATIONS' },
    { code: '303000', name: 'RETAINED EARNINGS' },
    { code: '304000', name: 'SHARE CAPITAL' },
  ];

  for (const u of updates) {
    const result = await db.chartOfAccount.updateMany({
      where: { accountCode: u.code },
      data: { accountName: u.name, fullCode: `${u.code}  ${u.name}`, category: u.name }
    });
    console.log(`Updated ${u.code} ${u.name}: ${result.count} row(s)`);
  }

  // Now dump Liabilities and Equity to confirm
  console.log('\n--- LIABILITIES ---');
  const liab = await db.chartOfAccount.findMany({
    where: { accountCode: { startsWith: '20' } },
    select: { accountCode: true, accountName: true, level: true },
    orderBy: { accountCode: 'asc' }
  });
  console.table(liab);

  console.log('\n--- EQUITY ---');
  const eq = await db.chartOfAccount.findMany({
    where: { accountCode: { startsWith: '30' } },
    select: { accountCode: true, accountName: true, level: true },
    orderBy: { accountCode: 'asc' }
  });
  console.table(eq);
}

main()
  .catch(e => console.error(e))
  .finally(() => db.$disconnect());
