import { db } from "@/prisma/db";
import type { ActivityFilters, ActivityRecord, ActivityStats } from "./activity-types";
import { EMPTY_ACTIVITY_STATS } from "./activity-types";

function readObjectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function resolveActivityType(action: string) {
  if (action.includes("DEPOSIT")) return "DEPOSIT";
  if (action.includes("WITHDRAWAL")) return "WITHDRAWAL";
  if (action.includes("LOAN_REPAYMENT")) return "LOAN_REPAYMENT";
  if (action.includes("LOAN_APPLICATION")) return "LOAN_APPLICATION";
  if (action.includes("LOAN")) return "LOAN";
  if (action.includes("USER")) return "USER_MANAGEMENT";
  if (action.includes("ACCOUNT")) return "ACCOUNT_MANAGEMENT";
  if (action.includes("MEMBER")) return "MEMBER_MANAGEMENT";
  return "SYSTEM_ADMIN";
}

function resolveActivityStatus(action: string) {
  if (action.includes("PENDING") || action.includes("CREATED")) return "PENDING";
  if (action.includes("FAILED") || action.includes("REJECTED")) return "FAILED";
  if (action.includes("APPROVED")) return "APPROVED";
  if (action.includes("ACTIVE")) return "ACTIVE";
  if (action.includes("PROCESSING")) return "PROCESSING";
  return "COMPLETED";
}

function mapActivityRecord(log: any): ActivityRecord {
  let member: string | undefined;
  let amount: number | undefined;
  let reference: string | undefined;
  let channel: string | undefined;

  const newVal = readObjectValue(log.newValue);
  if (newVal) {
    const nestedMember = readObjectValue(newVal.member);
    if (nestedMember?.name && typeof nestedMember.name === "string") {
      member = nestedMember.name;
    }
    if (typeof newVal.amount === "number" || typeof newVal.amount === "string") {
      amount = Number(newVal.amount);
    }
    if (typeof newVal.transactionRef === "string" || typeof newVal.reference === "string") {
      reference = (newVal.transactionRef as string | undefined) || (newVal.reference as string | undefined);
    }
    if (typeof newVal.channel === "string") {
      channel = newVal.channel;
    }
    if (!member && typeof newVal.memberName === "string") {
      member = newVal.memberName;
    }
  }

  const type = resolveActivityType(log.action);
  const status = resolveActivityStatus(log.action);

  const rawDetails = log.details;
  const detailsString =
    typeof rawDetails === "string"
      ? rawDetails
      : rawDetails != null
        ? JSON.stringify(rawDetails)
        : null;

  return {
    id: log.id,
    user: log.user.name || "System",
    branchId: log.user.branchId || null,
    branchName: log.user.branch?.name || null,
    member,
    type,
    action: log.action.replace(/_/g, " ").toLowerCase(),
    description:
      detailsString ?? `${log.action.replace(/_/g, " ").toLowerCase()} - ${log.entityType}`,
    status,
    amount,
    reference,
    channel,
    ipAddress: log.ipAddress || undefined,
    createdAt: log.timestamp.toISOString(),
  };
}

function buildWhere(filters: ActivityFilters = {}) {
  const where: any = {};

  if (filters.branchId && filters.branchId !== "all") {
    where.user = { branchId: filters.branchId };
  }

  if (filters.activityType && filters.activityType !== "all") {
    const actionMap: Record<string, string[]> = {
      DEPOSIT: ["DEPOSIT_CREATED", "DEPOSIT_COMPLETED"],
      WITHDRAWAL: ["WITHDRAWAL_CREATED", "WITHDRAWAL_COMPLETED", "WITHDRAWAL_VERIFIED"],
      LOAN: ["LOAN_CREATED", "LOAN_APPROVED", "LOAN_DISBURSED"],
      LOAN_REPAYMENT: ["LOAN_REPAYMENT_CREATED", "LOAN_REPAYMENT_COMPLETED"],
      LOAN_APPLICATION: ["LOAN_APPLICATION_CREATED", "LOAN_APPLICATION_UPDATED"],
      USER_MANAGEMENT: ["USER_CREATED", "USER_UPDATED", "USER_DELETED", "USER_ROLE_CHANGED"],
      ACCOUNT_MANAGEMENT: ["ACCOUNT_CREATED", "ACCOUNT_UPDATED", "ACCOUNT_CLOSED"],
      MEMBER_MANAGEMENT: ["MEMBER_CREATED", "MEMBER_UPDATED", "MEMBER_APPROVED", "MEMBER_REJECTED"],
      SYSTEM_ADMIN: ["SYSTEM_CONFIG_UPDATED", "BACKUP_CREATED", "MAINTENANCE_MODE"],
    };

    const actions = actionMap[filters.activityType];
    if (actions) {
      where.action = { in: actions };
    }
  }

  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    if (filters.startDate) {
      where.timestamp.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.timestamp.lte = filters.endDate;
    }
  }

  return where;
}

