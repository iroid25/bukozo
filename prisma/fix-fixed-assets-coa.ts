import { PrismaClient, AccountLedgerType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting COA fix for Fixed Assets...');

  // 1. Ensure 103000 is the parent "Fixed Assets"
  let fixedAssetsParent = await prisma.chartOfAccount.findUnique({
    where: { accountCode: '103000' }
  });

  if (!fixedAssetsParent) {
    console.log('➕ Creating 103000 - Fixed Assets');
    fixedAssetsParent = await prisma.chartOfAccount.create({
      data: {
        accountCode: '103000',
        accountName: 'Fixed Assets',
        fullCode: '103000',
        ledgerType: AccountLedgerType.ASSETS,
        level: 1,
        isActive: true,
      }
    });
  } else {
    console.log('✅ 103000 - Fixed Assets already exists');
    await prisma.chartOfAccount.update({
      where: { id: fixedAssetsParent.id },
      data: { accountName: 'Fixed Assets', level: 1, isActive: true }
    });
  }

  const accountsToCreate = [
    { code: '103100', name: 'LAND' },
    { code: '103200', name: 'BUILDINGS' },
    { code: '103300', name: 'MOTORCYCLES' },
    { code: '103400', name: 'FURNITURE AND FITTINGS' }
  ];

  for (const acc of accountsToCreate) {
    const existing = await prisma.chartOfAccount.findUnique({
      where: { accountCode: acc.code }
    });

    if (existing) {
      console.log(`🔄 Updating ${acc.code} to ${acc.name}`);
      await prisma.chartOfAccount.update({
        where: { id: existing.id },
        data: {
          accountName: acc.name,
          fullCode: acc.code,
          level: 3, // Level 3 for classification dropdown visibility
          isActive: true,
          parentId: fixedAssetsParent.id
        }
      });
    } else {
      console.log(`➕ Creating ${acc.code} - ${acc.name}`);
      await prisma.chartOfAccount.create({
        data: {
          accountCode: acc.code,
          accountName: acc.name,
          fullCode: acc.code,
          ledgerType: AccountLedgerType.ASSETS,
          level: 3,
          isActive: true,
          parentId: fixedAssetsParent.id
        }
      });
    }
  }

  // 2. Deactivate unwanted accounts in 103xxx series
  console.log('🧹 Deactivating unwanted accounts in 103xxx series...');
  await prisma.chartOfAccount.updateMany({
    where: {
      accountCode: {
        startsWith: '103',
        notIn: ['103000', '103100', '103200', '103300', '103400']
      }
    },
    data: { isActive: false }
  });

  console.log('✨ Fixed Asset COA correction complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
