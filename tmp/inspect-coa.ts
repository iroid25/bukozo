
import { db } from "./prisma/db";

async function main() {
  console.log("--- EXISTING CHART OF ACCOUNTS ---");
  const accounts = await db.chartOfAccount.findMany({
    orderBy: { accountCode: "asc" }
  });

  if (accounts.length === 0) {
      console.log("No accounts found. Database is clean for seeding.");
  } else {
      console.log(`Found ${accounts.length} accounts.`);
      for (const acc of accounts) {
          console.log(`${acc.accountCode} - ${acc.accountName} (${acc.ledgerType})`);
      }
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
