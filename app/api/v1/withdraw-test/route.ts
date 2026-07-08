import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();

    const [withdrawals, todayData, monthData, totalData] = await Promise.all([
      db.withdrawal.findMany({
        include: {
          transaction: {
            select: {
              id: true, status: true, channel: true, transactionRef: true,
              description: true, externalReference: true,
            },
          },
          institution: {
            select: {
              id: true, institutionName: true,
              user: { select: { name: true, email: true, phone: true, image: true } },
            },
          },
          member: {
            select: {
              id: true, memberNumber: true,
              user: { select: { name: true, email: true, phone: true, image: true } },
            },
          },
          account: {
            select: {
              id: true, accountNumber: true,
              branch: { select: { name: true, location: true } },
              accountType: { select: { name: true } },
            },
          },
          handler: { select: { id: true, name: true, role: true } },
        },
        orderBy: { withdrawalDate: "desc" },
      }),
      db.withdrawal.aggregate({
        where: { withdrawalDate: { gte: startOfDay(now), lte: endOfDay(now) } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.withdrawal.aggregate({
        where: { withdrawalDate: { gte: startOfMonth(now), lte: endOfMonth(now) } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.withdrawal.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        withdrawals,
        statistics: {
          today: { amount: todayData._sum.amount || 0, count: { id: todayData._count.id || 0 } },
          thisMonth: { amount: monthData._sum.amount || 0, count: { id: monthData._count.id || 0 } },
          total: { amount: totalData._sum.amount || 0, count: { id: totalData._count.id || 0 } },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching withdrawal test data:", error);
    return NextResponse.json({ error: "Failed to fetch withdrawals" }, { status: 500 });
  }
}
