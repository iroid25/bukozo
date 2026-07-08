import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { ReconciliationStatus, UserRole } from "@prisma/client";

const TOLERANCE = 1000;

async function getReconciliationStats(branchId?: string) {
  const where: any = { isEndOfDay: true };
  if (branchId) where.float = { user: { branchId } };
  const [total, pending, approved, rejected] = await Promise.all([
    db.floatReconciliation.count({ where }),
    db.floatReconciliation.count({ where: { ...where, status: ReconciliationStatus.PENDING } }),
    db.floatReconciliation.count({ where: { ...where, status: ReconciliationStatus.APPROVED } }),
    db.floatReconciliation.count({ where: { ...where, status: ReconciliationStatus.REJECTED } }),
  ]);
  return { total, pending, approved, rejected };
}

async function getBranchSuspenseData(branchId: string) {
  const reconciliations = await db.floatReconciliation.findMany({
    where: {
      status: ReconciliationStatus.APPROVED,
      isEndOfDay: true,
      float: { user: { branchId } },
    },
    include: {
      float: {
        include: {
          user: {
            select: {
              id: true, name: true, email: true, role: true, phone: true,
              branch: { select: { id: true, name: true, location: true } },
            },
          },
        },
      },
      approvedBy: { select: { id: true, name: true, role: true } },
    },
    orderBy: { reconciliationDate: "desc" },
  });

  const overageEntries = reconciliations.filter((r) => r.difference > TOLERANCE);
  const shortageEntries = reconciliations.filter((r) => r.difference < -TOLERANCE);
  const totalOverages = overageEntries.reduce((s, r) => s + r.difference, 0);
  const totalShortages = shortageEntries.reduce((s, r) => s + Math.abs(r.difference), 0);
  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, location: true },
  });
  const lastReconciliation = reconciliations[0]?.reconciliationDate || null;

  return {
    branchSummary: {
      branchId: branch?.id || branchId,
      branchName: branch?.name || "Unknown Branch",
      branchLocation: branch?.location || null,
      totalOverages,
      totalShortages,
      netPosition: totalOverages - totalShortages,
      overageCount: overageEntries.length,
      shortageCount: shortageEntries.length,
      lastReconciliationDate: lastReconciliation,
      unresolvedOverages: overageEntries.filter((r) => r.status === ReconciliationStatus.PENDING).length,
      unresolvedShortages: shortageEntries.filter((r) => r.status === ReconciliationStatus.PENDING).length,
      overageEntries,
      shortageEntries,
    },
  };
}

async function getCompanyWideSuspenseData() {
  const branches = await db.branch.findMany({
    select: { id: true, name: true, location: true },
    orderBy: { name: "asc" },
  });

  const branchSummaries = await Promise.all(
    branches.map(async (branch) => {
      const reconciliations = await db.floatReconciliation.findMany({
        where: {
          status: ReconciliationStatus.APPROVED,
          isEndOfDay: true,
          float: { user: { branchId: branch.id } },
        },
        include: {
          float: {
            include: {
              user: {
                select: {
                  id: true, name: true, email: true, role: true, phone: true,
                  branch: { select: { id: true, name: true, location: true } },
                },
              },
            },
          },
          approvedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { reconciliationDate: "desc" },
      });

      const overageEntries = reconciliations.filter((r) => r.difference > TOLERANCE);
      const shortageEntries = reconciliations.filter((r) => r.difference < -TOLERANCE);
      const totalOverages = overageEntries.reduce((s, r) => s + r.difference, 0);
      const totalShortages = shortageEntries.reduce((s, r) => s + Math.abs(r.difference), 0);

      return {
        branchId: branch.id,
        branchName: branch.name,
        branchLocation: branch.location,
        totalOverages,
        totalShortages,
        netPosition: totalOverages - totalShortages,
        overageCount: overageEntries.length,
        shortageCount: shortageEntries.length,
        lastReconciliationDate: reconciliations[0]?.reconciliationDate || null,
        unresolvedOverages: overageEntries.filter((r) => r.status === ReconciliationStatus.PENDING).length,
        unresolvedShortages: shortageEntries.filter((r) => r.status === ReconciliationStatus.PENDING).length,
        overageEntries,
        shortageEntries,
      };
    })
  );

  const totalOverages = branchSummaries.reduce((s, b) => s + b.totalOverages, 0);
  const totalShortages = branchSummaries.reduce((s, b) => s + b.totalShortages, 0);

  return {
    companySummary: {
      totalOverages,
      totalShortages,
      netPosition: totalOverages - totalShortages,
      totalBranches: branches.length,
      branchesWithOverages: branchSummaries.filter((b) => b.overageCount > 0).length,
      branchesWithShortages: branchSummaries.filter((b) => b.shortageCount > 0).length,
      branches: branchSummaries,
    },
  };
}

async function getBranchReconciliationStatistics(branchId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const branch = await db.branch.findUnique({ where: { id: branchId }, select: { name: true } });
  const all = await db.floatReconciliation.findMany({
    where: { float: { user: { branchId } } },
    select: { id: true, status: true, reconciliationDate: true, difference: true, floatReturned: true },
  });

  const pending = all.filter((r) => r.status === ReconciliationStatus.PENDING).length;
  const approved = all.filter((r) => r.status === ReconciliationStatus.APPROVED).length;
  const rejected = all.filter((r) => r.status === ReconciliationStatus.REJECTED).length;
  const todayCount = all.filter((r) => {
    const d = new Date(r.reconciliationDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).length;

  const overages = all.filter((r) => r.difference > TOLERANCE);
  const shortages = all.filter((r) => r.difference < -TOLERANCE);

  return {
    branchId,
    branchName: branch?.name || "Unknown Branch",
    totalReconciliations: all.length,
    pending, approved, rejected,
    today: todayCount,
    totalSuspense: overages.reduce((s, r) => s + r.difference, 0),
    totalReturned: all.reduce((s, r) => s + (r.floatReturned || 0), 0),
    totalShortage: shortages.reduce((s, r) => s + Math.abs(r.difference), 0),
    totalOverages: overages.length,
    totalShortages: shortages.length,
    unresolvedOverages: overages.filter((r) => r.status === ReconciliationStatus.PENDING).length,
    unresolvedShortages: shortages.filter((r) => r.status === ReconciliationStatus.PENDING).length,
    resolvedCount: approved,
    pendingCount: pending,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;

    const currentUser = await db.user.findUnique({
      where: { email: user.email },
      select: {
        id: true, name: true, role: true, branchId: true,
        branch: { select: { id: true, name: true, location: true } },
      },
    });

    if (!currentUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (currentUser.role === UserRole.ADMIN) {
      const [companySuspenseData, statistics] = await Promise.all([
        getCompanyWideSuspenseData(),
        getReconciliationStats(),
      ]);
      return NextResponse.json({
        success: true,
        data: {
          isAdmin: true,
          companySummary: companySuspenseData.companySummary,
          statistics,
          currentUser,
        },
      });
    }

    if (!currentUser.branchId) {
      return NextResponse.json({
        success: true,
        data: { isAdmin: false, noBranch: true, currentUser },
      });
    }

    const [branchSuspenseData, branchStatistics] = await Promise.all([
      getBranchSuspenseData(currentUser.branchId),
      getBranchReconciliationStatistics(currentUser.branchId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        isAdmin: false,
        branchSummary: branchSuspenseData.branchSummary,
        statistics: branchStatistics,
        currentUser,
      },
    });
  } catch (error) {
    console.error("Error fetching suspense data:", error);
    return NextResponse.json({ error: "Failed to fetch suspense data" }, { status: 500 });
  }
}
