import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.budgetCategory.findMany({
    include: { parent: true }
  });

  console.log("All Categories:");
  categories.forEach(cat => {
    console.log(`- [${cat.code || "NO CODE"}] [${cat.kind}] ${cat.name} (Parent: ${cat.parent?.name || "None"}) ID: ${cat.id}`);
  });
}

main().finally(() => prisma.$disconnect());
