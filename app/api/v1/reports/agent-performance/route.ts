import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { db } from "@/prisma/db";
import { startOfDay, endOfDay, startOfMonth } from "date-fns";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const params = request.nextUrl.searchParams;
    const startDate = startOfDay(parseDate(params.get("startDate"), startOfMonth(new Date())));
    const endDate = endOfDay(parseDate(params.get("endDate"), new Date()));
    const requestedBranchId = params.get("branchId");

    const branchIdFilter = resolveBranchScope(
      { role: user.role, branchId: user.branchId },
      requestedBranchId && requestedBranchId !== "ALL" && requestedBranchId !== "all"
        ? requestedBranchId
        : undefined,
    );

    const agentWhere = {
      role: UserRole.AGENT,
      ...(branchIdFilter ? { branchId: branchIdFilter } : {}),
    };

    const agents = await db.user.findMany({
      where: agentWhere,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        branchId: true,
        branch: { select: { name: true } },
        userFloat: { select: { balance: true } },
      },
      orderBy: { name: "asc" },
    });

    const rows = await Promise.all(
      agents.map(async (agent) => {
        const [transactionsCount, transactionsAmount, depositsCount, depositsAmount, withdrawalsCount, withdrawalsAmount, floatTransactionsCount] =
          await Promise.all([
            db.transaction.count({
              where: {
                processedByUserId: agent.id,
                transactionDate: { gte: startDate, lte: endDate },
              },
            }),
            db.transaction.aggregate({
              where: {
                processedByUserId: agent.id,
                transactionDate: { gte: startDate, lte: endDate },
              },
              _sum: { amount: true },
            }),
            db.deposit.count({
              where: {
                handlerUserId: agent.id,
                depositDate: { gte: startDate, lte: endDate },
              },
            }),
            db.deposit.aggregate({
              where: {
                handlerUserId: agent.id,
                depositDate: { gte: startDate, lte: endDate },
              },
              _sum: { amount: true },
            }),
            db.withdrawal.count({
              where: {
                handlerUserId: agent.id,
                withdrawalDate: { gte: startDate, lte: endDate },
              },
            }),
            db.withdrawal.aggregate({
              where: {
                handlerUserId: agent.id,
                withdrawalDate: { gte: startDate, lte: endDate },
              },
              _sum: { amount: true },
            }),
            db.floatTransaction.count({
              where: {
                performedByUserId: agent.id,
                transactionDate: { gte: startDate, lte: endDate },
              },
            }),
          ]);

        const depositTotal = depositsAmount._sum.amount || 0;
        const withdrawalTotal = withdrawalsAmount._sum.amount || 0;
        const txAmount = transactionsAmount._sum.amount || 0;

        return {
          id: agent.id,
          agentName: agent.name || agent.email,
          branch: agent.branch?.name || "Unassigned",
          transactionsCount,
          transactionAmount: txAmount,
          depositCount: depositsCount,
          depositAmount: depositTotal,
          withdrawalCount: withdrawalsCount,
          withdrawalAmount: withdrawalTotal,
          floatTransactionsCount,
          floatBalance: agent.userFloat?.balance || 0,
          netCashFlow: depositTotal - withdrawalTotal,
        };
      }),
    );

    const summary = rows.reduce(
      (acc, row) => {
        acc.totalAgents += 1;
        acc.totalTransactions += row.transactionsCount;
        acc.totalDeposits += row.depositAmount;
        acc.totalWithdrawals += row.withdrawalAmount;
        acc.totalFloatBalance += row.floatBalance;
        acc.totalNetCashFlow += row.netCashFlow;
        return acc;
      },
      {
        totalAgents: 0,
        totalTransactions: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalFloatBalance: 0,
        totalNetCashFlow: 0,
      },
    );

    rows.sort((a, b) => b.transactionsCount - a.transactionsCount || b.netCashFlow - a.netCashFlow);

    return NextResponse.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        summary,
        agents: rows.map((row, index) => ({
          ...row,
          rank: index + 1,
        })),
      },
    });
  } catch (error: any) {
    console.error("Error generating agent performance report:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to generate agent performance report" },
      { status: 500 },
    );
  }
}
