import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking SystemConfiguration for insurance accounts...");

  // Search for any existing keys that might hold the insurance account ID
  const configs = await prisma.systemConfiguration.findMany({
    where: {
      key: {
        contains: "INSURANCE",
      },
    },
  });

  console.log("Found existing insurance-related configurations:", configs.map(c => ({ key: c.key, value: c.value })));

  // Finding the new liability account ID
  // Corrected field names: accountCode, accountName
  const liabilityAccount = await prisma.chartOfAccount.findFirst({
    where: {
      accountCode: "2105",
      accountName: "Loans Insurance",
    },
  });

  if (!liabilityAccount) {
    console.log("Loans Insurance liability account (2105) not found! Skipping config update.");
    return;
  }

  console.log(`Found Loans Insurance account ID: ${liabilityAccount.id} (Code: 2105)`);

  const keyToUpdate = "LOAN_INSURANCE_ACCOUNT_ID"; 
  const existingConfig = await prisma.systemConfiguration.findUnique({
    where: { key: keyToUpdate },
  });

  if (existingConfig) {
    console.log(`Updating existing configuration '${keyToUpdate}' to '${liabilityAccount.id}'...`);
    await prisma.systemConfiguration.update({
      where: { key: keyToUpdate },
      data: { value: liabilityAccount.id },
    });
    console.log("Update successful.");
  } else {
    console.log(`Configuration '${keyToUpdate}' does not exist. Creating it...`);
    await prisma.systemConfiguration.create({
      data: {
        key: keyToUpdate,
        value: liabilityAccount.id,
        description: "Account ID for Loan Insurance (Liability)",
        category: "ACCOUNTING",
      },
    });
    console.log("Creation successful.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
