const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// Define starter sub-accounts for each EXPENSE parent that should have children
const EXPENSE_STARTERS = {
  '500100': ['PRINTING PAPER', 'PENS AND MARKERS', 'FILES AND FOLDERS', 'INK AND TONER'],
  '500200': ['RECEIPT BOOKS', 'LEDGER BOOKS', 'CASHBOOKS', 'REGISTERS'],
  '500300': ['POLICY DRAFTING', 'POLICY AMENDMENT', 'POLICY DOCUMENTS PRINTING'],
  '500400': ['ELECTRICITY', 'WATER', 'TV SUBSCRIPTION', 'INTERNET'],
  '500500': ['COMPUTER REPAIRS', 'FURNITURE REPAIRS', 'MOTORCYCLE REPAIRS', 'OFFICE RENOVATION', 'GENERATOR MAINTENANCE'],
  '500600': ['BASIC SALARY', 'OVERTIME PAY', 'SALARY ADVANCES', 'CASUAL LABOUR'],
  '500700': ['NSSF EMPLOYER CONTRIBUTION', 'NSSF EMPLOYEE CONTRIBUTION'],
  '500800': ['PAYE DEDUCTIONS'],
  '500900': ['STAFF WELFARE', 'STAFF LUNCH', 'STAFF SUPPER', 'STAFF IDENTITY CARDS'],
  '501000': ['BOARD ALLOWANCES', 'SUPERVISORY COMMITTEE ALLOWANCES', 'MANAGEMENT ALLOWANCES'],
  '501100': ['OFFICE SUPPLIES', 'CLEANING MATERIALS', 'SECURITY COSTS'],
  '501200': ['TRANSPORT LOCAL', 'TRANSPORT REGIONAL', 'TRANSPORT NATIONAL', 'FUEL', 'ACCOMMODATION', 'MEALS', 'OFF-STATION ALLOWANCE'],
  '501300': ['BOARD MEETINGS', 'COMMITTEE MEETINGS', 'AGM EXPENSES', 'STAFF MEETINGS'],
  '501400': ['AIRTIME', 'INTERNET SUBSCRIPTION', 'RADIO ANNOUNCEMENTS', 'POSTAL CHARGES'],
  '501500': ['INTERNAL TRAINING', 'EXTERNAL TRAINING', 'WORKSHOPS', 'SEMINARS'],
  '501600': ['LOCAL EXCHANGE VISITS', 'REGIONAL EXCHANGE VISITS', 'NATIONAL EXCHANGE VISITS'],
  '501700': ['UCSCU SUBSCRIPTION', 'KACCUS SUBSCRIPTION', 'OTHER SUBSCRIPTIONS'],
  '501800': ['COURT FEES', 'LAWYER FEES', 'BAILIFF COSTS', 'MEDIATION COSTS'],
  '501900': ['BANK CHARGES', 'INTEREST EXPENSE', 'LOAN PROCESSING COSTS'],
  '502000': ['CONDOLENCES', 'PRESENTS AND AWARDS', 'SOCIAL CONTRIBUTIONS', 'FUNDRAISING'],
  '502100': ['RADIO TALKSHOWS', 'SIGN POSTS', 'POSTERS AND BROCHURES', 'ADVERTS', 'MOBILISATION'],
  '502200': ['HOSPITALITY', 'WEDDINGS', 'PARTIES', 'PUBLIC HOLIDAYS'],
  '502300': ['HARDWARE EXPENSES', 'HONEY PROJECT', 'COFFEE PROJECT', 'WOODLOT PROJECT'],
  '502400': ['LOAN RECOVERY TRANSPORT', 'LOAN RECOVERY MEALS', 'LOAN RECOVERY AIRTIME', 'LOAN RECOVERY FUEL'],
  '502500': ['MEMBER DIVIDENDS', 'STAFF DIVIDENDS'],
  '502600': ['SOFTWARE LICENSES', 'SOFTWARE MAINTENANCE', 'SYSTEM UPGRADES'],
  '502700': ['FIRST AID SUPPLIES', 'SANITATION MATERIALS', 'HEALTH CHECKUPS'],
  '502800': ['DEPRECIATION ON MOTORCYCLE', 'DEPRECIATION ON FURNITURE', 'DEPRECIATION ON BUILDINGS', 'DEPRECIATION ON COMPUTERS', 'DEPRECIATION ON LAND', 'DEPRECIATION ON OTHER EQUIPMENT'],
  '502900': ['SACCO CALENDARS', 'WALL CALENDARS', 'DESK CALENDARS'],
  '503000': ['WEBSITE HOSTING', 'WEBSITE REDESIGN', 'DOMAIN RENEWAL'],
  '503100': ['THANKSGIVING EXPENSES', 'CHRISTMAS EXPENSES', 'EASTER EXPENSES'],
  '503200': ['OFFICE RENT', 'STORE RENT', 'LAND RENT'],
  '503300': ['BUILDING CONSTRUCTION', 'OFFICE RENOVATION', 'COMPOUND IMPROVEMENTS'],
  '503400': ['INTEREST ON EXTERNAL LOANS', 'INTEREST ON FIXED DEPOSITS', 'OTHER INTEREST PAYMENTS'],
};

