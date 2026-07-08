import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // List all users
    const allUsers = await prisma.$queryRaw`SELECT email, role FROM "User"`;
    console.log("All Users:", allUsers);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
