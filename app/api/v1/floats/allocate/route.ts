import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import {
  TransactionType,
  UserRole,
  VaultTransactionType,
} from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const tellerAgentId = body.tellerAgentId || body.tellerId;
    const branchId = body.branchId;
    const amount = Number(body.amount);
    const description = body.description ? String(body.description).trim() : null;

    if (!tellerAgentId || !branchId || !amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid input" },
        { status: 400 }
      );
    }

    if (
      user.role !== UserRole.ADMIN &&
      user.branchId &&
      user.branchId !== branchId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You can only allocate floats within your branch",
        },
        { status: 403 }
      );
    }

    const tellerAgent = await db.user.findUnique({
      where: { id: tellerAgentId },
      include: {
        userFloat: true,
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    if (!tellerAgent) {
      return NextResponse.json(
        { success: false, error: "Teller/agent not found" },
        { status: 404 }
      );
    }

    if (
      tellerAgent.role !== UserRole.TELLER &&
      tellerAgent.role !== UserRole.AGENT
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Only tellers and agents can receive float allocations",
        },
        { status: 400 }
      );
    }

    if (tellerAgent.userFloat?.pendingReconciliation) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This user has a pending reconciliation. Please wait until it is processed before allocating new float.",
        },
        { status: 400 }
      );
    }

    const branch = await db.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        location: true,
      },
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: "Branch not found" },
        { status: 404 }
      );
    }

    const allocator = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        role: true,
        branchId: true,
      },
    });

    if (!allocator) {
      return NextResponse.json(
        { success: false, error: "Allocator not found" },
        { status: 404 }
      );
    }

    const vault = await db.vault.findFirst({
      where: {
        branchId: allocator.branchId || branchId,
        isActive: true,
      },
    });

    if (!vault) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No active vault found for this branch. Please contact the system administrator.",
        },
        { status: 400 }
      );
    }

    if (vault.balance < amount) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient vault balance. Available: ${formatCurrency(vault.balance)}, Required: ${formatCurrency(amount)}`,
        },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      let userFloat = tellerAgent.userFloat;

      if (!userFloat) {
        userFloat = await tx.userFloat.create({
          data: {
            userId: tellerAgent.id,
            balance: 0,
            isActiveForDay: false,
            canStartNewDay: true,
            pendingReconciliation: false,
          },
        });
      }

      const previousBalance = Number(userFloat.balance) || 0;
      const newBalance = previousBalance + amount;
      const startToday = !userFloat.isActiveForDay;
      const now = new Date();

      const updatedFloat = await tx.userFloat.update({
        where: { id: userFloat.id },
        data: {
          balance: newBalance,
          ...(startToday
            ? {
                currentDayStarted: now,
                isActiveForDay: true,
                canStartNewDay: false,
                pendingReconciliation: false,
              }
            : {}),
        },
      });

      const allocation = await tx.floatAllocation.create({
        data: {
          tellerAgentId: tellerAgent.id,
          branchId,
          amount,
          description,
          allocatedByUserId: user.id,
        },
      });

      await tx.floatTransaction.create({
        data: {
          floatId: updatedFloat.id,
          type: TransactionType.FLOAT_ALLOCATION,
          amount,
          description: startToday
            ? "Start-of-day float allocation"
            : "Same-day top-up allocation",
          performedByUserId: user.id,
          relatedTransactionId: allocation.id,
        },
      });

      const vaultBalanceBefore = Number(vault.balance) || 0;
      const vaultBalanceAfter = vaultBalanceBefore - amount;

      await tx.vault.update({
        where: { id: vault.id },
        data: {
          balance: vaultBalanceAfter,
          physicalCash: {
            decrement: amount,
          },
        },
      });

      await tx.vaultTransaction.create({
        data: {
          vaultId: vault.id,
          type: VaultTransactionType.FLOAT_ALLOCATION,
          amount: -amount,
          balanceBefore: vaultBalanceBefore,
          balanceAfter: vaultBalanceAfter,
          description: `Float allocated to ${tellerAgent.name}`,
          relatedFloatAllocationId: allocation.id,
          relatedUserId: tellerAgent.id,
          performedByUserId: user.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: tellerAgent.id,
          type: "IN_APP",
          subject: "Float Allocated",
          message: `You have received UGX ${amount.toLocaleString()} from ${allocator.name}. Your new balance is UGX ${newBalance.toLocaleString()}.`,
          isRead: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "FLOAT_ALLOCATED_WITH_VAULT_DEDUCTION",
          entityType: "FloatAllocation",
          entityId: allocation.id,
          details: JSON.stringify({
            tellerName: tellerAgent.name,
            tellerEmail: tellerAgent.email,
            allocatorName: allocator.name,
            branchName: branch.name,
            amount,
            previousFloatBalance: previousBalance,
            newFloatBalance: newBalance,
            vaultBalanceBefore,
            vaultBalanceAfter,
            description,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      return {
        allocation,
        tellerName: tellerAgent.name,
        previousBalance,
        newBalance,
        vaultBalanceBefore,
        vaultBalanceAfter,
      };
    });

    revalidatePath("/dashboard/accountant/allocate-float");
    revalidatePath("/dashboard/accountant/allocate-float/floattwo");
    revalidatePath("/dashboard/floats");
    revalidatePath("/dashboard/my-float");
    revalidatePath("/dashboard/accounts/vault");
    revalidatePath(`/dashboard/floats/users/${tellerAgentId}`);

    return NextResponse.json(
      {
        success: true,
        message: `Float allocated successfully to ${result.tellerName}`,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error processing float allocation:", error);
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
