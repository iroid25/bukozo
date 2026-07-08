const { PrismaClient } = require('@prisma/client');
const accountsData = require('../parsed_accounts.json');

const db = new PrismaClient();

function mapLedgerType(type) {
  const normalized = type.toUpperCase().trim();
  if (normalized === 'ASSETS') return 'ASSETS';
  if (normalized === 'LIABILITIES') return 'LIABILITIES';
  if (normalized === 'EQUITY') return 'EQUITY';
  if (normalized === 'INCOME') return 'INCOME';
  if (normalized === 'EXPENSES') return 'EXPENSES';
  return 'ASSETS'; // Default fallback
}

function parseAccountCode(fullCode) {
  const match = fullCode.match(/^(\d+)\s+(.+)$/);
  if (!match) return null;
  return { code: match[1], name: match[2].trim() };
}

function isNumericAccountCode(value) {
  return /^\d+$/.test(String(value || '').trim());
}

function determineLevel(code) {
  // Level 1: Main categories (e.g., 100000, 200000)
  if (code.endsWith('0000') && code.length === 6) return 1;
  // Level 2: Sub-categories (e.g., 101000, 102000)
  if (code.endsWith('000') && code.length === 6) return 2;
  // Level 3: Individual accounts (e.g., 101001, 102001)
  return 3;
}

function getParentCode(code, level) {
  if (level === 1) return null;
  if (level === 2) {
    // Parent is the main category (e.g., 101000 -> 100000)
    return code.substring(0, 1) + '00000';
  }
  if (level === 3) {
    // Parent is the sub-category (e.g., 101001 -> 101000)
    return code.substring(0, 3) + '000';
  }
  return null;
}

async function seedChartOfAccounts() {
  console.log('🌱 Seeding Chart of Accounts...');
  
  try {
    // First, check if accounts already exist
    const existingCount = await db.chartOfAccount.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing accounts. Skipping seed.`);
      console.log('   To re-seed, delete existing accounts first.');
      return;
    }

    const accounts = accountsData;
    let created = 0;
    let skipped = 0;

    // Create accounts in order (parents first)
  for (const account of accounts) {
    if (!isNumericAccountCode(account.accountCode)) {
      console.log(`⚠️  Skipping non-numeric account code: ${account.accountCode}`);
      skipped++;
      continue;
    }

    const parsed = parseAccountCode(account.accountCode);
    if (!parsed) {
      console.log(`⚠️  Skipping invalid account code: ${account.accountCode}`);
      skipped++;
      continue;
      }

      const { code, name } = parsed;
      const level = determineLevel(code);
      const parentCode = getParentCode(code, level);

      // Find parent if exists
      let parentId = null;
      if (parentCode) {
        const parent = await db.chartOfAccount.findFirst({
          where: { accountCode: parentCode }
        });
        if (parent) {
          parentId = parent.id;
        } else if (level > 1) {
          console.log(`⚠️  Parent not found for ${code} (expected ${parentCode}). Skipping.`);
          skipped++;
          continue;
        }
      }

      // Determine ledger type
      let ledgerType = 'ASSETS';
      if (account.ledgerType) {
        ledgerType = mapLedgerType(account.ledgerType);
      } else {
        // Infer from account code
        const firstDigit = code.charAt(0);
        if (firstDigit === '1') ledgerType = 'ASSETS';
        else if (firstDigit === '2') ledgerType = 'LIABILITIES';
        else if (firstDigit === '3') ledgerType = 'EQUITY';
        else if (firstDigit === '4') ledgerType = 'INCOME';
        else if (firstDigit === '5') ledgerType = 'EXPENSES';
      }

      try {
        await db.chartOfAccount.create({
          data: {
            accountCode: code,
            accountName: name,
            fullCode: account.accountCode,
            parentId,
            level,
            ledgerType,
            category: level === 2 ? name : null,
            product: account.product || null,
            currency: account.currency || 'UGX',
            debitCredit: account.debitCredit || null,
            isSystem: true,
            isActive: true,
          }
        });
        created++;
        
        if (created % 50 === 0) {
          console.log(`   Created ${created} accounts...`);
        }
      } catch (error) {
        console.error(`❌ Error creating account ${code}: ${error.message}`);
        skipped++;
      }
    }

    console.log(`\n✅ Chart of Accounts seeded successfully!`);
    console.log(`   Created: ${created} accounts`);
    console.log(`   Skipped: ${skipped} accounts`);
    
  } catch (error) {
    console.error('❌ Error seeding Chart of Accounts:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Run the seed
seedChartOfAccounts()
  .then(() => {
    console.log('✅ Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
