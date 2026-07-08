const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Asset-COA Linkage Migration (JS)...");

  try {
    const assets = await prisma.fixedAsset.findMany({
      where: { accountId: null }
    });

    console.log(`🔍 Found ${assets.length} assets to link.`);

    for (const asset of assets) {
      console.log(`\n📦 Processing Asset: ${asset.assetName} (${asset.assetCode})`);

      // 1. Try to find an existing account in COA that matches
      let coaAccount = await prisma.chartOfAccount.findFirst({
        where: {
          OR: [
            { accountName: { contains: asset.assetName, mode: 'insensitive' } },
            { accountCode: { contains: asset.assetCode } }
          ]
        }
      });

      if (coaAccount) {
        console.log(`  ✅ Found existing COA account: ${coaAccount.accountName} (${coaAccount.accountCode})`);
      } else {
        console.log(`  ⚠️ No matching COA account found. Creating one...`);
        
        // Find parent based on category or type
        let parentCode = "103000"; // Default Fixed Assets (Corrected from 101000)
        const cat = (asset.category || "").toUpperCase();
        if (cat.includes("FURNITURE")) parentCode = "103100";
        else if (cat.includes("COMPUTER")) parentCode = "103100";
        else if (cat.includes("VEHICLE") || cat.includes("MOTOR")) parentCode = "103200";
        else if (cat.includes("BUILDING") || cat.includes("LAND")) parentCode = "103000";

        const parentAccount = await prisma.chartOfAccount.findUnique({ where: { accountCode: parentCode } });
        if (!parentAccount) {
          console.error(`  ❌ Parent account ${parentCode} not found. Skipping.`);
          continue;
        }

        // Generate Code
        const latestChild = await prisma.chartOfAccount.findFirst({
          where: { accountCode: { startsWith: parentCode }, level: parentAccount.level + 1 },
          orderBy: { accountCode: 'desc' }
        });

        let nextNum = 1;
        if (latestChild) {
          const suffix = latestChild.accountCode.substring(parentCode.length);
          if (suffix) {
            const parsed = parseInt(suffix);
            if (!isNaN(parsed)) nextNum = parsed + 1;
          }
        }
        const newCode = `${parentCode}${nextNum.toString().padStart(2, '0')}`;

        coaAccount = await prisma.chartOfAccount.create({
          data: {
            accountName: `${asset.assetName} (${asset.assetCode})`,
            accountCode: newCode,
            fullCode: newCode,
            ledgerType: "ASSETS",
            debitCredit: "DR",
            isActive: true,
            level: parentAccount.level + 1,
            parentId: parentAccount.id,
            category: asset.category,
            description: `Migrated Asset: ${asset.assetName}`
          }
        });
        console.log(`  ✅ Created new COA account: ${coaAccount.accountCode}`);
      }

      // 2. Map Depreciation Expense Account
      let depExpCode = "502800";
      if (coaAccount.accountCode.startsWith("1012")) depExpCode = "502801";
      else if (coaAccount.accountCode.startsWith("1013")) depExpCode = "502802";
      else if (coaAccount.accountCode.startsWith("1014")) depExpCode = "502804";
      else if (coaAccount.accountCode.startsWith("1015")) depExpCode = "502807";

      const depExpAccount = await prisma.chartOfAccount.findFirst({ where: { accountCode: depExpCode } });

      // 3. Update Asset
      await prisma.fixedAsset.update({
        where: { id: asset.id },
        data: {
          accountId: coaAccount.id,
          depreciationExpenseAccountId: depExpAccount ? depExpAccount.id : null
        }
      });

      console.log(`  ✨ Linkage successful.`);
    }

  } catch (error) {
    console.error(`  ❌ Error:`, error.message);
  } finally {
    await prisma.$disconnect();
    console.log("\n✨ Migration Completed.");
  }
}

main();
