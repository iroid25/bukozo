
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const allocations = await prisma.floatAllocation.findMany({
    orderBy: { allocationDate: 'desc' },
    take: 5,
    include: { tellerAgent: true, branch: true }
  });
  console.log("Recent Float Allocations:", allocations.map(a => ({
    id: a.id,
    teller: a.tellerAgent.name,
    amount: a.amount,
    date: a.allocationDate
  })));

  const vaults = await prisma.vault.findMany();
  console.log("\nVaults:");
  vaults.forEach(v => console.log(`${v.name}: ${v.balance}`));

  const tellers = await prisma.userFloat.findMany({
    where: { balance: { gt: 0 } },
    include: { user: true }
  });
  console.log("\nActive User Floats:");
  tellers.forEach(t => console.log(`${t.user.name}: ${t.balance}`));

  const recons = await prisma.floatReconciliation.findMany({
    orderBy: { reconciliationDate: 'desc' },
    take: 5
  });
  console.log("\nRecent Reconciliations:", recons.map(r => r.id));
}

check().catch(console.error).finally(() => prisma.$disconnect());
