
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@sacco.ug";
  console.log(`Updating user ${email}...`);
  
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { isVerified: true },
    });
    console.log("✅ User updated successfully:", user);
  } catch (error) {
    console.error("❌ Error updating user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
