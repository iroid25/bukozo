-- Manual migration to rename UserRole enum values
-- Run this when database is accessible

-- Step 1: Add new enum values
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BRANCHMANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'LOANOFFICER';

-- Step 2: Update all existing records
UPDATE "User" SET role = 'BRANCHMANAGER' WHERE role = 'BRANCH_MANAGER';
UPDATE "User" SET role = 'LOANOFFICER' WHERE role = 'LOAN_OFFICER';

-- Step 3: Create new enum without old values
CREATE TYPE "UserRole_new" AS ENUM (
  'ADMIN',
  'BRANCHMANAGER',
  'TELLER',
  'AGENT',
  'MEMBER',
  'ACCOUNTANT',
  'LOANOFFICER',
  'INSTITUTION',
  'AUDITOR'
);

-- Step 4: Alter column to use new enum
ALTER TABLE "User" ALTER COLUMN role TYPE "UserRole_new" USING (role::text::"UserRole_new");

-- Step 5: Drop old enum and rename new one
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
