const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  console.log("Checking accounts in database...");
  const count = await db.account.count();
  console.log(`Total accounts: ${count}`);

  const shareAccounts = await db.account.findMany({
    where: {
      accountType: {
        isShareAccount: true,
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

  console.log(`\nShare accounts count: ${shareAccounts.length}`);
  shareAccounts.forEach((acc) => {
    console.log(`Account No: ${acc.accountNumber}`);
    console.log(`  Member: ${acc.member?.user?.name || "N/A"}`);
    console.log(`  Type: ${acc.accountType?.name}`);
    console.log(`  Balance/Value: ${acc.balance}`);
    console.log(`  Shares Count: ${acc.sharesCount}`);
    console.log(`  Status: ${acc.status}`);
  });
}

main().catch(console.error).finally(() => db.$disconnect());
