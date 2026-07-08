import { ensureIncomeStructure } from "../lib/services/income-structure.ts";

export async function seedIncomeCategories() {
  console.log("Starting income category seed...");
  const result = await ensureIncomeStructure();
  console.log(`Income categories seeded successfully: ${result.nodes.length} nodes.`);
}
