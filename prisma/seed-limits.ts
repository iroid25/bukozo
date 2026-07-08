import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Staff Limits...");

  const limits = [
    {
      role: UserRole.TELLER,
      perTransactionLimit: 5000000, // 5M UGX
      dailyLimit: 20000000, // 20M UGX
    },
    {
      role: UserRole.AGENT,
      perTransactionLimit: 2000000, // 2M UGX
      dailyLimit: 10000000, // 10M UGX
    },
  ];

  for (const limit of limits) {
    await prisma.staffLimit.upsert({
      where: { role: limit.role },
      update: limit,
      create: limit,
    });
    console.log(`- Set limits for ${limit.role}`);
  }

  console.log("Staff limits seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
