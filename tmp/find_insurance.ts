import { db } from "../prisma/db";

async function findInsurance() {
  const accounts = await db.chartOfAccount.findMany({ 
    where: { accountName: { contains: 'Insurance', mode: 'insensitive' } } 
  });
  const categories = await db.budgetCategory.findMany({ 
    where: { name: { contains: 'Insurance', mode: 'insensitive' } } 
  });
  const configs = await db.systemConfiguration.findMany({ 
    where: { 
      OR: [
        { key: { contains: 'insurance', mode: 'insensitive' } },
        { value: { contains: 'Insurance', mode: 'insensitive' } }
      ]
    } 
  });

  console.log('--- Chart of Accounts ---');
  console.log(JSON.stringify(accounts, null, 2));
  console.log('--- Budget Categories ---');
  console.log(JSON.stringify(categories, null, 2));
  console.log('--- System Configurations ---');
  console.log(JSON.stringify(configs, null, 2));
}

findInsurance();
