const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const liab = await db.chartOfAccount.findMany({ 
    where: { accountCode: { startsWith: '20' } }, 
    select: { accountCode: true, accountName: true }, 
    orderBy: { accountCode: 'asc' } 
  });
  console.log('--- LIABILITIES ---');
  console.table(liab);

  const eq = await db.chartOfAccount.findMany({ 
    where: { accountCode: { startsWith: '30' } }, 
    select: { accountCode: true, accountName: true }, 
    orderBy: { accountCode: 'asc' } 
  });
  console.log('--- EQUITY ---');
  console.table(eq);
}

main()
  .catch(e => console.error(e))
  .finally(() => db.$disconnect());
