import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const members = await prisma.member.findMany({
    where: {
      accounts: {
        some: {
          status: "ACTIVE",
        },
      },
    },
    include: {
      user: true,
      accounts: true,
    },
  });

  console.log(`Total members with active accounts: ${members.length}`);
  members.forEach((m) => {
    console.log(`Member: ${m.user.name} (#${m.memberNumber}) - Accounts: ${m.accounts.length}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