// Define starter sub-accounts for each INCOME parent
const INCOME_STARTERS = {
  '401000': ['INTEREST ON LOANS', 'LOAN PROCESSING FEES', 'LOAN APPLICATION FEES', 'LOAN RECOVERY INCOME', 'OVERDRAFT FEES'],
  '402000': ['ACCOUNT OPENING FEES', 'ACCOUNT SERVICING FEES', 'STATEMENT CHARGES', 'SAVINGS WITHDRAWAL FEES'],
  '403000': ['RECEIPT BOOK SALES', 'STATIONERY ITEMS SALES'],
  '404000': ['SALE OF OLD FURNITURE', 'SALE OF OLD EQUIPMENT', 'SALE OF OLD MOTORCYCLE'],
  '405000': ['T-SHIRT SALES', 'BRANDED ITEMS SALES'],
  '406000': ['MOBILE MONEY COMMISSION', 'POS COMMISSION', 'AGENCY BANKING COMMISSION', 'OTHER COMMISSIONS'],
  '407000': ['ANNUAL SUBSCRIPTIONS', 'MONTHLY SUBSCRIPTIONS'],
  '408000': ['NEW MEMBER REGISTRATION', 'MEMBERSHIP RENEWAL'],
  '409000': ['HARDWARE PROJECT INCOME', 'HONEY PROJECT INCOME', 'COFFEE PROJECT INCOME', 'WOODLOT INCOME'],
  '410000': ['SOCIAL FUND CONTRIBUTIONS', 'WELFARE CONTRIBUTIONS'],
  '411000': ['LOAN DEFAULT PENALTIES', 'ABSENTEEISM PENALTIES', 'LATE COMING PENALTIES', 'INSUFFICIENT SHARES PENALTIES'],
  '412000': ['ACCOUNT SERVICING FEES', 'STATEMENT CHARGES', 'SAVINGS WITHDRAWAL FEES'],
  '413000': ['POSTBANK INTEREST', 'CENTENARY INTEREST', 'STANBIC INTEREST'],
  '414000': ['FIXED DEPOSIT INTEREST', 'SHARE INVESTMENT RETURNS'],
  '415000': ['FUNDRAISING EVENTS', 'DONATIONS RECEIVED'],
  '416000': ['STAFF INTERVIEW FEES', 'COMMITTEE INTERVIEW FEES'],
  '417000': ['INTERN CONTRIBUTIONS', 'INTERN FEES'],
  '418000': ['INSURANCE PREMIUMS', 'INSURANCE RECOVERY'],
  '419000': ['CONSTRUCTION FUND CONTRIBUTIONS'],
  '420000': ['WITHHOLDING TAX INCOME', 'TAX DEDUCTIONS INCOME'],
  '421000': ['RECOVERED CASH', 'RECOVERED ASSETS'],
};

