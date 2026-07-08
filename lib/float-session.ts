import { db } from "@/prisma/db";

export type FloatOpeningBalanceSource = {
  action: string;
  balance: number;
  timestamp: Date;
};

export async function getFloatOpeningBalanceSource(userFloatId: string): Promise<FloatOpeningBalanceSource | null> {
  const logs = await db.auditLog.findMany({
    where: {
      entityType: "UserFloat",
      entityId: userFloatId,
      action: {
        in: ["DAY_STARTED", "FLOAT_ALLOCATED_WITH_VAULT"],
      },
    },
    orderBy: {
      timestamp: "desc",
    },
    take: 10,
  });

  for (const log of logs) {
    try {
      const details =
        typeof log.details === "string" ? JSON.parse(log.details) : null;
      if (typeof details?.startBalance === "number") {
        return {
          action: log.action,
          balance: Number(details.startBalance) || 0,
          timestamp: log.timestamp,
        };
      }
      if (typeof details?.floatBalanceAfter === "number") {
        return {
          action: log.action,
          balance: Number(details.floatBalanceAfter) || 0,
          timestamp: log.timestamp,
        };
      }
    } catch {
      // Ignore malformed details and keep searching
    }
  }

  return null;
}
