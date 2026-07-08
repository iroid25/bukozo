import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, TransactionStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const whereClause: any = {
      transaction: {
        status: TransactionStatus.COMPLETED,
      },
    };

    // Branch isolation for non-ADMIN roles
    if (user.role !== UserRole.ADMIN) {
      if (!user.branchId) {
        console.warn("⚠️ [GET /deposits/stats] User has no branchId:", user.id);
      } else {
        whereClause.transaction = {
          ...whereClause.transaction,
          branchId: user.branchId,
        };
      }
    }

    const [todayStats, monthStats, totalStats] = await Promise.all([
      db.deposit.aggregate({
        where: {
          ...whereClause,
          depositDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.deposit.aggregate({
        where: {
          ...whereClause,
          depositDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.deposit.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      today: {
        amount: Number(todayStats._sum.amount || 0),
        count: todayStats._count,
      },
      thisMonth: {
        amount: Number(monthStats._sum.amount || 0),
        count: monthStats._count,
      },
      total: {
        amount: Number(totalStats._sum.amount || 0),
        count: totalStats._count,
      },
    });
  } catch (error: any) {
    console.error("Error fetching deposit statistics:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
