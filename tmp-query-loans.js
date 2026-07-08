const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.loanProduct.findMany({
    where: {
      name: {
        contains: 'Starter',
        mode: 'insensitive'
      }
    }
  });
  console.log(JSON.stringify(products, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
