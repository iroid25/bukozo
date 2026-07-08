import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const force = hasFlag("--force");

  if (!dryRun && !force) {
    console.log(
      "This is a destructive member reset. Re-run with --force to execute or --dry-run to preview."
    );
    process.exitCode = 1;
    return;
  }

  const [members, memberUsers] = await Promise.all([
    prisma.member.findMany({
      select: {
        id: true,
        userId: true,
        memberNumber: true,
      },
      orderBy: { memberNumber: "asc" },
    }),
    prisma.user.findMany({
      where: { role: UserRole.MEMBER },
      select: {
        id: true,
        email: true,
        phone: true,
      },
    }),
  ]);

  const memberIds = members.map((member) => member.id);
  const memberUserIds = memberUsers.map((user) => user.id);

  console.log(`Members to remove: ${members.length}`);
  console.log(`Member users to remove: ${memberUsers.length}`);

  if (dryRun) {
    console.log("Dry run only. No data was changed.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
    console.log("Deleting member-only blockers...");
    await tx.accountHold.deleteMany({
      where: { memberId: { in: memberIds } },
    });
    await tx.customerFeedback.deleteMany({
      where: { memberId: { in: memberIds } },
    });
    await tx.incomeRecord.deleteMany({
      where: { memberId: { in: memberIds } },
    });
    await tx.insuranceContribution.deleteMany({
      where: { memberId: { in: memberIds } },
    });
    await tx.smsLog.deleteMany({
      where: { memberId: { in: memberIds } },
    });
    await tx.withdrawalVerification.deleteMany({
      where: { memberId: { in: memberIds } },
    });

    console.log("Deleting member-owned rows...");
    await tx.member.deleteMany({
      where: { id: { in: memberIds } },
    });

    console.log("Deleting member user-linked rows...");
    await tx.notification.deleteMany({
      where: { userId: { in: memberUserIds } },
    });
    await tx.auditLog.deleteMany({
      where: { userId: { in: memberUserIds } },
    });

    console.log("Deleting member users...");
    await tx.user.deleteMany({
      where: {
        id: { in: memberUserIds },
        role: UserRole.MEMBER,
      },
    });
    },
    {
      timeout: 300000,
      maxWait: 10000,
    }
  );

  const [memberCount, memberUserCount] = await Promise.all([
    prisma.member.count(),
    prisma.user.count({ where: { role: UserRole.MEMBER } }),
  ]);

  console.log(`Remaining members: ${memberCount}`);
  console.log(`Remaining member users: ${memberUserCount}`);
  console.log("Member hard reset completed.");
}

main()
  .catch((error) => {
    console.error("Member reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
