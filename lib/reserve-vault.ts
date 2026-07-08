import { db } from "@/prisma/db";

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
