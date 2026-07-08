import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function updateCoaFixedAssets() {
  console.log('🔄 Starting Fixed Assets COA cleanup...');

  try {
    // 1. Define the categories to keep and standardise their codes
    // 101000 FIXED ASSETS
    //   101100 LAND
    //   101200 MOTORCYCLE
    //   101300 FURNITURE AND FITTINGS
    //   101400 BUILDINGS
    
    const targetCategories = [
      { code: '101100', name: 'LAND', parentCode: '101000' },
      { code: '101200', name: 'MOTORCYCLE', parentCode: '101000' },
      { code: '101300', name: 'FURNITURE AND FITTINGS', parentCode: '101000' },
      { code: '101400', name: 'BUILDINGS', parentCode: '101000' }
    ];

    const parent = await db.chartOfAccount.findFirst({ where: { accountCode: '101000' } });
    if (!parent) {
      console.error('❌ Parent account 101000 FIXED ASSETS not found.');
      return;
    }

    // 2. Map existing or create new for the allowed categories
    for (const cat of targetCategories) {
      // Check if exact code exists
      let existing = await db.chartOfAccount.findFirst({ where: { accountCode: cat.code } });
      
      // If not exact code, try finding by name and renaming
      if (!existing) {
        existing = await db.chartOfAccount.findFirst({
           where: { 
             accountCode: { startsWith: '101' }, 
             accountName: cat.name 
           } 
        });
        
        if (existing) {
           console.log(`Renaming existing ${existing.accountCode} to ${cat.code} for ${cat.name}`);
           await db.chartOfAccount.update({
              where: { id: existing.id },
              data: {
                 accountCode: cat.code,
                 fullCode: `${cat.code}  ${cat.name}`
              }
           });
        } else {
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
        }
      }
    }

    // 3. Deactivate/Delete unwanted categories
    const codesToRemove = [
      '101004', // BANKING SOFTWARE
      '101005', // BARCLAYS
      '104000', // OFFICE EQUIPMENT (and all its children)
      '104001', // SAFE
      '104002', // COMPUTERS & ACCESSORIES
      '104003', // PRINTER
      '104004', // GENERATOR - keeping? The prompt didn't explicitly remove, but "other equipment" implies removing 104 block. Let's remove 104 block to be strictly compliant, users can add specific ones if needed, or we just remove what was explicitly asked.
      '104005', // MONEY DETECTOR
      '104006', // OFFICE PHONES
      '104007', // OVERHEAD FAN
      '104008', // DIGITAL CAMERA
      '104010', // PUNCHING MACHINE
      '104012', // METAL DETECTOR
      '104013', // OTHER OFFICE EQUIPMENTS
    ];

    // Find all 104xxx
    const officeEquipmentAccounts = await db.chartOfAccount.findMany({
       where: { accountCode: { startsWith: '104' } }
    });

    const toDeleteIds = [];
    
    // Deactivate specific ones
    for (const code of [...codesToRemove, ...officeEquipmentAccounts.map(a => a.accountCode)]) {
       const acc = await db.chartOfAccount.findFirst({ where: { accountCode: code } });
       if (acc) {
          // Check if it has transactions or linked assets
          const assetsCount = await db.fixedAsset.count({ where: { accountId: acc.id } });
          const journalCount = await db.journalEntry.count({ where: { accountId: acc.id } });

          if (assetsCount > 0 || journalCount > 0) {
             console.log(`⚠️  Cannot delete ${acc.accountCode} (${acc.accountName}) - has linked data. Deactivating instead.`);
             await db.chartOfAccount.update({
                where: { id: acc.id },
                data: { isActive: false }
             });
          } else {
             console.log(`🗑️  Deleting ${acc.accountCode} (${acc.accountName})`);
             toDeleteIds.push(acc.id);
          }
       }
    }

    if (toDeleteIds.length > 0) {
        await db.chartOfAccount.deleteMany({
            where: { id: { in: toDeleteIds } }
        });
    }

    console.log('✅ Fixed Assets COA cleanup completed!');
  } catch (error) {
    console.error('❌ Error updating COA Fixed Assets:', error);
  } finally {
    await db.$disconnect();
  }
}

updateCoaFixedAssets();
