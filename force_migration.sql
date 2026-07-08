-- Force migration by deleting all users with old role values
-- WARNING: This will delete users! Only run if you're okay with data loss

-- Delete users with old role values
DELETE FROM "User" WHERE role IN ('BRANCH_MANAGER', 'LOAN_OFFICER');

-- Verify deletion
SELECT COUNT(*) as remaining_users FROM "User";
