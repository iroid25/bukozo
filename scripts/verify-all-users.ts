
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting bulk verification of all users...");

  const result = await prisma.user.updateMany({
    where: {
      isVerified: false,
    },
    data: {
      isVerified: true,
      isActive: true,
    },
  });

  console.log(`✅ Update complete!`);
  console.log(`  - Verified ${result.count} previously unverified users.`);
  
  const totalVerified = await prisma.user.count({
    where: { isVerified: true }
  });
  console.log(`  - Total verified users in system: ${totalVerified}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
