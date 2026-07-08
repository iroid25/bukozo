const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// Old parent-level income accounts that should be migrated to children of the new parents
// or deactivated if superseded
const MIGRATIONS = [
  // Old parent codes that overlap with new structure
  { old: '40100', newParent: '401000', action: 'reparent' }, // Interest on Loans -> under Loan Related Income
  { old: '400200', newParent: '420000', action: 'reparent' }, // Withholding Tax -> under Withholding Income
  { old: '400300', newParent: '411000', action: 'reparent' }, // Fines and Penalties -> under Penalties
  { old: '400400', newParent: '401000', action: 'reparent' }, // Commission on Loans -> under Loan Related Income
  { old: '400500', newParent: '401000', action: 'reparent' }, // Loan Application Fees -> under Loan Related Income
  { old: '400600', newParent: '407000', action: 'reparent' }, // Subscriptions Incomes -> under Subscription Income
  { old: '400700', newParent: '408000', action: 'reparent' }, // Membership Fees -> under Membership Income
  { old: '400800', newParent: '409000', action: 'reparent' }, // Project Income -> under Projects Income
  { old: '401200', newParent: '404000', action: 'reparent' }, // Sale of Old Assets -> under Sale of Old Assets
  { old: '401400', newParent: '412000', action: 'reparent' }, // Ledger Fees -> under Ledger Fees
  { old: '401500', newParent: '413000', action: 'reparent' }, // Interest on Bank Deposits -> under Interest on Bank Deposits
  { old: '401600', newParent: '415000', action: 'reparent' }, // Fundraising Incomes -> under Fundraising Income
  { old: '401700', newParent: '416000', action: 'reparent' }, // Interview Fee -> under Interview Fees
  { old: '401800', newParent: '401000', action: 'reparent' }, // Written Off Loans CR -> under Loan Related
  { old: '401900', newParent: '409000', action: 'reparent' }, // Land Income -> under Projects Income
  { old: '403800', newParent: '410000', action: 'reparent' }, // Social Fund (if exists) -> under Social Fund
];

async function main() {
  console.log('=== INCOME CLEANUP: Re-parenting old Level 1 parents ===\n');

  for (const m of MIGRATIONS) {
    const oldAcct = await db.chartOfAccount.findFirst({ where: { accountCode: m.old } });
    if (!oldAcct) {
      console.log(`  ${m.old} not found, skipping`);
      continue;
    }

    const newParent = await db.chartOfAccount.findFirst({ where: { accountCode: m.newParent } });
    if (!newParent) {
      console.log(`  New parent ${m.newParent} not found, skipping ${m.old}`);
      continue;
    }

    // Move this old parent to be a child of the new parent
    await db.chartOfAccount.update({
      where: { id: oldAcct.id },
      data: { parentId: newParent.id, level: 3 }
    });
    console.log(`  Moved ${m.old} ${oldAcct.accountName} -> under ${m.newParent} ${newParent.accountName}`);

    // Also move any children of the old parent to be under the new parent
    const children = await db.chartOfAccount.findMany({ where: { parentId: oldAcct.id } });
    for (const child of children) {
      await db.chartOfAccount.update({
        where: { id: child.id },
        data: { parentId: newParent.id, level: 3 }
      });
      console.log(`    Moved child ${child.accountCode} ${child.accountName} -> under ${m.newParent}`);
    }
  }

  // Handle scattered accounts in 409300 range - move under Projects Income (409000)
  const scattered = await db.chartOfAccount.findMany({
    where: { accountCode: { startsWith: '4093' } }
  });
  const projectsParent = await db.chartOfAccount.findFirst({ where: { accountCode: '409000' } });
  if (projectsParent) {
    for (const s of scattered) {
      if (s.parentId !== projectsParent.id) {
        await db.chartOfAccount.update({
          where: { id: s.id },
          data: { parentId: projectsParent.id, level: 3 }
        });
        console.log(`  Re-parented ${s.accountCode} ${s.accountName} -> under 409000`);
      }
    }
  }

  // Final dump
  console.log('\n--- FINAL CLEAN INCOME STRUCTURE ---');
  const final = await db.chartOfAccount.findMany({
    where: { accountCode: { startsWith: '40' } },
    select: { accountCode: true, accountName: true, level: true },
    orderBy: { accountCode: 'asc' }
  });
  console.table(final);
  console.log('\n✅ Income cleanup done!');
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => db.$disconnect());
