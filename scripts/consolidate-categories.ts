import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const mergeMap = [
  { fromCode: "401007", toCode: "401001", label: "Interest" },
  { fromCode: "401008", toCode: "401002", label: "Processing Fee" },
  { fromCode: "401006", toCode: "401005", label: "Penalty" },
];

async function main() {
  console.log("🚀 Starting consolidation of Loan Related Income categories...");

  for (const { fromCode, toCode, label } of mergeMap) {
    console.log(`\n--- Processing ${label} ---`);

    const sourceCat = await prisma.budgetCategory.findUnique({
      where: { code: fromCode },
    });

    const targetCat = await prisma.budgetCategory.findUnique({
      where: { code: toCode },
    });

    if (!sourceCat) {
      console.log(`ℹ️ Source category [${fromCode}] not found. Skipping.`);
      continue;
    }

    if (!targetCat) {
      console.log(`⚠️ Target category [${toCode}] not found. Cannot merge.`);
      continue;
    }

    console.log(`🔄 Merging [${sourceCat.code}] "${sourceCat.name}" -> [${targetCat.code}] "${targetCat.name}"`);

    // 1. Move any existing IncomeRecords to the target category
    const updateResult = await prisma.incomeRecord.updateMany({
      where: { budgetCategoryId: sourceCat.id },
      data: { budgetCategoryId: targetCat.id },
    });
    
    if (updateResult.count > 0) {
      console.log(`✅ Moved ${updateResult.count} records to "${targetCat.name}"`);
    }

    // 2. Delete the source category
    await prisma.budgetCategory.delete({
      where: { id: sourceCat.id },
    });
    console.log(`🗑️ Deleted redundant category [${sourceCat.code}]`);
  }

  console.log("\n✨ Consolidation complete!");
}

main()
  .catch((e) => {
    console.error("💥 Error during consolidation:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
