import { db } from "../prisma/db";

async function checkCOA() {
  const coaCount = await db.chartOfAccount.count();
  const branches = await db.branch.findMany();
  
  console.log(`Total Chart of Accounts: ${coaCount}`);
  console.log(`Total Branches: ${branches.length}`);
  
  const sample = await db.chartOfAccount.findMany({ take: 5 });
  console.log('Sample accounts:', JSON.stringify(sample, null, 2));

  // Check if any transaction is linked to a branch but not to others
  const branchTransactions = await db.transaction.groupBy({
    by: ['branchId'],
    _count: { id: true }
  });
  console.log('Transactions by branch:', JSON.stringify(branchTransactions, null, 2));
}

checkCOA();
