const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Fixing MEMBER ACCOUNT INCOME Category ---');

  // Find the MEMBER ACCOUNT INCOME category
  let memberCategory = await prisma.budgetCategory.findFirst({
    where: { 
      OR: [
        { name: { equals: 'MEMBER ACCOUNT INCOME', mode: 'insensitive' } },
        { code: '402000' }
      ]
    }
  });

  if (memberCategory) {
    console.log(`Found category ID: ${memberCategory.id}, ParentID: ${memberCategory.parentId}`);
    
    // Unset parentId so it becomes a Main Category
    if (memberCategory.parentId !== null) {
      memberCategory = await prisma.budgetCategory.update({
        where: { id: memberCategory.id },
        data: { parentId: null }
      });
      console.log('Successfully unset parentId to make it a Main Category.');
    } else {
      console.log('Category is already a Main Category.');
    }
  } else {
    // Create it as a Main Category
    memberCategory = await prisma.budgetCategory.create({
      data: {
        name: "MEMBER ACCOUNT INCOME",
        code: "402000",
        kind: "INCOME",
        description: "Fees from member accounts (withdrawals, etc.)",
        isActive: true,
        parentId: null
      }
    });
    console.log(`Created Main Category ID: ${memberCategory.id}`);
  }

  // Set "Transaction Fees" or "Withdrawal Fee" as a specific item under it
  const existingFeeCat = await prisma.budgetCategory.findFirst({
    where: { name: 'Transaction Fees', kind: 'INCOME' }
  });

  if (existingFeeCat) {
    if (existingFeeCat.parentId !== memberCategory.id) {
      await prisma.budgetCategory.update({
        where: { id: existingFeeCat.id },
        data: { parentId: memberCategory.id, code: '402001' }
      });
      console.log('Moved "Transaction Fees" under MEMBER ACCOUNT INCOME');
    } else {
      console.log('"Transaction Fees" is already correctly nested.');
    }
  }

  const existingWithdrawalFee = await prisma.budgetCategory.findFirst({
    where: { name: 'Withdrawal Fee', kind: 'INCOME' }
  });

  if (existingWithdrawalFee) {
    if (existingWithdrawalFee.parentId !== memberCategory.id) {
       await prisma.budgetCategory.update({
        where: { id: existingWithdrawalFee.id },
        data: { parentId: memberCategory.id, code: '402002' }
       });
       console.log('Moved "Withdrawal Fee" under MEMBER ACCOUNT INCOME');
    }
  } else {
       await prisma.budgetCategory.create({
        data: {
           name: 'Withdrawal Fee',
           code: '402002',
           kind: 'INCOME',
           description: 'Explicit withdrawal fees',
           isActive: true,
           parentId: memberCategory.id
        }
       });
       console.log('Created "Withdrawal Fee" under MEMBER ACCOUNT INCOME');
  }

  console.log('--- Done ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
