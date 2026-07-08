import { db } from "@/prisma/db";
import { TransactionType, UserRole } from "@prisma/client";

export async function validateStaffLimits(
  userId: string,
  amount: number,
  type: TransactionType
) {
  try {
    // 1. Fetch user role
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return { ok: false, error: "User not found" };
    }

    // 2. Fetch limits for this role
    const limits = await db.staffLimit.findUnique({
      where: { role: user.role },
    });

    // If no limits defined or inactive, skip validation
    if (!limits || !limits.isActive) {
      return { ok: true };
    }

    // 3. Per-Transaction Limit Check
    if (amount > limits.perTransactionLimit) {
      return {
        ok: false,
        error: `Transaction amount (${amount.toLocaleString()}) exceeds your per-transaction limit of ${limits.perTransactionLimit.toLocaleString()}`,
      };
    }

    // 4. Daily Limit Check
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const totalToday = await db.transaction.aggregate({
      where: {
        processedByUserId: userId,
        type,
        status: "COMPLETED",
        transactionDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const currentDailyTotal = totalToday._sum.amount || 0;
    const newTotal = currentDailyTotal + amount;

    if (newTotal > limits.dailyLimit) {
      return {
        ok: false,
        error: `Daily ${type.toLowerCase()} limit of ${limits.dailyLimit.toLocaleString()} reached. Currently processed today: ${currentDailyTotal.toLocaleString()}`,
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("Limit validation error:", error);
    return { ok: false, error: "Internal error during limit validation" };
  }
}
