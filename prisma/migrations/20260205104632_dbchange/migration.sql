/*
  Warnings:

  - A unique constraint covering the columns `[passwordResetToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MemberApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "AccountType" ADD COLUMN     "sharePrice" DOUBLE PRECISION DEFAULT 10000;

-- AlterTable
ALTER TABLE "LoanReschedule" ADD COLUMN     "loanOfficerId" TEXT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "approvalStatus" "MemberApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetExpires" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT;

-- CreateIndex
CREATE INDEX "Member_approvalStatus_idx" ON "Member"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanReschedule" ADD CONSTRAINT "LoanReschedule_loanOfficerId_fkey" FOREIGN KEY ("loanOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
