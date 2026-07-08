import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Listing all Chart of Accounts...");

  const accounts = await prisma.chartOfAccount.findMany({
    orderBy: { accountCode: "asc" },
  });

  if (accounts.length === 0) {
    console.log("No accounts found in ChartOfAccounts table.");
  } else {
    console.log(`Found ${accounts.length} accounts:`);
    accounts.forEach((acc) => {
      console.log(
        `${acc.accountCode} - ${acc.accountName} (${acc.ledgerType}) [Level: ${acc.level}] [Active: ${acc.isActive}]`,
      );
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
