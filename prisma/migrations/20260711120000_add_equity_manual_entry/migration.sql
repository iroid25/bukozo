-- CreateEnum
CREATE TYPE "EquityManualEntryType" AS ENUM ('STATUTORY_RESERVE', 'GRANT_DONATION');

-- CreateTable
CREATE TABLE "EquityManualEntry" (
    "id" TEXT NOT NULL,
    "type" "EquityManualEntryType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquityManualEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquityManualEntry_type_idx" ON "EquityManualEntry"("type");

-- CreateIndex
CREATE INDEX "EquityManualEntry_branchId_idx" ON "EquityManualEntry"("branchId");

-- CreateIndex
CREATE INDEX "EquityManualEntry_date_idx" ON "EquityManualEntry"("date");

-- CreateIndex
CREATE INDEX "EquityManualEntry_recordedByUserId_idx" ON "EquityManualEntry"("recordedByUserId");
