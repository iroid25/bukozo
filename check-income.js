const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  console.log('--- CURRENT INCOME ACCOUNTS ---');
  const income = await db.chartOfAccount.findMany({
    where: { accountCode: { startsWith: '40' } },
    select: { accountCode: true, accountName: true, level: true, isActive: true },
    orderBy: { accountCode: 'asc' }
  });
  console.table(income);
  console.log(`\nTotal income accounts: ${income.length}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => db.$disconnect());
