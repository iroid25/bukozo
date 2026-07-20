// app/api/v1/accountant/trends/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { UserRole, TransactionStatus } from "@prisma/client";
import { subMonths, format } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permissions
    const allowedRoles: UserRole[] = [
      UserRole.ACCOUNTANT,
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to view trends",
        },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "6months";
    const rawBranchId = searchParams.get("branchId") || undefined;
    const branchId = resolveBranchScope(
      { role: user.role, branchId: user.branchId },
      rawBranchId && rawBranchId !== "all" && rawBranchId !== "ALL" ? rawBranchId : undefined,
    ); // 6months, 12months, ytd

    let monthsBack = 6;
    if (period === "12months") monthsBack = 12;
    if (period === "ytd") {
      // Year to date
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      monthsBack = Math.ceil(
        (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
    }

    const startDate = subMonths(new Date(), monthsBack);

    // Get monthly income and expenditure trends
    const monthlyTrends = await db.$queryRaw<
      Array<{
        month: string;
        income: number;
        expenditure: number;
        net_income: number;
      }>
    >`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', ${startDate}::timestamp),
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        ) AS month
      ),
      income_data AS (
        SELECT 
          date_trunc('month', record_date) AS month,
          SUM(amount) AS total_income
        FROM "IncomeRecord"
        WHERE status = ${TransactionStatus.COMPLETED}
          AND record_date >= ${startDate}
        GROUP BY date_trunc('month', record_date)
      ),
      expenditure_data AS (
        SELECT 
          date_trunc('month', record_date) AS month,
          SUM(amount) AS total_expenditure
        FROM "ExpenditureRecord"
        WHERE status = ${TransactionStatus.COMPLETED}
          AND record_date >= ${startDate}
        GROUP BY date_trunc('month', record_date)
      )
      SELECT 
        TO_CHAR(m.month, 'Mon YYYY') AS month,
        COALESCE(i.total_income::float, 0) AS income,
        COALESCE(e.total_expenditure::float, 0) AS expenditure,
        COALESCE(i.total_income::float, 0) - COALESCE(e.total_expenditure::float, 0) AS net_income
      FROM months m
      LEFT JOIN income_data i ON m.month = i.month
      LEFT JOIN expenditure_data e ON m.month = e.month
      ORDER BY m.month
    `;

    // Get category-wise trends for income
    const incomeCategoryTrends = await db.$queryRaw<
      Array<{
        category: string;
        month: string;
        amount: number;
      }>
    >`
      SELECT 
        c.name as category,
        TO_CHAR(date_trunc('month', ir.record_date), 'Mon YYYY') AS month,
        SUM(ir.amount)::float AS amount
      FROM "IncomeRecord" ir
      INNER JOIN "IncomeCategory" c ON ir.category_id = c.id
      WHERE ir.status = ${TransactionStatus.COMPLETED}
        AND ir.record_date >= ${startDate}
      GROUP BY c.name, date_trunc('month', ir.record_date)
      ORDER BY date_trunc('month', ir.record_date), amount DESC
    `;

    // Get category-wise trends for expenditure
    const expenditureCategoryTrends = await db.$queryRaw<
      Array<{
        category: string;
        month: string;
        amount: number;
      }>
    >`
      SELECT 
        c.name as category,
        TO_CHAR(date_trunc('month', er.record_date), 'Mon YYYY') AS month,
        SUM(er.amount)::float AS amount
      FROM "ExpenditureRecord" er
      INNER JOIN "ExpenditureCategory" c ON er.category_id = c.id
      WHERE er.status = ${TransactionStatus.COMPLETED}
        AND er.record_date >= ${startDate}
      GROUP BY c.name, date_trunc('month', er.record_date)
      ORDER BY date_trunc('month', er.record_date), amount DESC
    `;

    // Calculate growth rates
    const firstMonth = monthlyTrends[0];
    const lastMonth = monthlyTrends[monthlyTrends.length - 1];

    const incomeGrowthRate =
      firstMonth && firstMonth.income > 0
        ? ((lastMonth.income - firstMonth.income) / firstMonth.income) * 100
        : 0;

    const expenditureGrowthRate =
      firstMonth && firstMonth.expenditure > 0
        ? ((lastMonth.expenditure - firstMonth.expenditure) /
            firstMonth.expenditure) *
          100
        : 0;

    // Calculate averages
    const avgIncome =
      monthlyTrends.reduce((sum, m) => sum + m.income, 0) /
      monthlyTrends.length;
    const avgExpenditure =
      monthlyTrends.reduce((sum, m) => sum + m.expenditure, 0) /
      monthlyTrends.length;

    return NextResponse.json({
      success: true,
      data: {
        monthlyTrends,
        incomeCategoryTrends,
        expenditureCategoryTrends,
        summary: {
          period,
          monthsIncluded: monthlyTrends.length,
          totalIncome: monthlyTrends.reduce((sum, m) => sum + m.income, 0),
          totalExpenditure: monthlyTrends.reduce(
            (sum, m) => sum + m.expenditure,
            0
          ),
          totalNetIncome: monthlyTrends.reduce(
            (sum, m) => sum + m.net_income,
            0
          ),
          avgMonthlyIncome: avgIncome,
          avgMonthlyExpenditure: avgExpenditure,
          incomeGrowthRate: Number(incomeGrowthRate.toFixed(1)),
          expenditureGrowthRate: Number(expenditureGrowthRate.toFixed(1)),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching trends:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch trends",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
