const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountTypes = await prisma.accountType.findMany();
  console.log(JSON.stringify(accountTypes, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
