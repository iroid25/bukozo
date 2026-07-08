-- Safe migration script to rename user roles
-- This adds new values first, then updates data, then removes old values

-- Step 1: Add new enum values (safe - doesn't break existing data)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BRANCHMANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'LOANOFFICER';

-- Step 2: Update all existing users (safe - data migration)
UPDATE "User" SET role = 'BRANCHMANAGER' WHERE role = 'BRANCH_MANAGER';
UPDATE "User" SET role = 'LOANOFFICER' WHERE role = 'LOAN_OFFICER';

-- Step 3: Verify no users have old values
SELECT COUNT(*) as old_branch_managers FROM "User" WHERE role = 'BRANCH_MANAGER';
SELECT COUNT(*) as old_loan_officers FROM "User" WHERE role = 'LOAN_OFFICER';
-- Both should return 0

-- Step 4: After verification, you can drop old values
-- Note: PostgreSQL doesn't support removing enum values directly
-- You'll need to use Prisma's db push after updating the schema
