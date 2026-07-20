// Seed script to create required Chart of Accounts for Fixed Deposits
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Chart of Accounts for Fixed Deposits...");

  // 1. Create Cash at Hand account (102001)
  const cashAccount = await prisma.chartOfAccount.upsert({
    where: { accountCode: "102001" },
    update: {},
    create: {
      accountCode: "102001",
      fullCode: "102001",
      accountName: "Cash at Hand",
      level: 3,
      ledgerType: "ASSETS",
      isActive: true,
      isSystem: true,
      debitBalance: 0,
      creditBalance: 0,
      balance: 0,
      description: "Cash at hand for daily operations",
    },
  });
  console.log("✅ Created/Updated Cash at Hand account:", cashAccount.accountCode);

  // 2. Create Fixed Deposit Liability account
  const fdLiabilityAccount = await prisma.chartOfAccount.upsert({
    where: { accountCode: "201001" },
    update: {},
    create: {
      accountCode: "201001",
      fullCode: "201001",
      accountName: "Fixed Savings",
      level: 3,
      ledgerType: "LIABILITIES",
      isActive: true,
      isSystem: true,
      debitBalance: 0,
      creditBalance: 0,
      balance: 0,
      description: "Liability account for fixed savings accounts",
    },
  });
  console.log("✅ Created/Updated Fixed Deposit Liability account:", fdLiabilityAccount.accountCode);

  console.log("\n✨ Fixed Deposit accounts seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding accounts:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
