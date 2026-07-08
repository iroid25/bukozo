import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { ReconciliationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "ACCOUNTANT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const branchFilter = user.branchId ? { branchId: user.branchId } : undefined;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalBalance,
      activeFloats,
      todayAllocations,
      pendingReconciliationsCount,
      unreconciledTellersCount,
      balancedCount,
      unbalancedCount,
      recentAllocations,
      pendingReconciliations,
      unreconciledTellers,
    ] = await Promise.all([
      db.userFloat.aggregate({
        where: branchFilter ? { user: branchFilter } : undefined,
        _sum: { balance: true },
      }),
      db.userFloat.count({
        where: {
          balance: { gt: 0 },
          ...(branchFilter ? { user: branchFilter } : {}),
        },
      }),
      db.floatAllocation.count({
        where: {
          allocationDate: { gte: todayStart },
          ...(branchFilter ? { branchId: branchFilter.branchId } : {}),
        },
      }),
      db.floatReconciliation.count({
        where: {
          status: ReconciliationStatus.PENDING,
          isEndOfDay: true,
          ...(branchFilter ? { float: { user: branchFilter } } : {}),
        },
      }),
      db.userFloat.count({
        where: {
          isActiveForDay: true,
          ...(branchFilter ? { user: branchFilter } : {}),
          OR: [
            { pendingReconciliation: true },
            { currentDayStarted: { lt: todayStart } },
          ],
        },
      }),
      db.floatReconciliation.count({
        where: {
          reconciliationDate: { gte: thirtyDaysAgo },
          status: ReconciliationStatus.APPROVED,
          ...(branchFilter ? { float: { user: branchFilter } } : {}),
        },
      }),
      db.floatReconciliation.count({
        where: {
          reconciliationDate: { gte: thirtyDaysAgo },
          status: ReconciliationStatus.REJECTED,
          ...(branchFilter ? { float: { user: branchFilter } } : {}),
        },
      }),
      db.floatAllocation.findMany({
        where: branchFilter ? { branchId: branchFilter.branchId } : undefined,
        include: {
          branch: true,
          tellerAgent: { select: { id: true, name: true, role: true, email: true, phone: true } },
          allocatedByUser: { select: { id: true, name: true, role: true } },
        },
        orderBy: { allocationDate: "desc" },
      }),
      db.floatReconciliation.findMany({
        where: {
          status: ReconciliationStatus.PENDING,
          isEndOfDay: true,
          ...(branchFilter ? { float: { user: branchFilter } } : {}),
        },
        include: {
          float: { include: { user: { include: { branch: true } } } },
          reconciledByUser: true,
        },
        orderBy: { reconciliationDate: "desc" },
      }),
      db.userFloat.findMany({
        where: {
          isActiveForDay: true,
          ...(branchFilter ? { user: branchFilter } : {}),
          OR: [
            { pendingReconciliation: true },
            { currentDayStarted: { lt: todayStart } },
          ],
        },
        include: { user: { include: { branch: true } } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        statistics: {
          totalBalance: totalBalance._sum.balance || 0,
          activeFloats,
          todayAllocations,
          pendingReconciliations: pendingReconciliationsCount,
          unreconciledTellersCount,
          reconciliationStatus: { balanced: balancedCount, unbalanced: unbalancedCount },
        },
        recent: { recentAllocations, pendingReconciliations, unreconciledTellers },
      },
    });
  } catch (error: any) {
    console.error("Error fetching float dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch float dashboard" }, { status: 500 });
  }
}
