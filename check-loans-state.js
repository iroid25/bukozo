const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.loanProduct.findMany();
  console.table(products.map(p => ({
    name: p.name,
    interestRate: p.interestRate,
    interestPeriod: p.interestPeriod,
    isActive: p.isActive
  })));
  
  // Also check some loan applications to see their interest rates and periods
  const apps = await prisma.loanApplication.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { loanProduct: true }
  });
  console.log('\n--- Recent Loan Applications ---');
  console.table(apps.map(a => ({
    id: a.id,
    product: a.loanProduct.name,
    amount: a.amountApplied,
    rate: a.interestRateOverride || a.loanProduct.interestRate,
    period: a.interestPeriod,
    status: a.status,
    stage: a.stage
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
