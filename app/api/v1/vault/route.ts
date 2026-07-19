import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== UserRole.ACCOUNTANT && user.role !== UserRole.ADMIN && user.role !== UserRole.BRANCHMANAGER)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vault = await db.vault.findFirst({
      where: { custodianUserId: user.id, isActive: true },
      include: {
        branch: { select: { id: true, name: true } },
        custodian: { select: { id: true, name: true, email: true } },
      },
    });

    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    const recentTransactions = await db.vaultTransaction.findMany({
      where: { vaultId: vault.id },
      include: {
        performedBy: { select: { name: true, role: true } },
        relatedUser: { select: { name: true, role: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: 50,
    });

    return NextResponse.json({ success: true, data: { ...vault, recentTransactions } });
  } catch (error) {
    console.error("Error fetching vault:", error);
    return NextResponse.json({ error: "Failed to fetch vault" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== UserRole.ACCOUNTANT && user.role !== UserRole.ADMIN)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.branchId) {
      return NextResponse.json({ error: "Branch information required" }, { status: 400 });
    }

    const existingVault = await db.vault.findFirst({
      where: { custodianUserId: user.id, branchId: user.branchId, isActive: true },
    });
    if (existingVault) {
      return NextResponse.json({ error: "Vault already exists", data: existingVault }, { status: 409 });
    }

    const INITIAL_BALANCE = 60000000;
    const vault = await db.$transaction(async (tx) => {
      const newVault = await tx.vault.create({
        data: {
          name: `Accountant Vault - ${user.name}`,
          branchId: user.branchId!,
          balance: INITIAL_BALANCE,
          physicalCash: INITIAL_BALANCE,
          custodianUserId: user.id,
          isActive: true,
          location: "Main Office",
        },
      });

      await tx.vaultTransaction.create({
        data: {
          vaultId: newVault.id,
          type: "INITIAL_DEPOSIT",
          amount: INITIAL_BALANCE,
          balanceBefore: 0,
          balanceAfter: INITIAL_BALANCE,
          description: "Initial vault setup - 60M UGX",
          performedByUserId: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "VAULT_INITIALIZED",
          entityType: "Vault",
          entityId: newVault.id,
          details: JSON.stringify({ initialBalance: INITIAL_BALANCE, vaultName: newVault.name }),
        },
      });

      // GL entry: Dr Vault (102005) / Cr Equity (301000)
      const { createVaultJournalEntry, VAULT_GL_CODE } = await import("@/lib/journal-entries-extended");
      await createVaultJournalEntry({
        debitAccountCode: VAULT_GL_CODE,
        creditAccountCode: "301000",
        amount: INITIAL_BALANCE,
        description: `Vault initialized - ${newVault.name}`,
        reference: `VAULT-INIT-${newVault.id.slice(0, 8)}`,
        branchId: user.branchId!,
        userId: user.id,
        entryDate: new Date(),
      }, tx);

      return newVault;
    });

    void bumpAccountingSyncState("Vault initialized");
    return NextResponse.json({ success: true, message: "Vault initialized with 60M UGX", data: vault });
  } catch (error) {
    console.error("Error initializing vault:", error);
    return NextResponse.json({ error: "Failed to initialize vault" }, { status: 500 });
  }
}
