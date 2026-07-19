import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, VaultTransactionType } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== UserRole.ACCOUNTANT && user.role !== UserRole.ADMIN && user.role !== UserRole.BRANCHMANAGER)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { vaultId, amount, description } = await request.json();
    if (!vaultId || !amount || amount <= 0) {
      return NextResponse.json({ error: "Valid vault ID and amount required" }, { status: 400 });
    }

    const vault = await db.vault.findFirst({
      where: { id: vaultId, custodianUserId: user.id, isActive: true },
    });
    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }
    if (vault.balance < amount) {
      return NextResponse.json({
        error: "Insufficient balance",
        currentBalance: vault.balance,
        requestedAmount: amount,
      }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      // Atomic decrement with balance guard — prevents TOCTOU race
      const vaultUpdate = await tx.vault.updateMany({
        where: { id: vaultId, balance: { gte: amount } },
        data: {
          balance: { decrement: amount },
          physicalCash: { decrement: amount },
          lastVerified: new Date(),
        },
      });
      if (vaultUpdate.count === 0) {
        throw new Error("Insufficient vault balance (concurrent withdrawal detected)");
      }

      const newBalance = vault.balance - amount;

      const transaction = await tx.vaultTransaction.create({
        data: {
          vaultId,
          type: VaultTransactionType.BANK_DEPOSIT,
          amount: -amount,
          balanceBefore: vault.balance,
          balanceAfter: newBalance,
          description: description || "Withdrawn for bank deposit",
          performedByUserId: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "VAULT_FUNDS_WITHDRAWN",
          entityType: "Vault",
          entityId: vaultId,
          details: JSON.stringify({ amount, previousBalance: vault.balance, newBalance, description }),
        },
      });

      return { newBalance, transaction };
    });

    return NextResponse.json({
      success: true,
      message: `Withdrew ${amount.toLocaleString()} UGX`,
      data: result,
    });
  } catch (error) {
    console.error("Error withdrawing funds:", error);
    return NextResponse.json({ error: "Failed to withdraw funds" }, { status: 500 });
  }
}
