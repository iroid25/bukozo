// actions/vault.ts (COMPLETE VERSION - Replace entire file)
"use server";

import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import { VaultTransactionType, UserRole } from "@prisma/client";
import {
  getActiveBranchReserveVault,
  getBranchReserveVaultWithTransactions,
  getOrganisationalReserveVault,
} from "@/lib/reserve-vault";

/**
 * Initialize Accountant Vault
 */
export async function initializeAccountantVault(accountantId: string) {
  try {
    const accountant = await db.user.findUnique({
      where: { id: accountantId },
      select: { role: true, name: true, branchId: true },
    });

    console.log("Vault Init Debug:", {
      id: accountantId,
      found: !!accountant,
      role: accountant?.role,
      expectedAccountant: UserRole.ACCOUNTANT,
      expectedAdmin: UserRole.ADMIN,
      expectedManager: UserRole.BRANCHMANAGER,
      isAccountant: accountant?.role === UserRole.ACCOUNTANT,
      isAdmin: accountant?.role === UserRole.ADMIN,
      isManager: accountant?.role === UserRole.BRANCHMANAGER,
    });

    if (
      !accountant ||
      (accountant.role !== UserRole.ACCOUNTANT &&
        accountant.role !== UserRole.ADMIN &&
        accountant.role !== UserRole.BRANCHMANAGER)
    ) {
      console.log("Vault Init Permission Denied for role:", accountant?.role);
      return { error: `Only accountants can have vaults. Current role: ${accountant?.role}` };
    }

    if (!accountant.branchId) {
      return { error: "Branch information required" };
    }

    let vault = await getActiveBranchReserveVault(accountant.branchId);

    if (vault) {
      return { success: true, vault, message: "Vault already exists" };
    }

    const INITIAL_BALANCE = 0; // Start with 0, must be funded by Main Office

    await db.$transaction(async (tx) => {
      const newVault = await tx.vault.create({
        data: {
          name: `Branch Reserve - ${accountant.name}`, // Updated name
          branchId: accountant.branchId!,
          balance: INITIAL_BALANCE,
          physicalCash: INITIAL_BALANCE,
          custodianUserId: accountantId,
          isActive: true,
          location: "Branch Office",
        },
      });

      // Only create transaction if balance > 0 (which is not true anymore, but keeping structure)
      if (INITIAL_BALANCE > 0) {
        await tx.vaultTransaction.create({
            data: {
            vaultId: newVault.id,
            type: VaultTransactionType.INITIAL_DEPOSIT,
            amount: INITIAL_BALANCE,
            balanceBefore: 0,
            balanceAfter: INITIAL_BALANCE,
            description: "Initial vault setup",
            performedByUserId: accountantId,
            },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: accountantId,
          action: "VAULT_INITIALIZED",
          entityType: "Vault",
          entityId: newVault.id,
          details: JSON.stringify({
            initialBalance: INITIAL_BALANCE,
            vaultName: newVault.name,
          }),
        },
      });

    });

    vault = await getActiveBranchReserveVault(accountant.branchId);

    revalidatePath("/dashboard/accountant/vault");
    return { success: true, vault, message: "Vault initialized. Waiting for funding." };
  } catch (error: any) {
    console.error("Error initializing vault:", error);
    return { error: `Failed to initialize vault: ${error.message}` };
  }
}

/**
 * Initialize Organisational Vault (Admin Only)
 */
export async function initializeOrganizationalVault(adminId: string) {
  try {
    const admin = await db.user.findUnique({
      where: { id: adminId },
      select: { role: true, name: true, branchId: true },
    });

    if (!admin || admin.role !== "ADMIN") {
      return { error: "Only admins can initialize the Organisational Reserve." };
    }

    let vault = await getOrganisationalReserveVault();

    if (vault) {
      return { success: true, vault, message: "Vault already exists" };
    }

    // Ensure Main Branch exists or use admin's branch
    let branchId = admin.branchId;
    if (!branchId) {
         const mainBranch = await db.branch.findFirst({ where: { name: { contains: "Main" } } });
         if (mainBranch) branchId = mainBranch.id;
    }

    if (!branchId) {
        return { error: "No branch found to associate with Reserve." };
    }

    const INITIAL_BALANCE = 0;

    await db.$transaction(async (tx) => {
      const newVault = await tx.vault.create({
        data: {
          name: "Organisational Reserve",
          branchId: branchId!,
          balance: INITIAL_BALANCE,
          physicalCash: INITIAL_BALANCE,
          custodianUserId: adminId,
          isActive: true,
          location: "Main Office",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: "VAULT_INITIALIZED",
          entityType: "Vault",
          entityId: newVault.id,
          details: JSON.stringify({
            initialBalance: INITIAL_BALANCE,
            vaultName: newVault.name,
            type: "ORGANISATIONAL_RESERVE"
          }),
        },
      });
    });

    vault = await getOrganisationalReserveVault();

    revalidatePath("/dashboard/accounts/vault");
    return { success: true, vault };
  } catch (error: any) {
    console.error("Error initializing Org vault:", error);
    return { error: `Failed to initialize Org vault: ${error.message}` };
  }
}

