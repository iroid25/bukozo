
import { PrismaClient, AccountLedgerType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- RESTRUCTURING CHART OF ACCOUNTS HIERARCHY ---');

  // 1. Define the 5 pillars (Assets, Liabilities, Equity, Income, Expenditures)
  const pillars = [
    { code: '100000', name: 'Assets', type: 'ASSETS' as AccountLedgerType },
    { code: '200000', name: 'Liabilities', type: 'LIABILITIES' as AccountLedgerType },
    { code: '300000', name: 'Equity', type: 'EQUITY' as AccountLedgerType },
    { code: '400000', name: 'Income', type: 'INCOME' as AccountLedgerType },
    { code: '500000', name: 'Expenditures', type: 'EXPENDITURES' as AccountLedgerType },
  ];

  const pillarIds: Record<string, string> = {};

  for (const p of pillars) {
    let account = await prisma.chartOfAccount.findUnique({
      where: { accountCode: p.code }
    });

    if (account) {
      console.log(`[EXISTING] Pillar ${p.code}: ${account.accountName} -> ${p.name}`);
      account = await prisma.chartOfAccount.update({
        where: { id: account.id },
        data: {
          accountName: p.name,
          fullCode: `${p.code} ${p.name}`,
          ledgerType: p.type,
          parentId: null, // Pillars must be roots
          level: 0
        }
      });
    } else {
      console.log(`[CREATING] Pillar ${p.code}: ${p.name}`);
      account = await prisma.chartOfAccount.create({
        data: {
          accountCode: p.code,
          accountName: p.name,
          fullCode: `${p.code} ${p.name}`,
          ledgerType: p.type,
          level: 0,
          isActive: true
        }
      });
    }
    pillarIds[p.type] = account.id;
  }

  // 2. Find all root nodes that are NOT pillars
  const rootOrphans = await prisma.chartOfAccount.findMany({
    where: {
      parentId: null,
      accountCode: { notIn: pillars.map(p => p.code) }
    }
  });

  console.log(`\nFound ${rootOrphans.length} root orphans to re-parent.`);

  for (const orphan of rootOrphans) {
    const parentId = pillarIds[orphan.ledgerType];
    if (parentId) {
      console.log(`[RE-PARENT] ${orphan.accountCode} (${orphan.accountName}) -> Pillar ${orphan.ledgerType}`);
      await prisma.chartOfAccount.update({
        where: { id: orphan.id },
        data: {
          parentId: parentId,
          level: 1 // We could calculate this more accurately but 1 is safe for children of pillars
        }
      });
    } else {
      console.warn(`[WARNING] No pillar found for orphan ${orphan.accountCode} with type ${orphan.ledgerType}`);
    }
  }

  console.log('\n--- HIERARCHY RESTRUCTURE COMPLETE ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
