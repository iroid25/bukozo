import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function updateEquity() {
  console.log('🔄 Restructuring Equity COA...');

  try {
    const mainEquity = await db.chartOfAccount.findFirst({ where: { accountCode: '300000' } });
    if (!mainEquity) {
      console.error('❌ Main Equity account 300000 not found.');
      return;
    }

    // 1. Rename existing parents if they match the old structure
    const updateParent = async (oldCode: string, newCode: string, newName: string) => {
        // Check if the NEW code already exists (from a previous partial run)
        let newParent = await db.chartOfAccount.findFirst({ where: { accountCode: newCode } });
        if (newParent) {
             console.log(`Parent category ${newCode} ${newName} already exists.`);
             return newParent;
        }

        let parent = await db.chartOfAccount.findFirst({ where: { accountCode: oldCode } });
        if (parent) {
            console.log(`Renaming parent category ${oldCode} -> ${newCode} ${newName}`);
            await db.chartOfAccount.update({
                where: { id: parent.id },
                data: {
                    accountCode: newCode,
                    accountName: newName,
                    fullCode: `${newCode}  ${newName}`,
                    category: newName
                }
            });
            return parent;
        } else {
            console.log(`Creating missing parent category ${newCode} ${newName}`);
            return await db.chartOfAccount.create({
                data: {
                    accountCode: newCode,
                    accountName: newName,
                    fullCode: `${newCode}  ${newName}`,
                    ledgerType: 'EQUITY',
                    debitCredit: 'CR',
                    isActive: true,
                    isSystem: true,
                    level: 2,
                    parentId: mainEquity.id,
                    category: newName
                }
            });
        }
    };

    // 2. Migrate Parents
    const statutoryReserves = await updateParent('300100', '301000', 'STATUTORY RESERVES');
    const grantsDonations = await updateParent('300300', '302000', 'GRANTS & DONATIONS');
    const retainedEarnings = await updateParent('300400', '303000', 'RETAINED EARNINGS');
    const shareCapital = await updateParent('300500', '304000', 'SHARE CAPITAL');

    // 3. Migrate Accounts under them
    const updateAccountsUnderPrefix = async (oldCodeStart: string, newCodeStart: string, parentId: string) => {
        const accounts = await db.chartOfAccount.findMany({ 
            where: { accountCode: { startsWith: oldCodeStart, not: oldCodeStart + '00' } } 
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
                    ledgerType: 'EQUITY', // Ensure it is marked as equity
                    category: account.category || null,
                }
            });
        }
    };

    console.log('--- Migrating to Statutory Reserves (301000) ---');
    await updateAccountsUnderPrefix('3001', '3010', statutoryReserves.id); 

    console.log('--- Migrating to Grants & Donations (302000) ---');
    await updateAccountsUnderPrefix('3003', '3020', grantsDonations.id);

    console.log('--- Migrating to Retained Earnings (303000) ---');
    await updateAccountsUnderPrefix('3004', '3030', retainedEarnings.id);

    console.log('--- Migrating to Share Capital (304000) ---');
    await updateAccountsUnderPrefix('3005', '3040', shareCapital.id);

    console.log('✅ Equity COA restructuring completed!');
  } catch (error) {
    console.error('❌ Error restructuring Equity COA:', error);
  } finally {
    await db.$disconnect();
  }
}

updateEquity();
