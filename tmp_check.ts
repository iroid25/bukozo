import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.budgetCategory.findMany({
    where: { kind: 'INCOME' },
    include: { parent: true, children: true }
  });
  console.log(JSON.stringify(categories, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
