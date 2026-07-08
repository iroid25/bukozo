import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.budgetCategory.findMany({
    where: { kind: "INCOME" },
    include: { parent: true }
  });

  console.log("Income Categories:");
  categories.forEach(cat => {
    console.log(`- [${cat.code || "NO CODE"}] ${cat.name} (Parent: ${cat.parent?.name || "None"}) ID: ${cat.id}`);
  });
}

main().finally(() => prisma.$disconnect());
