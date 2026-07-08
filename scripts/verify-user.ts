
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const phone = "+256781947238";
  console.log(`Searching for user with phone: ${phone}`);

  const user = await prisma.user.findFirst({
    where: { phone },
  });

  if (!user) {
    console.error("User not found!");
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user.id})`);
  console.log(`Current Status - Verified: ${user.isVerified}, Active: ${user.isActive}`);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      isActive: true, // Ensure active too
    },
  });

  console.log(`✅ User updated successfully!`);
  console.log(`New Status - Verified: ${updated.isVerified}, Active: ${updated.isActive}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
