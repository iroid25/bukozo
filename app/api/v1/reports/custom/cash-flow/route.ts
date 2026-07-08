import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

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

    let startDateStr = searchParams.get("start") || searchParams.get("startDate");
    let endDateStr = searchParams.get("end") || searchParams.get("endDate");
    let branchIds: string[] = [];
    let includedCategories: string[] = [];
    let excludedCategories: string[] = [];

    if (request.method === "POST") {
      try {
        const body = await request.json();
        startDateStr = body.startDate || body.start || startDateStr;
        endDateStr = body.endDate || body.end || endDateStr;
        branchIds = Array.isArray(body.branchIds) ? body.branchIds : [];
        includedCategories = Array.isArray(body.includedCategories)
          ? body.includedCategories
          : [];
        excludedCategories = Array.isArray(body.excludedCategories)
          ? body.excludedCategories
          : [];
      } catch {
        // keep defaults
      }
    }

    // Default to current month
    const now = new Date();
    const start = startDateStr
      ? new Date(startDateStr)
      : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = endDateStr
      ? new Date(endDateStr + "T23:59:59.999Z")
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date parameters." }, { status: 400 });
    }

    // Branch scope: resolve effective branch filter
    // branchIds array (from custom filters) takes priority for ADMIN;
    // non-ADMIN always locked to their own branch
    let branchFilter: { branchId?: string; branchId_in?: string[] } = {};
    let resolvedBranchIds: string[] | undefined;

    if (user.role === UserRole.ADMIN) {
      if (branchIds.length === 1) {
        resolvedBranchIds = branchIds;
      } else if (branchIds.length > 1) {
        resolvedBranchIds = branchIds;
      }
      // else: no filter = all branches
    } else {
      resolvedBranchIds = user.branchId ? [user.branchId] : undefined;
    }

    // Helper: build branchId condition for direct branchId field
    const directBranchWhere = resolvedBranchIds?.length
      ? { branchId: { in: resolvedBranchIds } }
      : {};

    // Helper: build nested account.branchId condition
    const accountBranchWhere = resolvedBranchIds?.length
      ? { account: { branchId: { in: resolvedBranchIds } } }
      : {};

    // Helper: build nested loan.branchId condition
    const loanBranchWhere = resolvedBranchIds?.length
      ? { loan: { branchId: { in: resolvedBranchIds } } }
      : {};

    // Helper: build nested account.branchId for ShareTransaction
    const shareAccountBranchWhere = resolvedBranchIds?.length
      ? { account: { branchId: { in: resolvedBranchIds } } }
      : {};

    // Category filters for IncomeRecord / ExpenditureRecord
    const categoryIncludeWhere =
      includedCategories.length > 0
        ? {
            budgetCategory: {
              name: { in: includedCategories },
            },
          }
        : {};
    const categoryExcludeWhere =
      excludedCategories.length > 0
        ? {
            NOT: {
              budgetCategory: {
                name: { in: excludedCategories },
              },
            },
          }
        : {};

    // ── OPERATING ACTIVITIES ──────────────────────────────────────────────
    const [
      depositsAgg,
      withdrawalsAgg,
      loanRepaymentsAgg,
      incomeRecordsAgg,
      expenditureRecordsAgg,
    ] = await Promise.all([
      db.deposit.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          depositDate: { gte: start, lte: end },
          ...accountBranchWhere,
        },
      }),

      db.withdrawal.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          withdrawalDate: { gte: start, lte: end },
          ...accountBranchWhere,
        },
      }),

      db.loanRepayment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          repaymentDate: { gte: start, lte: end },
          ...loanBranchWhere,
        },
      }),

      db.incomeRecord.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          recordDate: { gte: start, lte: end },
          status: { not: "REJECTED" as any },
          ...directBranchWhere,
          ...categoryIncludeWhere,
          ...categoryExcludeWhere,
        },
      }),

      db.expenditureRecord.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          recordDate: { gte: start, lte: end },
          status: { not: "REJECTED" as any },
          ...directBranchWhere,
          ...categoryIncludeWhere,
          ...categoryExcludeWhere,
        },
      }),
    ]);

    // ── INVESTING ACTIVITIES ──────────────────────────────────────────────
    const [loanDisbursementsAgg, fdPlacementsAgg, fdMaturitiesAgg] =
      await Promise.all([
        db.loan.aggregate({
          _sum: { amountGranted: true },
          _count: { id: true },
          where: {
            disbursementDate: { gte: start, lte: end },
            status: { notIn: ["PENDING", "APPROVED", "REJECTED"] as any[] },
            ...directBranchWhere,
          },
        }),

        db.fixedDeposit.aggregate({
          _sum: { principalAmount: true },
          _count: { id: true },
          where: {
            startDate: { gte: start, lte: end },
            isReversed: false,
            ...directBranchWhere,
          },
        }),

        db.fixedDeposit.aggregate({
          _sum: { withdrawnAmount: true },
          _count: { id: true },
          where: {
            withdrawnDate: { gte: start, lte: end },
            isWithdrawn: true,
            isReversed: false,
            ...directBranchWhere,
          },
        }),
      ]);

    // ── FINANCING ACTIVITIES ──────────────────────────────────────────────
    const [sharePurchasesAgg, shareSalesAgg] = await Promise.all([
      db.shareTransaction.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          transactionDate: { gte: start, lte: end },
          transactionType: "PURCHASE",
          isReversed: false,
          ...shareAccountBranchWhere,
        },
      }),

      db.shareTransaction.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          transactionDate: { gte: start, lte: end },
          transactionType: "SALE",
          isReversed: false,
          ...shareAccountBranchWhere,
        },
      }),
    ]);

    // ── Assemble ──────────────────────────────────────────────────────────
    const operatingInflows = [
      {
        label: "Member Savings Deposits",
        amount: Number(depositsAgg._sum.amount) || 0,
        count: depositsAgg._count.id,
      },
      {
        label: "Loan Repayments Received",
        amount: Number(loanRepaymentsAgg._sum.amount) || 0,
        count: loanRepaymentsAgg._count.id,
      },
      {
        label: "Other Income",
        amount: Number(incomeRecordsAgg._sum.amount) || 0,
        count: incomeRecordsAgg._count.id,
      },
    ];

    const operatingOutflows = [
      {
        label: "Member Withdrawals",
        amount: Number(withdrawalsAgg._sum.amount) || 0,
        count: withdrawalsAgg._count.id,
      },
      {
        label: "Operating Expenditure",
        amount: Number(expenditureRecordsAgg._sum.amount) || 0,
        count: expenditureRecordsAgg._count.id,
      },
    ];

    const operatingTotal =
      operatingInflows.reduce((s, r) => s + r.amount, 0) -
      operatingOutflows.reduce((s, r) => s + r.amount, 0);

    const investingInflows = [
      {
        label: "Fixed Deposit Maturities / Withdrawals",
        amount: Number(fdMaturitiesAgg._sum.withdrawnAmount) || 0,
        count: fdMaturitiesAgg._count.id,
      },
    ];

    const investingOutflows = [
      {
        label: "Loans Disbursed to Members",
        amount: Number(loanDisbursementsAgg._sum.amountGranted) || 0,
        count: loanDisbursementsAgg._count.id,
      },
      {
        label: "Fixed Deposit Placements",
        amount: Number(fdPlacementsAgg._sum.principalAmount) || 0,
        count: fdPlacementsAgg._count.id,
      },
    ];

    const investingTotal =
      investingInflows.reduce((s, r) => s + r.amount, 0) -
      investingOutflows.reduce((s, r) => s + r.amount, 0);

    const financingInflows = [
      {
        label: "Share Capital Contributions",
        amount: Number(sharePurchasesAgg._sum.amount) || 0,
        count: sharePurchasesAgg._count.id,
      },
    ];

    const financingOutflows = [
      {
        label: "Share Redemptions",
        amount: Number(shareSalesAgg._sum.amount) || 0,
        count: shareSalesAgg._count.id,
      },
    ];

    const financingTotal =
      financingInflows.reduce((s, r) => s + r.amount, 0) -
      financingOutflows.reduce((s, r) => s + r.amount, 0);

    const netCashChange = operatingTotal + investingTotal + financingTotal;

    return NextResponse.json({
      success: true,
      data: {
        reportType: "Custom Cash Flow Statement",
        period: {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
        },
        filters: {
          branchIds: resolvedBranchIds ?? [],
          includedCategories,
          excludedCategories,
        },
        operating: {
          inflows: operatingInflows,
          outflows: operatingOutflows,
          total: operatingTotal,
        },
        investing: {
          inflows: investingInflows,
          outflows: investingOutflows,
          total: investingTotal,
        },
        financing: {
          inflows: financingInflows,
          outflows: financingOutflows,
          total: financingTotal,
        },
        summary: {
          operatingCashFlow: operatingTotal,
          investingCashFlow: investingTotal,
          financingCashFlow: financingTotal,
          netCashChange,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Custom cash flow error:", error);
    return NextResponse.json(
      { error: "Failed to generate custom cash flow statement" },
      { status: 500 },
    );
  }
}
