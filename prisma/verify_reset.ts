import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧐 Verifying Reset State...");

  const memberCount = await prisma.member.count();
  const institutionCount = await prisma.institution.count();
  const transactionCount = await prisma.transaction.count();
  const loanCount = await prisma.loan.count();
  const memberUserCount = await prisma.user.count({ where: { role: "MEMBER" } });
  const staffUserCount = await prisma.user.count({ where: { role: { not: "MEMBER" } } });
  
  const totalBalance = await prisma.chartOfAccount.aggregate({
    _sum: {
      balance: true,
      debitBalance: true,
      creditBalance: true
    }
  });

  console.log(`- Members: ${memberCount}`);
  console.log(`- Institutions: ${institutionCount}`);
  console.log(`- Transactions: ${transactionCount}`);
  console.log(`- Loans: ${loanCount}`);
  console.log(`- Member Users: ${memberUserCount}`);
  console.log(`- Staff Users: ${staffUserCount}`);
  console.log(`- Total Ledger Balance: ${totalBalance._sum.balance ?? 0}`);

  if (memberCount === 0 && transactionCount === 0 && loanCount === 0 && memberUserCount === 0 && staffUserCount > 0) {
    console.log("✅ Verification Passed!");
  } else {
    console.log("❌ Verification Failed!");
  }
}

main().finally(() => prisma.$disconnect());
