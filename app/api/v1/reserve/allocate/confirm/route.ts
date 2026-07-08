import { NextRequest, NextResponse } from "next/server";
import { TransactionStatus, VaultTransactionType, UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== UserRole.ACCOUNTANT) {
      return NextResponse.json(
        { success: false, error: "Only Branch Accountants can confirm reserve allocations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const allocationId = body.allocationId as string;
    const physicalCashEntered = Number(body.physicalCashEntered);
    const physicalFloatEntered = Number(body.physicalFloatEntered);
    const notes = body.notes as string | undefined;

    if (!allocationId) {
      return NextResponse.json(
        { success: false, error: "Allocation ID is required" },
        { status: 400 }
      );
    }

    const allocation = await db.branchReserveAllocation.findUnique({
      where: { id: allocationId },
      include: {
        targetVault: true,
        sourceVault: true,
      },
    });

    if (!allocation) {
      return NextResponse.json(
        { success: false, error: "Allocation not found" },
        { status: 404 }
      );
    }

    if (allocation.status !== TransactionStatus.PENDING) {
      return NextResponse.json(
        { success: false, error: "Allocation is already processed" },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      await tx.vault.update({
        where: { id: allocation.sourceVaultId },
        data: {
          balance: { decrement: allocation.amount + allocation.floatAmount },
          physicalCash: { decrement: allocation.amount + allocation.floatAmount },
        },
      });

      await tx.vault.update({
        where: { id: allocation.targetVaultId },
        data: {
          balance: { increment: allocation.amount + allocation.floatAmount },
          physicalCash: { increment: allocation.amount + allocation.floatAmount },
          lastVerified: new Date(),
        },
      });

      const updated = await tx.branchReserveAllocation.update({
        where: { id: allocationId },
        data: {
          status: TransactionStatus.APPROVED,
          confirmedByUserId: user.id,
          confirmationDate: new Date(),
          physicalCashEntered,
          physicalFloatEntered,
          notes: notes
            ? allocation.notes
              ? `${allocation.notes}\n${notes}`
              : notes
            : allocation.notes,
        },
      });

      await tx.vaultTransaction.create({
        data: {
          vaultId: allocation.sourceVaultId,
          type: VaultTransactionType.RESERVE_ALLOCATION,
          amount: -(allocation.amount + allocation.floatAmount),
          balanceBefore: allocation.sourceVault.balance,
          balanceAfter: allocation.sourceVault.balance - (allocation.amount + allocation.floatAmount),
          description: `Reserve allocation to branch vault: ${allocation.targetVault.name}`,
          performedByUserId: user.id,
        },
      });

      await tx.vaultTransaction.create({
        data: {
          vaultId: allocation.targetVaultId,
          type: VaultTransactionType.RESERVE_ALLOCATION,
          amount: allocation.amount + allocation.floatAmount,
          balanceBefore: allocation.targetVault.balance,
          balanceAfter: allocation.targetVault.balance + (allocation.amount + allocation.floatAmount),
          description: `Reserve allocation received from ${allocation.sourceVault.name}`,
          performedByUserId: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "RESERVE_ALLOCATION_CONFIRMED",
          entityType: "BranchReserveAllocation",
          entityId: allocation.id,
          details: `Confirmed receiving ${physicalCashEntered} cash and ${physicalFloatEntered} float.`,
        },
      });

      return updated;
    });

    revalidatePath("/dashboard/reserve");
    revalidatePath("/dashboard/accounts/vault");

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error confirming reserve allocation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to confirm reserve allocation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
