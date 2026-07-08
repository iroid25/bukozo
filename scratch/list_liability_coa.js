const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  console.log("Listing Liability Accounts from ChartOfAccount...");
  const accounts = await db.chartOfAccount.findMany({
    where: {
      OR: [
        { ledgerType: "LIABILITIES" },
        { accountCode: { startsWith: "2" } }
      ]
    },
    orderBy: { accountCode: "asc" }
  });

  console.log(`Total Liability Accounts found: ${accounts.length}`);
  accounts.forEach(acc => {
    console.log(`Code: ${acc.accountCode} | Name: ${acc.accountName} | Category: ${acc.category} | LedgerType: ${acc.ledgerType} | Level: ${acc.level} | ParentId: ${acc.parentId}`);
  });
}

main().catch(console.error).finally(() => db.$disconnect());
