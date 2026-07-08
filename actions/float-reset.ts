"use server";

import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import { TransactionType, UserRole } from "@prisma/client";

interface ResetFloatParams {
  userFloatId: string;
  resetType: "FULL_RESET" | "BALANCE_ONLY" | "STATUS_ONLY";
  newBalance?: number;
  reason: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

export async function resetUserFloat(
  params: ResetFloatParams,
  currentUserId: string
) {
  try {
    if (!params.userFloatId || !params.resetType || !params.reason) {
      return { error: "Missing required fields", data: null };
    }

    if (params.reason.trim().length < 10) {
      return {
        error: "Reason must be at least 10 characters long",
        data: null,
      };
    }

    const currentUser = await db.user.findUnique({
      where: { id: currentUserId },
      select: { role: true, name: true, branchId: true },
    });

    if (!currentUser) {
      return { error: "User not found", data: null };
    }

    if (
      currentUser.role !== UserRole.ACCOUNTANT &&
      currentUser.role !== UserRole.ADMIN
    ) {
      return {
        error: "Only accountants and admins can reset float balances",
        data: null,
      };
    }

    const userFloat = await db.userFloat.findUnique({
      where: { id: params.userFloatId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            branchId: true,
          },
        },
      },
    });

    if (!userFloat) {
      return { error: "Float not found", data: null };
    }

    if (
      currentUser.role === UserRole.ACCOUNTANT &&
      currentUser.branchId !== userFloat.user.branchId
    ) {
      return {
        error: "You can only reset floats within your branch",
        data: null,
      };
    }

    if (
      params.newBalance !== undefined &&
      (Number.isNaN(params.newBalance) || params.newBalance < 0)
    ) {
      return { error: "Balance must be a non-negative number", data: null };
    }

    const oldBalance = Number(userFloat.balance) || 0;

    const result = await db.$transaction(async (tx) => {
      let updateData: Record<string, unknown> = {};
      let transactionAmount = 0;
      let transactionDescription = "";

      switch (params.resetType) {
        case "FULL_RESET":
          updateData = {
            balance: 0,
            isActiveForDay: false,
            canStartNewDay: true,
            pendingReconciliation: false,
            currentDayStarted: null,
            lastReconciliation: new Date(),
          };
          transactionAmount = oldBalance;
          transactionDescription = `Full float reset - balance set to 0`;
          break;
        case "BALANCE_ONLY":
          updateData = { balance: params.newBalance };
          transactionAmount = Math.abs((params.newBalance ?? 0) - oldBalance);
          transactionDescription = `Balance-only float reset from ${formatCurrency(oldBalance)} to ${formatCurrency(params.newBalance ?? 0)}`;
          break;
        case "STATUS_ONLY":
          updateData = {
            isActiveForDay: false,
            canStartNewDay: true,
            pendingReconciliation: false,
            currentDayStarted: null,
            lastReconciliation: new Date(),
          };
          transactionAmount = 0;
          transactionDescription = `Status-only float reset`;
          break;
      }

      await tx.userFloat.update({
        where: { id: params.userFloatId },
        data: updateData as any,
      });

      await tx.floatTransaction.create({
        data: {
          floatId: userFloat.id,
          type: TransactionType.OTHER,
          amount: transactionAmount,
          description: transactionDescription,
          performedByUserId: currentUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          action: "FLOAT_RESET",
          entityType: "UserFloat",
          entityId: params.userFloatId,
          details: `${params.resetType}: ${params.reason}`,
        },
      });

      return { success: true };
    });

    revalidatePath("/dashboard/floats/reset");
    revalidatePath(`/dashboard/floats/users/${userFloat.userId}`);

    return {
      error: null,
      data: result,
      message: `Float reset successful for ${userFloat.user.name}`,
    };
  } catch (error) {
    console.error("Error resetting float:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to reset float",
      data: null,
    };
  }
}
