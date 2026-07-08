import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, VaultTransactionType } from "@prisma/client";

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

    const [transactions, reconciliations] = await Promise.all([
      db.vaultTransaction.findMany({ where: { vaultId }, orderBy: { transactionDate: "desc" } }),
      db.vaultReconciliation.findMany({ where: { vaultId }, orderBy: { reconciliationDate: "desc" } }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTxns = transactions.filter(t => new Date(t.transactionDate) >= today);

    const byType = (type: VaultTransactionType) => transactions.filter(t => t.type === type);
    const sum = (txns: any[]) => txns.reduce((s, t) => s + t.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        currentBalance: vault.balance,
        physicalCash: vault.physicalCash,
        lastVerified: vault.lastVerified,
        totalTransactions: transactions.length,
        todayTransactions: todayTxns.length,
        totalAllocations: Math.abs(sum(byType(VaultTransactionType.FLOAT_ALLOCATION))),
        totalReturns: sum(byType(VaultTransactionType.FLOAT_RETURN)),
        totalOverages: sum(byType(VaultTransactionType.OVERAGE_RECEIVED)),
        totalShortages: Math.abs(sum(byType(VaultTransactionType.SHORTAGE_WRITTEN_OFF))),
        totalBankDeposits: Math.abs(sum(byType(VaultTransactionType.BANK_DEPOSIT))),
        totalBankWithdrawals: sum(byType(VaultTransactionType.BANK_WITHDRAWAL)),
        allocationCount: byType(VaultTransactionType.FLOAT_ALLOCATION).length,
        returnCount: byType(VaultTransactionType.FLOAT_RETURN).length,
        bankDepositCount: byType(VaultTransactionType.BANK_DEPOSIT).length,
        bankWithdrawalCount: byType(VaultTransactionType.BANK_WITHDRAWAL).length,
        lastReconciliation: reconciliations[0] || null,
        reconciliationCount: reconciliations.length,
      },
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 });
  }
}
