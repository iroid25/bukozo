import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting reclassification of Budget Categories and GL Accounts...');

  // --- 1. HANDLE BUDGET CATEGORIES ---

  // Find or Create Liabilities Parent
  let liabilityParent = await prisma.budgetCategory.findUnique({
    where: { code: '202000' }
  });
  
  if (!liabilityParent) {
    console.log('Creating Liability Parent BudgetCategory...');
    liabilityParent = await prisma.budgetCategory.create({
      data: {
        name: 'Non-current Liabilities',
        code: '202000',
        kind: 'LIABILITY',
        isActive: true
      }
    });
  }

  // Find or Create Equity Parent
  let equityParent = await prisma.budgetCategory.findUnique({
    where: { code: '300000' }
  });

  if (!equityParent) {
    console.log('Creating Equity Parent BudgetCategory...');
    equityParent = await prisma.budgetCategory.create({
      data: {
        name: 'Equity',
        code: '300000',
        kind: 'EQUITY',
        isActive: true
      }
    });
  }

  // Reclassify Insurance BudgetCategory
  const insuranceBudgetCat = await prisma.budgetCategory.findUnique({
    where: { code: '401003' }
  });

  if (insuranceBudgetCat) {
    console.log(`Moving Insurance BudgetCategory (${insuranceBudgetCat.code}) to Liabilities...`);
    await prisma.budgetCategory.update({
      where: { id: insuranceBudgetCat.id },
      data: {
        code: '202002', // 202001 is already taken
        kind: 'LIABILITY',
        parentId: liabilityParent.id
      }
    });
    console.log('✅ Insurance BudgetCategory reclassified.');
  }

  // Reclassify Shares BudgetCategory
  const sharesBudgetCat = await prisma.budgetCategory.findUnique({
    where: { code: '401004' }
  });

  if (sharesBudgetCat) {
    console.log(`Moving Shares BudgetCategory (${sharesBudgetCat.code}) to Equity...`);
    await prisma.budgetCategory.update({
      where: { id: sharesBudgetCat.id },
      data: {
        code: '300001',
        kind: 'EQUITY',
        parentId: equityParent.id
      }
    });
    console.log('✅ Shares BudgetCategory reclassified.');
  }

  // --- 2. HANDLE CHART OF ACCOUNTS (GL) ---

  // Find GL Parents
  const glLiabilityParent = await prisma.chartOfAccount.findUnique({
    where: { accountCode: '200600' }
  });
  
  const glEquityParent = await prisma.chartOfAccount.findUnique({
    where: { accountCode: '300500' }
  });

  // Reclassify Insurance GL Account (if exists)
  const insuranceGL = await prisma.chartOfAccount.findFirst({
    where: {
      OR: [
        { accountCode: '401003' },
        { accountName: 'Loan insurance fees' }
      ]
    }
  });

  if (insuranceGL && glLiabilityParent) {
    console.log(`Moving Insurance GL Account (${insuranceGL.accountCode}) to Liabilities...`);
    await prisma.chartOfAccount.update({
      where: { id: insuranceGL.id },
      data: {
        accountCode: '200601',
        fullCode: '200601  Loan insurance fees',
        ledgerType: 'LIABILITIES',
        parentId: glLiabilityParent.id,
        level: glLiabilityParent.level + 1
      }
    });
    console.log('✅ Insurance GL Account reclassified.');
  }

  // Reclassify Shares GL Account (if exists)
  const sharesGL = await prisma.chartOfAccount.findFirst({
    where: {
      OR: [
        { accountCode: '401004' },
        { accountName: 'Loan share capital' }
      ]
    }
  });

  if (sharesGL && glEquityParent) {
    console.log(`Moving Shares GL Account (${sharesGL.accountCode}) to Equity...`);
    await prisma.chartOfAccount.update({
      where: { id: sharesGL.id },
      data: {
        accountCode: '300503',
        fullCode: '300503  Loan share capital',
        ledgerType: 'EQUITY',
        parentId: glEquityParent.id,
        level: glEquityParent.level + 1
      }
    });
    console.log('✅ Shares GL Account reclassified.');
  }

  // Update 401000 name if it still says SOCIAL FUND
  const incomeParent = await prisma.chartOfAccount.findUnique({
    where: { accountCode: '401000' }
  });

  if (incomeParent && incomeParent.accountName === 'SOCIAL FUND') {
    await prisma.chartOfAccount.update({
      where: { id: incomeParent.id },
      data: {
        accountName: 'Loan related income',
        fullCode: '401000 Loan related income'
      }
    });
    console.log('✅ Updated 401000 GL name to "Loan related income".');
  }

  console.log('Process complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
