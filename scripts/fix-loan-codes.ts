import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🛠️ Starting Robust Loan Code Migration...");

  // Helper to safely update code
  const safeUpdateCode = async (oldCode: string, newCode: string, nameFilter?: string) => {
    const category = await prisma.budgetCategory.findFirst({
      where: { code: oldCode }
    });

    if (category) {
      if (nameFilter && !category.name.toLowerCase().includes(nameFilter.toLowerCase())) {
        console.log(`⚠️ Skipping ${oldCode} ('${category.name}') - does not match filter '${nameFilter}'`);
        return;
      }
      
      console.log(`✅ Moving '${category.name}' from ${oldCode} to ${newCode}...`);
      try {
        await prisma.budgetCategory.update({
          where: { id: category.id },
          data: { code: newCode }
        });
      } catch (err) {
        console.error(`❌ Failed to update ${oldCode} to ${newCode}:`, err);
      }
    } else {
      console.log(`ℹ️ Category with code ${oldCode} not found, skipping.`);
    }
  };

  // 1. Move "social fund" (currently 401001) to 401004 to free up 401001
  await safeUpdateCode("401001", "401004", "social");

  // 2. Move "Loan interest paid" (currently 40100) to 401001
  await safeUpdateCode("40100", "401001", "interest");

  // 3. Move "Loan processing fee" (currently INC-LPF-SPEC) to 401002
  await safeUpdateCode("INC-LPF-SPEC", "401002");

  // 4. Move "Loan penalty paid" (currently INC-LPP-SPEC) to 401005
  await safeUpdateCode("INC-LPP-SPEC", "401005");

  // 5. Cleanup any previous misalignments (e.g. insurance at 401002)
  const insurance = await prisma.budgetCategory.findFirst({
    where: { 
      code: "401002",
      name: { contains: "insurance", mode: "insensitive" }
    }
  });
  if (insurance) {
    console.log(`✅ Shifting legacy insurance from 401002 to 401003...`);
    await prisma.budgetCategory.update({
      where: { id: insurance.id },
      data: { code: "401003" }
    });
  }

  console.log("🏁 Migration Completed!");
}

main()
  .catch((e) => {
    console.error("❌ Fatal Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