/**
 * Get Accountant Vault with Recent Transactions
 */
/**
 * Get Accountant Vault with Recent Transactions
 */
export async function getAccountantVault(accountantId: string) {
  try {
    const accountant = await db.user.findUnique({
      where: { id: accountantId },
      select: {
        branchId: true,
        role: true,
      },
    });

    const vault = accountant?.branchId
      ? await getBranchReserveVaultWithTransactions(accountant.branchId)
      : await db.vault.findFirst({
          where: {
            custodianUserId: accountantId,
            isActive: true,
          },
          include: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
            custodian: {
              select: { id: true, name: true, email: true },
            },
          },
        });

    if (!vault) return null;

    const recentTransactions = await db.vaultTransaction.findMany({
      where: { vaultId: vault.id },
      include: {
        performedBy: { select: { name: true, role: true } },
        relatedUser: { select: { name: true, role: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: 50,
    });

    return { ...vault, recentTransactions };
  } catch (error) {
    console.error("Error fetching vault:", error);
    return null;
  }
}

/**
 * Add Funds to Vault (from bank withdrawal)
 */
export async function addVaultFunds(
  vaultId: string,
  amount: number,
  performedBy: string,
  description?: string
) {
  try {
    if (amount <= 0) return { error: "Amount must be positive" };

    const vault = await db.vault.findUnique({ where: { id: vaultId } });
    if (!vault) return { error: "Vault not found" };

    const result = await db.$transaction(async (tx) => {
      const newBalance = vault.balance + amount;

      await tx.vault.update({
        where: { id: vaultId },
        data: {
          balance: newBalance,
          physicalCash: newBalance,
          lastVerified: new Date(),
        },
      });

      await tx.vaultTransaction.create({
        data: {
          vaultId,
          type: VaultTransactionType.BANK_WITHDRAWAL,
          amount,
          balanceBefore: vault.balance,
          balanceAfter: newBalance,
          description: description || "Funds added to vault from bank",
          performedByUserId: performedBy,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: performedBy,
          action: "VAULT_FUNDS_ADDED",
          entityType: "Vault",
          entityId: vaultId,
          details: JSON.stringify({
            amount,
            previousBalance: vault.balance,
            newBalance,
            description,
          }),
        },
      });

      return { newBalance };
    });

    revalidatePath("/dashboard/accountant/vault");
    return { success: true, data: result };
  } catch (error) {
    console.error("Error adding vault funds:", error);
    return { error: "Failed to add funds" };
  }
}

/**
 * Reconcile Vault - Update physical cash to match actual count
 */
export async function reconcileVault(
  vaultId: string,
  physicalCash: number,
  reconciledBy: string,
  notes?: string
) {
  try {
    if (physicalCash < 0) {
      return { error: "Physical cash amount cannot be negative" };
    }

    const vault = await db.vault.findUnique({
      where: { id: vaultId },
    });

    if (!vault) {
      return { error: "Vault not found" };
    }

    const variance = physicalCash - vault.balance;
    const isBalanced = Math.abs(variance) <= 1000; // 1000 UGX tolerance

    const result = await db.$transaction(async (tx) => {
      // Create reconciliation record
      const reconciliation = await tx.vaultReconciliation.create({
        data: {
          vaultId,
          reconciliationDate: new Date(),
          systemBalance: vault.balance,
          physicalCash,
          difference: variance,
          isBalanced,
          reconciledByUserId: reconciledBy,
          status: "APPROVED", // Auto-approve vault reconciliations
          approvedByUserId: reconciledBy,
          approvalDate: new Date(),
          notes: notes || null,
        },
      });

      // If there's a variance, adjust vault balance and record transaction
      if (!isBalanced) {
        await tx.vault.update({
          where: { id: vaultId },
          data: {
            balance: physicalCash,
            physicalCash,
            lastVerified: new Date(),
          },
        });

        // Record adjustment transaction
        await tx.vaultTransaction.create({
          data: {
            vaultId,
            type: VaultTransactionType.ADJUSTMENT,
            amount: variance,
            balanceBefore: vault.balance,
            balanceAfter: physicalCash,
            description: `Vault reconciliation adjustment - ${variance > 0 ? "Overage" : "Shortage"}: ${Math.abs(variance).toLocaleString()} UGX. ${notes || ""}`,
            performedByUserId: reconciledBy,
          },
        });
      } else {
        // Even if balanced, update last verified timestamp
        await tx.vault.update({
          where: { id: vaultId },
          data: {
            lastVerified: new Date(),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: reconciledBy,
          action: "VAULT_RECONCILED",
          entityType: "VaultReconciliation",
          entityId: reconciliation.id,
          details: JSON.stringify({
            systemBalance: vault.balance,
            physicalCash,
            variance,
            isBalanced,
            notes,
          }),
        },
      });

      return {
        reconciliationId: reconciliation.id,
        previousBalance: vault.balance,
        newBalance: physicalCash,
        variance,
        isBalanced,
      };
    });

    revalidatePath("/dashboard/accountant/vault");

    return {
      success: true,
      message: isBalanced
        ? "Vault is balanced"
        : `Vault reconciled with ${variance > 0 ? "overage" : "shortage"} of ${Math.abs(variance).toLocaleString()} UGX`,
      data: result,
    };
  } catch (error) {
    console.error("Error reconciling vault:", error);
    return {
      error: "Failed to reconcile vault",
    };
  }
}

/**
 * Get Vault Statistics
 */
export async function getVaultStatistics(vaultId: string) {
  try {
    const [vault, transactions, reconciliations] = await Promise.all([
      db.vault.findUnique({
        where: { id: vaultId },
      }),
      db.vaultTransaction.findMany({
        where: { vaultId },
        orderBy: { transactionDate: "desc" },
      }),
      db.vaultReconciliation.findMany({
        where: { vaultId },
        orderBy: { reconciliationDate: "desc" },
      }),
    ]);

    if (!vault) {
      return { error: "Vault not found" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = transactions.filter(
      (t) => new Date(t.transactionDate) >= today
    );

    const allocations = transactions.filter(
      (t) => t.type === VaultTransactionType.FLOAT_ALLOCATION
    );
    const returns = transactions.filter(
      (t) => t.type === VaultTransactionType.FLOAT_RETURN
    );
    const overages = transactions.filter(
      (t) => t.type === VaultTransactionType.OVERAGE_RECEIVED
    );
    const shortages = transactions.filter(
      (t) => t.type === VaultTransactionType.SHORTAGE_WRITTEN_OFF
    );

    return {
      success: true,
      data: {
        currentBalance: vault.balance,
        physicalCash: vault.physicalCash,
        totalTransactions: transactions.length,
        todayTransactions: todayTransactions.length,
        totalAllocations: Math.abs(
          allocations.reduce((sum, t) => sum + t.amount, 0)
        ),
        totalReturns: returns.reduce((sum, t) => sum + t.amount, 0),
        totalOverages: overages.reduce((sum, t) => sum + t.amount, 0),
        totalShortages: Math.abs(
          shortages.reduce((sum, t) => sum + t.amount, 0)
        ),
        allocationCount: allocations.length,
        returnCount: returns.length,
        lastReconciliation: reconciliations[0] || null,
        reconciliationCount: reconciliations.length,
      },
    };
  } catch (error) {
    console.error("Error fetching vault statistics:", error);
    return { error: "Failed to fetch statistics" };
  }
}

/**
 * Get All Vault Transactions with Filters
 */
export async function getVaultTransactions(
  vaultId: string,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    type?: VaultTransactionType;
    limit?: number;
  }
) {
  try {
    const whereClause: any = { vaultId };

    if (filters?.startDate || filters?.endDate) {
      whereClause.transactionDate = {};
      if (filters.startDate) {
        whereClause.transactionDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.transactionDate.lte = filters.endDate;
      }
    }

    if (filters?.type) {
      whereClause.type = filters.type;
    }

    const transactions = await db.vaultTransaction.findMany({
      where: whereClause,
      include: {
        performedBy: {
          select: { id: true, name: true, role: true },
        },
        relatedUser: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { transactionDate: "desc" },
      take: filters?.limit || 100,
    });

    return {
      success: true,
      data: transactions,
    };
  } catch (error) {
    console.error("Error fetching vault transactions:", error);
    return {
      success: false,
      error: "Failed to fetch transactions",
      data: [],
    };
  }
}

/**
 * Get Vault Reconciliation History
 */
export async function getVaultReconciliations(vaultId: string) {
  try {
    const reconciliations = await db.vaultReconciliation.findMany({
      where: { vaultId },
      include: {
        reconciledBy: {
          select: { id: true, name: true, role: true },
        },
        approvedBy: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { reconciliationDate: "desc" },
    });

    return {
      success: true,
      data: reconciliations,
    };
  } catch (error) {
    console.error("Error fetching reconciliations:", error);
    return {
      success: false,
      error: "Failed to fetch reconciliations",
      data: [],
    };
  }
}
