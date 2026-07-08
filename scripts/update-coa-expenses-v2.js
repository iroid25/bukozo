const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// The 34 categories the client requested, in order
const EXPENSE_CATEGORIES = [
  { code: '500100', name: 'OFFICE STATIONERY' },
  { code: '500200', name: 'BOOKS OF ACCOUNTS' },
  { code: '500300', name: 'POLICY DOCUMENTS' },
  { code: '500400', name: 'UTILITIES' },
  { code: '500500', name: 'MAINTENANCE' },
  { code: '500600', name: 'SALARIES AND WAGES' },
  { code: '500700', name: 'NSSF' },
  { code: '500800', name: 'PAYE' },
  { code: '500900', name: 'STAFF INCENTIVES' },
  { code: '501000', name: 'ADMINISTRATION ALLOWANCES' },
  { code: '501100', name: 'ADMINISTRATION COSTS' },
  { code: '501200', name: 'TRANSPORT AND TRAVEL COSTS' },
  { code: '501300', name: 'MEETINGS' },
  { code: '501400', name: 'COMMUNICATION' },
  { code: '501500', name: 'TRAININGS' },
  { code: '501600', name: 'EXCHANGE VISITS EXPENSE' },
  { code: '501700', name: 'SUBSCRIPTIONS TO ORGANIZATIONS' },
  { code: '501800', name: 'LEGAL COSTS' },
  { code: '501900', name: 'FINANCIAL COSTS' },
  { code: '502000', name: 'PUBLIC RELATIONS' },
  { code: '502100', name: 'PUBLICITY AND ADVERTISEMENTS' },
  { code: '502200', name: 'ENTERTAINMENT' },
  { code: '502300', name: 'PROJECTS EXPENSES' },
  { code: '502400', name: 'LOAN RELATED EXPENSES' },
  { code: '502500', name: 'DIVIDENDS' },
  { code: '502600', name: 'SOFTWARE EXPENSES' },
  { code: '502700', name: 'HEALTH AND SANITATION' },
  { code: '502800', name: 'DEPRECIATION EXPENSES' },
  { code: '502900', name: 'CALENDARS' },
  { code: '503000', name: 'WEBSITE EXPENSES' },
  { code: '503100', name: 'THANKS GIVING EXPENSES' },
  { code: '503200', name: 'RENT' },
  { code: '503300', name: 'CONSTRUCTION COSTS' },
  { code: '503400', name: 'INTEREST PAYMENTS' },
];

