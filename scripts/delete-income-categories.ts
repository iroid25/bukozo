import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Add the names or codes of categories you want to delete here
const itemsToDelete = [
  "Loan insurance fees",
  "Loan share Paid",
  // Add more here
];

async function main() {
  console.log("🚀 Starting deletion of income categories...");

  for (const itemName of itemsToDelete) {
    console.log(`\n🔍 Looking for: "${itemName}"`);
    
    // Find the category in BudgetCategory (used in the form)
    const category = await prisma.budgetCategory.findFirst({
      where: {
        name: { contains: itemName, mode: 'insensitive' },
        kind: "INCOME"
      }
    });

    if (category) {
      console.log(`✅ Found Category: ${category.name} [${category.code || 'No Code'}] (ID: ${category.id})`);
      
      // Check for related records
      const recordsCount = await prisma.incomeRecord.count({
        where: { budgetCategoryId: category.id }
      });

      if (recordsCount > 0) {
        console.warn(`⚠️ Cannot delete "${category.name}" because it has ${recordsCount} income records linked to it.`);
        console.log("💡 Suggestion: Deactivate it instead by setting isActive: false");
      } else {
        await prisma.budgetCategory.delete({
          where: { id: category.id }
        });
        console.log(`🗑️ Successfully deleted "${category.name}"`);
      }
    } else {
      console.log(`❌ Could not find an income category matching "${itemName}"`);
    }
  }
}

main()
  .catch((e) => {
    console.error("💥 Error during deletion:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
