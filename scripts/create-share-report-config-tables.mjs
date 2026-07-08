import { db } from "../prisma/db.ts";

async function main() {
  await db.$executeRawUnsafe(`
    ALTER TABLE "ShareAccount"
    ADD COLUMN IF NOT EXISTS "batchNumber" INTEGER
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ShareAccount_batchNumber_idx"
    ON "ShareAccount" ("batchNumber")
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ShareDormancyThreshold" (
      "id" TEXT PRIMARY KEY,
      "recentlyActiveDays" INTEGER NOT NULL DEFAULT 90,
      "moderatelyIdleDays" INTEGER NOT NULL DEFAULT 365,
      "inactiveDays" INTEGER NOT NULL DEFAULT 999,
      "dormantDays" INTEGER NOT NULL DEFAULT 1000,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const existing = await db.$queryRawUnsafe(`
    SELECT "id" FROM "ShareDormancyThreshold" WHERE "isActive" = TRUE LIMIT 1
  `);

  if (existing.length === 0) {
    await db.$executeRawUnsafe(`
      INSERT INTO "ShareDormancyThreshold" (
        "id", "recentlyActiveDays", "moderatelyIdleDays", "inactiveDays", "dormantDays", "isActive"
      ) VALUES (
        'share-dormancy-default',
        90,
        365,
        999,
        1000,
        TRUE
      )
    `);
  }
}

main()
  .then(async () => {
    await db.$disconnect();
    console.log("Share report config tables are ready.");
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
