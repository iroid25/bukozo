// actions/reconciliation-branch.ts
"use server";

import { db } from "@/prisma/db";
import { ReconciliationStatus, UserRole } from "@prisma/client";

import type {
  BranchSuspenseSummary,
  CompanyWideSuspenseSummary,
  BranchSuspenseResponse,
  CompanySuspenseResponse,
  SuspenseEntry,
  ShortageEntry,
  ReconciliationFilters,
  BranchReconciliationStatistics,
} from "@/types/reconciliation";

const TOLERANCE = 1000;

// ============================================================================
// GET BRANCH SUSPENSE DATA (For Branch Managers/Accountants)
// ============================================================================

export async function getBranchSuspenseData(
  branchId: string,
  filters?: ReconciliationFilters
): Promise<BranchSuspenseResponse> {
  try {
    const whereClause: any = {
      status: ReconciliationStatus.APPROVED,
      isEndOfDay: true,
      float: {
        user: {
          branchId: branchId,
        },
      },
    };

    if (filters?.startDate || filters?.endDate) {
      whereClause.reconciliationDate = {};
      if (filters.startDate) {
        whereClause.reconciliationDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.reconciliationDate.lte = filters.endDate;
      }
    }

    if (filters?.userId) {
      whereClause.float = {
        user: {
          ...whereClause.float.user,
          id: filters.userId,
        },
      };
    }

    // Get all reconciliations for this branch
    const reconciliations = await db.floatReconciliation.findMany({
      where: whereClause,
      include: {
        float: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                branch: {
                  select: {
                    id: true,
                    name: true,
                    location: true,
                  },
                },
              },
            },
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        reconciliationDate: "desc",
      },
    });

    // Separate overages and shortages
    const overageEntries = reconciliations.filter(
      (r) => r.difference > TOLERANCE
    ) as any as SuspenseEntry[];

    const shortageEntries = reconciliations.filter(
      (r) => r.difference < -TOLERANCE
    ) as any as ShortageEntry[];

    // Calculate totals
    const totalOverages = overageEntries.reduce(
      (sum, entry) => sum + entry.difference,
      0
    );

    const totalShortages = shortageEntries.reduce(
      (sum, entry) => sum + Math.abs(entry.difference),
      0
    );

    const unresolvedOverages = overageEntries.filter(
      (e) => e.status === ReconciliationStatus.PENDING
    ).length;

    const unresolvedShortages = shortageEntries.filter(
      (e) => e.status === ReconciliationStatus.PENDING
    ).length;

    // Get branch info
    const branch = await db.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        location: true,
      },
    });

    const lastReconciliation =
      reconciliations.length > 0 ? reconciliations[0].reconciliationDate : null;

    const branchSummary: BranchSuspenseSummary = {
      branchId: branch?.id || branchId,
      branchName: branch?.name || "Unknown Branch",
      branchLocation: branch?.location || null,
      totalOverages,
      totalShortages,
      netPosition: totalOverages - totalShortages,
      overageCount: overageEntries.length,
      shortageCount: shortageEntries.length,
      lastReconciliationDate: lastReconciliation,
      unresolvedOverages,
      unresolvedShortages,
      overageEntries,
      shortageEntries,
    };

    return {
      branchSummary,
    };
  } catch (error) {
    console.error("Error fetching branch suspense data:", error);
    throw error;
  }
}

// ============================================================================
// GET COMPANY-WIDE SUSPENSE DATA (For Admin)
// ============================================================================

