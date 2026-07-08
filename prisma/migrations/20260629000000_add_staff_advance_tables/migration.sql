-- Create AdvanceType enum
DO $$ BEGIN
  CREATE TYPE "AdvanceType" AS ENUM ('STAFF', 'OFFICIAL', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create StaffAdvanceStatus enum
DO $$ BEGIN
  CREATE TYPE "StaffAdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create StaffAdvanceRequest table
CREATE TABLE IF NOT EXISTS "StaffAdvanceRequest" (
  "id"                  TEXT NOT NULL,
  "requestCode"         TEXT NOT NULL,
  "advanceType"         "AdvanceType" NOT NULL DEFAULT 'STAFF',
  "staffId"             TEXT,
  "staffName"           TEXT NOT NULL,
  "amount"              DOUBLE PRECISION NOT NULL,
  "reason"              TEXT NOT NULL,
  "installments"        INTEGER NOT NULL,
  "monthlyDeduction"    DOUBLE PRECISION NOT NULL,
  "repaymentStartMonth" TEXT NOT NULL,
  "notes"               TEXT,
  "status"              "StaffAdvanceStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById"        TEXT,
  "approvedAt"          TIMESTAMP(3),
  "rejectedById"        TEXT,
  "rejectedAt"          TIMESTAMP(3),
  "rejectionReason"     TEXT,
  "branchId"            TEXT,
  "assetId"             TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "initiatedByUserId"   TEXT NOT NULL,
  "outstandingBalance"  DOUBLE PRECISION NOT NULL,

  CONSTRAINT "StaffAdvanceRequest_pkey" PRIMARY KEY ("id")
);

-- Create StaffAdvanceRepayment table
CREATE TABLE IF NOT EXISTS "StaffAdvanceRepayment" (
  "id"               TEXT NOT NULL,
  "advanceId"        TEXT NOT NULL,
  "amount"           DOUBLE PRECISION NOT NULL,
  "notes"            TEXT,
  "recordedByUserId" TEXT NOT NULL,
  "paidAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StaffAdvanceRepayment_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on requestCode
CREATE UNIQUE INDEX IF NOT EXISTS "StaffAdvanceRequest_requestCode_key" ON "StaffAdvanceRequest"("requestCode");

-- Indexes for StaffAdvanceRequest
CREATE INDEX IF NOT EXISTS "StaffAdvanceRequest_staffId_idx"            ON "StaffAdvanceRequest"("staffId");
CREATE INDEX IF NOT EXISTS "StaffAdvanceRequest_initiatedByUserId_idx"  ON "StaffAdvanceRequest"("initiatedByUserId");
CREATE INDEX IF NOT EXISTS "StaffAdvanceRequest_status_idx"             ON "StaffAdvanceRequest"("status");
CREATE INDEX IF NOT EXISTS "StaffAdvanceRequest_branchId_idx"           ON "StaffAdvanceRequest"("branchId");
CREATE INDEX IF NOT EXISTS "StaffAdvanceRequest_createdAt_idx"          ON "StaffAdvanceRequest"("createdAt");

-- Indexes for StaffAdvanceRepayment
CREATE INDEX IF NOT EXISTS "StaffAdvanceRepayment_advanceId_idx"        ON "StaffAdvanceRepayment"("advanceId");
CREATE INDEX IF NOT EXISTS "StaffAdvanceRepayment_recordedByUserId_idx" ON "StaffAdvanceRepayment"("recordedByUserId");
CREATE INDEX IF NOT EXISTS "StaffAdvanceRepayment_paidAt_idx"           ON "StaffAdvanceRepayment"("paidAt");
