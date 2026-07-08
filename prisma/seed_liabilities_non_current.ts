import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Non-Current Liabilities...');

  // 1. Ensure the parent "202000" exists
  let parent = await prisma.chartOfAccount.findUnique({
    where: { accountCode: '202000' }
  });

  if (!parent) {
    parent = await prisma.chartOfAccount.create({
      data: {
        accountCode: '202000',
        accountName: 'Non-Current Liabilities',
        category: 'LIABILITY_NON_CURRENT',
        currency: 'UGX',
        isActive: true,
        level: 2,
        ledgerType: 'LIABILITIES',
        fullCode: '202000',
      }
    });
    console.log('Created parent 202000');
  }

  // 2. Create the specific children
  const childrenToCreate = [
    { code: '202020', name: 'Accumulated Depreciation' },
    { code: '202030', name: 'External Loan (Long Term)' },
    { code: '202040', name: 'Founders Account' },
  ];

  for (const child of childrenToCreate) {
    const existing = await prisma.chartOfAccount.findUnique({
      where: { accountCode: child.code }
    });

    if (!existing) {
      await prisma.chartOfAccount.create({
        data: {
          accountCode: child.code,
          accountName: child.name,
          category: 'LIABILITY_NON_CURRENT',
          currency: 'UGX',
          isActive: true,
          level: 3,
          ledgerType: 'LIABILITIES',
          fullCode: child.code, // using code as fullCode for level 3
          parentId: parent.id,
        }
      });
      console.log(`Created child ${child.code}: ${child.name}`);
    } else {
      console.log(`Child ${child.code} already exists`);
    }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
