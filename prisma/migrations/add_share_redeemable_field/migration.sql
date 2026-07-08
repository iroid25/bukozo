-- Add isRedeemable field to ShareTransaction to track if shares can be sold
-- Shares from TRANSFER_IN (share account transfers) should not be redeemable

-- AlterTable
ALTER TABLE "ShareTransaction" ADD COLUMN "isRedeemable" BOOLEAN NOT NULL DEFAULT true;

-- Update existing TRANSFER_IN transactions to be non-redeemable
UPDATE "ShareTransaction" 
SET "isRedeemable" = false 
WHERE "transactionType" = 'TRANSFER_IN';