async function main() {
  console.log('=== EXPENSES COA RESTRUCTURING (v2) ===\n');

  const mainExpenses = await db.chartOfAccount.findFirst({ where: { accountCode: '500000' } });
  if (!mainExpenses) {
    console.error('Main Expenses account 500000 not found!');
    return;
  }

  // STEP 1: Ensure the 34 parent categories exist with correct names
  console.log('--- Step 1: Upsert 34 parent categories ---');
  const parentMap = {}; // code -> id

  for (const cat of EXPENSE_CATEGORIES) {
    const existing = await db.chartOfAccount.findFirst({ where: { accountCode: cat.code } });
    if (existing) {
      // Update name to match client spec
      const updated = await db.chartOfAccount.update({
        where: { id: existing.id },
        data: {
          accountName: cat.name,
          fullCode: `${cat.code}  ${cat.name}`,
          category: cat.name,
          ledgerType: 'EXPENDITURES',
          debitCredit: 'DR',
          isActive: true,
          parentId: mainExpenses.id,
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
          ledgerType: 'EXPENDITURES',
          debitCredit: 'DR',
          isActive: true,
          isSystem: true,
          level: 2,
          parentId: mainExpenses.id,
          category: cat.name,
        }
      });
      console.log(`  Created ${cat.code} -> ${cat.name}`);
      parentMap[cat.code] = created.id;
    }
  }

  // STEP 2: Re-parent any orphan sub-accounts that fall under the 34 parent ranges
  // Any account with code 50XXYY (where XX matches a parent prefix) should be linked to that parent
  console.log('\n--- Step 2: Re-parent orphaned sub-accounts ---');
  const allExpenseAccounts = await db.chartOfAccount.findMany({
    where: { 
      accountCode: { startsWith: '50' },
      NOT: { accountCode: '500000' },
    },
    orderBy: { accountCode: 'asc' }
  });

  for (const acct of allExpenseAccounts) {
    // Skip the 34 parent codes themselves
    if (EXPENSE_CATEGORIES.some(c => c.code === acct.accountCode)) continue;
    
    // Find the matching parent by looking at the first 4 digits
    const prefix4 = acct.accountCode.substring(0, 4);
    const matchingParentCode = `${prefix4}00`;
    
    if (parentMap[matchingParentCode]) {
      // This child belongs under a known parent
      if (acct.parentId !== parentMap[matchingParentCode]) {
        await db.chartOfAccount.update({
          where: { id: acct.id },
          data: { 
            parentId: parentMap[matchingParentCode],
            level: 3
          }
        });
        console.log(`  Re-parented ${acct.accountCode} ${acct.accountName} -> under ${matchingParentCode}`);
      }
    } else {
      // This is an account whose prefix doesn't match any of the 34 categories
      // It's a legacy account - just make sure it's under mainExpenses
      if (acct.accountCode.endsWith('00') && acct.accountCode.length === 6) {
        // It's a parent-level code not in our 34 - keep as legacy parent under mainExpenses
        if (acct.parentId !== mainExpenses.id) {
          await db.chartOfAccount.update({
            where: { id: acct.id },
            data: { parentId: mainExpenses.id }
          });
          console.log(`  Legacy parent ${acct.accountCode} ${acct.accountName} -> under mainExpenses`);
        }
      }
    }
  }

  // STEP 3: Clean up any TEMP_ prefixed accounts left from previous failed run
  console.log('\n--- Step 3: Cleanup TEMP_ leftovers ---');
  const tempAccounts = await db.chartOfAccount.findMany({
    where: { accountCode: { startsWith: 'TEMP_' } }
  });
  
  for (const temp of tempAccounts) {
    const originalCode = temp.accountCode.replace('TEMP_', '');
    // Check if the real code already exists
    const realExists = await db.chartOfAccount.findFirst({ where: { accountCode: originalCode } });
    
    if (realExists) {
      // Move children from temp to real, then delete temp
      const children = await db.chartOfAccount.findMany({ where: { parentId: temp.id } });
      for (const child of children) {
        await db.chartOfAccount.update({
          where: { id: child.id },
          data: { parentId: realExists.id }
        });
      }
      // Move journal entries if any
      await db.journalEntry.updateMany({
        where: { accountId: temp.id },
        data: { accountId: realExists.id }
      });
      await db.chartOfAccount.delete({ where: { id: temp.id } });
      console.log(`  Merged TEMP_${originalCode} into ${originalCode} and deleted temp`);
    } else {
      // Just restore the original code
      await db.chartOfAccount.update({
        where: { id: temp.id },
        data: { accountCode: originalCode }
      });
      console.log(`  Restored TEMP_${originalCode} -> ${originalCode}`);
    }
  }

  // STEP 4: Final verification
  console.log('\n--- FINAL EXPENSES STRUCTURE ---');
  const finalParents = await db.chartOfAccount.findMany({
    where: { 
      accountCode: { startsWith: '50' },
      level: { lte: 2 }
    },
    select: { accountCode: true, accountName: true, level: true, isActive: true },
    orderBy: { accountCode: 'asc' }
  });
  console.table(finalParents);

  const totalChildren = await db.chartOfAccount.count({
    where: { accountCode: { startsWith: '50' }, level: 3 }
  });
  console.log(`\nTotal Level 3 expense sub-accounts: ${totalChildren}`);
  console.log('\n✅ Expenses restructuring complete!');
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => db.$disconnect());
