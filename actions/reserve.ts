"use server";

import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import { TransactionStatus, VaultTransactionType, UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import {
  getActiveBranchReserveVault,
  getOrganisationalReserveVault,
} from "@/lib/reserve-vault";

/**
 * Get the SACCO Reserve (Main Office Vault)
 */
export async function getSaccoReserve() {
  try {
    const reserve = await getOrganisationalReserveVault();
    return reserve;
  } catch (error) {
    console.error("Error fetching SACCO Reserve:", error);
    return null;
  }
}

/**
 * Propose an allocation from the SACCO Reserve to a Branch
 */
export async function proposeReserveAllocation(data: {
  amount: number;
  floatAmount: number;
  targetVaultId: string;
  sourceVaultId: string;
  notes?: string;
}) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT)) {
      return { error: "Only Admins and Accountants can propose reserve allocations" };
    }

    if (data.amount <= 0 && data.floatAmount <= 0) {
      return { error: "Allocation amount must be positive" };
    }

    // Check source vault (HQ Reserve)
    const sourceVault = await db.vault.findUnique({
      where: { id: data.sourceVaultId }
    });

    if (!sourceVault) return { error: "Source vault not found" };
    if (sourceVault.balance < (data.amount + data.floatAmount)) {
      return { error: "Insufficient funds in the SACCO Reserve" };
    }

    const allocation = await db.branchReserveAllocation.create({
      data: {
        amount: data.amount,
        floatAmount: data.floatAmount,
        sourceVaultId: data.sourceVaultId,
        targetVaultId: data.targetVaultId,
        allocatedByUserId: user.id,
        status: TransactionStatus.PENDING,
        notes: data.notes,
      },
    });

    revalidatePath("/dashboard/reserve");
    return { success: true, data: allocation };
  } catch (error) {
    console.error("Error proposing allocation:", error);
    return { error: "Failed to propose reserve allocation" };
  }
}

/**
 * Direct allocation of funds (for initial branch setup)
 * This bypasses the PENDING state and completes immediately.
 * Only Admins can do this.
 */
export async function directAllocateReserve(data: {
  amount: number;
  floatAmount: number;
  targetVaultId: string;
  sourceVaultId: string;
  notes?: string;
}) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== UserRole.ADMIN) {
      return { error: "Only Admins can perform direct allocations" };
    }

    const sourceVault = await db.vault.findUnique({ where: { id: data.sourceVaultId } });
    const targetVault = await db.vault.findUnique({ where: { id: data.targetVaultId } });

    if (!sourceVault || !targetVault) return { error: "Vault(s) not found" };

    const totalToMove = data.amount + data.floatAmount;
    if (sourceVault.balance < totalToMove) {
      return { error: "Insufficient funds in SACCO Reserve" };
    }

    const result = await db.$transaction(async (tx) => {
      // 1. Update source vault
      await tx.vault.update({
        where: { id: sourceVault.id },
        data: {
          balance: { decrement: totalToMove },
          physicalCash: { decrement: data.amount }
        }
      });

      // 2. Update target vault
      await tx.vault.update({
        where: { id: targetVault.id },
        data: {
          balance: { increment: totalToMove },
          physicalCash: { increment: data.amount }
        }
      });

      // 3. Create Allocation Record (Already COMPLETED)
      const allocation = await tx.branchReserveAllocation.create({
        data: {
          amount: data.amount,
          floatAmount: data.floatAmount,
          sourceVaultId: sourceVault.id,
          targetVaultId: targetVault.id,
          allocatedByUserId: user.id,
          confirmedByUserId: user.id, // Admin confirmed it physically
          status: TransactionStatus.APPROVED,
          confirmationDate: new Date(),
          notes: data.notes || "Initial Branch Funding (Direct)",
          physicalCashEntered: data.amount,
          physicalFloatEntered: data.floatAmount
        }
      });

      // 4. Create Transactions for both sides
      await tx.vaultTransaction.create({
        data: {
          vaultId: sourceVault.id,
          type: VaultTransactionType.VAULT_TRANSFER,
          amount: -totalToMove,
          balanceBefore: sourceVault.balance,
          balanceAfter: sourceVault.balance - totalToMove,
          description: `Direct Allocation to ${targetVault.name}`,
          performedByUserId: user.id
        }
      });

      await tx.vaultTransaction.create({
        data: {
          vaultId: targetVault.id,
          type: VaultTransactionType.VAULT_TRANSFER,
          amount: totalToMove,
          balanceBefore: targetVault.balance,
          balanceAfter: targetVault.balance + totalToMove,
          description: `Direct Allocation from SACCO Reserve`,
          performedByUserId: user.id
        }
      });

      return allocation;
    });

    revalidatePath("/dashboard/reserve");
    revalidatePath("/dashboard/accounts/vault");
    return { success: true, data: result };
  } catch (error) {
    console.error("Error in direct allocation:", error);
    return { error: "Failed to allocate funds" };
  }
}

/**
 * Confirm a reserve allocation (by Branch Accountant)
 */
