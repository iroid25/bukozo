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
    let requestedBranchId = searchParams.get("branchId") || null;

    if (request.method === "POST") {
      try {
        const body = await request.json();
        startDateStr = body.startDate || body.start || startDateStr;
        endDateStr = body.endDate || body.end || endDateStr;
        requestedBranchId = body.branchId ?? requestedBranchId;
      } catch {
        // keep defaults
      }
    }

    // Default to current month when no dates supplied
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

    // Branch scope: ADMIN can filter, others are locked to their branch
    let branchId: string | undefined;
    if (user.role === UserRole.ADMIN) {
      branchId =
        requestedBranchId && requestedBranchId !== "ALL" && requestedBranchId !== "all"
          ? requestedBranchId
          : undefined;
    } else {
      branchId = user.branchId || undefined;
    }

    // ── OPERATING ACTIVITIES ──────────────────────────────────────────────
    const [
      depositsAgg,
      withdrawalsAgg,
      loanRepaymentsAgg,
      incomeRecordsAgg,
      expenditureRecordsAgg,
    ] = await Promise.all([
      // Inflow: Savings deposits received
      db.deposit.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          depositDate: { gte: start, lte: end },
          ...(branchId ? { account: { branchId } } : {}),
        },
      }),

      // Outflow: Member withdrawals paid
      db.withdrawal.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          withdrawalDate: { gte: start, lte: end },
          ...(branchId ? { account: { branchId } } : {}),
        },
      }),

      // Inflow: Loan repayments received
      db.loanRepayment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          repaymentDate: { gte: start, lte: end },
          ...(branchId ? { loan: { branchId } } : {}),
        },
      }),

      // Inflow: Other income (fees, interest, etc.)
      db.incomeRecord.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          recordDate: { gte: start, lte: end },
          status: { not: "REJECTED" as any },
          ...(branchId ? { branchId } : {}),
        },
      }),

      // Outflow: Operating expenditure
      db.expenditureRecord.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          recordDate: { gte: start, lte: end },
          status: { not: "REJECTED" as any },
          ...(branchId ? { branchId } : {}),
        },
      }),
    ]);

    // ── INVESTING ACTIVITIES ──────────────────────────────────────────────
    const [loanDisbursementsAgg, fdPlacementsAgg, fdMaturitiesAgg] =
      await Promise.all([
        // Outflow: Loans disbursed to members
        db.loan.aggregate({
          _sum: { amountGranted: true },
          _count: { id: true },
          where: {
            disbursementDate: { gte: start, lte: end },
            status: { notIn: ["PENDING", "APPROVED", "REJECTED"] as any[] },
            ...(branchId ? { branchId } : {}),
          },
        }),

        // Outflow: Fixed deposits placed (new placements)
        db.fixedDeposit.aggregate({
          _sum: { principalAmount: true },
          _count: { id: true },
          where: {
            startDate: { gte: start, lte: end },
            isReversed: false,
            ...(branchId ? { branchId } : {}),
          },
        }),

        // Inflow: Fixed deposits matured/withdrawn (cash returned)
        db.fixedDeposit.aggregate({
          _sum: { withdrawnAmount: true },
          _count: { id: true },
          where: {
            withdrawnDate: { gte: start, lte: end },
            isWithdrawn: true,
            isReversed: false,
            ...(branchId ? { branchId } : {}),
          },
        }),
      ]);

    // ── FINANCING ACTIVITIES ──────────────────────────────────────────────
    const [sharePurchasesAgg, shareSalesAgg] = await Promise.all([
      // Inflow: Member share capital contributions
      db.shareTransaction.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          transactionDate: { gte: start, lte: end },
          transactionType: "PURCHASE",
          isReversed: false,
          ...(branchId ? { account: { branchId } } : {}),
        },
      }),

      // Outflow: Member share redemptions
      db.shareTransaction.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          transactionDate: { gte: start, lte: end },
          transactionType: "SALE",
          isReversed: false,
          ...(branchId ? { account: { branchId } } : {}),
        },
      }),
    ]);

    // ── Assemble sections ─────────────────────────────────────────────────
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
        reportType: "Cash Flow Statement",
        period: {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
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
    console.error("Cash flow statement error:", error);
    return NextResponse.json(
      { error: "Failed to generate cash flow statement" },
      { status: 500 },
    );
  }
}
