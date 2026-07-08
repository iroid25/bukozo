import { db } from "../prisma/db";

async function calculateBranchBalances(branchId: string) {
  const accounts = await db.chartOfAccount.findMany({
    where: { isActive: true },
    include: {
      journalEntries: {
        where: {
          OR: [
            { transaction: { branchId } },
            { transactionId: null, branchId },
          ]
        },
        select: { debitAmount: true, creditAmount: true }
      }
    }
  });

  return accounts.map(acc => {
    const debits = acc.journalEntries.reduce((sum, j) => sum + j.debitAmount, 0);
    const credits = acc.journalEntries.reduce((sum, j) => sum + j.creditAmount, 0);
    return {
      id: acc.id,
      name: acc.accountName,
      code: acc.accountCode,
      branchDebit: debits,
      branchCredit: credits,
      branchBalance: (acc.ledgerType === 'ASSET' || acc.ledgerType === 'EXPENDITURE') ? debits - credits : credits - debits
    };
  });
}
// This is for logic demonstration in AccountingService