export async function confirmReserveAllocation(data: {
  allocationId: string;
  physicalCashEntered: number;
  physicalFloatEntered: number;
  notes?: string;
}) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== UserRole.ACCOUNTANT) {
      return { error: "Only Branch Accountants can confirm reserve allocations" };
    }

    const allocation = await db.branchReserveAllocation.findUnique({
      where: { id: data.allocationId },
      include: {
        targetVault: true,
        sourceVault: true,
      }
    });

    if (!allocation) return { error: "Allocation not found" };
    if (allocation.status !== TransactionStatus.PENDING) {
      return { error: "Allocation is already processed" };
    }

    // Process in transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Update source vault (HQ)
      await tx.vault.update({
        where: { id: allocation.sourceVaultId },
        data: {
          balance: { decrement: allocation.amount + allocation.floatAmount },
          physicalCash: { decrement: allocation.amount + allocation.floatAmount },
        }
      });

      // 2. Update target vault (Branch)
      await tx.vault.update({
        where: { id: allocation.targetVaultId },
        data: {
          balance: { increment: allocation.amount + allocation.floatAmount },
          physicalCash: { increment: allocation.amount + allocation.floatAmount },
          lastVerified: new Date(),
        }
      });

      // 3. Record Transactions for Source
      await tx.vaultTransaction.create({
        data: {
          vaultId: allocation.sourceVaultId,
          type: VaultTransactionType.RESERVE_ALLOCATION,
          amount: -(allocation.amount + allocation.floatAmount),
          balanceBefore: allocation.sourceVault.balance,
          balanceAfter: allocation.sourceVault.balance - (allocation.amount + allocation.floatAmount),
          description: `Reserve allocation to branch vault: ${allocation.targetVault.name}`,
          performedByUserId: user.id,
        }
      });

      // 4. Record Transactions for Target
      await tx.vaultTransaction.create({
        data: {
          vaultId: allocation.targetVaultId,
          type: VaultTransactionType.RESERVE_ALLOCATION,
          amount: allocation.amount + allocation.floatAmount,
          balanceBefore: allocation.targetVault.balance,
          balanceAfter: allocation.targetVault.balance + (allocation.amount + allocation.floatAmount),
          description: `Reserve allocation received from ${allocation.sourceVault.name}`,
          performedByUserId: user.id,
        }
      });

      // 5. Update Allocation status
      const updated = await tx.branchReserveAllocation.update({
        where: { id: data.allocationId },
        data: {
          status: TransactionStatus.APPROVED,
          confirmedByUserId: user.id,
          confirmationDate: new Date(),
          physicalCashEntered: data.physicalCashEntered,
          physicalFloatEntered: data.physicalFloatEntered,
          notes: data.notes ? (allocation.notes ? `${allocation.notes}\n${data.notes}` : data.notes) : allocation.notes,
        }
      });

      // 6. Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "RESERVE_ALLOCATION_CONFIRMED",
          entityType: "BranchReserveAllocation",
          entityId: allocation.id,
          details: `Confirmed receiving ${data.physicalCashEntered} cash and ${data.physicalFloatEntered} float.`,
        }
      });

      return updated;
    });

    revalidatePath("/dashboard/reserve");
    revalidatePath("/dashboard/accountant/vault");
    return { success: true, data: result };
  } catch (error) {
    console.error("Error confirming allocation:", error);
    return { error: "Failed to confirm reserve allocation" };
  }
}

/**
 * Get pending allocations for a specific branch/accountant
 */
