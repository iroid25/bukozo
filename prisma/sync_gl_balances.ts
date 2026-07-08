import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting GL vs Member Accounts consistency sync...\n');

  // 1. Fetch all Account Types (which define savings products)
  const accountTypes = await prisma.accountType.findMany({
    include: {
      accounts: true // Pull the member accounts under this product
    }
  });

  console.log(`Found ${accountTypes.length} Account Types to verify.\n`);

  for (const type of accountTypes) {
    // 2. Sum the actual balances of all members for this product type
    const trueTotalBalance = type.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    
    console.log(`--- [Account Type: ${type.name}] ---`);
    console.log(`Total Member Deposits: USh ${trueTotalBalance.toLocaleString()}`);

    // If it already has a ledger mapping, just sync the balance!
    let targetId = type.ledgerAccountId;

    // 3. If there is no mapping assigned yet (legacy products), fuzzy match it to the COA!
    if (!targetId) {
       console.log(`No explicit ledger mapping found. Attempting fuzzy match...`);
       // Find an ACTIVE liability node with a very similar name (e.g., "Voluntary Savings" -> contains "voluntary")
       const searchKey = type.name.split(" ")[0] || type.name; // Use first word like "Voluntary"
       const matchingCOA = await prisma.chartOfAccount.findFirst({
         where: {
           ledgerType: { in: ['LIABILITIES', 'EQUITY'] },
           accountName: { contains: searchKey, mode: 'insensitive' },
           isActive: true
         }
       });

       if (matchingCOA) {
         console.log(`Found matching COA: ${matchingCOA.accountName} (${matchingCOA.accountCode}). Setting mapping!`);
         await prisma.accountType.update({
           where: { id: type.id },
           data: { ledgerAccountId: matchingCOA.id }
         });
         targetId = matchingCOA.id;
       } else {
         console.log(`WARNING: Could not auto-map to any existing COA. Skipping balance sync for this product.`);
         continue;
       }
    }

    // 4. Update the mapped ChartOfAccount liability node to strictly equal the true member deposits sum.
    if (targetId) {
      const coa = await prisma.chartOfAccount.findUnique({ where: { id: targetId } });
      if (coa) {
        console.log(`Updating GL Node "${coa.accountName}" Balance: ${coa.balance} -> ${trueTotalBalance}`);
        // Liability/Equity accounts increase via Credit. So balance == creditBalance mathematically.
        await prisma.chartOfAccount.update({
          where: { id: targetId },
          data: {
            balance: trueTotalBalance, 
            creditBalance: trueTotalBalance, 
            debitBalance: 0 // Resetting debit to 0 since we're forcing net balance
          }
        });
      }
    }
    console.log("\n");
  }

  console.log('GL Resync Finished Successfully!');
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
