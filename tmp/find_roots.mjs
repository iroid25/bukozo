import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function findRoots() {
  try {
    const categories = await db.budgetCategory.findMany({ 
      where: { parentId: null } 
    });
    const accounts = await db.chartOfAccount.findMany({ 
      where: { parentId: null } 
    });

    console.log('--- Root Categories ---');
    console.log(JSON.stringify(categories, null, 2));
    console.log('--- Root Accounts ---');
    console.log(JSON.stringify(accounts, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await db.$disconnect();
  }
}

findRoots();
