import { NextRequest, NextResponse } from "next/server";
import { TransactionStatus, UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { IncomeService } from "@/services/income.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PeriodRange = {
  startDate: Date;
  endDate: Date;
};

type CategorySummary = {
  categoryName: string;
  total: number;
};

type ProfitLossSummary = {
  income: {
    total: number;
    byCategory: CategorySummary[];
  };
  expenses: {
    total: number;
    byCategory: CategorySummary[];
  };
  netProfit: number;
  profitMargin: number;
};

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeBranchIds(user: { role: UserRole; branchId?: string | null }, requestedBranchIds: unknown) {
  if (user.role === UserRole.ADMIN) {
    return Array.isArray(requestedBranchIds)
      ? requestedBranchIds.filter((branchId): branchId is string => typeof branchId === "string" && branchId.length > 0)
      : [];
  }

  if (!user.branchId) {
    return null;
  }

  return [user.branchId];
}

function buildRecordWhere(
  period: PeriodRange,
  branchIds: string[],
  includedIncomeCategories: string[],
  excludeCategories: string[],
) {
  const where: any = {
    recordDate: {
      gte: period.startDate,
      lte: period.endDate,
    },
    status: {
      not: TransactionStatus.FAILED,
    },
  };

  if (branchIds.length > 0) {
    where.branchId = {
      in: branchIds,
    };
  }

  if (includedIncomeCategories.length > 0) {
    where.OR = [
      {
        budgetCategory: {
          name: {
            in: includedIncomeCategories,
          },
        },
      },
      {
        category: {
          name: {
            in: includedIncomeCategories,
          },
        },
      },
    ];
  }

  if (excludeCategories.length > 0) {
    const excludedCategoryWhere = {
      OR: [
        {
          budgetCategory: {
            name: {
              in: excludeCategories,
            },
          },
        },
        {
          category: {
            name: {
              in: excludeCategories,
            },
          },
        },
      ],
    };

    where.NOT = excludedCategoryWhere;
  }

  return where;
}

