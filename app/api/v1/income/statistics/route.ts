import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole, TransactionStatus } from "@prisma/client";
import { resolveBranchScope } from "@/lib/services/branch-scope";

const BLOCKED_INCOME_CATEGORY_NAMES = ["loan insurance fees", "loan share capital"];

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
      select: { id: true, name: true, parent: { select: { name: true } } },
    });

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

    const statistics = {
      totalIncome: totalIncome._sum.amount || 0,
      totalRecords,
      todayIncome: todayIncome._sum.amount || 0,
      todayRecords,
      thisMonthIncome: thisMonthIncome._sum.amount || 0,
      averageIncome:
        totalRecords > 0 ? (totalIncome._sum.amount || 0) / totalRecords : 0,
      categoryBreakdown: categoryBreakdown.map((item) => {
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
      }),
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
