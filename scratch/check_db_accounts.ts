import { db } from "../prisma/db";

async function main() {
  console.log("Checking accounts in database...");
  const count = await db.account.count();
  console.log(`Total accounts: ${count}`);

  const zeroBalanceCount = await db.account.count({
    where: {
      balance: {
        lte: 0,
      },
    },
  });
  console.log(`Accounts with balance <= 0: ${zeroBalanceCount}`);

  const zeroBalanceAccounts = await db.account.findMany({
    where: {
      balance: {
        lte: 0,
      },
    },
    include: {
      accountType: true,
      member: {
        include: {
          user: true,
        },
      },
    },
  });

  console.log("\nZero balance accounts breakdown:");
  zeroBalanceAccounts.forEach((acc) => {
    console.log(`Account No: ${acc.accountNumber}`);
    console.log(`  Member: ${acc.member?.user?.name || "N/A"}`);
    console.log(`  Type: ${acc.accountType?.name}`);
    console.log(`  Balance: ${acc.balance}`);
    console.log(`  Status: ${acc.status}`);
  });
}

main().catch(console.error);
