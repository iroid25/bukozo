import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- SYSTEM CONNECTIVITY AUDIT (Chart of Accounts) ---\n');

  // 1. Savings & Shares Products
  const accountTypes = await prisma.accountType.findMany({
    select: { id: true, name: true, ledgerAccountId: true, isShareAccount: true }
  });
  
  const unmappedTypes = accountTypes.filter(t => !t.ledgerAccountId);
  console.log(`1. Savings & Share Products [Total: ${accountTypes.length}]`);
  if (unmappedTypes.length > 0) {
    console.log(`   ❌ UNCONNECTED (${unmappedTypes.length}):`);
    unmappedTypes.forEach(t => console.log(`      - ${t.name} (${t.isShareAccount ? 'Share' : 'Savings'})`));
  } else {
    console.log(`   ✅ ALL CONNECTED`);
  }
  console.log('\n');

  // 2. Loan Products
  const loanProducts = await prisma.loanProduct.findMany({
    select: { 
      id: true, 
      name: true, 
      ledgerAccountId: true, 
      interestAccountId: true,
      penaltyAccountId: true,
      feeAccountId: true
    }
  });

  const unmappedLoans = loanProducts.filter(p => !p.ledgerAccountId || !p.interestAccountId);
  console.log(`2. Loan Products [Total: ${loanProducts.length}]`);
  if (unmappedLoans.length > 0) {
    console.log(`   ❌ UNCONNECTED (Missing Ledger or Interest Account):`);
    unmappedLoans.forEach(p => {
      const missing = [];
      if (!p.ledgerAccountId) missing.push('Principal Ledger');
      if (!p.interestAccountId) missing.push('Interest Income');
      console.log(`      - ${p.name} (Missing: ${missing.join(', ')})`);
    });
  } else {
    console.log(`   ✅ ALL CONNECTED`);
  }
  console.log('\n');

  // 3. Fixed Assets
  const fixedAssets = await prisma.fixedAsset.findMany({
    select: { id: true, assetName: true, assetCode: true, accountId: true }
  });
  const unmappedAssets = fixedAssets.filter(a => !a.accountId);
  console.log(`3. Fixed Assets [Total: ${fixedAssets.length}]`);
  console.log(`   ⚠️  Note: Fixed Assets currently rely on "Soft Matching" logic in many places.`);
  if (unmappedAssets.length > 0) {
    console.log(`   ❌ MISSING HARD FK (${unmappedAssets.length}):`);
    unmappedAssets.forEach(a => console.log(`      - ${a.assetName} (${a.assetCode})`));
  } else {
    console.log(`   ✅ ALL HAVE HARD FKs`);
  }
  console.log('\n');

  // 4. Budget Categories (Income/Expense)
  const categories = await prisma.budgetCategory.findMany({
    select: { name: true, kind: true }
  });
  console.log(`4. Income & Expense Categories [Total: ${categories.length}]`);
  console.log(`   ⚠️  STATUS: DISCONNECTED (Pure name matching only)`);
  console.log(`      These do not have Foreign Keys to the Chart of Accounts. They only match if the COA Name matches the Category Name.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
