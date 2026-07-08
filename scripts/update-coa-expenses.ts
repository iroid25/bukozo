import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const EXPENSE_CATEGORIES = [
    "OFFICE STATIONERY",
    "BOOKS OF ACCOUNTS",
    "POLICY DOCUMENTS",
    "UTILITIES",
    "MAINTENANCE",
    "SALARIES AND WAGES",
    "NSSF",
    "PAYE",
    "STAFF INCENTIVES",
    "ADMINISTRATION ALLOWANCES",
    "ADMINISTRATION COSTS",
    "TRANSPORT AND TRAVEL COSTS",
    "MEETINGS",
    "COMMUNICATION",
    "TRAININGS",
    "EXCHANGE VISITS EXPENSE",
    "SUBSCRIPTIONS TO ORGANIZATIONS",
    "LEGAL COSTS",
    "FINANCIAL COSTS",
    "PUBLIC RELATIONS",
    "PUBLICITY AND ADVERTISEMENTS",
    "ENTERTAINMENT",
    "PROJECTS EXPENSES",
    "LOAN RELATED EXPENSES",
    "DIVIDENDS",
    "SOFTWARE EXPENSES",
    "HEALTH AND SANITATION",
    "DEPRECIATION EXPENSES",
    "CALENDARS",
    "WEBSITE EXPENSES",
    "THANKS GIVING EXPENSES",
    "RENT",
    "CONSTRUCTION COSTS",
    "INTEREST PAYMENTS"
];

// Map old prefixes that had significant data to new prefixes
const MIGRATION_MAPPING: { [oldPrefix: string]: string } = {
    "5005": "5001", // Printing and Stationary -> Office Stationery
    "5007": "5006", // Salaries and Wages -> Salaries and Wages
    "5008": "5013", // Meetings -> Meetings
    "5002": "5019", // Financial Costs -> Financial Costs
    "5009": "5028", // Depreciation -> Depreciation Expenses
};

