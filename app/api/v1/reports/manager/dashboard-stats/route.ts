import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(request.url);
    let requestedBranchId = searchParams.get("branchId") || null;

    if (request.method === "POST") {
      try {
        const body = await request.json();
        requestedBranchId = body.branchId ?? requestedBranchId;
      } catch {
        // keep defaults
      }
    }

    // Branch scope: ADMIN can filter, others locked to their branch
    const branchId = resolveBranchScope(
      { role: user.role, branchId: user.branchId },
      requestedBranchId && requestedBranchId !== "ALL" && requestedBranchId !== "all"
        ? requestedBranchId
        : undefined,
    );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      savingsAgg,
      sharesAgg,
      institutionSharesAgg,
      fixedDepositsAgg,
      totalMembers,
      activeMembers,
      newMembersToday,
      activeLoansAgg,
      overdueLoansCount,
      depositsTodayAgg,
      withdrawalsTodayAgg,
      loanRepaymentsTodayAgg,
    ] = await Promise.all([
      // Savings portfolio — Account is master balance source (TXN-001)
      db.account.aggregate({
        _sum: { balance: true },
        _count: { id: true },
        where: {
          status: "ACTIVE",
          accountType: { isShareAccount: false, hasFixedPeriod: false },
          ...(branchId ? { branchId } : {}),
        },
      }),

      // Shares portfolio
      db.shareAccount.aggregate({
        _sum: { totalValue: true, numberOfShares: true },
        _count: { id: true },
        where: {
          status: "ACTIVE",
          ...(branchId ? { branchId } : {}),
        },
      }),

      // Institution share accounts (stored in Account table)
      db.account.aggregate({
        _sum: { balance: true },
        _count: { id: true },
        where: {
          institutionId: { not: null },
          accountType: { isShareAccount: true },
          status: "ACTIVE",
          ...(branchId ? { branchId } : {}),
        },
      }),

      // Fixed deposits portfolio — FixedDeposit table (new model)
      db.fixedDeposit.aggregate({
        _sum: { principalAmount: true, maturityAmount: true },
        _count: { id: true },
        where: {
          status: "ACTIVE",
          isReversed: false,
          ...(branchId ? { branchId } : {}),
        },
      }),

      // Member counts — Member has no branchId; scope via their accounts when branchId is set
      db.member.count({
        where: branchId
          ? { OR: [{ accounts: { some: { branchId } } }, { shareAccounts: { some: { branchId } } }] }
          : {},
      }),

      db.member.count({
        where: {
          status: "ACTIVE",
          ...(branchId
            ? { OR: [{ accounts: { some: { branchId } } }, { shareAccounts: { some: { branchId } } }] }
            : {}),
        },
      }),

      db.member.count({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          ...(branchId
            ? { OR: [{ accounts: { some: { branchId } } }, { shareAccounts: { some: { branchId } } }] }
            : {}),
        },
      }),

      // Active loans (DISBURSED + OVERDUE)
      db.loan.aggregate({
        _sum: { outstandingBalance: true },
        _count: { id: true },
        where: {
          status: { in: ["DISBURSED", "OVERDUE"] as any[] },
          ...(branchId ? { branchId } : {}),
        },
      }),

      // Overdue loans
      db.loan.count({
        where: {
          status: "OVERDUE" as any,
          ...(branchId ? { branchId } : {}),
        },
      }),

      // Deposits today
      db.deposit.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          depositDate: { gte: todayStart, lte: todayEnd },
          ...(branchId ? { account: { branchId } } : {}),
        },
      }),

      // Withdrawals today
      db.withdrawal.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          withdrawalDate: { gte: todayStart, lte: todayEnd },
          ...(branchId ? { account: { branchId } } : {}),
        },
      }),

      // Loan repayments today
      db.loanRepayment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          repaymentDate: { gte: todayStart, lte: todayEnd },
          ...(branchId ? { loan: { branchId } } : {}),
        },
      }),
    ]);

    sharesAgg._sum.totalValue = Number(sharesAgg._sum.totalValue || 0) + Number(institutionSharesAgg._sum.balance || 0);
    sharesAgg._count.id += institutionSharesAgg._count.id;

    return NextResponse.json({
      success: true,
      data: {
        savings: {
          totalBalance: Number(savingsAgg._sum.balance) || 0,
          activeAccounts: savingsAgg._count.id,
        },
        fixedDeposits: {
          totalPrincipal: Number(fixedDepositsAgg._sum.principalAmount) || 0,
          totalMaturityValue: Number(fixedDepositsAgg._sum.maturityAmount) || 0,
          activeCount: fixedDepositsAgg._count.id,
        },
        shares: {
          totalCapital: Number(sharesAgg._sum.totalValue) || 0,
          totalShares: Number(sharesAgg._sum.numberOfShares) || 0,
          totalShareholders: sharesAgg._count.id,
        },
        members: {
          total: totalMembers,
          active: activeMembers,
          newToday: newMembersToday,
        },
        loans: {
          activeCount: activeLoansAgg._count.id,
          outstandingBalance: Number(activeLoansAgg._sum.outstandingBalance) || 0,
          overdueCount: overdueLoansCount,
        },
        today: {
          deposits: {
            count: depositsTodayAgg._count.id,
            amount: Number(depositsTodayAgg._sum.amount) || 0,
          },
          withdrawals: {
            count: withdrawalsTodayAgg._count.id,
            amount: Number(withdrawalsTodayAgg._sum.amount) || 0,
          },
          loanRepayments: {
            count: loanRepaymentsTodayAgg._count.id,
            amount: Number(loanRepaymentsTodayAgg._sum.amount) || 0,
          },
        },
      },
    });
  } catch (error) {
    console.error("Manager dashboard stats error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate manager dashboard stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
