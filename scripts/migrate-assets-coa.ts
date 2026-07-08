import { db } from '../prisma/db';

async function migrateAssets() {
  console.log("🚀 Starting Asset Reorganization...");

  // 1. Get the target parents
  const rootAssets = await db.chartOfAccount.findUnique({ where: { accountCode: "100000" } });
  const fixedAssetsParent = await db.chartOfAccount.findUnique({ where: { accountCode: "101000" } });
  const currentAssetsParent = await db.chartOfAccount.findUnique({ where: { accountCode: "102000" } });

  if (!rootAssets || !fixedAssetsParent || !currentAssetsParent) {
    console.error("❌ Critical parent accounts missing. Please run seed-coa.ts first.");
    return;
  }

  // 2. Identify all ASSETS and move to correct parents
  const assets = await db.chartOfAccount.findMany({
    where: { 
      ledgerType: 'ASSETS',
      NOT: {
        accountCode: { in: ["100000", "101000", "102000"] }
      }
    }
  });

  console.log(`🔍 Found ${assets.length} asset accounts to reorganize.`);

  for (const asset of assets) {
    let targetParentId = currentAssetsParent.id; // Default to Current Assets
    
    // Logic to identify Fixed Assets
    const fixedAssetKeywords = ["LAND", "BUILDING", "MOTORCYCLE", "FURNITURE", "FIXED", "MACHINE", "VEHICLE", "COMPUTER", "EQUIPMENT", "OFFICE TOOLS", "ASSET"];
    const isFixed = fixedAssetKeywords.some(kw => asset.accountName.toUpperCase().includes(kw));

    if (isFixed) {
      targetParentId = fixedAssetsParent.id;
    }

    // Special cases that are definitely current
    const currentKeywords = ["CASH", "BANK", "LOAN", "MOBILE MONEY", "ADVANCE", "STOCK", "RECEIVABLE", "PETTY"];
    const isCurrent = currentKeywords.some(kw => asset.accountName.toUpperCase().includes(kw));
    
    if (isCurrent) {
        targetParentId = currentAssetsParent.id;
    }

    // Update the account
    await db.chartOfAccount.update({
      where: { id: asset.id },
      data: {
        parentId: targetParentId,
        level: 3 // They become Level 3 under the Level 2 categories
      }
    });

    console.log(`✅ Moved ${asset.accountCode} - ${asset.accountName} under ${targetParentId === fixedAssetsParent.id ? 'Fixed' : 'Current'} Assets`);
  }

  console.log("✨ Asset Migration Completed.");
}

migrateAssets()
  .catch(console.error)
  .finally(() => db.$disconnect());
