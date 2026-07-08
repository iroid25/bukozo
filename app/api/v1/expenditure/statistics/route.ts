import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole, TransactionStatus } from "@prisma/client";
import { resolveBranchScope } from "@/lib/services/branch-scope";

// GET /api/v1/expenditure/statistics - Get expenditure statistics
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
      status: TransactionStatus.COMPLETED,
    };

    if (startDate && endDate) {
      whereClause.recordDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const [
      totalExpenditure,
      totalRecords,
      todayExpenditure,
      thisMonthExpenditure,
      pendingExpenditure,
      pendingCount,
      categoryBreakdown,
      branchBreakdown,
    ] = await Promise.all([
      db.expenditureRecord.aggregate({
        where: whereClause,
        _sum: { amount: true },
      }),
      db.expenditureRecord.count({
        where: whereClause,
      }),
      db.expenditureRecord.aggregate({
        where: {
          ...whereClause,
          recordDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        _sum: { amount: true },
      }),
      db.expenditureRecord.aggregate({
        where: {
          ...whereClause,
          recordDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { amount: true },
      }),
      db.expenditureRecord.aggregate({
        where: {
          ...branchFilter,
          status: TransactionStatus.PENDING,
        },
        _sum: { amount: true },
      }),
      db.expenditureRecord.count({
        where: {
          ...branchFilter,
          status: TransactionStatus.PENDING,
        },
      }),
      db.expenditureRecord.groupBy({
        by: ["budgetCategoryId"],
        where: whereClause,
        _count: true,
        _sum: { amount: true },
      }),
      db.expenditureRecord.groupBy({
        by: ["branchId"],
        where: {
          ...whereClause,
          branchId: { not: null },
        },
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    // Get category names
    const categoryIds = categoryBreakdown
      .map((item) => item.budgetCategoryId)
      .filter((id): id is string => id !== null);
    const categories = await db.budgetCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    // Get branch names
    const branchIds = branchBreakdown
      .map((item) => item.branchId)
      .filter((id): id is string => id !== null);
    const branches = await db.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    const statistics = {
      totalExpenditure: totalExpenditure._sum.amount || 0,
      totalRecords,
      todayExpenditure: todayExpenditure._sum.amount || 0,
      thisMonthExpenditure: thisMonthExpenditure._sum.amount || 0,
      pendingExpenditure: pendingExpenditure._sum.amount || 0,
      pendingCount,
      averageExpenditure:
        totalRecords > 0
          ? (totalExpenditure._sum.amount || 0) / totalRecords
          : 0,
      categoryBreakdown: categoryBreakdown.map((item) => ({
        categoryId: item.budgetCategoryId || "",
        categoryName: item.budgetCategoryId
          ? categoryMap.get(item.budgetCategoryId) || "Unknown"
          : "Unknown",
        count: item._count,
        amount: item._sum.amount || 0,
      })),
      branchBreakdown: branchBreakdown.map((item) => ({
        branchId: item.branchId,
        branchName: item.branchId
          ? branchMap.get(item.branchId) || "Unknown"
          : "No Branch",
        count: item._count,
        amount: item._sum.amount || 0,
      })),
    };

    return NextResponse.json({ data: statistics });
  } catch (error) {
    console.error("Error fetching expenditure statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
