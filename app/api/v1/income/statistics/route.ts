import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole, TransactionStatus } from "@prisma/client";
import { resolveBranchScope } from "@/lib/services/branch-scope";

const BLOCKED_INCOME_CATEGORY_NAMES = ["loan insurance fees", "loan share capital"];
const LOAN_INCOME_CODES = ["401001", "401002", "401005"];

// GET /api/v1/income/statistics - Get income statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;

    const requestedBranchId = searchParams.get("branchId");
    const branchId = resolveBranchScope(user, requestedBranchId);
    const branchFilter = user.role === UserRole.ADMIN
      ? (branchId ? { branchId } : {})
      : user.branchId
        ? { branchId: user.branchId }
        : { branchId: "no-branch-assigned" };

    const whereClause: any = {
      ...branchFilter,
      status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
      budgetCategory: {
        kind: "INCOME",
        name: {
          notIn: BLOCKED_INCOME_CATEGORY_NAMES,
          mode: "insensitive",
        },
      },
    };

    if (startDate && endDate) {
      whereClause.recordDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const [
      totalIncome,
      totalRecords,
      todayIncome,
      todayRecords,
      thisMonthIncome,
      categoryBreakdown,
      branchBreakdown,
      paymentMethodBreakdown,
    ] = await Promise.all([
      db.incomeRecord.aggregate({
        where: whereClause,
        _sum: { amount: true },
      }),
      db.incomeRecord.count({
        where: whereClause,
      }),
      db.incomeRecord.aggregate({
        where: {
          ...whereClause,
          recordDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        _sum: { amount: true },
      }),
      db.incomeRecord.count({
        where: {
          ...whereClause,
          recordDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      db.incomeRecord.aggregate({
        where: {
          ...whereClause,
          recordDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { amount: true },
      }),
      db.incomeRecord.groupBy({
        by: ["budgetCategoryId"],
        where: whereClause,
        _count: true,
        _sum: { amount: true },
      }),
      db.incomeRecord.groupBy({
        by: ["branchId"],
        where: {
          ...whereClause,
          branchId: { not: null },
        },
        _count: true,
        _sum: { amount: true },
      }),
      db.incomeRecord.groupBy({
        by: ["paymentMethod"],
        where: whereClause,
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    // Get category names
    const categoryIds = categoryBreakdown
      .map((item) => item.budgetCategoryId)
      .filter((id): id is string => id !== null);
    const categories = await db.budgetCategory.findMany({
      where: { id: { in: categoryIds }, kind: "INCOME" },
      select: { id: true, code: true, name: true, parent: { select: { name: true } } },
    });

    const fallbackCategories = await db.budgetCategory.findMany({
      where: {
        code: { in: LOAN_INCOME_CODES },
        kind: "INCOME",
      },
      select: { id: true, code: true, name: true, parent: { select: { name: true } } },
    });

    const fallbackAccounts = await db.chartOfAccount.findMany({
      where: {
        accountCode: { in: LOAN_INCOME_CODES },
        isActive: true,
      },
      select: { id: true, accountCode: true },
    });

    const fallbackAccountIds = fallbackAccounts.map((account) => account.id);
    const fallbackJournalTotals = fallbackAccountIds.length
      ? await db.journalEntry.groupBy({
          by: ["accountId"],
          where: {
            accountId: { in: fallbackAccountIds },
            ...(user.role === UserRole.ADMIN
              ? (branchId ? { branchId } : {})
              : user.branchId
                ? { branchId: user.branchId }
                : { branchId: "no-branch-assigned" }),
          },
          _count: true,
          _sum: { creditAmount: true },
        })
      : [];

    const fallbackAccountMap = new Map(
      fallbackAccounts.map((account) => [account.id, account.accountCode]),
    );
    const fallbackTotalsByCode = new Map<string, { count: number; amount: number }>();
    for (const item of fallbackJournalTotals) {
      const code = fallbackAccountMap.get(item.accountId);
      if (!code) continue;
      fallbackTotalsByCode.set(code, {
        count: item._count,
        amount: item._sum.creditAmount || 0,
      });
    }

    // Get branch names
    const branchIds = branchBreakdown
      .map((item) => item.branchId)
      .filter((id): id is string => id !== null);
    const branches = await db.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    const directBreakdown = categoryBreakdown.map((item) => {
      const cat = item.budgetCategoryId
        ? categoryMap.get(item.budgetCategoryId)
        : null;
      return {
        categoryId: item.budgetCategoryId || "",
        categoryName: cat?.name || "Unknown",
        parentName: cat?.parent?.name,
        count: item._count,
        amount: item._sum.amount || 0,
      };
    });

    const breakdownCodesWithDirectAmounts = new Set(
      directBreakdown
        .map((row) => {
          const category = categories.find((item) => item.id === row.categoryId);
          return category?.code || "";
        })
        .filter(Boolean),
    );

    const fallbackBreakdown = fallbackCategories
      .map((category) => {
        const fallback = fallbackTotalsByCode.get(category.code || "");
        if (!fallback || fallback.amount <= 0) return null;
        if (breakdownCodesWithDirectAmounts.has(category.code || "")) return null;
        return {
          categoryId: category.id,
          categoryName: category.name,
          parentName: category.parent?.name,
          count: fallback.count,
          amount: fallback.amount,
        };
      })
      .filter(
        (item): item is {
          categoryId: string;
          categoryName: string;
          parentName: string | undefined;
          count: number;
          amount: number;
        } => item !== null,
      );

    const statistics = {
      totalIncome: totalIncome._sum.amount || 0,
      totalRecords,
      todayIncome: todayIncome._sum.amount || 0,
      todayRecords,
      thisMonthIncome: thisMonthIncome._sum.amount || 0,
      averageIncome:
        totalRecords > 0 ? (totalIncome._sum.amount || 0) / totalRecords : 0,
      categoryBreakdown: [...directBreakdown, ...fallbackBreakdown],
      branchBreakdown: branchBreakdown.map((item) => ({
        branchId: item.branchId,
        branchName: item.branchId
          ? branchMap.get(item.branchId) || "Unknown"
          : "No Branch",
        count: item._count,
        amount: item._sum.amount || 0,
      })),
      paymentMethodBreakdown: paymentMethodBreakdown.map((item) => ({
        method: item.paymentMethod,
        count: item._count,
        amount: item._sum.amount || 0,
      })),
    };

    return NextResponse.json({ data: statistics });
  } catch (error) {
    console.error("Error fetching income statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
