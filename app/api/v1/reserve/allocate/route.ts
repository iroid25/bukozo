import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { UserRole, TransactionStatus, VaultTransactionType } from "@prisma/client";
import { ensureBranchReserveVault, ensureOrganisationalReserveVault } from "@/lib/reserve-vault";

/**
 * POST /api/v1/reserve/allocate
 * Direct allocation of funds from Org Reserve to a branch (Admin only)
 * Used for initial branch funding - bypasses proposal/approval workflow
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Only Admins can perform direct allocations" },
        { status: 403 }
      );
    }

    const actingUser =
      (await db.user.findUnique({
        where: { id: (session.user as any).id },
        select: {
          id: true,
          role: true,
          branchId: true,
        },
      })) ||
      ((session.user as any).email
        ? await db.user.findFirst({
            where: {
              email: {
                equals: (session.user as any).email,
                mode: "insensitive",
              },
            },
            select: {
              id: true,
              role: true,
              branchId: true,
            },
          })
        : null);

    if (!actingUser) {
      return NextResponse.json(
        { error: "Authenticated user not found" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { amount, floatAmount, targetVaultId, sourceVaultId, branchId, notes } = body;

    // Validate required fields
    if (!amount || !floatAmount || (!targetVaultId && !branchId) || !sourceVaultId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const sourceVault =
      (await db.vault.findUnique({
        where: { id: sourceVaultId },
        include: { branch: true }
      })) || (await ensureOrganisationalReserveVault());

    const targetVault = targetVaultId
      ? await db.vault.findUnique({
          where: { id: targetVaultId },
          include: { branch: true }
        })
      : branchId
        ? await ensureBranchReserveVault(branchId)
        : null;

    if (!sourceVault || !targetVault) {
      return NextResponse.json(
        { error: "Vault(s) not found" },
        { status: 404 }
      );
    }

    const totalToMove = Number(amount) + Number(floatAmount || 0);
    if (sourceVault.balance < totalToMove) {
      return NextResponse.json(
        { error: "Insufficient funds in Organisational Reserve" },
        { status: 400 }
      );
    }

    // Execute transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Update source vault
      await tx.vault.update({
        where: { id: sourceVault.id },
        data: {
          balance: { decrement: totalToMove },
          physicalCash: { decrement: totalToMove }
        }
      });

      // 2. Update target vault
      await tx.vault.update({
        where: { id: targetVault.id },
        data: {
          balance: { increment: totalToMove },
          physicalCash: { increment: totalToMove }
        }
      });

      // 3. Create Allocation Record (Already APPROVED)
      const allocation = await tx.branchReserveAllocation.create({
        data: {
          amount: Number(amount),
          floatAmount: Number(floatAmount),
          sourceVaultId: sourceVault.id,
          targetVaultId: targetVault.id,
          allocatedByUserId: actingUser.id,
          confirmedByUserId: actingUser.id,
          status: TransactionStatus.APPROVED,
          confirmationDate: new Date(),
          notes: notes || "Initial Branch Funding (Direct)",
          physicalCashEntered: Number(amount),
          physicalFloatEntered: Number(floatAmount)
        }
      });

      // 4. Create Transactions for both sides
      await tx.vaultTransaction.create({
        data: {
          vaultId: sourceVault.id,
          type: VaultTransactionType.VAULT_TRANSFER,
          amount: -totalToMove,
          balanceBefore: sourceVault.balance,
          balanceAfter: sourceVault.balance - totalToMove,
          description: `Direct Allocation to ${targetVault.name}`,
          performedByUserId: actingUser.id
        }
      });

      await tx.vaultTransaction.create({
        data: {
          vaultId: targetVault.id,
          type: VaultTransactionType.VAULT_TRANSFER,
          amount: totalToMove,
          balanceBefore: targetVault.balance,
          balanceAfter: targetVault.balance + totalToMove,
          description: `Direct Allocation from Org. Reserve`,
          performedByUserId: actingUser.id
        }
      });

      return allocation;
    });

    // Refresh relevant dashboards
    revalidatePath("/dashboard/floats/my-float");
    revalidatePath("/dashboard/branches");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounts/vault");

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: "Funds allocated successfully"
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error allocating reserve:", error);
    return NextResponse.json(
      { error: "Failed to allocate reserve funds" },
      { status: 500 }
    );
  }
}
