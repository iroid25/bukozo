import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.budgetCategory.findMany({
    where: { kind: "INCOME" },
    include: { parent: true }
  });

  const nameMap = new Map();
  categories.forEach(cat => {
    const list = nameMap.get(cat.name.toLowerCase()) || [];
    list.push(cat);
    nameMap.set(cat.name.toLowerCase(), list);
  });

  console.log("Potential Duplicates by Name:");
  for (const [name, list] of nameMap.entries()) {
    if (list.length > 1) {
      console.log(`- ${name}:`);
      list.forEach(c => {
        console.log(`  * [${c.code}] ID: ${c.id} (Parent: ${c.parent?.name || "None"})`);
      });
    }
  }
}

main().finally(() => prisma.$disconnect());