async function main() {
  console.log('=== SEEDING STARTER SUB-ACCOUNTS ===\n');

  let created = 0;
  let skipped = 0;

  // Process EXPENSES
  console.log('--- EXPENSES ---');
  for (const [parentCode, children] of Object.entries(EXPENSE_STARTERS)) {
    const parent = await db.chartOfAccount.findFirst({ where: { accountCode: parentCode } });
    if (!parent) {
      console.log(`  Parent ${parentCode} not found, skipping`);
      continue;
    }

    // Check how many children already exist
    const existingCount = await db.chartOfAccount.count({ where: { parentId: parent.id } });

    // Find the next available suffix (start after existing children)
    let nextSuffix = existingCount + 1;

    for (const childName of children) {
      // Check if this exact name already exists under this parent
      const exists = await db.chartOfAccount.findFirst({
        where: {
          parentId: parent.id,
          accountName: { equals: childName, mode: 'insensitive' }
        }
      });

      if (exists) {
        skipped++;
        continue;
      }

      // Generate code: parentCode prefix (4 digits) + 2-digit suffix
      const prefix = parentCode.substring(0, 4);
      const suffix = String(nextSuffix).padStart(2, '0');
      const newCode = `${prefix}${suffix}`;

      // Check if code already taken
      const codeTaken = await db.chartOfAccount.findFirst({ where: { accountCode: newCode } });
      if (codeTaken) {
        nextSuffix++;
        // Try next suffix
        const suffix2 = String(nextSuffix).padStart(2, '0');
        const newCode2 = `${prefix}${suffix2}`;
        const codeTaken2 = await db.chartOfAccount.findFirst({ where: { accountCode: newCode2 } });
        if (codeTaken2) {
          nextSuffix++;
          continue; // Skip if still taken
        }
        await db.chartOfAccount.create({
          data: {
            accountCode: newCode2,
            accountName: childName,
            fullCode: `${newCode2}  ${childName}`,
            ledgerType: 'EXPENDITURES',
            debitCredit: 'DR',
            isActive: true,
            isSystem: true,
            level: 3,
            parentId: parent.id,
            category: parent.accountName,
          }
        });
        created++;
        nextSuffix++;
        continue;
      }

      await db.chartOfAccount.create({
        data: {
          accountCode: newCode,
          accountName: childName,
          fullCode: `${newCode}  ${childName}`,
          ledgerType: 'EXPENDITURES',
          debitCredit: 'DR',
          isActive: true,
          isSystem: true,
          level: 3,
          parentId: parent.id,
          category: parent.accountName,
        }
      });
      created++;
      nextSuffix++;
    }
    console.log(`  ${parentCode} ${parent.accountName}: seeded children`);
  }

  // Process INCOME
  console.log('\n--- INCOME ---');
  for (const [parentCode, children] of Object.entries(INCOME_STARTERS)) {
    const parent = await db.chartOfAccount.findFirst({ where: { accountCode: parentCode } });
    if (!parent) {
      console.log(`  Parent ${parentCode} not found, skipping`);
      continue;
    }

    const existingCount = await db.chartOfAccount.count({ where: { parentId: parent.id } });
    let nextSuffix = existingCount + 1;

    for (const childName of children) {
      const exists = await db.chartOfAccount.findFirst({
        where: {
          parentId: parent.id,
          accountName: { equals: childName, mode: 'insensitive' }
        }
      });

      if (exists) {
        skipped++;
        continue;
      }

      const prefix = parentCode.substring(0, 4);
      const suffix = String(nextSuffix).padStart(2, '0');
      const newCode = `${prefix}${suffix}`;

      const codeTaken = await db.chartOfAccount.findFirst({ where: { accountCode: newCode } });
      if (codeTaken) {
        nextSuffix++;
        const suffix2 = String(nextSuffix).padStart(2, '0');
        const newCode2 = `${prefix}${suffix2}`;
        const codeTaken2 = await db.chartOfAccount.findFirst({ where: { accountCode: newCode2 } });
        if (codeTaken2) { nextSuffix++; continue; }
        await db.chartOfAccount.create({
          data: {
            accountCode: newCode2,
            accountName: childName,
            fullCode: `${newCode2}  ${childName}`,
            ledgerType: 'INCOME',
            debitCredit: 'CR',
            isActive: true,
            isSystem: true,
            level: 3,
            parentId: parent.id,
            category: parent.accountName,
          }
        });
        created++;
        nextSuffix++;
        continue;
      }

      await db.chartOfAccount.create({
        data: {
          accountCode: newCode,
          accountName: childName,
          fullCode: `${newCode}  ${childName}`,
          ledgerType: 'INCOME',
          debitCredit: 'CR',
          isActive: true,
          isSystem: true,
          level: 3,
          parentId: parent.id,
          category: parent.accountName,
        }
      });
      created++;
      nextSuffix++;
    }
    console.log(`  ${parentCode} ${parent.accountName}: seeded children`);
  }

  console.log(`\n✅ Done! Created ${created} new sub-accounts, skipped ${skipped} duplicates.`);
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => db.$disconnect());
