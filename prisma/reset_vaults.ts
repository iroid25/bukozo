import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log("Resetting vaults with default 60M balance...");
  
  // Update vaults that have exactly 60,000,000 balance
  const update = await prisma.vault.updateMany({
    where: {
      balance: 60000000
    },
    data: {
      balance: 0,
      physicalCash: 0
    }
  });

  console.log(`Successfully reset ${update.count} vaults from 60M to 0.`);
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
