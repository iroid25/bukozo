const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// Client's requested Income structure:
// 401000 Loan related income (parent for interest, processing fees, penalties etc.)
// 402000 Member account income (parent for membership fees, subscriptions etc.)
// 403000+ Remaining income categories as Level 2 parents
const INCOME_CATEGORIES = [
  { code: '401000', name: 'LOAN RELATED INCOME' },
  { code: '402000', name: 'MEMBER ACCOUNT INCOME' },
  { code: '403000', name: 'STATIONERY SALES' },
  { code: '404000', name: 'SALE OF OLD ASSETS' },
  { code: '405000', name: 'SALE OF T SHIRTS' },
  { code: '406000', name: 'COMMISSIONS INCOME' },
  { code: '407000', name: 'SUBSCRIPTION INCOME' },
  { code: '408000', name: 'MEMBERSHIP INCOME' },
  { code: '409000', name: 'PROJECTS INCOME' },
  { code: '410000', name: 'SOCIAL FUND' },
  { code: '411000', name: 'PENALTIES' },
  { code: '412000', name: 'LEDGER FEES' },
  { code: '413000', name: 'INTEREST ON BANK DEPOSITS' },
  { code: '414000', name: 'INTEREST ON INVESTMENT' },
  { code: '415000', name: 'FUNDRAISING INCOME' },
  { code: '416000', name: 'INTERVIEW FEES' },
  { code: '417000', name: 'INTERNS INCOME' },
  { code: '418000', name: 'INSURANCE INCOME' },
  { code: '419000', name: 'CONSTRUCTION FUND' },
  { code: '420000', name: 'WITHHOLDING INCOME' },
  { code: '421000', name: 'RECOVERY OF FRAUDED MONEY' },
];

// Map existing sub-accounts to new parent categories
// Existing codes with prefix "4001" (Interest Income, etc.) -> 401000 (Loan Related Income)
// Existing codes with prefix "4009" (Processing Fees) -> 401000 (Loan Related Income)
// Existing codes with prefix "4013" (Penalties) -> 411000 (Penalties) or keep under 401000 if loan-related
const CHILD_MIGRATION = {
  '4001': '401000', // Interest Income -> Loan Related Income
  '4009': '401000', // Processing Fees -> Loan Related Income  
  '4013': '401000', // Penalty Income  -> Loan Related Income
  '4002': '402000', // Member account-like items -> Member Account Income
};

