import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedInterestConfiguration() {
  console.log("🌱 Seeding Interest Configuration...");

  const configurations = [
    {
      key: "DEFAULT_INTEREST_TYPE",
      value: "FLAT_RATE",
      description: "Default interest calculation type for new loan products",
      category: "INTEREST",
      dataType: "STRING",
    },
    {
      key: "DEFAULT_LOAN_INTEREST_RATE",
      value: "15",
      description: "Default interest rate percentage for new loan products",
      category: "INTEREST",
      dataType: "NUMBER",
    },
    {
      key: "MAX_INTEREST_RATE",
      value: "100",
      description: "Maximum allowed interest rate percentage",
      category: "INTEREST",
      dataType: "NUMBER",
    },
    {
      key: "MIN_INTEREST_RATE",
      value: "0",
      description: "Minimum allowed interest rate percentage",
      category: "INTEREST",
      dataType: "NUMBER",
    },
    {
      key: "ALLOW_INTEREST_TYPE_OVERRIDE",
      value: "true",
      description: "Allow loan applications to override product interest type",
      category: "INTEREST",
      dataType: "BOOLEAN",
    },
    {
      key: "SAVINGS_INTEREST_RATE",
      value: "5",
      description: "Default interest rate for savings accounts",
      category: "INTEREST",
      dataType: "NUMBER",
    },
    {
      key: "FIXED_DEPOSIT_INTEREST_RATE",
      value: "8",
      description: "Default interest rate for fixed deposit accounts",
      category: "INTEREST",
      dataType: "NUMBER",
    },
  ];

  for (const config of configurations) {
    await prisma.systemConfiguration.upsert({
      where: { key: config.key },
      update: {}, // Don't update if exists
      create: config,
    });
  }

  console.log("✅ Interest Configuration seeded successfully");
}

// Run if called directly
if (require.main === module) {
  seedInterestConfiguration()
    .then(() => {
      console.log("✅ Seeding completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

export { seedInterestConfiguration };
