import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Scope by branch for non-admin roles
    const whereClause: any = {};
    const userRole = (session.user as any).role;
    const userBranchId = (session.user as any).branchId;
    const requestedBranchId = new URL(request.url).searchParams.get("branchId");
    const branchId = resolveBranchScope(
      session.user as { role: string; branchId?: string | null },
      requestedBranchId,
    );

    if (branchId || ["TELLER", "LOANOFFICER", "BRANCHMANAGER"].includes(userRole)) {
      whereClause.loan = { branchId: branchId || userBranchId };
    }

    // Get total repayments and amount
    const [totalRepayments, repaymentAgg] = await Promise.all([
      db.loanRepayment.count({ where: whereClause }),
      db.loanRepayment.aggregate({
        where: whereClause,
        _sum: {
          amount: true,
          principalPaid: true,
          interestPaid: true,
          penaltyPaid: true,
        },
      }),
    ]);

    // Get repayments grouped by channel
    const channelBreakdown = await db.loanRepayment.groupBy({
      by: ["channel"],
      where: whereClause,
      _count: { id: true },
      _sum: { amount: true },
    });

    // Get recent repayments (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRepayments = await db.loanRepayment.count({
      where: {
        ...whereClause,
        repaymentDate: { gte: thirtyDaysAgo },
      },
    });

    const recentAmount = await db.loanRepayment.aggregate({
      where: {
        ...whereClause,
        repaymentDate: { gte: thirtyDaysAgo },
      },
      _sum: { amount: true },
    });

    return NextResponse.json({
      totalRepayments,
      totalAmount: repaymentAgg._sum.amount || 0,
      totalPrincipalPaid: repaymentAgg._sum.principalPaid || 0,
      totalInterestPaid: repaymentAgg._sum.interestPaid || 0,
      totalPenaltyPaid: repaymentAgg._sum.penaltyPaid || 0,
      recentRepayments,
      recentAmount: recentAmount._sum.amount || 0,
      channelBreakdown: channelBreakdown.map((c) => ({
        channel: c.channel,
        count: c._count.id,
        amount: c._sum.amount || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching repayment statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch repayment statistics" },
      { status: 500 }
    );
  }
}
