import { NextResponse } from "next/server";
import { ReconciliationStatus, UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import {
  getActiveBranchReserveVault,
  getOrganisationalReserveVault,
} from "@/lib/reserve-vault";

const ALLOWED_ROLES = ["ACCOUNTANT", "ADMIN", "BRANCHMANAGER"] as const;

function isSameDay(date: Date | null | undefined): boolean {
  if (!date) return false;
  const d = new Date(date);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function calculateFloatStatistics(
  allocations: any[],
  pendingReconciliations: any[]
) {
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const todayAllocations = allocations.filter(
    (allocation) => new Date(allocation.allocationDate) >= todayStart
  );

  return {
    totalAllocations: allocations.length,
    totalAmount: allocations.reduce((sum, a) => sum + a.amount, 0),
    todayAllocations: todayAllocations.length,
    todayAmount: todayAllocations.reduce((sum, a) => sum + a.amount, 0),
    activeTellers: new Set(
      allocations
        .filter((a) => new Date(a.allocationDate) >= todayStart)
        .map((a) => a.tellerAgentId)
    ).size,
    pendingReconciliations: pendingReconciliations.length,
  };
}

function determineFloatEligibility(
  floatStatus: any,
  hasPendingReconciliation: boolean
): boolean {
  if (!floatStatus) return true;
  if (hasPendingReconciliation || floatStatus.pendingReconciliation) return false;
  if (!floatStatus.canStartNewDay) return false;
  if (floatStatus.balance === 0 && !floatStatus.isActiveForDay) return true;
  if (floatStatus.isActiveForDay && isSameDay(floatStatus.currentDayStarted)) return true;
  if (floatStatus.isActiveForDay && !isSameDay(floatStatus.currentDayStarted)) return false;
  return true;
}

function getIneligibilityReason(
  floatStatus: any,
  hasPendingReconciliation: boolean
): string {
  if (hasPendingReconciliation || floatStatus.pendingReconciliation) {
    return "Has pending EOD reconciliation awaiting approval";
  }
  if (!floatStatus.canStartNewDay) {
    return "Previous day not reconciled - EOD approval required";
  }
  if (floatStatus.isActiveForDay && !isSameDay(floatStatus.currentDayStarted)) {
    return "Active day is stale - must submit EOD first";
  }
  return "Not eligible for float allocation";
}

function enhanceUsersWithFloatStatus(users: any[], pendingReconciliations: any[]) {
  const pendingReconciliationUserIds = new Set(
    pendingReconciliations.map((r) => r.float.userId)
  );

  return users
    .map((user) => {
      const floatStatus = user.userFloat
        ? {
            balance: user.userFloat.balance,
            isActiveForDay: user.userFloat.isActiveForDay,
            canStartNewDay: user.userFloat.canStartNewDay,
            pendingReconciliation: user.userFloat.pendingReconciliation,
            currentDayStarted: user.userFloat.currentDayStarted,
            lastReconciliation: user.userFloat.lastReconciliation,
          }
        : null;

      const hasPendingReconciliation = pendingReconciliationUserIds.has(user.id);
      const isEligible = determineFloatEligibility(
        floatStatus,
        hasPendingReconciliation
      );

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch
          ? {
              id: user.branch.id,
              name: user.branch.name,
              location: user.branch.location,
            }
          : undefined,
        floatStatus: floatStatus
          ? {
              ...floatStatus,
              hasPendingReconciliation,
              isEligible,
              ineligibilityReason: !isEligible
                ? getIneligibilityReason(floatStatus, hasPendingReconciliation)
                : null,
            }
          : null,
      };
    })
    .sort((a, b) => {
      if (a.floatStatus?.isEligible !== b.floatStatus?.isEligible) {
        return a.floatStatus?.isEligible ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
}

export async function GET() {
  try {
    const user = await getAuthUser();

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!ALLOWED_ROLES.includes(user.role as any)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const branchFilter =
      user.role === UserRole.ACCOUNTANT
        ? user.branchId
          ? { branchId: user.branchId }
          : null
        : {};

    if (user.role === UserRole.ACCOUNTANT && !user.branchId) {
      return NextResponse.json(
        {
          success: false,
          error: "Accountant must be assigned to a branch",
        },
        { status: 400 }
      );
    }

    const [floatAllocations, eligibleUsers, branches, pendingReconciliations] =
      await Promise.all([
        db.floatAllocation.findMany({
          where: branchFilter || undefined,
          include: {
            branch: true,
            tellerAgent: {
              select: {
                id: true,
                name: true,
                role: true,
                email: true,
                phone: true,
              },
            },
            allocatedByUser: { select: { id: true, name: true, role: true } },
          },
          orderBy: { allocationDate: "desc" },
        }),
        db.user.findMany({
          where: {
            role: { in: ["TELLER", "AGENT"] },
            isActive: true,
            ...(branchFilter || {}),
          },
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
            userFloat: {
              select: {
                id: true,
                balance: true,
                isActiveForDay: true,
                canStartNewDay: true,
                pendingReconciliation: true,
                currentDayStarted: true,
                lastReconciliation: true,
              },
            },
          },
          orderBy: { name: "asc" },
        }),
        db.branch.findMany({
          where:
            user.role === UserRole.ACCOUNTANT && user.branchId
              ? { id: user.branchId }
              : undefined,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            location: true,
          },
        }),
        db.floatReconciliation.findMany({
          where: {
            status: ReconciliationStatus.PENDING,
            isEndOfDay: true,
            float: {
              user: branchFilter || {},
            },
          },
          include: {
            float: { include: { user: { include: { branch: true } } } },
            reconciledByUser: true,
          },
          orderBy: { reconciliationDate: "desc" },
        }),
      ]);

    const [vaultData, orgVault] = await Promise.all([
      user.branchId
        ? getActiveBranchReserveVault(user.branchId)
        : user.role === UserRole.ADMIN
          ? getOrganisationalReserveVault()
          : null,
      getOrganisationalReserveVault(),
    ]);

    const statistics = calculateFloatStatistics(
      floatAllocations,
      pendingReconciliations
    );
    const enhancedUsers = enhanceUsersWithFloatStatus(
      eligibleUsers,
      pendingReconciliations
    );
    const eligibleCount = enhancedUsers.filter(
      (u) => u.floatStatus?.isEligible !== false
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        floatAllocations,
        eligibleUsers: enhancedUsers,
        branches,
        pendingReconciliations,
        statistics,
        eligibleCount,
        vaultBalance: vaultData?.balance || 0,
        vaultId: vaultData?.id || "",
        vaultData,
        branchReserveVault: vaultData,
        branchReserveBalance: vaultData?.balance || 0,
        branchReserveId: vaultData?.id || "",
        branchReserveMissing: !vaultData,
        orgReserveId: orgVault?.id || "",
        currentUserId: user.id,
        branchId: user.branchId || null,
      },
    });
  } catch (error) {
    console.error("Error fetching float overview:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
