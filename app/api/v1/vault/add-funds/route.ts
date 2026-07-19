import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, VaultTransactionType } from "@prisma/client";
import { ensureOrganisationalReserveVault } from "@/lib/reserve-vault";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== UserRole.ACCOUNTANT && user.role !== UserRole.ADMIN && user.role !== UserRole.BRANCHMANAGER)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const persistedUser =
      (await db.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          role: true,
          branchId: true,
        },
      })) ||
      (user.email
        ? await db.user.findFirst({
            where: {
              email: {
                equals: user.email,
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

    if (!persistedUser) {
      return NextResponse.json({ error: "Authenticated user not found" }, { status: 401 });
    }

    const { vaultId, amount, description } = await request.json();
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid vault ID and amount required" }, { status: 400 });
    }

    let vault = null as Awaited<ReturnType<typeof db.vault.findFirst>> | null;

    if (persistedUser.role === UserRole.ADMIN) {
      vault = await ensureOrganisationalReserveVault();
    } else {
      vault = await db.vault.findFirst({
        where: {
          id: vaultId,
          isActive: true,
          OR: [
            { custodianUserId: persistedUser.id },
            ...(persistedUser.branchId ? [{ branchId: persistedUser.branchId }] : []),
          ],
        },
      });
    }

    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      const newBalance = vault.balance + amount;
      await tx.vault.update({
        where: { id: vault.id },
        data: { balance: { increment: amount }, physicalCash: { increment: amount }, lastVerified: new Date() },
      });

      const transaction = await tx.vaultTransaction.create({
        data: {
          vaultId: vault.id,
          type: VaultTransactionType.BANK_WITHDRAWAL,
          amount,
          balanceBefore: vault.balance,
          balanceAfter: newBalance,
          description: description || "Funds added from bank",
          performedByUserId: persistedUser.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: persistedUser.id,
          action: "VAULT_FUNDS_ADDED",
          entityType: "Vault",
          entityId: vault.id,
          details: JSON.stringify({ amount, previousBalance: vault.balance, newBalance, description }),
        },
      });

      // GL entry: Dr Vault (102005) / Cr Bank (102002)
      const { createVaultJournalEntry, VAULT_GL_CODE } = await import("@/lib/journal-entries-extended");
      await createVaultJournalEntry({
        debitAccountCode: VAULT_GL_CODE,
        creditAccountCode: "102002",
        amount,
        description: description || "Funds added from bank",
        reference: `VAULT-ADD-${Date.now()}`,
        branchId: vault.branchId || undefined,
        userId: persistedUser.id,
        entryDate: new Date(),
      }, tx);

      return { newBalance, transaction };
    });

    return NextResponse.json({
      success: true,
      message: `Added ${amount.toLocaleString()} UGX`,
      data: result,
    });
  } catch (error) {
    console.error("Error adding funds:", error);
    return NextResponse.json({ error: "Failed to add funds" }, { status: 500 });
  }
}
