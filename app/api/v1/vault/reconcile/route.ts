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

    const { vaultId, physicalCash, notes } = await request.json();
    if (!vaultId || physicalCash === undefined || physicalCash < 0) {
      return NextResponse.json({ error: "Valid vault ID and physical cash required" }, { status: 400 });
    }

    const vault = await db.vault.findFirst({
      where: { id: vaultId, custodianUserId: user.id, isActive: true },
    });
    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    const variance = physicalCash - vault.balance;
    const isBalanced = Math.abs(variance) <= 1000;

    const result = await db.$transaction(async (tx) => {
      const reconciliation = await tx.vaultReconciliation.create({
        data: {
          vaultId,
          systemBalance: vault.balance,
          physicalCash,
          difference: variance,
          isBalanced,
          reconciledByUserId: user.id,
          status: "PENDING",
          notes: notes || null,
        },
      });

      if (isBalanced) {
        await tx.vault.update({ where: { id: vaultId }, data: { lastVerified: new Date() } });
      } else {
        if (variance < 0) {
          await tx.cashShortage.create({
            data: {
              userId: user.id,
              amount: Math.abs(variance),
              reportedByUserId: user.id,
              description: `Shortage detected in vault reconciliation for ${vault.name}${notes ? ` - ${notes}` : ""}`,
              reconciliationId: reconciliation.id,
              status: "PENDING",
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "VAULT_RECONCILED",
          entityType: "VaultReconciliation",
          entityId: reconciliation.id,
          details: JSON.stringify({ systemBalance: vault.balance, physicalCash, variance, isBalanced, notes }),
        },
      });

      return { reconciliationId: reconciliation.id, previousBalance: vault.balance, newBalance: physicalCash, variance, isBalanced };
    });

    return NextResponse.json({
      success: true,
      message: isBalanced ? "Vault is balanced" : `Reconciled with ${variance > 0 ? "overage" : "shortage"} of ${Math.abs(variance).toLocaleString()} UGX`,
      data: result,
    });
  } catch (error) {
    console.error("Error reconciling:", error);
    return NextResponse.json({ error: "Failed to reconcile" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== UserRole.ACCOUNTANT && user.role !== UserRole.ADMIN && user.role !== UserRole.BRANCHMANAGER)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vaultId = searchParams.get("vaultId");
    if (!vaultId) {
      return NextResponse.json({ error: "Vault ID required" }, { status: 400 });
    }

    const vault = await db.vault.findFirst({
      where: { id: vaultId, custodianUserId: user.id, isActive: true },
    });
    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    const reconciliations = await db.vaultReconciliation.findMany({
      where: { vaultId },
      include: {
        reconciledBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { reconciliationDate: "desc" },
    });

    return NextResponse.json({ success: true, data: reconciliations });
  } catch (error) {
    console.error("Error fetching reconciliations:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
