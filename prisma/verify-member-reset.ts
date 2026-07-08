import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [memberCount, memberUserCount, memberAccountCount] = await Promise.all([
    prisma.member.count(),
    prisma.user.count({ where: { role: UserRole.MEMBER } }),
    prisma.account.count({ where: { memberId: { not: null } } }),
  ]);

  console.log(`Members: ${memberCount}`);
  console.log(`Member users: ${memberUserCount}`);
  console.log(`Accounts tied to members: ${memberAccountCount}`);

  if (memberCount === 0 && memberUserCount === 0) {
    console.log("Verification passed.");
    return;
  }

  console.log("Verification failed.");
  process.exitCode = 1;
}

main().finally(async () => {
  await prisma.$disconnect();
});
