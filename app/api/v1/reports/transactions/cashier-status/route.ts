import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { getFloatOpeningBalanceSource } from "@/lib/float-session";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/transactions/cashier-status?startDate=&endDate=&userId=
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get("branchId");
    const branchId = resolveBranchScope(user, requestedBranchId);

    if (!branchId && user.role !== "ADMIN") {
      return NextResponse.json({ data: [], summary: { totalCashiers: 0, totalFloatBalance: 0, totalOpeningBalance: 0, totalCashIn: 0, totalCashOut: 0, activeCashiers: 0 } });
    }

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");

    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Get cashier/teller float status
    const userFloats = await db.userFloat.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(branchId ? { user: { branchId } } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        floatTransactions: {
          where: {
            transactionDate: { gte: start, lte: end },
          },
          orderBy: { transactionDate: "asc" },
        },
      },
    });

    const records = await Promise.all(
      userFloats.map(async (userFloat) => {
        const [deposits, withdrawals, loanRepayments] = await Promise.all([
          db.deposit.count({
            where: {
              handlerUserId: userFloat.userId,
              depositDate: { gte: start, lte: end },
            },
          }),
          db.withdrawal.count({
            where: {
              handlerUserId: userFloat.userId,
              withdrawalDate: { gte: start, lte: end },
            },
          }),
          db.loanRepayment.count({
            where: {
              handlerUserId: userFloat.userId,
              repaymentDate: { gte: start, lte: end },
            },
          }),
        ]);

        const totalIn = userFloat.floatTransactions
          .filter((t) => t.type === "DEPOSIT")
          .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

      const totalOut = userFloat.floatTransactions
          .filter((t) => t.type === "WITHDRAWAL")
          .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
        const openingBalanceSource = await getFloatOpeningBalanceSource(userFloat.id);

        return {
          cashierId: userFloat.user.id,
          cashierName: userFloat.user.name,
          role: userFloat.user.role,
          floatBalance: Number(userFloat.balance),
          openingBalance: openingBalanceSource?.balance ?? Number(userFloat.balance),
          openingBalanceSource,
          totalIn,
          totalOut,
          netCashFlow: totalIn - totalOut,
          transactionCount: userFloat.floatTransactions.length,
          depositsHandled: deposits,
          withdrawalsHandled: withdrawals,
          loanRepaymentsHandled: loanRepayments,
          isActiveForDay: userFloat.isActiveForDay,
          lastReconciliation: userFloat.lastReconciliation?.toISOString() || "Never",
        };
      })
    );

    return NextResponse.json({
      data: records,
      summary: {
        totalCashiers: records.length,
        totalFloatBalance: records.reduce((sum, r) => sum + r.floatBalance, 0),
        totalOpeningBalance: records.reduce((sum, r) => sum + (r.openingBalance || 0), 0),
        totalCashIn: records.reduce((sum, r) => sum + r.totalIn, 0),
        totalCashOut: records.reduce((sum, r) => sum + r.totalOut, 0),
        activeCashiers: records.filter((r) => r.isActiveForDay).length,
      },
    });
  } catch (error) {
    console.error("Error generating cashier status report:", error);
    return NextResponse.json({ error: "Failed to generate cashier status report" }, { status: 500 });
  }
}
