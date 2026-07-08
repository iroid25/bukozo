import { db } from "@/prisma/db";

export type FingerprintAction = "ENROLL" | "VERIFY_SUCCESS" | "VERIFY_FAIL";

export async function updateMemberFingerprintMetadata(args: {
  memberId: string;
  template: string;
  quality: number | null;
}) {
  await db.$executeRaw`
    UPDATE "Member"
    SET
      "fingerprintTemplate" = ${args.template},
      "fingerprintQuality" = ${args.quality},
      "fingerprintEnrolledAt" = ${new Date()}
    WHERE "id" = ${args.memberId}
  `;
}

export async function insertFingerprintLog(args: {
  memberId: string;
  action: FingerprintAction;
  quality?: number | null;
  score?: number | null;
  ipAddress?: string | null;
}) {
  await db.$executeRaw`
    INSERT INTO "FingerprintLog" (
      "memberId",
      "action",
      "quality",
      "score",
      "ipAddress",
      "createdAt"
    ) VALUES (
      ${args.memberId},
      ${args.action},
      ${args.quality ?? null},
      ${args.score ?? null},
      ${args.ipAddress ?? null},
      ${new Date()}
    )
  `;
}

export async function loadFingerprintMemberRow(memberKey: string) {
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      memberNumber: string;
      fingerprintTemplate: string | null;
      fingerprintQuality: number | null;
      fingerprintEnrolledAt: Date | null;
      fingerprintUpdatedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      memberName: string | null;
      email: string | null;
      balance: number;
    }>
  >`
    SELECT
      m."id",
      m."memberNumber",
      m."fingerprintTemplate",
      m."fingerprintQuality",
      m."fingerprintEnrolledAt",
      m."fingerprintUpdatedAt",
      m."createdAt",
      m."updatedAt",
      u."name" AS "memberName",
      u."email",
      COALESCE(
        (
          SELECT SUM(a."balance")
          FROM "Account" a
          WHERE a."memberId" = m."id"
            AND (a."status" IS NULL OR a."status" = 'ACTIVE')
        ),
        0
      ) AS "balance"
    FROM "Member" m
    LEFT JOIN "User" u ON u."id" = m."userId"
    WHERE m."id" = ${memberKey}
       OR m."memberNumber" = ${memberKey}
       OR m."userId" = ${memberKey}
    LIMIT 1
  `;

  return rows[0] ?? null;
}
