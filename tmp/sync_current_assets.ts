import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Synchronizing Assets...');

  // The user considers ALL of these as Current Assets under a single umbrella.
  // We'll place them under 101000 - Current Assets.
  const currentAssetsList = [
    { code: '101001', name: 'Cash at hand' },
    { code: '101002', name: 'Postbank' },
    { code: '101003', name: 'Centenary bank' },
    { code: '101004', name: 'Stanbic bank' },
    { code: '101005', name: 'Mobile money float' },
    { code: '101006', name: 'Receivables' },
    { code: '101007', name: 'Founders account' },
    { code: '101008', name: 'Share investments' },
    { code: '101009', name: 'Other investments' },
    { code: '101010', name: 'Office equipment' },
    { code: '101011', name: 'Other equipment' },
    { code: '101012', name: 'Advances' },
    { code: '101013', name: 'Stock' },
    { code: '101014', name: 'Loans' },
    { code: '101015', name: 'Software' },
  ];

  // First, ensure the parent category Current Assets exists
  const parentAsset = await prisma.chartOfAccount.upsert({
    where: { code: '101000' },
    update: {
      name: 'Current Assets',
      accountType: 'ASSET',
      isActive: true,
      description: 'All current assets including cash, bank, receivables, and equipment based on specific client requirements.',
    },
    create: {
      code: '101000',
      name: 'Current Assets',
      accountType: 'ASSET',
      isActive: true,
      description: 'All current assets including cash, bank, receivables, and equipment based on specific client requirements.',
    },
  });

  // Now, upsert all the specific items under the parent
  for (const item of currentAssetsList) {
    await prisma.chartOfAccount.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        accountType: 'ASSET',
        parentId: parentAsset.id,
        isActive: true,
      },
      create: {
        code: item.code,
        name: item.name,
        accountType: 'ASSET',
        parentId: parentAsset.id,
        isActive: true,
      },
    });
  }

  // Deactivate any other ASSET accounts starting with '1' and not in our list
  const validCodes = ['100000', '101000', ...currentAssetsList.map(i => i.code)];
  
  await prisma.chartOfAccount.updateMany({
    where: {
      code: { startsWith: '1' },
      code: { notIn: validCodes },
      accountType: 'ASSET',
    },
    data: {
      isActive: false,
    },
  });

  console.log('Successfully synchronized all provided items as Current Assets according to client instructions.');
}

main()
  .catch((e) => {
    console.error('Error syncing assets:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
