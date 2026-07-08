import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;

    const whereClause: any = { channel: "MOBILE_MONEY" };

    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
      whereClause.loan = { branchId: user.branchId };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const [repayments, todayStats, monthStats, totalStats] = await Promise.all([
      db.loanRepayment.findMany({
        where: whereClause,
        select: {
          id: true, loanId: true, memberId: true, amount: true, repaymentDate: true,
          handlerUserId: true, channel: true, mobileMoneyRef: true,
          loan: {
            select: {
              id: true, amountGranted: true, interestRate: true, totalAmountDue: true,
              amountPaid: true, outstandingBalance: true, disbursementDate: true, dueDate: true, status: true,
              loanApplication: { select: { id: true, amountApplied: true, applicationDate: true, loanProduct: { select: { id: true, name: true } } } },
            },
          },
          member: { select: { id: true, memberNumber: true, user: { select: { id: true, name: true, email: true, phone: true, image: true } } } },
          handler: { select: { id: true, name: true, role: true } },
        },
        orderBy: { repaymentDate: "desc" },
      }),
      db.loanRepayment.aggregate({ where: { ...whereClause, repaymentDate: { gte: today, lt: tomorrow } }, _sum: { amount: true }, _count: { _all: true } }),
      db.loanRepayment.aggregate({ where: { ...whereClause, repaymentDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true }, _count: { _all: true } }),
      db.loanRepayment.aggregate({ where: whereClause, _sum: { amount: true }, _count: { _all: true } }),
    ]);

    const statistics = {
      today: { amount: Number(todayStats._sum.amount || 0), count: todayStats._count._all },
      thisMonth: { amount: Number(monthStats._sum.amount || 0), count: monthStats._count._all },
      total: { amount: Number(totalStats._sum.amount || 0), count: totalStats._count._all },
    };

    return NextResponse.json({ success: true, data: { repayments, statistics } });
  } catch (error) {
    console.error("Error fetching mobile money loan repayments:", error);
    return NextResponse.json({ error: "Failed to fetch repayments" }, { status: 500 });
  }
}
