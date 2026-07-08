
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

// Manually load .env
const envPath = path.join(process.cwd(), '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const databaseUrlMatch = envContent.match(/^DATABASE_URL=['"]?([^'"]+)['"]?/m)

if (databaseUrlMatch) {
  process.env.DATABASE_URL = databaseUrlMatch[1]
  console.log('Successfully loaded DATABASE_URL from .env')
} else {
  console.error('Failed to find DATABASE_URL in .env')
  process.exit(1)
}

const prisma = new PrismaClient()

async function main() {
  const roles = await prisma.user.findMany({
    select: {
      role: true
    },
    distinct: ['role']
  })
  console.log('Roles in DB:', JSON.stringify(roles, null, 2))
  
  const dataEntries = await prisma.user.findMany({
    where: {
      role: {
        in: ['DATA_ENTRANT', 'DATAENTRANT'] as any
      }
    },
    select: {
      id: true,
      email: true,
      role: true
    }
  })
  console.log('Data Entrants in DB:', JSON.stringify(dataEntries, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
