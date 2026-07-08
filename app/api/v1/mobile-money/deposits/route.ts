import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;

    const whereClause: any = { channel: "MOBILE_MONEY" };

    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
      whereClause.account = { branchId: user.branchId };
    }

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    const [deposits, todayStats, monthStats, totalStats] = await Promise.all([
      db.deposit.findMany({
        where: whereClause,
        select: {
          id: true, transactionId: true, memberId: true, institutionId: true, accountId: true,
          amount: true, depositDate: true, handlerUserId: true, channel: true,
          mobileMoneyRef: true, depositorName: true,
          transaction: { select: { id: true, transactionRef: true, status: true, description: true } },
          member: { select: { id: true, memberNumber: true, user: { select: { id: true, name: true, email: true, phone: true, image: true } } } },
          institution: { select: { id: true, institutionNumber: true, institutionName: true, institutionType: true, institutionEmail: true, institutionPhone: true, user: { select: { id: true, name: true, email: true, phone: true, image: true } } } },
          account: { select: { id: true, accountNumber: true, balance: true, accountType: { select: { id: true, name: true, minBalance: true } }, branch: { select: { id: true, name: true, location: true } } } },
          handler: { select: { id: true, name: true, role: true } },
        },
        orderBy: { depositDate: "desc" },
      }),
      db.deposit.aggregate({ where: { ...whereClause, depositDate: { gte: todayStart, lte: todayEnd } }, _sum: { amount: true }, _count: true }),
      db.deposit.aggregate({ where: { ...whereClause, depositDate: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true }, _count: true }),
      db.deposit.aggregate({ where: whereClause, _sum: { amount: true }, _count: true }),
    ]);

    const statistics = {
      today: { count: todayStats._count, amount: todayStats._sum.amount || 0 },
      thisMonth: { count: monthStats._count, amount: monthStats._sum.amount || 0 },
      total: { count: totalStats._count, amount: totalStats._sum.amount || 0 },
    };

    return NextResponse.json({ success: true, data: { deposits, statistics } });
  } catch (error) {
    console.error("Error fetching mobile money deposits:", error);
    return NextResponse.json({ error: "Failed to fetch deposits" }, { status: 500 });
  }
}
