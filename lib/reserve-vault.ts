import { db } from "@/prisma/db";
import type { VaultTransactionType } from "@prisma/client";

type PrismaTx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const VISIBLE_BRANCH_INCLUDE = {
  branch: {
    select: {
      id: true,
      name: true,
      location: true,
    },
  },
  custodian: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

export async function getActiveBranchReserveVault(branchId: string) {
  if (!branchId) return null;

  return db.vault.findFirst({
    where: {
      branchId,
      isActive: true,
    },
    include: VISIBLE_BRANCH_INCLUDE,
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
  });
}

export async function ensureBranchReserveVault(branchId: string) {
  if (!branchId) return null;

  const existing = await getActiveBranchReserveVault(branchId);
  if (existing) {
    return existing;
  }

  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      name: true,
      location: true,
      accountantId: true,
    },
  });

  if (!branch) {
    return null;
  }

  return db.vault.create({
    data: {
      name: `Branch Reserve - ${branch.name}`,
      branchId: branch.id,
      balance: 0,
      physicalCash: 0,
      isActive: true,
      location: branch.location,
      custodianUserId: branch.accountantId || null,
    },
    include: VISIBLE_BRANCH_INCLUDE,
  });
}

export async function getBranchReserveVaultWithTransactions(branchId: string) {
  const vault = await getActiveBranchReserveVault(branchId);

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
}

export async function getOrganisationalReserveVault() {
  return db.vault.findFirst({
    where: {
      location: "Main Office",
      isActive: true,
    },
    include: VISIBLE_BRANCH_INCLUDE,
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
  });
}

export async function ensureOrganisationalReserveVault() {
  const existing = await getOrganisationalReserveVault();
  if (existing) {
    return existing;
  }

  return db.vault.create({
    data: {
      name: "SACCO Reserve Vault",
      location: "Main Office",
      balance: 0,
      physicalCash: 0,
      isActive: true,
    },
    include: VISIBLE_BRANCH_INCLUDE,
  });
}

/**
 * Canonical helper for moving cash between vaults, or between a vault and
 * an external source (bank/HQ-injected funds).
 *
 * Before this helper existed, every route that moved vault cash hand-rolled
 * its own debit/credit pair — which is how the reserve-allocation route
 * ended up moving a different amount than its own confirm/return
 * counterparts, and how loan disbursement ended up decrementing `balance`
 * without ever touching `physicalCash`. New vault-movement code should call
 * this instead of writing `tx.vault.update(...)` by hand, so `balance` and
 * `physicalCash` always move together and both sides of a transfer always
 * move by the same amount.
 *
 * Must be called inside an existing `db.$transaction` — pass that
 * transaction client as `tx` so this participates in the caller's atomicity
 * (a partial failure must not credit one side without debiting the other).
 *
 * Pass only `fromVaultId` for a pure outflow (e.g. "Withdraw to Bank"), only
 * `toVaultId` for a pure inflow (e.g. "Add Funds" from an external source),
 * or both for a vault-to-vault transfer (e.g. HQ funding a branch).
 */
export async function moveVaultCash(
  tx: PrismaTx,
  params: {
    amount: number;
    type: VaultTransactionType;
    description: string;
    performedByUserId: string;
    fromVaultId?: string | null;
    toVaultId?: string | null;
    relatedUserId?: string | null;
    relatedFloatAllocationId?: string | null;
    relatedFloatReconciliationId?: string | null;
  },
) {
  const { amount, type, description, performedByUserId, relatedUserId, relatedFloatAllocationId, relatedFloatReconciliationId } = params;

  if (amount <= 0) {
    throw new Error("moveVaultCash: amount must be greater than zero");
  }
  if (!params.fromVaultId && !params.toVaultId) {
    throw new Error("moveVaultCash: at least one of fromVaultId/toVaultId is required");
  }

  const results: { from?: { balanceBefore: number; balanceAfter: number }; to?: { balanceBefore: number; balanceAfter: number } } = {};

  if (params.fromVaultId) {
    const vault = await tx.vault.findUniqueOrThrow({ where: { id: params.fromVaultId } });
    if (vault.balance < amount) {
      throw new Error(`moveVaultCash: vault "${vault.name}" has insufficient balance (${vault.balance}) for a movement of ${amount}`);
    }
    const balanceBefore = vault.balance;
    const updated = await tx.vault.update({
      where: { id: params.fromVaultId },
      data: {
        balance: { decrement: amount },
        physicalCash: { decrement: amount },
      },
    });
    await tx.vaultTransaction.create({
      data: {
        vaultId: params.fromVaultId,
        type,
        amount: -amount,
        balanceBefore,
        balanceAfter: updated.balance,
        description,
        performedByUserId,
        relatedUserId: relatedUserId || null,
        relatedFloatAllocationId: relatedFloatAllocationId || null,
        relatedFloatReconciliationId: relatedFloatReconciliationId || null,
      },
    });
    results.from = { balanceBefore, balanceAfter: updated.balance };
  }

  if (params.toVaultId) {
    const vault = await tx.vault.findUniqueOrThrow({ where: { id: params.toVaultId } });
    const balanceBefore = vault.balance;
    const updated = await tx.vault.update({
      where: { id: params.toVaultId },
      data: {
        balance: { increment: amount },
        physicalCash: { increment: amount },
      },
    });
    await tx.vaultTransaction.create({
      data: {
        vaultId: params.toVaultId,
        type,
        amount,
        balanceBefore,
        balanceAfter: updated.balance,
        description,
        performedByUserId,
        relatedUserId: relatedUserId || null,
        relatedFloatAllocationId: relatedFloatAllocationId || null,
        relatedFloatReconciliationId: relatedFloatReconciliationId || null,
      },
    });
    results.to = { balanceBefore, balanceAfter: updated.balance };
  }

  return results;
}
