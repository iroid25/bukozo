const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("--- Debug: Check existing Loan Related Categories ---");

  // Get all income categories that might be loan-related
  const categories = await prisma.budgetCategory.findMany({
    where: {
      OR: [
        { name: { contains: "Loan", mode: "insensitive" } },
        { code: { startsWith: "401" } },
      ],
    },
    select: {
      id: true,
      name: true,
      code: true,
      kind: true,
      parentId: true,
    },
    orderBy: { code: "asc" },
  });

  console.log("Existing categories:");
  for (const c of categories) {
    console.log(
      `  ID: ${c.id}, Name: "${c.name}", Code: "${c.code}", Kind: ${c.kind}, ParentID: ${c.parentId || "null"}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
