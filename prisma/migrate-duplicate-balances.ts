
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateBalances() {
  const mappings = [
    { from: "102001", to: "101100" }, // Cash at Hand
    { from: "102002", to: "101200" }, // Post Bank
    { from: "102015", to: "101400" }, // Stanbic Bank
    { from: "102005", to: "101500" }, // Mobile Money Float
  ];

  console.log("🚀 Starting COA Balance Migration...");

  for (const mapping of mappings) {
    const fromAccount = await prisma.chartOfAccount.findUnique({
      where: { accountCode: mapping.from }
    });

    const toAccount = await prisma.chartOfAccount.findUnique({
      where: { accountCode: mapping.to }
    });

    if (fromAccount && toAccount) {
      const balanceToMove = fromAccount.balance;
      
      if (balanceToMove !== 0) {
        console.log(`📦 Moving ${balanceToMove} from ${fromAccount.accountCode} (${fromAccount.accountName}) to ${toAccount.accountCode} (${toAccount.accountName})...`);
        
        await prisma.$transaction([
          prisma.chartOfAccount.update({
            where: { id: fromAccount.id },
            data: { balance: 0, isActive: false }
          }),
          prisma.chartOfAccount.update({
            where: { id: toAccount.id },
            data: { balance: { increment: balanceToMove }, isActive: true }
          }),
          // Optional: Create a internal adjustment journal entry if needed, 
          // but for cleanup this direct update is usually sufficient if audited later.
        ]);
        
        console.log(`✅ Moved balance for ${mapping.from} -> ${mapping.to}`);
      } else {
        console.log(`ℹ️ No balance to move for ${mapping.from}. Deactivating...`);
        await prisma.chartOfAccount.update({
          where: { id: fromAccount.id },
          data: { isActive: false }
        });
      }
    } else {
      console.warn(`⚠️ Could not find accounts for mapping: ${mapping.from} -> ${mapping.to}`);
    }
  }

  console.log("🏁 Migration Complete.");
}

migrateBalances()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
