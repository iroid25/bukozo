import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const vaults = await prisma.vault.findMany({
    include: {
      branch: true,
      custodian: true,
    }
  })
  console.log(JSON.stringify(vaults, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
