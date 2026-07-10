import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";
import { IncomeService } from "@/services/income.service";

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

    let year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    let requestedBranchId = searchParams.get("branchId") || null;

    if (request.method === "POST") {
      try {
        const body = await request.json();
        year = body.year ? parseInt(body.year, 10) : year;
        requestedBranchId = body.branchId ?? requestedBranchId;
      } catch {
        // keep defaults
      }
    }

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Invalid year parameter." }, { status: 400 });
    }

    // Branch scope: ADMIN can filter, others are locked to their branch
    let branchId: string | undefined;
    if (user.role === UserRole.ADMIN) {
      branchId = requestedBranchId && requestedBranchId !== "ALL" && requestedBranchId !== "all"
        ? requestedBranchId
        : undefined;
    } else {
      branchId = user.branchId || undefined;
    }

    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    // Fetch all budget entries for the year
    const budgets = await db.budget.findMany({
      where: {
        year,
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        category: { select: { id: true, name: true, code: true, kind: true } },
        branch: { select: { name: true } },
      },
    });

    if (budgets.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          year,
          rows: [],
          summary: {
            year,
            totalBudgeted: 0,
            totalActual: 0,
            totalVariance: 0,
            overBudgetCount: 0,
            underBudgetCount: 0,
          },
        },
      });
    }

    const categoryIds = [...new Set(budgets.map((b) => b.categoryId))];

    // Actual spend/income grouped by budgetCategoryId for the year
    const [actualExpenditures, incomeRecords] = await Promise.all([
      db.expenditureRecord.groupBy({
        by: ["budgetCategoryId"],
        where: {
          budgetCategoryId: { in: categoryIds },
          recordDate: { gte: yearStart, lte: yearEnd },
          status: { not: "REJECTED" as any },
          ...(branchId ? { branchId } : {}),
        },
        _sum: { amount: true },
      }),
      IncomeService.getUnifiedIncomeRecords({
        user: { role: user.role, branchId: user.branchId || null },
        branchId,
        startDate: yearStart,
        endDate: yearEnd,
      }),
    ]);

    const expenditureMap = new Map(
      actualExpenditures.map((e) => [e.budgetCategoryId!, Number(e._sum.amount) || 0]),
    );
    const incomeMap = new Map<string, number>();
    for (const record of incomeRecords) {
      const categoryId = record.budgetCategoryId;
      if (!categoryId || !categoryIds.includes(categoryId)) continue;
      const current = incomeMap.get(categoryId) || 0;
      incomeMap.set(categoryId, current + Number(record.amount || 0));
    }

    const rows = budgets.map((budget) => {
      const budgeted = Number(budget.amount);
      const isIncome = budget.category.kind === "INCOME";
      const actual = isIncome
        ? (incomeMap.get(budget.categoryId) ?? 0)
        : (expenditureMap.get(budget.categoryId) ?? 0);
      const variance = budgeted - actual;
      const variancePct = budgeted !== 0 ? (variance / budgeted) * 100 : 0;

      return {
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        categoryCode: budget.category.code || "",
        kind: budget.category.kind,
        budgeted,
        actual,
        variance,
        variancePct: Math.round(variancePct * 100) / 100,
        status: variance >= 0 ? "UNDER_BUDGET" : "OVER_BUDGET",
        utilizationPct: budgeted > 0 ? Math.round((actual / budgeted) * 10000) / 100 : 0,
        branch: budget.branch?.name || "All Branches",
      };
    });

    // Over-budget rows first, then alphabetical
    rows.sort((a, b) => {
      if (a.variance < 0 && b.variance >= 0) return -1;
      if (a.variance >= 0 && b.variance < 0) return 1;
      return a.categoryName.localeCompare(b.categoryName);
    });

    const summary = {
      year,
      totalBudgeted: rows.reduce((s, r) => s + r.budgeted, 0),
      totalActual: rows.reduce((s, r) => s + r.actual, 0),
      totalVariance: rows.reduce((s, r) => s + r.variance, 0),
      overBudgetCount: rows.filter((r) => r.status === "OVER_BUDGET").length,
      underBudgetCount: rows.filter((r) => r.status === "UNDER_BUDGET").length,
      overallUtilizationPct:
        rows.reduce((s, r) => s + r.budgeted, 0) > 0
          ? Math.round(
              (rows.reduce((s, r) => s + r.actual, 0) /
                rows.reduce((s, r) => s + r.budgeted, 0)) *
                10000,
            ) / 100
          : 0,
    };

    return NextResponse.json({ success: true, data: { year, rows, summary } });
  } catch (error) {
    console.error("Budget variance report error:", error);
    return NextResponse.json(
      { error: "Failed to generate budget variance report" },
      { status: 500 },
    );
  }
}
