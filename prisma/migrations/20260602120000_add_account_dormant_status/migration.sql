-- Add dormant status to generic accounts
ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'DORMANT';
