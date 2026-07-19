import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, SavingsAccountStatus, AccountStatus } from "@prisma/client";

/**
 * GET /api/v1/accountant/reconciliation/member-vs-gl
 * Compares member sub-ledger balances against GL account balances.
 *
 * Checks:
 * - Savings: sum of SavingsAccount.balance (ACTIVE) vs GL via AccountType.ledgerAccount
 * - Shares: sum of ShareAccount.totalValue (ACTIVE) vs GL via AccountType.ledgerAccount
 * - Loans: sum of Loan.outstandingBalance vs GL 107000
 * - Fixed Deposits: sum of FixedDeposit.principalAmount vs GL 201003
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || undefined;

    const [
      savingsByType,
      sharesByType,
      institutionSharesByType,
      loanAgg,
      fdAgg,
      loanGL,
      fdGL,
    ] = await Promise.all([
      db.savingsAccount.groupBy({
        by: ["accountTypeId"],
        where: {
          status: SavingsAccountStatus.ACTIVE,
          ...(branchId ? { branchId } : {}),
        },
        _sum: { balance: true },
        _count: true,
      }),
      db.shareAccount.groupBy({
        by: ["accountTypeId"],
        where: {
          status: SavingsAccountStatus.ACTIVE,
          ...(branchId ? { branchId } : {}),
        },
        _sum: { totalValue: true },
        _count: true,
      }),
      db.account.groupBy({
        by: ["accountTypeId"],
        where: {
          institutionId: { not: null },
          accountType: { isShareAccount: true },
          status: "ACTIVE",
          ...(branchId ? { branchId } : {}),
        },
        _sum: { balance: true },
        _count: true,
      }),
      db.loan.aggregate({
        where: {
          outstandingBalance: { gt: 0 },
          status: { not: "WRITTEN_OFF" },
          ...(branchId ? { branchId } : {}),
        },
        _sum: { outstandingBalance: true },
      }),
      db.fixedDeposit.aggregate({
        where: {
          status: { in: ["ACTIVE", "MATURED"] },
          ...(branchId ? { branchId } : {}),
        },
        _sum: { principalAmount: true },
      }),
      db.chartOfAccount.findFirst({
        where: { accountCode: "107000", isActive: true },
        select: { balance: true },
      }),
      db.chartOfAccount.findFirst({
        where: { accountCode: "201003", isActive: true },
        select: { balance: true },
      }),
    ]);

    const accountTypeIds = [...new Set([
      ...savingsByType.map((s) => s.accountTypeId),
      ...sharesByType.map((s) => s.accountTypeId),
      ...institutionSharesByType.map((s) => s.accountTypeId),
    ])];

    const mergedSharesByType = [...sharesByType];
    for (const instRow of institutionSharesByType) {
      const existing = mergedSharesByType.find((s) => s.accountTypeId === instRow.accountTypeId);
      if (existing) {
        (existing._sum as any).totalValue = Number((existing._sum as any).totalValue || 0) + Number((instRow._sum as any).balance || 0);
        existing._count += instRow._count;
      } else {
        mergedSharesByType.push({
          ...instRow,
          _sum: { totalValue: Number((instRow._sum as any).balance || 0) },
        } as any);
      }
    }

    const accountTypes = await db.accountType.findMany({
      where: { id: { in: accountTypeIds } },
      select: {
        id: true,
        name: true,
        isShareAccount: true,
        ledgerAccount: { select: { accountCode: true, accountName: true, balance: true } },
      },
    });

    const typeMap = new Map(accountTypes.map((t) => [t.id, t]));

    const savings: Array<{
      accountType: string;
      glCode: string | null;
      glName: string | null;
      operational: number;
      gl: number;
      discrepancy: number;
      count: number;
      status: string;
    }> = [];

    for (const row of savingsByType) {
      const at = typeMap.get(row.accountTypeId);
      const operational = Number(row._sum.balance || 0);
      const glBalance = Number(at?.ledgerAccount?.balance || 0);
      savings.push({
        accountType: at?.name || row.accountTypeId,
        glCode: at?.ledgerAccount?.accountCode || null,
        glName: at?.ledgerAccount?.accountName || null,
        operational,
        gl: glBalance,
        discrepancy: operational - glBalance,
        count: row._count,
        status: operational === glBalance ? "MATCHED" : "MISMATCH",
      });
    }

    const shares: Array<{
      accountType: string;
      glCode: string | null;
      glName: string | null;
      operational: number;
      gl: number;
      discrepancy: number;
      count: number;
      status: string;
    }> = [];

    for (const row of mergedSharesByType) {
      const at = typeMap.get(row.accountTypeId);
      const operational = Number(row._sum.totalValue || 0);
      const glBalance = Number(at?.ledgerAccount?.balance || 0);
      shares.push({
        accountType: at?.name || row.accountTypeId,
        glCode: at?.ledgerAccount?.accountCode || null,
        glName: at?.ledgerAccount?.accountName || null,
        operational,
        gl: glBalance,
        discrepancy: operational - glBalance,
        count: row._count,
        status: operational === glBalance ? "MATCHED" : "MISMATCH",
      });
    }

    const loanOperational = Number(loanAgg._sum.outstandingBalance || 0);
    const loanGLBalance = Number(loanGL?.balance || 0);
    const loanDiscrepancy = loanOperational - loanGLBalance;

    const fdOperational = Number(fdAgg._sum.principalAmount || 0);
    const fdGLBalance = Number(fdGL?.balance || 0);
    const fdDiscrepancy = fdOperational - fdGLBalance;

    const totalSavingsDiscrepancy = savings.reduce((s, r) => s + r.discrepancy, 0);
    const totalSharesDiscrepancy = shares.reduce((s, r) => s + r.discrepancy, 0);
    const overallDiscrepancy = totalSavingsDiscrepancy + totalSharesDiscrepancy + loanDiscrepancy + fdDiscrepancy;

    return NextResponse.json({
      success: true,
      data: {
        savings,
        shares,
        loans: {
          operational: loanOperational,
          gl: loanGLBalance,
          glCode: "107000",
          discrepancy: loanDiscrepancy,
          status: loanOperational === loanGLBalance ? "MATCHED" : "MISMATCH",
        },
        fixedDeposits: {
          operational: fdOperational,
          gl: fdGLBalance,
          glCode: "201003",
          discrepancy: fdDiscrepancy,
          status: fdOperational === fdGLBalance ? "MATCHED" : "MISMATCH",
        },
        overallDiscrepancy,
        overallStatus: overallDiscrepancy === 0 ? "MATCHED" : "MISMATCH",
        checkedAt: new Date().toISOString(),
        branchId: branchId || "ALL",
      },
    });
  } catch (error) {
    console.error("Error in member-vs-gl reconciliation:", error);
    return NextResponse.json({ error: "Failed to run reconciliation" }, { status: 500 });
  }
}
