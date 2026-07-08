const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  console.log('--- CURRENT EXPENSES STATE ---');
  const expenses = await db.chartOfAccount.findMany({
    where: { accountCode: { startsWith: '50' } },
    select: { accountCode: true, accountName: true, level: true },
    orderBy: { accountCode: 'asc' }
  });
  console.table(expenses);

  // Also check for any TEMP_ leftovers
  const temps = await db.chartOfAccount.findMany({
    where: { accountCode: { startsWith: 'TEMP_' } },
    select: { accountCode: true, accountName: true },
    orderBy: { accountCode: 'asc' }
  });
  if (temps.length > 0) {
    console.log('\n--- TEMP ACCOUNTS ---');
    console.table(temps);
  } else {
    console.log('\nNo TEMP_ accounts found.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => db.$disconnect());
