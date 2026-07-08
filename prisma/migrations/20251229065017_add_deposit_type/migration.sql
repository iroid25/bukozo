-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('DIRECT', 'FEE_PAYMENT');

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "depositType" "DepositType" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "feeType" TEXT,
ADD COLUMN     "studentClass" TEXT,
ADD COLUMN     "studentName" TEXT,
ADD COLUMN     "studentYear" TEXT;

-- CreateIndex
CREATE INDEX "Deposit_depositType_idx" ON "Deposit"("depositType");
