import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const coaCount = await prisma.chartOfAccount.count();
  const memberCount = await prisma.member.count();
  const productCount = await prisma.loanProduct.count();
  const userCount = await prisma.user.count();

  console.log(`ChartOfAccount: ${coaCount}`);
  console.log(`Member: ${memberCount}`);
  console.log(`LoanProduct: ${productCount}`);
  console.log(`User: ${userCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
