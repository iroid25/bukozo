-- Add fingerprint enrollment metadata to members
ALTER TABLE "Member"
ADD COLUMN IF NOT EXISTS "fingerprintQuality" INTEGER,
ADD COLUMN IF NOT EXISTS "fingerprintEnrolledAt" TIMESTAMP(3);

-- Log all fingerprint enrollment and verification events
CREATE TABLE IF NOT EXISTS "FingerprintLog" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "quality" INTEGER,
    "score" INTEGER,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FingerprintLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FingerprintLog_memberId_idx" ON "FingerprintLog"("memberId");
CREATE INDEX IF NOT EXISTS "FingerprintLog_action_idx" ON "FingerprintLog"("action");
CREATE INDEX IF NOT EXISTS "FingerprintLog_createdAt_idx" ON "FingerprintLog"("createdAt");

ALTER TABLE "FingerprintLog"
ADD CONSTRAINT "FingerprintLog_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
