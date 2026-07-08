const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const annualKeywords = [
    "commercial",
    "business",
    "home improvement",
    "asset acquisition",
    "boda", // covers boda-boda and bodaboda
    "super saver",
    "starter fund"
  ];

  console.log('--- UPDATING LOAN PRODUCTS TO ANNUAL INTEREST ---');

  const products = await prisma.loanProduct.findMany({
    where: { isActive: true }
  });

  const affectedProductIds = [];

  for (const product of products) {
    const isAnnual = annualKeywords.some(kw => product.name.toLowerCase().includes(kw));
    
    if (isAnnual) {
      affectedProductIds.push(product.id);
      if (product.interestPeriod !== 'ANNUAL') {
        await prisma.loanProduct.update({
          where: { id: product.id },
          data: { interestPeriod: 'ANNUAL' }
        });
        console.log(`✅ Updated: ${product.name} (ID: ${product.id}) -> ANNUAL`);
      } else {
        console.log(`ℹ️ Already Annual: ${product.name}`);
      }
    } else {
      console.log(`- Skipping: ${product.name}`);
    }
  }

  // Also check existing loan applications that might be affected
  if (affectedProductIds.length > 0) {
    console.log('\n--- UPDATING EXISTING PENDING APPLICATIONS ---');
    const pendingApps = await prisma.loanApplication.findMany({
      where: { 
        status: 'PENDING',
        loanProductId: { in: affectedProductIds }
      }
    });

    for (const app of pendingApps) {
      if (app.interestPeriod !== 'ANNUAL') {
        await prisma.loanApplication.update({
          where: { id: app.id },
          data: { interestPeriod: 'ANNUAL' }
        });
        console.log(`✅ Updated App: ${app.id} -> ANNUAL`);
      } else {
        console.log(`ℹ️ App ${app.id} already Annual.`);
      }
    }
  }

  console.log('\nDone!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
