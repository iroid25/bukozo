import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function findPillars() {
  try {
    const pillars = await db.chartOfAccount.findMany({ 
      where: { parentId: null } 
    });
    console.log(JSON.stringify(pillars.map(p => ({ id: p.id, code: p.accountCode, name: p.accountName, type: p.ledgerType })), null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await db.$disconnect();
  }
}

findPillars();