async function summarizePeriod(
  period: PeriodRange,
  branchIds: string[],
  includedIncomeCategories: string[],
  excludeCategories: string[],
): Promise<ProfitLossSummary> {
  const [incomeRecords, expenditureRecords] = await Promise.all([
    IncomeService.getUnifiedIncomeRecords({
      user: { role: UserRole.ADMIN, branchId: null },
      branchIds,
      startDate: period.startDate,
      endDate: period.endDate,
    }),
    db.expenditureRecord.findMany({
      where: buildRecordWhere(period, branchIds, includedIncomeCategories, excludeCategories),
      select: {
        amount: true,
        budgetCategory: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const normalizedIncomeRecords = incomeRecords.filter((record) => {
    const categoryName = (record.budgetCategory?.name || record.category?.name || "").toLowerCase();
    const includedMatch =
      includedIncomeCategories.length === 0 ||
      includedIncomeCategories.some((name) => name.toLowerCase() === categoryName);
    const excludedMatch = excludeCategories.some((name) => name.toLowerCase() === categoryName);
    return includedMatch && !excludedMatch;
  });

  const groupByCategory = (
    records: Array<{ amount: number; budgetCategory?: { name: string } | null; category?: { name: string } | null }>,
  ) => {
    const grouped = new Map<string, number>();

    for (const record of records) {
      const categoryName = record.budgetCategory?.name || record.category?.name || "Uncategorized";
      grouped.set(categoryName, (grouped.get(categoryName) || 0) + Number(record.amount || 0));
    }

    return Array.from(grouped.entries())
      .map(([categoryName, total]) => ({
        categoryName,
        total,
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  };

  const incomeByCategory = groupByCategory(normalizedIncomeRecords);
  const expenseByCategory = groupByCategory(expenditureRecords);

  const totalIncome = incomeByCategory.reduce((sum, item) => sum + item.total, 0);
  const totalExpenses = expenseByCategory.reduce((sum, item) => sum + item.total, 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  return {
    income: {
      total: totalIncome,
      byCategory: incomeByCategory,
    },
    expenses: {
      total: totalExpenses,
      byCategory: expenseByCategory,
    },
    netProfit,
    profitMargin,
  };
}

// POST /api/v1/reports/custom/profit-loss - Custom P&L with comparison
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { startDate, endDate, includedIncomeCategories, excludeCategories, branchIds, comparisonPeriod } = body;
    const resolvedBranchIds = normalizeBranchIds(user, branchIds);

    if (resolvedBranchIds === null) {
      return NextResponse.json({ error: "Branch access is required for this user" }, { status: 403 });
    }

    const currentPeriodStart = parseDate(startDate);
    const currentPeriodEnd = parseDate(endDate);

    if (!currentPeriodStart || !currentPeriodEnd) {
      return NextResponse.json({ error: "Start date and end date are required" }, { status: 400 });
    }

    const incomeCategories = Array.isArray(includedIncomeCategories) ? includedIncomeCategories : [];
    const excludedCategories = Array.isArray(excludeCategories) ? excludeCategories : [];

    const currentPeriod = await summarizePeriod(
      {
        startDate: currentPeriodStart,
        endDate: currentPeriodEnd,
      },
      resolvedBranchIds,
      incomeCategories,
      excludedCategories,
    );

    let comparisonSummary: ProfitLossSummary | null = null;
    let comparisonPeriodRange: { startDate: string; endDate: string } | null = null;

    if (comparisonPeriod?.startDate && comparisonPeriod?.endDate) {
      const comparisonStart = parseDate(comparisonPeriod.startDate);
      const comparisonEnd = parseDate(comparisonPeriod.endDate);

      if (comparisonStart && comparisonEnd) {
        comparisonSummary = await summarizePeriod(
          {
            startDate: comparisonStart,
            endDate: comparisonEnd,
          },
          resolvedBranchIds,
          incomeCategories,
          excludedCategories,
        );
        comparisonPeriodRange = {
          startDate: comparisonStart.toISOString().split("T")[0],
          endDate: comparisonEnd.toISOString().split("T")[0],
        };
      }
    }

    const variance = comparisonSummary
      ? {
          income: currentPeriod.income.total - comparisonSummary.income.total,
          incomePercent: comparisonSummary.income.total
            ? ((currentPeriod.income.total - comparisonSummary.income.total) /
                Math.abs(comparisonSummary.income.total)) * 100
            : 0,
          expenses: currentPeriod.expenses.total - comparisonSummary.expenses.total,
          expensesPercent: comparisonSummary.expenses.total
            ? ((currentPeriod.expenses.total - comparisonSummary.expenses.total) /
                Math.abs(comparisonSummary.expenses.total)) * 100
            : 0,
          netProfit: currentPeriod.netProfit - comparisonSummary.netProfit,
          netProfitPercent: comparisonSummary.netProfit
            ? ((currentPeriod.netProfit - comparisonSummary.netProfit) / Math.abs(comparisonSummary.netProfit)) * 100
            : 0,
        }
      : undefined;

    return NextResponse.json({
      data: {
        reportType: "Custom Profit & Loss Statement",
        period: {
          startDate: currentPeriodStart.toISOString().split("T")[0],
          endDate: currentPeriodEnd.toISOString().split("T")[0],
        },
        currentPeriod,
        comparisonPeriod: comparisonSummary
          ? {
              period: comparisonPeriodRange,
              ...comparisonSummary,
            }
          : null,
        variance,
        filters: {
          includedIncomeCategories: incomeCategories,
          excludeCategories: excludedCategories,
          branchIds: resolvedBranchIds,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating custom profit & loss:", error);
    return NextResponse.json(
      { error: "Failed to generate custom profit & loss statement" },
      { status: 500 },
    );
  }
}
