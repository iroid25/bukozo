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

    const baseWhere: any = {
      type: "DEPOSIT",
      status: TransactionStatus.COMPLETED,
    };

    if (user.role !== UserRole.ADMIN && user.branchId) {
      baseWhere.branchId = user.branchId;
    }

    const [todayStats, monthStats, totalStats] = await Promise.all([
      db.transaction.aggregate({
        where: {
          ...baseWhere,
          transactionDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.transaction.aggregate({
        where: {
          ...baseWhere,
          transactionDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.transaction.aggregate({
        where: baseWhere,
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
