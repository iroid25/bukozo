// lib/auditLog.ts
"use server";

import { db } from "@/prisma/db";
import type { AuditLogData } from "@/lib/lib/audit-constants";

// Create audit log entry
export async function createAuditLog(data: AuditLogData) {
  try {
    await db.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId || undefined,
        oldValue: data.oldValue || undefined,
        newValue: data.newValue || undefined,
        ipAddress: data.ipAddress || undefined,
        userAgent: data.userAgent || undefined,
        browser: data.browser || undefined,
        os: data.os || undefined,
        details: data.details || undefined,
      },
    });
  } catch (error) {
    console.error("Error creating audit log:", error);
    // Don't throw error to prevent breaking main operations
  }
}

// Batch create audit logs
export async function createAuditLogs(logs: AuditLogData[]) {
  try {
    await db.auditLog.createMany({
      data: logs.map((log) => ({
        userId: log.userId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId || undefined,
        oldValue: log.oldValue || undefined,
        newValue: log.newValue || undefined,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        browser: log.browser || undefined,
        os: log.os || undefined,
        details: log.details || undefined,
      })),
    });
  } catch (error) {
    console.error("Error creating audit logs:", error);
    // Don't throw error to prevent breaking main operations
  }
}

// Helper functions for specific entity types
export async function logUserAction(
  userId: string,
  action: string,
  targetUserId?: string,
  oldValue?: any,
  newValue?: any,
  details?: any,
  ipAddress?: string
) {
  await createAuditLog({
    userId,
    action,
    entityType: "User",
    entityId: targetUserId,
    oldValue,
    newValue,
    details,
    ipAddress,
  });
}

export async function logMemberAction(
  userId: string,
  action: string,
  memberId?: string,
  oldValue?: any,
  newValue?: any,
  details?: any,
  ipAddress?: string
) {
  await createAuditLog({
    userId,
    action,
    entityType: "Member",
    entityId: memberId,
    oldValue,
    newValue,
    details,
    ipAddress,
  });
}

export async function logAccountAction(
  userId: string,
  action: string,
  accountId?: string,
  oldValue?: any,
  newValue?: any,
  details?: any,
  ipAddress?: string
) {
  await createAuditLog({
    userId,
    action,
    entityType: "Account",
    entityId: accountId,
    oldValue,
    newValue,
    details,
    ipAddress,
  });
}

export async function logTransactionAction(
  userId: string,
  action: string,
  transactionId?: string,
  oldValue?: any,
  newValue?: any,
  details?: any,
  ipAddress?: string
) {
  await createAuditLog({
    userId,
    action,
    entityType: "Transaction",
    entityId: transactionId,
    oldValue,
    newValue,
    details,
    ipAddress,
  });
}

export async function logDepositAction(
  userId: string,
  action: string,
  depositId?: string,
  oldValue?: any,
  newValue?: any,
  details?: any,
  ipAddress?: string
) {
  await createAuditLog({
    userId,
    action,
    entityType: "Deposit",
    entityId: depositId,
    oldValue,
    newValue,
    details,
    ipAddress,
  });
}

export async function logWithdrawalAction(
  userId: string,
  action: string,
  withdrawalId?: string,
  oldValue?: any,
  newValue?: any,
  details?: any,
  ipAddress?: string
) {
  await createAuditLog({
    userId,
    action,
    entityType: "Withdrawal",
    entityId: withdrawalId,
    oldValue,
    newValue,
    details,
    ipAddress,
  });
}

export async function logLoanAction(
  userId: string,
  action: string,
  loanId?: string,
  oldValue?: any,
  newValue?: any,
  details?: any,
  ipAddress?: string
) {
  await createAuditLog({
    userId,
    action,
    entityType: "Loan",
    entityId: loanId,
    oldValue,
    newValue,
    details,
    ipAddress,
  });
}
