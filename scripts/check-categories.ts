
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const codes = ["402000", "402001"];
  const names = ["MEMBER ACCOUNT INCOME", "Transaction Fees", "Fee Income"];

  const categories = await prisma.budgetCategory.findMany({
    where: {
      OR: [
        { code: { in: codes } },
        { name: { in: names } }
      ]
    }
  });

  console.log("Found Categories:");
  console.log(JSON.stringify(categories, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
