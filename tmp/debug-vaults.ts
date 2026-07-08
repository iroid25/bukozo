
import { db } from "./prisma/db";

async function main() {
  console.log("--- DEBUG VAULTS ---");
  const vaults = await db.vault.findMany({
    include: {
      branch: true,
    }
  });

  console.log(`Found ${vaults.length} vaults.`);
  for (const v of vaults) {
    console.log(`Vault: ${v.name} (ID: ${v.id})`);
    console.log(`  Branch: ${v.branch ? v.branch.name : "None (HQ/SACCO)"}`);
    console.log(`  Balance: ${v.balance}`);
    console.log(`  Active: ${v.isActive}`);
    console.log("-------------------");
  }

  console.log("--- DEBUG ALLOCATIONS ---");
  const allocations = await db.branchReserveAllocation.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
          sourceVault: true,
          targetVault: true,
      }
  });
  
  for (const a of allocations) {
      console.log(`Allocation ID: ${a.id}`);
      console.log(`  Source: ${a.sourceVault.name} (${a.sourceVault.balance})`);
      console.log(`  Target: ${a.targetVault.name} (${a.targetVault.balance})`);
      console.log(`  Amount: ${a.amount} + Float: ${a.floatAmount}`);
      console.log(`  Status: ${a.status}`);
      console.log("-------------------");
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
