import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting duplicate liabilities cleanup...');

  const duplicateCodes = [
    '201001', // Member Savings 
    '201002', // Accounts Payable 
    '201003', // Member Fixed Deposits 
    '202010', // Loan Insurance wrongly duplicated under non-current liabilities
    '202200', // Accumulated Depreciation 
    '202201', // ACCUMMULATED DEPN- MOTORCYCLE 
    '202202', // ACCUMMULATED DEPN- FURNITURE & FITTINGS 
    '202203', // ACCUMMULATED DEPN- COMPUTERS 
    '202204', // ACCUMMULATED DEPN- OTHER OFFICE EQPT 
    '202205', // ACCUMMULATED DEPN-SAFE 
    '202300', // Legacy External Loan 
    '202310', // Legacy EXTERNAL LOAN 
    '202400', // Legacy Founders Account 
  ];

  for (const code of duplicateCodes) {
    const account = await prisma.chartOfAccount.findUnique({
      where: { accountCode: code }
    });

    if (account) {
      if (account.balance === 0 && account.isActive === false) {
        // Safe to delete if it's inactive and has 0 balance. Let's do a hard delete to fully stop repeating.
        try {
          await prisma.chartOfAccount.delete({
            where: { accountCode: code }
          });
          console.log(`DELETED repetitive inactive liability: ${account.accountName} (${code})`);
        } catch (err: any) {
          console.log(`Could not delete ${code} (has relations). Archiving instead...`);
          await prisma.chartOfAccount.update({
            where: { accountCode: code },
            data: { 
              accountName: `[ARCHIVED] ${account.accountName}`,
              // Change category or level if needed, but keeping it inactive with [ARCHIVED] is usually enough UI indication
            }
          });
        }
      } else {
         console.log(`Could not delete ${code}. Balance is ${account.balance}, isActive is ${account.isActive}. Removing from "LIABILITIES" category and marking archived...`);
         await prisma.chartOfAccount.update({
            where: { accountCode: code },
            data: { 
              accountName: `[ARCHIVED] ${account.accountName}`,
              isActive: false,
              category: 'ARCHIVED'
            }
          });
      }
    } else {
      console.log(`Code ${code} already deleted or not found.`);
    }
  }

  console.log('Cleanup finished!');
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
