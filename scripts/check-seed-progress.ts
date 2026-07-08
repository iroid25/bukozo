import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.member.count();
  const userCount = await prisma.user.count({ where: { role: "MEMBER" } });
  console.log(`Current Member Count: ${count}`);
  console.log(`Current Member Users: ${userCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
