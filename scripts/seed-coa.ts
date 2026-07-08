import { PrismaClient, AccountLedgerType, AccountCategory } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Helper to determine account type from code range if not provided
function inferLedgerType(code: string): AccountLedgerType {
    const codeVal = parseInt(code);
    if (isNaN(codeVal)) return AccountLedgerType.ASSETS; // Default fallback

    if (codeVal >= 100000 && codeVal < 200000) return AccountLedgerType.ASSETS;
    if (codeVal >= 200000 && codeVal < 300000) return AccountLedgerType.LIABILITIES;
    if (codeVal >= 300000 && codeVal < 400000) return AccountLedgerType.EQUITY;
    if (codeVal >= 400000 && codeVal < 500000) return AccountLedgerType.INCOME;
    if (codeVal >= 500000 && codeVal < 600000) return AccountLedgerType.EXPENDITURES;
    
    return AccountLedgerType.ASSETS;
}

// Helper to map type string to Enum
function mapType(typeStr: string): AccountLedgerType {
  if (!typeStr) return AccountLedgerType.ASSETS; // Fallback will be handled by inferLedgerType if code is present
  switch (typeStr.toUpperCase()) {
    case 'ASSETS': return AccountLedgerType.ASSETS;
    case 'LIABILITIES': return AccountLedgerType.LIABILITIES;
    case 'EQUITY': return AccountLedgerType.EQUITY;
    case 'INCOME': return AccountLedgerType.INCOME;
    case 'EXPENDITURES': return AccountLedgerType.EXPENDITURES;
    default: return AccountLedgerType.ASSETS; // Fallback
  }
}

// Helper to map product/category
function mapCategory(productStr: string): AccountCategory | null {
  if (!productStr) return null;
  const p = productStr.toUpperCase();
  if (p.includes('SAVINGS')) return AccountCategory.SAVINGS;
  if (p.includes('SHARES')) return AccountCategory.SHARES;
  if (p.includes('FIXED DEPOSIT')) return AccountCategory.FIXED_DEPOSIT;
  return null;
}

function isNumericAccountCode(value: string): boolean {
  return /^\d+$/.test(String(value || '').trim());
}

// Parent account lookup map
function findParentCode(code: string, allCodes: Set<string>): string | null {
  if (code.length > 3) {
      // Try replacing last digit with 0
      let parent = code.substring(0, code.length - 1) + '0';
      if (allCodes.has(parent) && parent !== code) return parent;

      // Try replacing last 2 digits
      parent = code.substring(0, code.length - 2) + '00';
      if (allCodes.has(parent) && parent !== code) return parent;
      
      // Try replacing last 3 digits
      parent = code.substring(0, code.length - 3) + '000';
      if (allCodes.has(parent) && parent !== code) return parent;
      
      // Try replacing last 4 digits (for 6 digit codes like 100000)
      parent = code.substring(0, code.length - 4) + '0000';
      if (allCodes.has(parent) && parent !== code) return parent;
  }
  return null;
}

async function main() {
  console.log('Seeding Chart of Accounts from parsed_accounts.json...');

  const filePath = path.join(process.cwd(), 'parsed_accounts.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const rawData = JSON.parse(fileContent);

  // 1. Create all accounts first
  for (const item of rawData) {
    if (!item.accountCode || !isNumericAccountCode(item.accountCode)) continue;

    // Parse "Code  Name" format
    // Matches "100000  ASSETS" -> code="100000", name="ASSETS"
    const match = item.accountCode.match(/^(\d+)\s+(.+)$/);
    
    let code = "";
    let name = "";
    
    if (match) {
        code = match[1];
        name = match[2];
    } else {
        // Fallback for cases that might not match perfectly
        code = item.accountCode.split(/\s+/)[0];
        name = item.accountCode.substring(code.length).trim() || item.accountName;
    }

    if (!code) continue;

    // Determine type from item.ledgerType or infer from code
    let type = mapType(item.ledgerType);
    if ((!item.ledgerType || item.ledgerType === "") && code) {
        type = inferLedgerType(code);
    }

    const category = mapCategory(item.product);
    const fullCode = `${code}  ${name}`; 

    await prisma.chartOfAccount.upsert({
      where: { accountCode: code },
      update: {
        accountName: name,
        ledgerType: type,
        category: typeof category === 'string' ? category : null,
        product: item.product || null,
        description: item.product || null,
        fullCode: fullCode,
      },
      create: {
        accountCode: code,
        accountName: name,
        ledgerType: type,
        category: typeof category === 'string' ? category : null,
        product: item.product || null,
        description: item.product || null,
        fullCode: fullCode,
        level: 0, 
      },
    });
  }

  console.log('Accounts created. Linking parents...');

  // 2. Link parents
  const allAccounts = await prisma.chartOfAccount.findMany();
  const codeMap = new Set(allAccounts.map(a => a.accountCode));
  
  for (const acc of allAccounts) {
      const parentCode = findParentCode(acc.accountCode, codeMap);
      if (parentCode) {
          const parent = allAccounts.find(a => a.accountCode === parentCode);
          if (parent) {
              // Calculate level based on parent
              const newLevel = (parent.level || 0) + 1;
              
              await prisma.chartOfAccount.update({
                  where: { id: acc.id },
                  data: { 
                      parentId: parent.id,
                      level: newLevel 
                  }
              });
          }
      }
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
