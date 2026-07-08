import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accountTypes = await prisma.accountType.findMany({
    select: { id: true, name: true, isShareAccount: true, earnsDividends: true }
  });
  const loanProducts = await prisma.loanProduct.findMany({
    select: { id: true, name: true, interestRate: true, minAmount: true, maxAmount: true }
  });
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, location: true }
  });
  const coa = await prisma.chartOfAccount.findMany({
    where: { ledgerType: { in: ['INCOME', 'EXPENSES'] } },
    select: { id: true, accountName: true, accountCode: true, ledgerType: true },
    take: 20
  });

  console.log('--- Account Types ---');
  console.log(JSON.stringify(accountTypes, null, 2));
  console.log('\n--- Loan Products ---');
  console.log(JSON.stringify(loanProducts, null, 2));
  console.log('\n--- Branches ---');
  console.log(JSON.stringify(branches, null, 2));
  console.log('\n--- Income/Expense Accounts (Sample) ---');
  console.log(JSON.stringify(coa, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
