import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function checkFD() {
  try {
    const fdCount = await db.fixedDeposit.count();
    const accountCount = await db.account.count({ 
      where: { accountType: { hasFixedPeriod: true } } 
    });
    const fdSample = await db.fixedDeposit.findFirst({
        include: { account: { include: { member: { include: { user: true } }, branch: true } } }
    });

    console.log('FixedDeposit Table Count:', fdCount);
    console.log('Account Table (hasFixedPeriod) Count:', accountCount);
    console.log('Sample FD:', JSON.stringify(fdSample, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await db.$disconnect();
  }
}

checkFD();
