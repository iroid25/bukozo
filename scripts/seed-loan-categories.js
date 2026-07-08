const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log(
    "--- Starting Seeding: Loan Related Income Categories (Fixed) ---",
  );

  // 1. Ensure Parent Category "Loan related income (401000)"
  const parent = await prisma.budgetCategory.upsert({
    where: { code: "401000" },
    update: { name: "Loan related income" },
    create: {
      name: "Loan related income",
      code: "401000",
      kind: "INCOME",
      description: "Loan related income including fees, interest and penalties",
      isActive: true,
    },
  });
  console.log(
    `Parent Category: ${parent.name} (Code: ${parent.code}, ID: ${parent.id})`,
  );

  // 2. Specific Items - handle existing categories differently
  const specificItems = [
    { name: "Loan interest paid", code: "401001" },
    { name: "Loan processing fees", code: "401002" },
    { name: "Loan insurance fees", code: "401003" },
    { name: "Loan share capital", code: "401004" },
    { name: "Loan penalty paid", code: "401005" },
  ];

  for (const item of specificItems) {
    // First try to find by code
    const existingByCode = await prisma.budgetCategory.findUnique({
      where: { code: item.code },
    });

    if (existingByCode) {
      // Update to ensure it has correct parentId
      const updated = await prisma.budgetCategory.update({
        where: { id: existingByCode.id },
        data: {
          name: item.name,
          parentId: parent.id,
          kind: "INCOME",
        },
      });
      console.log(
        `- Updated by code: ${updated.name} (Code: ${updated.code}, ParentID: ${updated.parentId})`,
      );
      continue;
    }

    // Check if exists by name + parentId
    const existingByName = await prisma.budgetCategory.findFirst({
      where: {
        name: item.name,
        parentId: parent.id,
        kind: "INCOME",
      },
    });

    if (existingByName) {
      // Update to set the correct code
      const updated = await prisma.budgetCategory.update({
        where: { id: existingByName.id },
        data: { code: item.code },
      });
      console.log(
        `- Updated code on existing: ${updated.name} (Code: ${updated.code})`,
      );
      continue;
    }

    // Create new
    const child = await prisma.budgetCategory.create({
      data: {
        name: item.name,
        code: item.code,
        kind: "INCOME",
        isActive: true,
        parentId: parent.id,
      },
    });
    console.log(
      `- Created: ${child.name} (Code: ${child.code}, ParentID: ${child.parentId})`,
    );
  }

  console.log("--- Seeding Completed Successfully ---");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
