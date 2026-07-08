import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function setupCurrentAssets() {
  console.log('🔄 Seding requested Current Asset categories...');

  try {
    const parent = await db.chartOfAccount.findFirst({ where: { accountCode: '102000' } });
    if (!parent) {
      console.error('❌ Parent account 102000 CURRENT ASSETS not found.');
      return;
    }

    const newCategories = [
      { code: '102100', name: 'OFFICE EQUIPMENT', parentCode: '102000' },
      { code: '102200', name: 'OTHER EQUIPMENT', parentCode: '102000' },
      { code: '102300', name: 'SOFTWARE', parentCode: '102000' },
      { code: '102400', name: 'RECEIVABLES', parentCode: '102000' },
    ];

    for (const cat of newCategories) {
      const existing = await db.chartOfAccount.findFirst({ where: { accountCode: cat.code } });
      
      if (!existing) {
         console.log(`Creating missing category ${cat.code} ${cat.name}`);
         await db.chartOfAccount.create({
            data: {
               accountCode: cat.code,
               accountName: cat.name,
               fullCode: `${cat.code}  ${cat.name}`,
               ledgerType: 'ASSETS',
               debitCredit: 'DR',
               isActive: true,
               isSystem: true,
               level: 3,
               parentId: parent.id,
               category: cat.name
            }
         });
      } else {
          console.log(`✅ Category ${cat.code} ${cat.name} already exists.`);
      }
    }

    console.log('✅ Current Assets COA setup completed!');
  } catch (error) {
    console.error('❌ Error setting up COA Current Assets:', error);
  } finally {
    await db.$disconnect();
  }
}

setupCurrentAssets();