export async function getPendingBranchAllocations(branchId: string) {
  try {
    const allocations = await db.branchReserveAllocation.findMany({
      where: {
        targetVault: {
          branchId: branchId
        },
        status: TransactionStatus.PENDING
      },
      include: {
        sourceVault: true,
        allocatedByUser: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: allocations };
  } catch (error) {
    console.error("Error fetching pending allocations:", error);
    return { error: "Failed to fetch pending allocations" };
  }
}

/**
 * Get all allocations (for Admin/Board view)
 */
export async function getAllReserveAllocations() {
  try {
    const allocations = await db.branchReserveAllocation.findMany({
      include: {
        sourceVault: true,
        targetVault: { include: { branch: true } },
        allocatedByUser: { select: { name: true } },
        confirmedByUser: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: allocations };
  } catch (error) {
    console.error("Error fetching all allocations:", error);
    return { error: "Failed to fetch allocations" };
  }
}

/**
 * Propose returning funds to the SACCO Reserve (by Branch Accountant)
 */
export async function proposeReserveReturn(data: {
  amount: number;
  floatAmount: number;
  sourceVaultId: string; // The branch vault
  targetVaultId: string; // The HQ Reserve vault
  notes?: string;
}) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== UserRole.ACCOUNTANT) {
      return { error: "Only Branch Accountants can propose reserve returns" };
    }

    if (data.amount <= 0 && data.floatAmount <= 0) {
      return { error: "Return amount must be positive" };
    }

    // Check branch vault
    const branchVault = await db.vault.findUnique({
      where: { id: data.sourceVaultId }
    });

    if (!branchVault) return { error: "Branch vault not found" };
    if (branchVault.balance < (data.amount + data.floatAmount)) {
      return { error: "Insufficient funds in the branch vault" };
    }

    const allocation = await db.branchReserveAllocation.create({
      data: {
        amount: data.amount,
        floatAmount: data.floatAmount,
        sourceVaultId: data.sourceVaultId,
        targetVaultId: data.targetVaultId,
        allocatedByUserId: user.id,
        status: TransactionStatus.PENDING,
        notes: `RETURN: ${data.notes || ""}`,
      },
    });

    revalidatePath("/dashboard/reserve");
    return { success: true, data: allocation };
  } catch (error) {
    console.error("Error proposing return:", error);
    return { error: "Failed to propose reserve return" };
  }
}

/**
 * Confirm a reserve return (by Board/Admin)
 */
export async function confirmReserveReturn(data: {
  allocationId: string;
  notes?: string;
}) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== UserRole.ADMIN) {
      return { error: "Only Admins (the Board) can confirm reserve returns" };
    }

    const allocation = await db.branchReserveAllocation.findUnique({
      where: { id: data.allocationId },
      include: {
        targetVault: true,
        sourceVault: true,
      }
    });

    if (!allocation) return { error: "Return record not found" };
    if (allocation.status !== TransactionStatus.PENDING) {
      return { error: "Return is already processed" };
    }

    // Process in transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Update source vault (Branch)
      await tx.vault.update({
        where: { id: allocation.sourceVaultId },
        data: {
          balance: { decrement: allocation.amount + allocation.floatAmount },
          physicalCash: { decrement: allocation.amount + allocation.floatAmount },
        }
      });

      // 2. Update target vault (HQ)
      await tx.vault.update({
        where: { id: allocation.targetVaultId },
        data: {
          balance: { increment: allocation.amount + allocation.floatAmount },
          physicalCash: { increment: allocation.amount + allocation.floatAmount },
          lastVerified: new Date(),
        }
      });

      // 3. Record Transactions for Source (Branch)
      await tx.vaultTransaction.create({
        data: {
          vaultId: allocation.sourceVaultId,
          type: VaultTransactionType.RESERVE_RETURN,
          amount: -(allocation.amount + allocation.floatAmount),
          balanceBefore: allocation.sourceVault.balance,
          balanceAfter: allocation.sourceVault.balance - (allocation.amount + allocation.floatAmount),
          description: `Funds returned to SACCO Reserve`,
          performedByUserId: user.id,
        }
      });

      // 4. Record Transactions for Target (HQ)
      await tx.vaultTransaction.create({
        data: {
          vaultId: allocation.targetVaultId,
          type: VaultTransactionType.RESERVE_RETURN,
          amount: allocation.amount + allocation.floatAmount,
          balanceBefore: allocation.targetVault.balance,
          balanceAfter: allocation.targetVault.balance + (allocation.amount + allocation.floatAmount),
          description: `Reserve funds returned from branch: ${allocation.sourceVault.name}`,
          performedByUserId: user.id,
        }
      });

      // 5. Update status
      const updated = await tx.branchReserveAllocation.update({
        where: { id: data.allocationId },
        data: {
          status: TransactionStatus.APPROVED,
          confirmedByUserId: user.id,
          confirmationDate: new Date(),
          notes: data.notes ? (allocation.notes ? `${allocation.notes}\n${data.notes}` : data.notes) : allocation.notes,
        }
      });

      return updated;
    });

    revalidatePath("/dashboard/reserve");
    return { success: true, data: result };
  } catch (error) {
    console.error("Error confirming return:", error);
    return { error: "Failed to confirm reserve return" };
  }
}

/**
 * Get branch reserve status (Vaults for all branches)
 */
export async function getBranchReserves() {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Not authenticated" };

    const branches = await db.branch.findMany({
      include: {
        vaults: {
          where: { isActive: true },
          orderBy: [
            { updatedAt: "desc" },
            { createdAt: "desc" },
          ],
          include: { custodian: true }
        },
        accountant: true,
        manager: true,
      }
    });

    return {
      success: true,
      data: await Promise.all(
        branches.map(async (branch) => ({
          ...branch,
          activeVault: branch.id
            ? await getActiveBranchReserveVault(branch.id)
            : null,
        }))
      ),
    };
  } catch (error) {
    console.error("Error fetching branch reserves:", error);
    return { error: "Failed to fetch branch reserves" };
  }
}

/**
 * Get Reserve Transaction History
 */
export async function getReserveHistory() {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Not authenticated" };

    const history = await db.branchReserveAllocation.findMany({
      include: {
        sourceVault: { include: { branch: true } },
        targetVault: { include: { branch: true } },
        allocatedByUser: true,
        confirmedByUser: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { success: true, data: history };
  } catch (error) {
    console.error("Error fetching reserve history:", error);
    return { error: "Failed to fetch history" };
  }
}
