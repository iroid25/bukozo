// app/api/v1/deposits/statistics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { TransactionStatus } from "@prisma/client";

// GET /api/v1/deposits/statistics - Get deposit statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Statistics across ALL branches
    const [todayStats, monthStats, totalStats] = await Promise.all([
      db.deposit.aggregate({
        where: {
          transaction: {
            status: TransactionStatus.COMPLETED,
          },
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
          transaction: {
            status: TransactionStatus.COMPLETED,
          },
          depositDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.deposit.aggregate({
        where: {
          transaction: {
            status: TransactionStatus.COMPLETED,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      data: {
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
      },
    });
  } catch (error) {
    console.error("Error fetching deposit statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}