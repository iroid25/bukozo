const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.loanProduct.updateMany({
    where: {
      name: {
        contains: 'Starter',
        mode: 'insensitive'
      }
    },
    data: {
      interestRate: 12,
      interestPeriod: 'ANNUAL'
    }
  });
  console.log('Updated:', result.count);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
