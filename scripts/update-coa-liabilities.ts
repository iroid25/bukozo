import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function updateLiabilities() {
  console.log('🔄 Restructuring Liabilities COA...');

  try {
    const mainLiabilities = await db.chartOfAccount.findFirst({ where: { accountCode: '200000' } });
    if (!mainLiabilities) {
      console.error('❌ Main Liabilities account 200000 not found.');
      return;
    }

    // 1. Remove old Founders A/C from Assets if it exists (might be 102012)
    const oldFounders = await db.chartOfAccount.findFirst({
        where: { accountCode: { startsWith: '102' }, accountName: { contains: 'FOUNDERS', mode: 'insensitive' } }
    });
    if (oldFounders) {
        console.log(`Deactivating old Founders A/C from Current Assets (${oldFounders.accountCode})`);
        await db.chartOfAccount.update({
            where: { id: oldFounders.id },
            data: { isActive: false }
        });
    }

    // 2. Create Current and Non-Current Liabilities
    const createOrGetParent = async (code: string, name: string) => {
        let parent = await db.chartOfAccount.findFirst({ where: { accountCode: code } });
        if (!parent) {
            console.log(`Creating parent category ${code} ${name}`);
            parent = await db.chartOfAccount.create({
                data: {
                    accountCode: code,
                    accountName: name,
                    fullCode: `${code}  ${name}`,
                    ledgerType: 'LIABILITIES',
                    debitCredit: 'CR',
                    isActive: true,
                    isSystem: true,
                    level: 2,
                    parentId: mainLiabilities.id,
                    category: name
                }
            });
        }
        return parent;
    };

    const currentLiabs = await createOrGetParent('201000', 'CURRENT LIABILITIES');
    const nonCurrentLiabs = await createOrGetParent('202000', 'NON-CURRENT LIABILITIES');

    // 3. Migrate Accounts
    const updateAccount = async (oldCodeStart: string, newCodeStart: string, parentId: string, level: number = 3) => {
        const accounts = await db.chartOfAccount.findMany({ 
            where: { accountCode: { startsWith: oldCodeStart } } 
        });

        for (const account of accounts) {
            // Re-generate the full code by swapping the prefix
            const suffix = account.accountCode.substring(oldCodeStart.length);
            const newCode = `${newCodeStart}${suffix}`;
            
            console.log(`Moving ${account.accountCode} (${account.accountName}) -> ${newCode}`);
            
            await db.chartOfAccount.update({
                where: { id: account.id },
                data: {
                    accountCode: newCode,
                    fullCode: `${newCode}  ${account.accountName}`,
                    parentId: parentId,
                    level: level,
                    ledgerType: 'LIABILITIES', // Ensure it is marked as liability
                    category: account.category || null,
                }
            });
        }
    };

    // --- Migrate to Current Liabilities (201000) ---
    console.log('--- Migrating to Current Liabilities ---');
    // Savings and Dividends
    await updateAccount('2001', '2014', currentLiabs.id); // Fixed Deposit / Junior
    await updateAccount('2002', '2011', currentLiabs.id); // Voluntary Savings
    await updateAccount('2003', '2012', currentLiabs.id); // Compulsory Savings
    await updateAccount('2004', '2015', currentLiabs.id); // Dividend Payable

    // --- Migrate to Non-Current Liabilities (202000) ---
    console.log('--- Migrating to Non-Current Liabilities ---');
    await updateAccount('2006', '2021', nonCurrentLiabs.id); // Loan Insurance
    await updateAccount('2007', '2022', nonCurrentLiabs.id); // Accumulated Depreciation
    await updateAccount('2008', '2023', nonCurrentLiabs.id); // External Loans
    await updateAccount('2009', '2024', nonCurrentLiabs.id); // Founders A/C (Liability side)

    // A specific fix: In `2001` we had two: `200100` and `200110`. 
    // They became `201400` and `201410`. That's fine.

    console.log('✅ Liabilities COA restructuring completed!');
  } catch (error) {
    console.error('❌ Error restructuring Liabilities COA:', error);
  } finally {
    await db.$disconnect();
  }
}

updateLiabilities();
