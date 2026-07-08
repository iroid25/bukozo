import { PrismaClient, AccountLedgerType } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const assets: Record<string, string> = {
    "101000": "Current Assets",
    "101100": "cash at hand",
    "101200": "postbank",
    "101300": "centenary bank",
    "101400": "stanbic bank",
    "101500": "mobile money float",
    "101600": "Receivables",
    "101700": "founders account",
    "101800": "advances",
    "101900": "stock",
    "101910": "loans",
    "102000": "Investments",
    "102100": "share investments",
    "102200": "other investments",
    "103000": "Fixed Assets",
    "103100": "office equipment",
    "103200": "other equipment",
    "103300": "software"
  }

  console.log("🚀 Starting Asset COA Sync...")

  for (const [code, name] of Object.entries(assets)) {
    const level = code.endsWith("000") ? 1 : 2
    const parentCode = code.endsWith("000") ? null : code.substring(0, 3) + "000"

    let parentId = null
    if (parentCode) {
      const parent = await prisma.chartOfAccount.findUnique({ where: { accountCode: parentCode } })
      parentId = parent?.id || null
    }

    await prisma.chartOfAccount.upsert({
      where: { accountCode: code },
      update: {
        accountName: name,
        parentId: parentId,
        level: level,
        ledgerType: AccountLedgerType.ASSETS,
        isActive: true
      },
      create: {
        accountCode: code,
        accountName: name,
        fullCode: `${code} ${name}`,
        parentId: parentId,
        level: level,
        ledgerType: AccountLedgerType.ASSETS,
        isActive: true,
        isSystem: false,
        balance: 0,
        currency: "UGX"
      }
    })
    console.log(`✅ Synced ${code}: ${name}`)
  }

  console.log("✨ Asset COA Sync Complete!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
