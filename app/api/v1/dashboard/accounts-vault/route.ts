import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import {
  getActiveBranchReserveVault,
  ensureOrganisationalReserveVault,
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

    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const [vaultData, branches] = await Promise.all([
      ensureOrganisationalReserveVault(),
      db.branch.findMany({
        include: {
          vaults: {
            where: { isActive: true },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          },
          accountant: true,
          manager: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    if (vaultData) {
      const recentTransactions = await db.vaultTransaction.findMany({
        where: { vaultId: vaultData.id },
        include: {
          performedBy: { select: { name: true, role: true } },
          relatedUser: { select: { name: true, role: true } },
        },
        orderBy: { transactionDate: "desc" },
        take: 50,
      });
      (vaultData as any).recentTransactions = recentTransactions;
    }

    const branchesWithActiveVault = await Promise.all(
      branches.map(async (branch) => ({
        ...branch,
        activeVault: await getActiveBranchReserveVault(branch.id),
      }))
    );

    return NextResponse.json({
      success: true,
      data: {
        currentUserId: user.id,
        userRole: user.role,
        vaultData,
        branches: branchesWithActiveVault,
        orgReserveId: vaultData?.id || "",
      },
    });
  } catch (error) {
    console.error("Error fetching accounts vault dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load accounts vault dashboard",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
