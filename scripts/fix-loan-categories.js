const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("--- Fix Loan Categories ---");

  const parent = await prisma.budgetCategory.findUnique({
    where: { code: "401000" },
  });

  if (!parent) {
    console.log("ERROR: Parent category 401000 not found!");
    process.exit(1);
  }
  console.log(`Parent: ${parent.id} - ${parent.name}`);

  // Fix: "Loan interest paid" (40100 -> 401001)
  const interestOld = await prisma.budgetCategory.findUnique({
    where: { code: "40100" },
  });
  if (interestOld) {
    // Delete the duplicate if exists
    const interestNew = await prisma.budgetCategory.findUnique({
      where: { code: "401001" },
    });
    if (interestNew && interestNew.id !== interestOld.id) {
      // Update children to point to old one first, then delete new
      await prisma.budgetCategory.updateMany({
        where: { parentId: interestNew.id },
        data: { parentId: interestOld.id },
      });
      await prisma.budgetCategory.delete({ where: { id: interestNew.id } });
    }
    // Update old to correct code
    await prisma.budgetCategory.update({
      where: { id: interestOld.id },
      data: { code: "401001", parentId: parent.id },
    });
    console.log("Fixed: Loan interest paid -> 401001");
  }

  // Fix: "Loan Penalties Income" (400200 -> 401005)
  const penaltyOld = await prisma.budgetCategory.findUnique({
    where: { code: "400200" },
  });
  if (penaltyOld) {
    await prisma.budgetCategory.update({
      where: { id: penaltyOld.id },
      data: { code: "401005", parentId: parent.id, name: "Loan penalty paid" },
    });
    console.log("Fixed: Loan penalty paid -> 401005");
  }

  // Fix: "social fund" (401004 should be "Loan share capital")
  const socialFund = await prisma.budgetCategory.findUnique({
    where: { code: "401004" },
  });
  if (socialFund && socialFund.parentId === parent.id) {
    await prisma.budgetCategory.update({
      where: { id: socialFund.id },
      data: { name: "Loan share capital" },
    });
    console.log("Fixed: social fund -> Loan share capital");
  }

  // Delete duplicate INC-LPF-SPEC if exists
  const dupFee = await prisma.budgetCategory.findUnique({
    where: { code: "INC-LPF-SPEC" },
  });
  if (dupFee) {
    await prisma.budgetCategory.delete({ where: { id: dupFee.id } });
    console.log("Deleted duplicate: INC-LPF-SPEC");
  }

  // Delete duplicate INC-LPF if exists
  const dupFee2 = await prisma.budgetCategory.findUnique({
    where: { code: "INC-LPF" },
  });
  if (dupFee2) {
    await prisma.budgetCategory.delete({ where: { id: dupFee2.id } });
    console.log("Deleted duplicate: INC-LPF");
  }

  // Delete duplicate INC-LI if exists
  const dupLI = await prisma.budgetCategory.findUnique({
    where: { code: "INC-LI" },
  });
  if (dupLI) {
    await prisma.budgetCategory.delete({ where: { id: dupLI.id } });
    console.log("Deleted duplicate: INC-LI");
  }

  // Ensure 401003 exists (Loan insurance fees)
  const ins = await prisma.budgetCategory.findUnique({
    where: { code: "401003" },
  });
  if (!ins) {
    await prisma.budgetCategory.create({
      data: {
        name: "Loan insurance fees",
        code: "401003",
        kind: "INCOME",
        isActive: true,
        parentId: parent.id,
        description: "Fees collected for loan insurance",
      },
    });
    console.log("Created: 401003 - Loan insurance fees");
  }

  console.log("\n--- Verification ---");
  const categories = await prisma.budgetCategory.findMany({
    where: {
      code: {
        in: ["401000", "401001", "401002", "401003", "401004", "401005"],
      },
    },
    orderBy: { code: "asc" },
  });

  console.log("Categories under 401000:");
  for (const c of categories) {
    console.log(
      `  ${c.code}: ${c.name} (parentId: ${c.parentId === parent.id ? "OK" : c.parentId})`,
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