export async function getCompanyWideSuspenseData(
  filters?: ReconciliationFilters
): Promise<CompanySuspenseResponse> {
  try {
    // Get all branches
    const branches = await db.branch.findMany({
      select: {
        id: true,
        name: true,
        location: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const branchSummaries: BranchSuspenseSummary[] = [];

    // Get suspense data for each branch
    for (const branch of branches) {
      const whereClause: any = {
        status: ReconciliationStatus.APPROVED,
        isEndOfDay: true,
        float: {
          user: {
            branchId: branch.id,
          },
        },
      };

      if (filters?.startDate || filters?.endDate) {
        whereClause.reconciliationDate = {};
        if (filters.startDate) {
          whereClause.reconciliationDate.gte = filters.startDate;
        }
        if (filters.endDate) {
          whereClause.reconciliationDate.lte = filters.endDate;
        }
      }

      const reconciliations = await db.floatReconciliation.findMany({
        where: whereClause,
        include: {
          float: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  phone: true,
                  branch: {
                    select: {
                      id: true,
                      name: true,
                      location: true,
                    },
                  },
                },
              },
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: {
          reconciliationDate: "desc",
        },
      });

      // Separate overages and shortages
      const overageEntries = reconciliations.filter(
        (r) => r.difference > TOLERANCE
      ) as any as SuspenseEntry[];

      const shortageEntries = reconciliations.filter(
        (r) => r.difference < -TOLERANCE
      ) as any as ShortageEntry[];

      const totalOverages = overageEntries.reduce(
        (sum, entry) => sum + entry.difference,
        0
      );

      const totalShortages = shortageEntries.reduce(
        (sum, entry) => sum + Math.abs(entry.difference),
        0
      );

      const unresolvedOverages = overageEntries.filter(
        (e) => e.status === ReconciliationStatus.PENDING
      ).length;

      const unresolvedShortages = shortageEntries.filter(
        (e) => e.status === ReconciliationStatus.PENDING
      ).length;

      const lastReconciliation =
        reconciliations.length > 0
          ? reconciliations[0].reconciliationDate
          : null;

      branchSummaries.push({
        branchId: branch.id,
        branchName: branch.name,
        branchLocation: branch.location,
        totalOverages,
        totalShortages,
        netPosition: totalOverages - totalShortages,
        overageCount: overageEntries.length,
        shortageCount: shortageEntries.length,
        lastReconciliationDate: lastReconciliation,
        unresolvedOverages,
        unresolvedShortages,
        overageEntries,
        shortageEntries,
      });
    }

    // Calculate company-wide totals
    const totalOverages = branchSummaries.reduce(
      (sum, branch) => sum + branch.totalOverages,
      0
    );

    const totalShortages = branchSummaries.reduce(
      (sum, branch) => sum + branch.totalShortages,
      0
    );

    const branchesWithOverages = branchSummaries.filter(
      (b) => b.overageCount > 0
    ).length;

    const branchesWithShortages = branchSummaries.filter(
      (b) => b.shortageCount > 0
    ).length;

    const companySummary: CompanyWideSuspenseSummary = {
      totalOverages,
      totalShortages,
      netPosition: totalOverages - totalShortages,
      totalBranches: branches.length,
      branchesWithOverages,
      branchesWithShortages,
      branches: branchSummaries,
    };

    return {
      companySummary,
    };
  } catch (error) {
    console.error("Error fetching company-wide suspense data:", error);
    throw error;
  }
}

// ============================================================================
// GET BRANCH STATISTICS
// ============================================================================

export async function getBranchReconciliationStatistics(
  branchId: string
): Promise<BranchReconciliationStatistics> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const branch = await db.branch.findUnique({
      where: { id: branchId },
      select: { name: true },
    });

    const allReconciliations = await db.floatReconciliation.findMany({
      where: {
        float: {
          user: {
            branchId: branchId,
          },
        },
      },
      select: {
        id: true,
        status: true,
        reconciliationDate: true,
        difference: true,
        floatReturned: true,
      },
    });

    const totalReconciliations = allReconciliations.length;

    const pending = allReconciliations.filter(
      (r) => r.status === ReconciliationStatus.PENDING
    ).length;

    const approved = allReconciliations.filter(
      (r) => r.status === ReconciliationStatus.APPROVED
    ).length;

    const rejected = allReconciliations.filter(
      (r) => r.status === ReconciliationStatus.REJECTED
    ).length;

    const todayReconciliations = allReconciliations.filter((r) => {
      const recDate = new Date(r.reconciliationDate);
      recDate.setHours(0, 0, 0, 0);
      return recDate.getTime() === today.getTime();
    }).length;

    // Overages
    const overages = allReconciliations.filter((r) => r.difference > TOLERANCE);
    const totalOverages = overages.length;
    const unresolvedOverages = overages.filter(
      (r) => r.status === ReconciliationStatus.PENDING
    ).length;
    const totalSuspense = overages.reduce((sum, r) => sum + r.difference, 0);

    // Shortages
    const shortages = allReconciliations.filter(
      (r) => r.difference < -TOLERANCE
    );
    const totalShortages = shortages.length;
    const unresolvedShortages = shortages.filter(
      (r) => r.status === ReconciliationStatus.PENDING
    ).length;
    const totalShortage = shortages.reduce(
      (sum, r) => sum + Math.abs(r.difference),
      0
    );

    const totalReturned = allReconciliations.reduce(
      (sum, r) => sum + (r.floatReturned || 0),
      0
    );

    return {
      branchId,
      branchName: branch?.name || "Unknown Branch",
      totalReconciliations,
      pending,
      approved,
      rejected,
      today: todayReconciliations,
      totalSuspense,
      totalReturned,
      totalShortage,
      totalOverages,
      totalShortages,
      unresolvedOverages,
      unresolvedShortages,
      resolvedCount: approved,
      pendingCount: pending,
    };
  } catch (error) {
    console.error("Failed to get branch reconciliation statistics:", error);
    return {
      branchId,
      branchName: "Unknown Branch",
      totalReconciliations: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      today: 0,
      totalSuspense: 0,
      totalReturned: 0,
      totalShortage: 0,
      totalOverages: 0,
      totalShortages: 0,
      unresolvedOverages: 0,
      unresolvedShortages: 0,
      resolvedCount: 0,
      pendingCount: 0,
    };
  }
}

