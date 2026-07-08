import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { startOfDay, endOfDay, subHours } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "TELLER") {
      return NextResponse.json({ success: false, error: "Unauthorized or not a teller" }, { status: 403 });
    }

    const tellerId = user.id;
    const branchId = user.branchId;
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const userFloat = await db.userFloat.findUnique({
      where: { userId: tellerId },
      include: { user: { select: { name: true, image: true } } },
    });

    const dailyTransactions = await db.transaction.findMany({
      where: { processedByUserId: tellerId, transactionDate: { gte: todayStart, lte: todayEnd }, status: TransactionStatus.COMPLETED },
    });

    const stats = {
      deposits: {
        amount: dailyTransactions.filter((t) => t.type === TransactionType.DEPOSIT).reduce((sum, t) => sum + t.amount, 0),
        count: dailyTransactions.filter((t) => t.type === TransactionType.DEPOSIT).length,
      },
      withdrawals: {
        amount: dailyTransactions.filter((t) => t.type === TransactionType.WITHDRAWAL).reduce((sum, t) => sum + Math.abs(t.amount), 0),
        count: dailyTransactions.filter((t) => t.type === TransactionType.WITHDRAWAL).length,
      },
      totalTransactions: dailyTransactions.length,
      uniquecustomers: new Set(dailyTransactions.map((t) => t.memberId || t.institutionId).filter(Boolean)).size,
    };

    const last24hStart = subHours(new Date(), 24);
    const hourlyActivityRaw = await db.transaction.findMany({
      where: { processedByUserId: tellerId, transactionDate: { gte: last24hStart }, status: TransactionStatus.COMPLETED },
      select: { transactionDate: true, amount: true, type: true },
    });

    const hourlyData = Array.from({ length: 24 }).map((_, i) => {
      const hourDate = subHours(new Date(), 23 - i);
      const hour = hourDate.getHours();
      const hourTransactions = hourlyActivityRaw.filter(
        (t) => new Date(t.transactionDate).getHours() === hour && new Date(t.transactionDate).toDateString() === hourDate.toDateString()
      );
      return {
        hour: `${hour}:00`,
        deposits: hourTransactions.filter((t) => t.type === TransactionType.DEPOSIT).reduce((sum, t) => sum + t.amount, 0),
        withdrawals: hourTransactions.filter((t) => t.type === TransactionType.WITHDRAWAL).reduce((sum, t) => sum + Math.abs(t.amount), 0),
      };
    });

    const recentTransactions = await db.transaction.findMany({
      where: { processedByUserId: tellerId },
      orderBy: { transactionDate: "desc" },
      take: 50,
      include: {
        member: { include: { user: { select: { name: true } } } },
        institution: { select: { institutionName: true } },
        account: { include: { accountType: { select: { name: true } } } },
      },
    });

    const pendingDisbursementsCount = await db.loan.count({ where: { allocatedTellerId: tellerId, status: "APPROVED" } });

    return NextResponse.json({
      success: true,
      data: {
        user: { name: user.name, role: user.role, image: user.image, branchId: user.branchId },
        userFloat,
        stats,
        hourlyData,
        recentTransactions,
        drawerBalance: userFloat?.balance || 0,
        pendingDisbursementsCount,
      },
    });
  } catch (error: any) {
    console.error("Error fetching teller dashboard data:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
