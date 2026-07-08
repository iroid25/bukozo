import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // Build where condition based on role
    let whereCondition: any = {};

    if (user.role === "AGENT") {
      whereCondition.handlerUserId = user.id;
    } else if (["BRANCHMANAGER", "TELLER"].includes(user.role) && user.branchId) {
      whereCondition.loan = {
        branchId: user.branchId,
      };
    } else if (user.role === "MEMBER") {
      const member = await db.member.findUnique({
        where: { userId: user.id },
      });
      if (member) {
        whereCondition.memberId = member.id;
      } else {
        return NextResponse.json({
          totalRepayments: 0,
          totalAmount: 0,
          todayRepayments: 0,
          todayAmount: 0,
          thisMonthRepayments: 0,
          thisMonthAmount: 0,
          channelBreakdown: [],
        });
      }
    } else if (user.role === "LOANOFFICER") {
      whereCondition.handlerUserId = user.id;
    } else if (!["ADMIN", "ACCOUNTANT", "AUDITOR", "BRANCHMANAGER", "TELLER", "DATA_ENTRANT"].includes(user.role)) {
      console.warn(`[API] Unauthorized access attempt to repayments statistics: user=${user.id}, role=${user.role}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }


    // Date ranges
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));
    const thisMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    const [
      totalStats,
      todayStats,
      monthStats,
      channelBreakdown,
      instStats,
    ] = await Promise.all([
      db.loanRepayment.aggregate({
        where: whereCondition,
        _count: true,
        _sum: { amount: true },
      }),
      db.loanRepayment.aggregate({
        where: {
          ...whereCondition,
          repaymentDate: { gte: todayStart, lte: todayEnd },
        },
        _count: true,
        _sum: { amount: true },
      }),
      db.loanRepayment.aggregate({
        where: {
          ...whereCondition,
          repaymentDate: { gte: thisMonthStart },
        },
        _count: true,
        _sum: { amount: true },
      }),
      db.loanRepayment.groupBy({
        by: ["channel"],
        where: whereCondition,
        _count: true,
        _sum: { amount: true },
      }),
      // Institutional Stats - Simplified for now as we don't have direct branch/handler filtering yet
      (() => {
        const instModel = (db as any).institutionLoanRepayment;
        if (!instModel) return Promise.resolve({ _sum: { amount: 0 }, _count: 0 });
        return instModel.aggregate({
          _sum: { amount: true },
          _count: true,
        }).catch((err: any) => {
          console.error("[API] Error fetching institutional statistics:", err);
          return ({ _sum: { amount: 0 }, _count: 0 });
        });
      })()
    ]);

    const totalCount = (totalStats._count || 0) + (instStats._count || 0);
    const totalSum = (totalStats._sum.amount || 0) + (instStats._sum.amount || 0);
    const todayRepayments = todayStats._count || 0;
    const todaySum = todayStats._sum.amount || 0;
    const thisMonthRepayments = monthStats._count || 0;
    const thisMonthAmountSum = monthStats._sum.amount || 0;

    return NextResponse.json({
      totalRepayments: totalCount,
      totalAmount: totalSum,
      todayRepayments,
      todayAmount: todaySum,
      thisMonthRepayments,
      thisMonthAmount: thisMonthAmountSum,
      channelBreakdown: channelBreakdown.map((item) => ({
        channel: item.channel,
        count: item._count,
        amount: item._sum.amount || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching repayment statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
