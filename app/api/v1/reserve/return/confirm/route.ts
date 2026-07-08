import { NextRequest, NextResponse } from "next/server";
import { TransactionStatus, VaultTransactionType, UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "Only Admins (the Board) can confirm reserve returns" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const allocationId = body.allocationId as string;
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
        { success: false, error: "Return record not found" },
        { status: 404 }
      );
    }

    if (allocation.status !== TransactionStatus.PENDING) {
      return NextResponse.json(
        { success: false, error: "Return is already processed" },
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
          type: VaultTransactionType.RESERVE_RETURN,
          amount: -(allocation.amount + allocation.floatAmount),
          balanceBefore: allocation.sourceVault.balance,
          balanceAfter: allocation.sourceVault.balance - (allocation.amount + allocation.floatAmount),
          description: `Funds returned to SACCO Reserve`,
          performedByUserId: user.id,
        },
      });

      await tx.vaultTransaction.create({
        data: {
          vaultId: allocation.targetVaultId,
          type: VaultTransactionType.RESERVE_RETURN,
          amount: allocation.amount + allocation.floatAmount,
          balanceBefore: allocation.targetVault.balance,
          balanceAfter: allocation.targetVault.balance + (allocation.amount + allocation.floatAmount),
          description: `Reserve funds returned from branch: ${allocation.sourceVault.name}`,
          performedByUserId: user.id,
        },
      });

      return updated;
    });

    revalidatePath("/dashboard/reserve");

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error confirming reserve return:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to confirm reserve return",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
