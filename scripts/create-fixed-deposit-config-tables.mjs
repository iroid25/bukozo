import { db } from "../prisma/db.ts";

const sql = `
CREATE TABLE IF NOT EXISTS "ConcentrationBand" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "minAmount" DOUBLE PRECISION NOT NULL,
  "maxAmount" DOUBLE PRECISION,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConcentrationBand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConcentrationBand_label_key" ON "ConcentrationBand"("label");
CREATE INDEX IF NOT EXISTS "ConcentrationBand_sortOrder_idx" ON "ConcentrationBand"("sortOrder");
CREATE INDEX IF NOT EXISTS "ConcentrationBand_isActive_idx" ON "ConcentrationBand"("isActive");

CREATE TABLE IF NOT EXISTS "MaturityAction" (
  "code" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaturityAction_pkey" PRIMARY KEY ("code")
);

CREATE INDEX IF NOT EXISTS "MaturityAction_sortOrder_idx" ON "MaturityAction"("sortOrder");
CREATE INDEX IF NOT EXISTS "MaturityAction_isActive_idx" ON "MaturityAction"("isActive");
`;

await db.$executeRawUnsafe(sql);
console.log("Created fixed deposit config tables.");
await db.$disconnect();
