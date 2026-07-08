import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const affected = [
      'Commercial loan/Business loan',
      'School fees loan',
      'Home improvement loan/Asset aquistion',
      'Boda-boda loan',
      'Super savers loan'
    ];
    
    const products = await prisma.loanProduct.findMany({
      where: { name: { in: affected } }
    });
    
    console.log('Found', products.length, 'products to update');
    
    for (const p of products) {
      await prisma.loanProduct.update({
        where: { id: p.id },
        data: { interestPeriod: 'ANNUAL' }
      });
      console.log(`Updated ${p.name} to ANNUAL`);
    }
    
    console.log('Update complete.');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
