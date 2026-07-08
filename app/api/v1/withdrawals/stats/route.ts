import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Branch isolation for non-ADMIN users
    const branchFilter: any = {};
    if (user.role !== "ADMIN" && user.branchId) {
      branchFilter.account = { branchId: user.branchId };
    }

    const [todayData, monthData, totalData] = await Promise.all([
      db.withdrawal.aggregate({
        where: { 
          withdrawalDate: { gte: todayStart, lte: todayEnd },
          ...branchFilter,
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.withdrawal.aggregate({
        where: { 
          withdrawalDate: { gte: monthStart, lte: monthEnd },
          ...branchFilter,
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.withdrawal.aggregate({
        where: branchFilter,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        today: {
          amount: Number(todayData._sum.amount || 0),
          count: { id: todayData._count.id || 0 },
        },
        thisMonth: {
          amount: Number(monthData._sum.amount || 0),
          count: { id: monthData._count.id || 0 },
        },
        total: {
          amount: Number(totalData._sum.amount || 0),
          count: { id: totalData._count.id || 0 },
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching withdrawal statistics API:", error);
    return NextResponse.json(
      {
        success: false,
        data: {
          today: { amount: 0, count: { id: 0 } },
          thisMonth: { amount: 0, count: { id: 0 } },
          total: { amount: 0, count: { id: 0 } },
        },
        error: error.message || "Failed to fetch statistics",
      },
      { status: 500 }
    );
  }
}
