import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.chartOfAccount.findMany({
    where: {
      OR: [
        { accountName: { contains: 'insurance', mode: 'insensitive' } },
        { accountName: { contains: 'share', mode: 'insensitive' } },
        { accountCode: { in: ['401003', '401004'] } }
      ]
    },
    include: { parent: true }
  });
  console.log(JSON.stringify(accounts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
