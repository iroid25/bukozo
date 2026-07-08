// actions/income-reports.ts - Income reporting and analytics
// @ts-nocheck
"use server";

import { db } from "@/prisma/db";
import { TransactionStatus } from "@prisma/client";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

// Get comprehensive income report
export async function getIncomeReport(params: {
  startDate: Date;
  endDate: Dat;
  e;
  branchId?: string;
  reportType: "summary" | "detailed" | "comparison" | "variance";
}) {
  try {
    const { userId } = auth();
    if (!userId) {
      return { error: "Unauthorized", data: null };
    }

    const where: any = {
      status: TransactionStatus.COMPLETED,
      recordDate: {
        gte: params.startDate,
        lte: params.endDate,
      },
    };

    if (params.branchId) {
      where.branchId = params.branchId;
    }

    // Get actual income data
    const [incomeRecords, byCategory, byMonth, byBranch] = await Promise.all([
      db.incomeRecord.findMany({
        where,
        include: {
          category: true,
          branch: true,
          member: true,
        },
        orderBy: { recordDate: "desc" },
      }),

      // Income by category
      db.incomeRecord.groupBy({
        by: ["categoryId"],
        where,
        _sum: { amount: true },
        _count: true,
      }),

      // Income by month
      db.$queryRaw<
        Array<{ month: string; total_amount: number; count: number }>
      >`
        SELECT 
          TO_CHAR(record_date, 'YYYY-MM') as month,
          SUM(amount)::float as total_amount,
          COUNT(*)::int as count
        FROM income_records
        WHERE status = 'COMPLETED'
          AND record_date >= ${params.startDate}
          AND record_date <= ${params.endDate}
          ${params.branchId ? `AND branch_id = ${params.branchId}` : ""}
        GROUP BY TO_CHAR(record_date, 'YYYY-MM')
        ORDER BY month
      `,

      // Income by branch
      db.incomeRecord.groupBy({
        by: ["branchId"],
        where: { ...where, branchId: { not: null } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Get budget allocations for the period
    const budgetAllocations = await db.budgetAllocation.findMany({
      where: {
        period: {
          startDate: { lte: params.endDate },
          endDate: { gte: params.startDate },
        },
        category: {
          kind: "INCOME",
        },
      },
      include: {
        category: true,
        period: true,
      },
    });

    // Enrich category data with budgets
    const categoryIds = byCategory.map((c) => c.categoryId);
    const categories = await db.budgetCategory.findMany({
      where: { id: { in: categoryIds } },
    });

    const enrichedByCategory = byCategory.map((c) => {
      const cat = categories.find((category) => category.id === c.categoryId);
      const budget = budgetAllocations.find(
        (b) => b.categoryId === c.categoryId
      );
      const actualAmount = c._sum.amount || 0;
      const budgetAmount = budget?.allocatedAmount || 0;
      const variance = actualAmount - budgetAmount;
      const variancePercent =
        budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

      return {
        category: cat?.name || "Unknown",
        categoryCode: cat?.code || "",
        amount: actualAmount,
        budget: budgetAmount,
        variance,
        variancePercent,
        count: c._count,
      };
    });

    // Enrich branch data
    const branchIds = byBranch
      .filter((b) => b.branchId)
      .map((b) => b.branchId!);
    const branches = await db.branch.findMany({
      where: { id: { in: branchIds } },
    });

    const totalIncome = byCategory.reduce(
      (sum, c) => sum + (c._sum.amount || 0),
      0
    );

    const enrichedByBranch = byBranch.map((b) => {
      const branch = branches.find((br) => br.id === b.branchId);
      const amount = b._sum.amount || 0;
      return {
        branch: branch?.name || "Unknown",
        branchCode: branch?.code || "",
        amount,
        percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
        count: b._count,
      };
    });

    // Add budget data to monthly trend
    const enrichedByMonth = byMonth.map((m) => {
      const monthBudget = budgetAllocations
        .filter((b) => format(b.period.startDate, "yyyy-MM") === m.month)
        .reduce((sum, b) => sum + b.allocatedAmount, 0);

      return {
        month: m.month,
        amount: m.total_amount,
        budget: monthBudget,
        variance: m.total_amount - monthBudget,
        count: m.count,
      };
    });

    // Calculate summary statistics
    const totalBudget = budgetAllocations.reduce(
      (sum, b) => sum + b.allocatedAmount,
      0
    );
    const totalVariance = totalIncome - totalBudget;

    // Calculate growth rate (compare to previous period)
    const periodLength = params.endDate.getTime() - params.startDate.getTime();
    const previousStart = new Date(params.startDate.getTime() - periodLength);
    const previousEnd = new Date(params.endDate.getTime() - periodLength);

    const previousIncome = await db.incomeRecord.aggregate({
      where: {
        status: TransactionStatus.COMPLETED,
        recordDate: {
          gte: previousStart,
          lte: previousEnd,
        },
        ...(params.branchId ? { branchId: params.branchId } : {}),
      },
      _sum: { amount: true },
    });

    const previousTotal = previousIncome._sum.amount || 0;
    const growthRate =
      previousTotal > 0
        ? ((totalIncome - previousTotal) / previousTotal) * 100
        : 0;

    return {
      error: null,
      data: {
        records: incomeRecords,
        byCategory: enrichedByCategory,
        byMonth: enrichedByMonth,
        byBranch: enrichedByBranch,
        summary: {
          totalIncome,
          totalBudget,
          variance: totalVariance,
          variancePercent:
            totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0,
          growthRate,
          recordCount: incomeRecords.length,
        },
      },
    };
  } catch (error) {
    console.error("Error generating income report:", error);
    return { error: "Failed to generate income report", data: null };
  }
}

// Get income variance analysis
export async function getIncomeVarianceAnalysis(params: {
  periodId: string;
  branchId?: string;
}) {
  try {
    const { userId } = auth();
    if (!userId) {
      return { error: "Unauthorized", data: null };
    }

    const period = await db.financialPeriod.findUnique({
      where: { id: params.periodId },
    });

    if (!period) {
      return { error: "Financial period not found", data: null };
    }

    // Get budget allocations
    const allocations = await db.budgetAllocation.findMany({
      where: {
        periodId: params.periodId,
        category: { kind: "INCOME" },
      },
      include: {
        category: true,
      },
    });

    // Get actual income for each category
    const actualIncome = await db.incomeRecord.groupBy({
      by: ["categoryId"],
      where: {
        status: TransactionStatus.COMPLETED,
        recordDate: {
          gte: period.startDate,
          lte: period.endDate,
        },
        ...(params.branchId ? { branchId: params.branchId } : {}),
      },
      _sum: { amount: true },
    });

    // Calculate variances
    const variances = allocations.map((alloc) => {
      const actual = actualIncome.find(
        (a) => a.categoryId === alloc.categoryId
      );
      const actualAmount = actual?._sum.amount || 0;
      const budgetAmount = alloc.allocatedAmount;
      const variance = actualAmount - budgetAmount;
      const variancePercent =
        budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

      return {
        category: alloc.category.name,
        categoryCode: alloc.category.code,
        budgeted: budgetAmount,
        actual: actualAmount,
        variance,
        variancePercent,
        status: variance >= 0 ? "FAVORABLE" : "UNFAVORABLE",
        utilizationRate:
          budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0,
      };
    });

    // Sort by absolute variance (largest issues first)
    const sortedVariances = variances.sort(
      (a, b) => Math.abs(b.variance) - Math.abs(a.variance)
    );

    const totalBudget = allocations.reduce(
      (sum, a) => sum + a.allocatedAmount,
      0
    );
    const totalActual = actualIncome.reduce(
      (sum, a) => sum + (a._sum.amount || 0),
      0
    );
    const totalVariance = totalActual - totalBudget;

    return {
      error: null,
      data: {
        period: {
          id: period.id,
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
        },
        variances: sortedVariances,
        summary: {
          totalBudget,
          totalActual,
          totalVariance,
          totalVariancePercent:
            totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0,
          favorableCount: variances.filter((v) => v.status === "FAVORABLE")
            .length,
          unfavorableCount: variances.filter((v) => v.status === "UNFAVORABLE")
            .length,
        },
      },
    };
  } catch (error) {
    console.error("Error generating variance analysis:", error);
    return { error: "Failed to generate variance analysis", data: null };
  }
}

// Export income report to Excel format (returns data for client-side processing)
export async function exportIncomeReport(params: {
  startDate: Date;
  endDate: Date;
  branchId?: string;
  format: "summary" | "detailed";
}) {
  try {
    const { userId } = auth();
    if (!userId) {
      return { error: "Unauthorized", data: null };
    }

    const where: any = {
      status: TransactionStatus.COMPLETED,
      recordDate: {
        gte: params.startDate,
        lte: params.endDate,
      },
    };

    if (params.branchId) {
      where.branchId = params.branchId;
    }

    const records = await db.incomeRecord.findMany({
      where,
      include: {
        category: true,
        branch: true,
        member: true,
        receivedByUser: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { recordDate: "asc" },
    });

    // Format data for export
    const exportData = records.map((record) => ({
      "Receipt No": record.receiptNo,
      Date: format(record.recordDate, "yyyy-MM-dd"),
      Category: record.category.name,
      "Category Code": record.category.code,
      Description: record.description,
      Amount: record.amount,
      Branch: record.branch?.name || "N/A",
      Member: record.member
        ? `${record.member.firstName} ${record.member.lastName}`
        : "N/A",
      "Member No": record.member?.memberNumber || "N/A",
      "Payment Method": record.paymentMethod || "N/A",
      Basis: record.basis,
      "Received By": `${record.receivedByUser.firstName} ${record.receivedByUser.lastName}`,
      Status: record.status,
    }));

    return {
      error: null,
      data: exportData,
    };
  } catch (error) {
    console.error("Error exporting income report:", error);
    return { error: "Failed to export income report", data: null };
  }
}
