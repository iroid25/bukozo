import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
(async () => {
  // Test the exact search function logic
  const q = "KASITHU";
  const like = `%${q}%`;

  const members = await db.$queryRaw`
    SELECT DISTINCT ON (m."id")
      m."id" AS member_id,
      m."memberNumber" AS member_number,
      u."name" AS full_name,
      u."phone" AS phone,
      COALESCE(sa."accountNumber", sha."accountNumber", fd."accountNumber", a."accountNumber") AS account_number,
      CASE
        WHEN sa."accountNumber" IS NOT NULL THEN 'savings'
        WHEN sha."accountNumber" IS NOT NULL THEN 'shares'
        WHEN fd."accountNumber" IS NOT NULL THEN 'fixed'
        WHEN a."accountNumber" IS NOT NULL THEN 'general'
        ELSE 'member'
      END AS account_kind
    FROM "Member" m
    LEFT JOIN "User" u ON u."id" = m."userId"
    LEFT JOIN "SavingsAccount" sa ON sa."memberId" = m."id" AND (sa."accountNumber" ILIKE ${like})
    LEFT JOIN "ShareAccount" sha ON sha."memberId" = m."id" AND (sha."accountNumber" ILIKE ${like})
    LEFT JOIN "FixedDeposit" fd ON fd."memberId" = m."id" AND (fd."accountNumber" ILIKE ${like})
    LEFT JOIN "Account" a ON a."memberId" = m."id" AND (a."accountNumber" ILIKE ${like})
    WHERE
      m."memberNumber" ILIKE ${like}
      OR u."name" ILIKE ${like}
      OR u."phone" ILIKE ${like}
      OR sa."accountNumber" IS NOT NULL
      OR sha."accountNumber" IS NOT NULL
      OR fd."accountNumber" IS NOT NULL
      OR a."accountNumber" IS NOT NULL
    ORDER BY m."id", u."name" ASC NULLS LAST
    LIMIT 20
  `;
  console.log("Members:", (members as any[]).length);

  // Test institution search
  const institutions = await db.institution.findMany({
    where: {
      OR: [
        { institutionName: { contains: q, mode: "insensitive" } },
        { institutionNumber: { contains: q, mode: "insensitive" } },
        { institutionPhone: { contains: q, mode: "insensitive" } },
        { institutionEmail: { contains: q, mode: "insensitive" } },
        { primaryContactPerson: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      institutionNumber: true,
      institutionName: true,
      institutionPhone: true,
    },
    take: 20,
  });
  console.log("Institutions:", institutions.length);
  console.log(JSON.stringify(institutions, null, 2));

  // Test what the frontend actually calls
  const total = (members as any[]).length + institutions.length;
  console.log("Total results:", total);

  await db.$disconnect();
})();