async function updateExpenses() {
    console.log('🔄 Restructuring Expenses COA...');

    try {
        const mainExpenses = await db.chartOfAccount.findFirst({ where: { accountCode: '500000' } });
        if (!mainExpenses) {
            console.error('❌ Main Expenses account 500000 not found.');
            return;
        }

        // 1. Rename any existing accounts that shouldn't conflict with our loop.
        // E.g., if there's an existing 500100 (Written Off Loans), we should temporarily park it so we don't hit unique constraint when making Office Stationery.
        console.log('--- Parking existing accounts out of the way ---');
        const existingAccounts = await db.chartOfAccount.findMany({
             where: { 
                 accountCode: { startsWith: '50' },
                 level: { gt: 1 } 
             }
        });
        
        // Loop through all existing 500xxx parents (Level 2) and suffix them with 'TEMP' in their code if they conflict with our new index.
        for (const act of existingAccounts) {
               if (act.accountCode.length === 6 && act.accountCode.endsWith('00') && act.accountCode !== '500000') {
                     await db.chartOfAccount.update({
                         where: { id: act.id },
                         data: { accountCode: `TEMP_${act.accountCode}` }
                     });
               }
        }

        // 2. Create / Re-instate the 34 parent categories exactly
        console.log('--- Establishing the 34 new Categories ---');
        const newParents: { [prefix: string]: string } = {};

        for (let i = 0; i < EXPENSE_CATEGORIES.length; i++) {
            const prefixVal = String(i + 1).padStart(2, '0');
            const newCode = `50${prefixVal}00`; // 500100, 500200 ... 503400
            const newName = EXPENSE_CATEGORIES[i];
            
            // Look for existing TEMP parent
            let parent = await db.chartOfAccount.findFirst({ where: { accountCode: `TEMP_${newCode}` } });
            
            if (parent) {
                 parent = await db.chartOfAccount.update({
                      where: { id: parent.id },
                      data: {
                          accountCode: newCode,
                          accountName: newName,
                          fullCode: `${newCode}  ${newName}`,
                          category: newName
                      }
                 });
                 console.log(`Re-instated parent ${newCode} ${newName}`);
            } else {
                 parent = await db.chartOfAccount.create({
                     data: {
                         accountCode: newCode,
                         accountName: newName,
                         fullCode: `${newCode}  ${newName}`,
                         ledgerType: 'EXPENDITURES',
                         debitCredit: 'DR',
                         isActive: true,
                         isSystem: true,
                         level: 2,
                         parentId: mainExpenses.id,
                         category: newName
                     }
                 });
                 console.log(`Created new parent ${newCode} ${newName}`);
            }
            newParents[`50${prefixVal}`] = parent.id;
        }

        // Clean up remaining orphans (e.g., parents that existed previously but are no longer in our 1-34 list)
        // Actually, we'll map them first, then park them under a new "509900 OTHER EXPENSES" block if needed.
        let otherExpensesParent = await db.chartOfAccount.findFirst({ where: { accountCode: '509900' } });
        if (!otherExpensesParent) {
              otherExpensesParent = await db.chartOfAccount.create({
                     data: {
                         accountCode: '509900',
                         accountName: 'OTHER EXPENSES / LEGACY',
                         fullCode: '509900  OTHER EXPENSES / LEGACY',
                         ledgerType: 'EXPENDITURES',
                         debitCredit: 'DR',
                         isActive: true,
                         level: 2,
                         parentId: mainExpenses.id,
                     }
              });
        }

        // 3. Remap children according to MIGRATION_MAPPING
        // E.g., anything starting with TEMP_5009 -> move to 5028. Sub-accounts starting with 5009 -> change to 5028
        for (const [oldPref, newPref] of Object.entries(MIGRATION_MAPPING)) {
            console.log(`Mapping ${oldPref}xxx to ${newPref}xxx...`);
            
            // Sub-accounts aren't TEMP_ prefixed, only parents are.
            const subAccounts = await db.chartOfAccount.findMany({ 
                 where: { accountCode: { startsWith: oldPref, not: `${oldPref}00` } } 
            });

            for (const subAct of subAccounts) {
                const suffix = subAct.accountCode.substring(4);
                const newCode = `${newPref}${suffix}`;
                console.log(`   Moving subaccount ${subAct.accountCode} to ${newCode}`);
                await db.chartOfAccount.update({
                      where: { id: subAct.id },
                      data: {
                          accountCode: newCode,
                          fullCode: `${newCode}  ${subAct.accountName}`,
                          parentId: newParents[newPref]
                      }
                });
            }
        }

        // 4. Any remaining TEMP_ parents that weren't mapped, move them out of the way to 5099xx and keep children
        const leftoverParents = await db.chartOfAccount.findMany({ where: { accountCode: { startsWith: 'TEMP_' } } });
        let legacyCounter = 1;
        for (const leftover of leftoverParents) {
             const originalPrefix = leftover.accountCode.replace('TEMP_', '').substring(0, 4); // "5001"
             
             // Did we already map this? If so, its children were extracted above. The parent itself should just be deleted if it has no children.
             const numChildren = await db.chartOfAccount.count({ where: { parentId: leftover.id } });
             if (numChildren === 0) {
                   await db.chartOfAccount.delete({ where: { id: leftover.id } });
                   continue;
             }
             
             // Assign a safe 508XXX or 509XXX block for legacy unmapped accounts to keep them isolated but intact
             const legacyPref = `50${90 - legacyCounter}`; // e.g., 5089, 5088...
             await db.chartOfAccount.update({
                 where: { id: leftover.id },
                 data: { accountCode: `${legacyPref}00`, fullCode: `${legacyPref}00  ${leftover.accountName}`, parentId: mainExpenses.id }
             });
             
             // Update any children sequentially
             const children = await db.chartOfAccount.findMany({ where: { parentId: leftover.id } });
             for (let j = 0; j < children.length; j++) {
                 const cPrefix = String(j + 1).padStart(2, '0');
                 await db.chartOfAccount.update({
                     where: { id: children[j].id },
                     data: { accountCode: `${legacyPref}${cPrefix}`, fullCode: `${legacyPref}${cPrefix}  ${children[j].accountName}` }
                 });
             }
             legacyCounter++;
        }

        console.log('✅ Expenses restructuring completed!');
    } catch (error) {
        console.error('❌ Error in Expenses DB restructuring:', error);
    } finally {
        await db.$disconnect();
    }
}

updateExpenses();