// ============================================================================
// HELPER: GET ALL BRANCHES WITH SUSPENSE DATA (For Reports/Analytics)
// ============================================================================

export async function getAllBranchesWithSuspense(): Promise<
  BranchSuspenseSummary[]
> {
  try {
    const result = await getCompanyWideSuspenseData();
    return result.companySummary.branches;
  } catch (error) {
    console.error("Error fetching all branches with suspense:", error);
    return [];
  }
}

// ============================================================================
// HELPER: GET BRANCHES WITH UNRESOLVED ISSUES (For Alerts/Notifications)
// ============================================================================

export async function getBranchesWithUnresolvedIssues(): Promise<{
  branchesWithUnresolvedOverages: BranchSuspenseSummary[];
  branchesWithUnresolvedShortages: BranchSuspenseSummary[];
}> {
  try {
    const result = await getCompanyWideSuspenseData();

    const branchesWithUnresolvedOverages =
      result.companySummary.branches.filter((b) => b.unresolvedOverages > 0);

    const branchesWithUnresolvedShortages =
      result.companySummary.branches.filter((b) => b.unresolvedShortages > 0);

    return {
      branchesWithUnresolvedOverages,
      branchesWithUnresolvedShortages,
    };
  } catch (error) {
    console.error("Error fetching branches with unresolved issues:", error);
    return {
      branchesWithUnresolvedOverages: [],
      branchesWithUnresolvedShortages: [],
    };
  }
}

// ============================================================================
// HELPER: GET TOP BRANCHES BY SUSPENSE AMOUNT (For Admin Dashboard)
// ============================================================================

export async function getTopBranchesBySuspense(limit: number = 5): Promise<{
  topOverageBranches: BranchSuspenseSummary[];
  topShortageBranches: BranchSuspenseSummary[];
}> {
  try {
    const result = await getCompanyWideSuspenseData();

    const topOverageBranches = [...result.companySummary.branches]
      .sort((a, b) => b.totalOverages - a.totalOverages)
      .slice(0, limit);

    const topShortageBranches = [...result.companySummary.branches]
      .sort((a, b) => b.totalShortages - a.totalShortages)
      .slice(0, limit);

    return {
      topOverageBranches,
      topShortageBranches,
    };
  } catch (error) {
    console.error("Error fetching top branches by suspense:", error);
    return {
      topOverageBranches: [],
      topShortageBranches: [],
    };
  }
}

// ============================================================================
// HELPER: GET SUSPENSE TREND DATA (For Charts/Graphs)
// ============================================================================

export async function getSuspenseTrendData(
  branchId?: string,
  days: number = 30
): Promise<
  {
    date: Date;
    overages: number;
    shortages: number;
    netPosition: number;
  }[]
> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const whereClause: any = {
      status: ReconciliationStatus.APPROVED,
      isEndOfDay: true,
      reconciliationDate: {
        gte: startDate,
      },
    };

    if (branchId) {
      whereClause.float = {
        user: {
          branchId: branchId,
        },
      };
    }

    const reconciliations = await db.floatReconciliation.findMany({
      where: whereClause,
      select: {
        reconciliationDate: true,
        difference: true,
      },
      orderBy: {
        reconciliationDate: "asc",
      },
    });

    // Group by date
    const trendMap = new Map<string, { overages: number; shortages: number }>();

    reconciliations.forEach((rec) => {
      const date = new Date(rec.reconciliationDate);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString();

      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, { overages: 0, shortages: 0 });
      }

      const data = trendMap.get(dateKey)!;
      if (rec.difference > TOLERANCE) {
        data.overages += rec.difference;
      } else if (rec.difference < -TOLERANCE) {
        data.shortages += Math.abs(rec.difference);
      }
    });

    // Convert to array
    const trendData = Array.from(trendMap.entries()).map(([dateStr, data]) => ({
      date: new Date(dateStr),
      overages: data.overages,
      shortages: data.shortages,
      netPosition: data.overages - data.shortages,
    }));

    return trendData;
  } catch (error) {
    console.error("Error fetching suspense trend data:", error);
    return [];
  }
}