async function main() {
  console.log('=== INCOME COA RESTRUCTURING ===\n');

  const mainIncome = await db.chartOfAccount.findFirst({ where: { accountCode: '400000' } });
  if (!mainIncome) {
    console.error('Main Income account 400000 not found!');
    return;
  }

  // STEP 1: Create/Update the parent categories
  console.log('--- Step 1: Upsert income parent categories ---');
  const parentMap = {}; // code -> id

  for (const cat of INCOME_CATEGORIES) {
    const existing = await db.chartOfAccount.findFirst({ where: { accountCode: cat.code } });
    if (existing) {
      const updated = await db.chartOfAccount.update({
        where: { id: existing.id },
        data: {
          accountName: cat.name,
          fullCode: `${cat.code}  ${cat.name}`,
          category: cat.name,
          ledgerType: 'INCOME',
          debitCredit: 'CR',
          isActive: true,
          parentId: mainIncome.id,
          level: 2,
        }
      });
      console.log(`  Updated ${cat.code} -> ${cat.name}`);
      parentMap[cat.code] = updated.id;
    } else {
      const created = await db.chartOfAccount.create({
        data: {
          accountCode: cat.code,
          accountName: cat.name,
          fullCode: `${cat.code}  ${cat.name}`,
          ledgerType: 'INCOME',
          debitCredit: 'CR',
          isActive: true,
          isSystem: true,
          level: 2,
          parentId: mainIncome.id,
          category: cat.name,
        }
      });
      console.log(`  Created ${cat.code} -> ${cat.name}`);
      parentMap[cat.code] = created.id;
    }
  }

  // STEP 2: Re-parent existing sub-accounts using CHILD_MIGRATION mapping
  console.log('\n--- Step 2: Re-parent existing sub-accounts ---');
  const allIncomeAccounts = await db.chartOfAccount.findMany({
    where: {
      accountCode: { startsWith: '40' },
      NOT: { accountCode: '400000' },
    },
    orderBy: { accountCode: 'asc' }
  });

  for (const acct of allIncomeAccounts) {
    // Skip parent categories themselves
    if (INCOME_CATEGORIES.some(c => c.code === acct.accountCode)) continue;

    // Check explicit migration mapping first
    const prefix4 = acct.accountCode.substring(0, 4);
    if (CHILD_MIGRATION[prefix4]) {
      const targetParentCode = CHILD_MIGRATION[prefix4];
      if (parentMap[targetParentCode] && acct.parentId !== parentMap[targetParentCode]) {
        await db.chartOfAccount.update({
          where: { id: acct.id },
          data: { parentId: parentMap[targetParentCode], level: 3 }
        });
        console.log(`  Migrated ${acct.accountCode} ${acct.accountName} -> under ${targetParentCode}`);
        continue;
      }
    }

    // Try matching by prefix to one of our new parents
    // e.g. 403001 -> 403000
    const matchingParentCode = `${prefix4.substring(0, 3)}000`;
    if (parentMap[matchingParentCode] && acct.parentId !== parentMap[matchingParentCode]) {
      await db.chartOfAccount.update({
        where: { id: acct.id },
        data: { parentId: parentMap[matchingParentCode], level: 3 }
      });
      console.log(`  Re-parented ${acct.accountCode} ${acct.accountName} -> under ${matchingParentCode}`);
      continue;
    }

    // For 6-digit codes, try matching to 4-digit parent
    if (acct.accountCode.length === 6) {
      const parentCode6 = `${prefix4}00`;
      if (parentMap[parentCode6] && acct.parentId !== parentMap[parentCode6]) {
        await db.chartOfAccount.update({
          where: { id: acct.id },
          data: { parentId: parentMap[parentCode6], level: 3 }
        });
        console.log(`  Re-parented ${acct.accountCode} ${acct.accountName} -> under ${parentCode6}`);
        continue;
      }
    }

    // Anything that doesn't match stays where it is
    console.log(`  Skipped ${acct.accountCode} ${acct.accountName} (no matching parent)`);
  }

  // STEP 3: Clean up any TEMP_ leftovers from previous runs
  console.log('\n--- Step 3: Cleanup TEMP_ leftovers ---');
  const tempAccounts = await db.chartOfAccount.findMany({
    where: { accountCode: { startsWith: 'TEMP_40' } }
  });

  for (const temp of tempAccounts) {
    const originalCode = temp.accountCode.replace('TEMP_', '');
    const realExists = await db.chartOfAccount.findFirst({ where: { accountCode: originalCode } });

    if (realExists) {
      const children = await db.chartOfAccount.findMany({ where: { parentId: temp.id } });
      for (const child of children) {
        await db.chartOfAccount.update({
          where: { id: child.id },
          data: { parentId: realExists.id }
        });
      }
      await db.journalEntry.updateMany({
        where: { accountId: temp.id },
        data: { accountId: realExists.id }
      });
      await db.chartOfAccount.delete({ where: { id: temp.id } });
      console.log(`  Merged TEMP_${originalCode} into ${originalCode}`);
    } else {
      await db.chartOfAccount.update({
        where: { id: temp.id },
        data: { accountCode: originalCode }
      });
      console.log(`  Restored TEMP_${originalCode} -> ${originalCode}`);
    }
  }

  if (tempAccounts.length === 0) {
    console.log('  No TEMP_ accounts found.');
  }

  // STEP 4: Final verification
  console.log('\n--- FINAL INCOME STRUCTURE ---');
  const finalIncome = await db.chartOfAccount.findMany({
    where: { accountCode: { startsWith: '40' } },
    select: { accountCode: true, accountName: true, level: true, isActive: true },
    orderBy: { accountCode: 'asc' }
  });
  console.table(finalIncome);

  console.log('\n✅ Income restructuring complete!');
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => db.$disconnect());
