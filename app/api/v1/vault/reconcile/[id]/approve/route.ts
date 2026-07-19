import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, VaultTransactionType } from "@prisma/client";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { notes } = await request.json().catch(() => ({}));

    const reconciliation = await db.vaultReconciliation.findUnique({
      where: { id },
      include: { vault: true, reconciledBy: { select: { id: true, name: true } } },
    });

    if (!reconciliation) {
      return NextResponse.json({ error: "Reconciliation not found" }, { status: 404 });
    }

    if (reconciliation.status !== "PENDING") {
      return NextResponse.json({ error: `Reconciliation is already ${reconciliation.status}` }, { status: 400 });
    }

    if (reconciliation.reconciledByUserId === user.id) {
      return NextResponse.json({ error: "Cannot approve your own reconciliation (segregation of duties)" }, { status: 403 });
    }

    const vault = reconciliation.vault;
    const variance = reconciliation.difference;
    const isBalanced = reconciliation.isBalanced;

    const result = await db.$transaction(async (tx) => {
      await tx.vaultReconciliation.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedByUserId: user.id,
          approvalDate: new Date(),
          notes: notes || reconciliation.notes,
        },
      });

      if (isBalanced) {
        await tx.vault.update({ where: { id: vault.id }, data: { lastVerified: new Date() } });
      } else {
        const newBalance = vault.balance + variance;
        await tx.vault.update({
          where: { id: vault.id },
          data: { balance: newBalance, physicalCash: newBalance, lastVerified: new Date() },
        });

        await tx.vaultTransaction.create({
          data: {
            vaultId: vault.id,
            type: VaultTransactionType.ADJUSTMENT,
            amount: variance,
            balanceBefore: vault.balance,
            balanceAfter: newBalance,
            description: `Reconciliation approved - ${variance > 0 ? "Overage" : "Shortage"}: ${Math.abs(variance).toLocaleString()} UGX`,
            performedByUserId: user.id,
          },
        });

        // GL entry for unbalanced reconciliation
        const { createVaultJournalEntry, VAULT_GL_CODE } = await import("@/lib/journal-entries-extended");
        if (variance > 0) {
          await createVaultJournalEntry({
            debitAccountCode: VAULT_GL_CODE,
            creditAccountCode: "401007",
            amount: variance,
            description: `Vault overage - reconciliation approved`,
            reference: `VAULT-ADJ-${id.slice(0, 8)}`,
            branchId: vault.branchId || undefined,
            userId: user.id,
            entryDate: new Date(),
          }, tx);
        } else {
          await createVaultJournalEntry({
            debitAccountCode: "501000",
            creditAccountCode: VAULT_GL_CODE,
            amount: Math.abs(variance),
            description: `Vault shortage - reconciliation approved`,
            reference: `VAULT-ADJ-${id.slice(0, 8)}`,
            branchId: vault.branchId || undefined,
            userId: user.id,
            entryDate: new Date(),
          }, tx);
        }
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "VAULT_RECONCILIATION_APPROVED",
          entityType: "VaultReconciliation",
          entityId: id,
          details: JSON.stringify({ reconciledBy: reconciliation.reconciledByUserId, variance, isBalanced }),
        },
      });

      return { status: "APPROVED", variance, isBalanced };
    });

    return NextResponse.json({ success: true, message: "Reconciliation approved", data: result });
  } catch (error) {
    console.error("Error approving vault reconciliation:", error);
    return NextResponse.json({ error: "Failed to approve reconciliation" }, { status: 500 });
  }
}
