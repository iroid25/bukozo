import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, TransactionStatus } from "@prisma/client";
import { db } from "@/prisma/db";
import {
  getActiveBranchReserveVault,
  getOrganisationalReserveVault,
} from "@/lib/reserve-vault";

export async function GET() {
  try {
    const user = await getAuthUser();

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!["ADMIN", "ACCOUNTANT", "BRANCHMANAGER"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const [orgReserve, branchesData, allAllocations, historyData] =
      await Promise.all([
        getOrganisationalReserveVault(),
        user.role === UserRole.ADMIN
          ? db.branch.findMany({
              include: {
                vaults: {
                  where: { isActive: true },
                  orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
                },
                accountant: true,
                manager: true,
              },
              orderBy: { name: "asc" },
            })
          : Promise.resolve([]),
        user.role === UserRole.ADMIN
          ? db.branchReserveAllocation.findMany({
              include: {
                sourceVault: true,
                targetVault: { include: { branch: true } },
                allocatedByUser: { select: { name: true } },
                confirmedByUser: { select: { name: true } },
              },
              orderBy: { createdAt: "desc" },
            })
          : Promise.resolve([]),
        db.branchReserveAllocation.findMany({
          include: {
            sourceVault: { include: { branch: true } },
            targetVault: { include: { branch: true } },
            allocatedByUser: true,
            confirmedByUser: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);

    let pendingAllocations: any[] = [];
    let accountantVault: any = null;

    if (user.role === UserRole.ADMIN) {
      pendingAllocations = allAllocations.filter(
        (allocation: any) => allocation.status === TransactionStatus.PENDING
      );
    } else if (user.branchId) {
      pendingAllocations = await db.branchReserveAllocation.findMany({
        where: {
          targetVault: { branchId: user.branchId },
          status: TransactionStatus.PENDING,
        },
        include: {
          sourceVault: true,
          allocatedByUser: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      accountantVault = await getActiveBranchReserveVault(user.branchId);
    }

    const branchesWithActiveVault = await Promise.all(
      branchesData.map(async (branch) => ({
        ...branch,
        activeVault: await getActiveBranchReserveVault(branch.id),
      }))
    );

    return NextResponse.json({
      success: true,
      data: {
        currentUserId: user.id,
        userRole: user.role,
        branchId: user.branchId || null,
        branches: branchesWithActiveVault,
        pendingAllocations,
        organisationalReserve: orgReserve,
        accountantVault,
        history: historyData,
      },
    });
  } catch (error) {
    console.error("Error fetching reserve dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load reserve dashboard",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
