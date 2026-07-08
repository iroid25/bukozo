import { db } from "./prisma/db";

async function main() {
  const accounts = await db.chartOfAccount.findMany({
    where: {
      OR: [
        { accountName: { contains: "Loan", mode: "insensitive" } },
        { accountName: { contains: "Interest", mode: "insensitive" } },
        { accountName: { contains: "Penalty", mode: "insensitive" } },
        { accountName: { contains: "Reserve", mode: "insensitive" } },
        { accountName: { contains: "Share", mode: "insensitive" } },
        { accountName: { contains: "Insurance", mode: "insensitive" } },
        { accountName: { contains: "Fee", mode: "insensitive" } },
        { accountName: { contains: "Asset", mode: "insensitive" } },
        { accountName: { contains: "Income", mode: "insensitive" } },
        { accountCode: { startsWith: "1" } }, // Assets
        { accountCode: { startsWith: "3" } }, // Capital/Equity/Reserves
        { accountCode: { startsWith: "4" } }, // Income
      ]
    },
    orderBy: { accountCode: "asc" }
  });

  console.log("Relevant Chart of Accounts:");
  accounts.forEach(a => {
    console.log(`${a.accountCode} | ${a.accountName} | ${a.ledgerType}`);
  });
}

main().catch(console.error);
