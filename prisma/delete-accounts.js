const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function deleteAccounts() {
  const result = await db.chartOfAccount.deleteMany();
  console.log(`Deleted ${result.count} accounts`);
  await db.$disconnect();
}

deleteAccounts();
