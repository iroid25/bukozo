import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function removeLandInKajwenge() {
  console.log('🔄 Searching for LAND IN KAJWENGE...');

  try {
    const account = await db.chartOfAccount.findFirst({
        where: {
            OR: [
                { accountName: { contains: 'KAJWENGE', mode: 'insensitive' } },
                { accountCode: '101001' }
            ]
        }
    });

    if (account) {
        console.log(`Found account: ${account.accountCode} - ${account.accountName}`);
        
        // Check for dependencies
        const assetsCount = await db.fixedAsset.count({ where: { accountId: account.id } });
        const journalCount = await db.journalEntry.count({ where: { accountId: account.id } });

        if (assetsCount > 0 || journalCount > 0) {
            console.log(`⚠️ Cannot hard delete. It has ${assetsCount} assets and ${journalCount} journal entries. Deactivating instead.`);
            await db.chartOfAccount.update({
                where: { id: account.id },
                data: { isActive: false }
            });
            console.log('✅ Deactivated successfully.');
        } else {
            console.log('🗑️ Deleting account...');
            await db.chartOfAccount.delete({
                where: { id: account.id }
            });
            console.log('✅ Deleted successfully.');
        }
    } else {
        console.log('❌ Could not find an account matching LAND or code 101001.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.$disconnect();
  }
}

removeLandInKajwenge();