export async function getActivityReports(filters: ActivityFilters = {}) {
  try {
    const { limit = 100, orderDirection = "desc" } = filters;
    const where = buildWhere(filters);

    const auditLogs = await db.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            role: true,
            email: true,
            branchId: true,
            branch: {
              select: {
                name: true,
                location: true,
              },
            },
          },
        },
      },
      orderBy: {
        timestamp: orderDirection,
      },
      take: limit,
    });

    return auditLogs.map(mapActivityRecord);
  } catch (error) {
    console.error("Error fetching activity reports:", error);
    return [];
  }
}

export async function getActivityStats(filters: ActivityFilters = {}) {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const baseWhere: any = buildWhere(filters);

    const [
      totalActivities,
      todayActivities,
      thisWeekActivities,
      thisMonthActivities,
      uniqueUsers,
      transactionValue,
      depositActivities,
      withdrawalActivities,
      loanActivities,
      loanRepaymentActivities,
      userMgmtActivities,
      accountMgmtActivities,
    ] = await Promise.all([
      db.auditLog.count({ where: baseWhere }),
      db.auditLog.count({
        where: {
          ...baseWhere,
          timestamp: {
            ...(baseWhere.timestamp || {}),
            gte: startOfDay,
          },
        },
      }),
      db.auditLog.count({
        where: {
          ...baseWhere,
          timestamp: {
            ...(baseWhere.timestamp || {}),
            gte: startOfWeek,
          },
        },
      }),
      db.auditLog.count({
        where: {
          ...baseWhere,
          timestamp: {
            ...(baseWhere.timestamp || {}),
            gte: startOfMonth,
          },
        },
      }),
      db.auditLog.findMany({
        where: baseWhere,
        select: {
          userId: true,
        },
        distinct: ["userId"],
      }),
      db.transaction.aggregate({
        where: {
          status: "COMPLETED",
          ...(filters.branchId && filters.branchId !== "all"
            ? { branchId: filters.branchId }
            : {}),
          ...(filters.startDate || filters.endDate
            ? {
                transactionDate: {
                  ...(filters.startDate ? { gte: filters.startDate } : {}),
                  ...(filters.endDate ? { lte: filters.endDate } : {}),
                },
              }
            : {}),
        },
        _sum: {
          amount: true,
        },
      }),
      db.auditLog.count({ where: { ...baseWhere, action: { contains: "DEPOSIT" } } }),
      db.auditLog.count({ where: { ...baseWhere, action: { contains: "WITHDRAWAL" } } }),
      db.auditLog.count({ where: { ...baseWhere, action: { contains: "LOAN" } } }),
      db.auditLog.count({ where: { ...baseWhere, action: { contains: "LOAN_REPAYMENT" } } }),
      db.auditLog.count({ where: { ...baseWhere, action: { contains: "USER" } } }),
      db.auditLog.count({ where: { ...baseWhere, action: { contains: "ACCOUNT" } } }),
    ]);

    return {
      totalActivities,
      todayActivities,
      thisWeekActivities,
      thisMonthActivities,
      uniqueUsers: uniqueUsers.length,
      totalTransactionValue: transactionValue._sum.amount || 0,
      deposits: depositActivities,
      withdrawals: withdrawalActivities,
      loans: loanActivities,
      loanRepayments: loanRepaymentActivities,
      userManagement: userMgmtActivities,
      accountManagement: accountMgmtActivities,
    };
  } catch (error) {
    console.error("Error fetching activity statistics:", error);
    return EMPTY_ACTIVITY_STATS;
  }
}
