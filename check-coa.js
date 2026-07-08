const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const codes = ["106000", "401000", "102001", "401300", "301004"];
    const accounts = await prisma.chartOfAccount.findMany({
      where: { accountCode: { in: codes } },
      select: { accountCode: true, accountName: true, id: true }
    });
    
    console.log("--- Account Status ---");
    codes.forEach(code => {
      const match = accounts.find(a => a.accountCode === code);
      if (match) {
        console.log(`[FOUND]   ${code}: ${match.accountName} (${match.id})`);
      } else {
        console.log(`[MISSING] ${code}`);
      }
    });
    
    const accumulatedAccounts = await prisma.chartOfAccount.findMany({
      where: { accountName: { contains: "Accumulated", mode: "insensitive" } },
      select: { accountCode: true, accountName: true, ledgerType: true }
    });
    console.log("\n--- Accumulated Depreciation Accounts ---");
    accumulatedAccounts.forEach(a => console.log(`${a.accountCode} [${a.ledgerType}]: ${a.accountName}`));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
