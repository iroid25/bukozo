import { db } from "../prisma/db.ts";

async function main() {
  await db.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "AssetApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "AssetTransferStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "FixedAsset"
      ADD COLUMN IF NOT EXISTS "officerName" TEXT,
      ADD COLUMN IF NOT EXISTS "approvalStatus" "AssetApprovalStatus" NOT NULL DEFAULT 'APPROVED',
      ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AssetTransfer" (
      "id" TEXT NOT NULL,
      "transferCode" TEXT NOT NULL,
      "sourceAssetId" TEXT NOT NULL,
      "targetAssetId" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "transferDate" TIMESTAMP(3) NOT NULL,
      "notes" TEXT,
      "branchId" TEXT,
      "status" "AssetTransferStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
      "requestedByUserId" TEXT NOT NULL,
      "approvedByUserId" TEXT,
      "approvedAt" TIMESTAMP(3),
      "rejectedByUserId" TEXT,
      "rejectedAt" TIMESTAMP(3),
      "rejectionReason" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "AssetTransfer_pkey" PRIMARY KEY ("id")
    );
  `);

  const indexStatements = [
    `CREATE UNIQUE INDEX IF NOT EXISTS "AssetTransfer_transferCode_key" ON "AssetTransfer"("transferCode");`,
    `CREATE INDEX IF NOT EXISTS "AssetTransfer_sourceAssetId_idx" ON "AssetTransfer"("sourceAssetId");`,
    `CREATE INDEX IF NOT EXISTS "AssetTransfer_targetAssetId_idx" ON "AssetTransfer"("targetAssetId");`,
    `CREATE INDEX IF NOT EXISTS "AssetTransfer_branchId_idx" ON "AssetTransfer"("branchId");`,
    `CREATE INDEX IF NOT EXISTS "AssetTransfer_status_idx" ON "AssetTransfer"("status");`,
    `CREATE INDEX IF NOT EXISTS "AssetTransfer_transferDate_idx" ON "AssetTransfer"("transferDate");`,
  ];

  for (const statement of indexStatements) {
    await db.$executeRawUnsafe(statement);
  }

  console.log("Current asset ledger schema setup completed.");
}

main()
  .catch((error) => {
    console.error("Failed to set up current asset ledger schema:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
