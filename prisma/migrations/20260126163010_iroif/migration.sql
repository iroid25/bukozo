/*
  Warnings:

  - The `details` column on the `AuditLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[transactionId]` on the table `LoanRepayment` will be added. If there are existing duplicate values, this will fail.
  - Made the column `memberId` on table `AccountHold` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'DATA_ENTRANT';

-- DropForeignKey
ALTER TABLE "AccountHold" DROP CONSTRAINT "AccountHold_memberId_fkey";

-- DropIndex
DROP INDEX "JournalEntry_entryNumber_key";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "expectedInterest" DOUBLE PRECISION,
ADD COLUMN     "fixingEndDate" TIMESTAMP(3),
ADD COLUMN     "fixingStartDate" TIMESTAMP(3),
ADD COLUMN     "fundingSourceAccountId" TEXT,
ADD COLUMN     "initialDepositReceiptNo" TEXT,
ADD COLUMN     "sharesCount" INTEGER;

-- AlterTable
ALTER TABLE "AccountHold" ALTER COLUMN "memberId" SET NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "userAgent" TEXT,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "entityType" DROP NOT NULL,
DROP COLUMN "details",
ADD COLUMN     "details" JSONB;

-- AlterTable
ALTER TABLE "ExpenditureRecord" ALTER COLUMN "categoryId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "FixedAsset" ADD COLUMN     "quantity" INTEGER DEFAULT 1,
ADD COLUMN     "receiptNo" TEXT;

-- AlterTable
ALTER TABLE "FixedDeposit" ADD COLUMN     "fundingSourceAccountId" TEXT,
ADD COLUMN     "totalInterestRealized" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "interestPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "penaltyPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "principalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "disbursementDate" DROP NOT NULL,
ALTER COLUMN "disbursementDate" DROP DEFAULT,
ALTER COLUMN "disbursedByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LoanRepayment" ADD COLUMN     "interestPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "penaltyPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "principalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "transactionId" TEXT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "status" "MemberStatus" NOT NULL DEFAULT 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordExpiryDays" INTEGER DEFAULT 90,
ADD COLUMN     "passwordLastChanged" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "requiresPasswordChange" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GlobalFeeConfiguration" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalFeeConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLimit" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "perTransactionLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalFeeConfiguration_key_key" ON "GlobalFeeConfiguration"("key");

-- CreateIndex
CREATE UNIQUE INDEX "StaffLimit_role_key" ON "StaffLimit"("role");

-- CreateIndex
CREATE INDEX "JournalEntry_entryNumber_idx" ON "JournalEntry"("entryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LoanRepayment_transactionId_key" ON "LoanRepayment"("transactionId");

-- AddForeignKey
ALTER TABLE "AccountHold" ADD CONSTRAINT "AccountHold_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
