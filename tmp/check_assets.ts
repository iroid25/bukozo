import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const accounts = await prisma.chartOfAccount.findMany({
    where: {
      accountCode: {
        startsWith: '1'
      }
    },
    select: {
      accountCode: true,
      accountName: true
    },
    orderBy: {
      accountCode: 'asc'
    }
  })
  accounts.slice(0, 50).forEach(a => console.log(`${a.accountCode}: ${a.accountName}`))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
