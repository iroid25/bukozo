# Role Renaming - IMPORTANT INSTRUCTIONS

## Problem
Your database has users with roles `BRANCH_MANAGER` and `LOAN_OFFICER`, but you want to rename them to `BRANCHMANAGER` and `LOANOFFICER` for routing purposes.

## Solution - Run these steps IN ORDER:

### Step 1: Connect to your database directly
Use Prisma Studio or a SQL client to connect to your Neon database.

### Step 2: Run this SQL to update existing data
```sql
-- First, add the new enum values
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BRANCHMANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'LOANOFFICER';

-- Update all existing users
UPDATE "User" SET role = 'BRANCHMANAGER' WHERE role = 'BRANCH_MANAGER';
UPDATE "User" SET role = 'LOANOFFICER' WHERE role = 'LOAN_OFFICER';
```

### Step 3: Update schema.prisma
Change the enum to:
```prisma
enum UserRole {
  ADMIN
  BRANCHMANAGER
  TELLER
  AGENT
  MEMBER
  ACCOUNTANT
  LOANOFFICER
  INSTITUTION
  AUDITOR
}
```

### Step 4: Push the schema
```bash
npx prisma db push
```

### Step 5: Generate Prisma Client
```bash
npx prisma generate
```

## Alternative: Keep BRANCH_MANAGER and LOAN_OFFICER

If the database migration is too risky, you can keep the current names and fix the routing issue differently by creating proper detail page routes.

**Current Status:** Schema is reverted to `BRANCH_MANAGER` and `LOAN_OFFICER` to prevent data loss.
