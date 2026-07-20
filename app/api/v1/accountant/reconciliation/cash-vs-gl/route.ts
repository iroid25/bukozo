import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { UserRole } from "@prisma/client";

/**
 * GET /api/v1/accountant/reconciliation/cash-vs-gl
 * Compares operational vault + float balances against GL account balances
 * to detect discrepancies between sub-ledgers and the general ledger.
 *
 * Returns:
 * - vaultOperational: sum of Vault.balance (isActive=true)
 * - vaultGL: ChartOfAccount.balance WHERE accountCode='102005'
 * - vaultDiscrepancy: vaultOperational - vaultGL
 * - floatOperational: sum of UserFloat.balance (isActiveForDay=true)
 * - floatGL: ChartOfAccount.balance WHERE accountCode='102004'
 * - floatDiscrepancy: floatOperational - floatGL
 * - cashAtHandGL: ChartOfAccount.balance WHERE accountCode='101100'
 * - overallDiscrepancy: sum of all discrepancies
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawBranchId = searchParams.get("branchId") || undefined;
    const branchId = resolveBranchScope(
      { role: user.role, branchId: user.branchId },
      rawBranchId,
    );

    const [vaultAgg, vaultGL, floatAgg, floatGL, cashAtHandGL] = await Promise.all([
      db.vault.aggregate({
        where: { isActive: true, ...(branchId ? { branchId } : {}) },
        _sum: { balance: true },
      }),
      db.chartOfAccount.findFirst({
        where: { accountCode: "102005", isActive: true },
        select: { balance: true },
      }),
      db.userFloat.aggregate({
        where: { isActiveForDay: true, ...(branchId ? { userId: branchId } : {}) },
        _sum: { balance: true },
      }),
      db.chartOfAccount.findFirst({
        where: { accountCode: "102004", isActive: true },
        select: { balance: true },
      }),
      db.chartOfAccount.findFirst({
        where: { accountCode: "101100", isActive: true },
        select: { balance: true },
      }),
    ]);

    const vaultOperational = Number(vaultAgg._sum.balance || 0);
    const vaultGLBalance = Number(vaultGL?.balance || 0);
    const vaultDiscrepancy = vaultOperational - vaultGLBalance;

    const floatOperational = Number(floatAgg._sum.balance || 0);
    const floatGLBalance = Number(floatGL?.balance || 0);
    const floatDiscrepancy = floatOperational - floatGLBalance;

    const cashAtHandBalance = Number(cashAtHandGL?.balance || 0);

    const overallDiscrepancy = vaultDiscrepancy + floatDiscrepancy;

    return NextResponse.json({
      success: true,
      data: {
        vault: {
          operational: vaultOperational,
          gl: vaultGLBalance,
          discrepancy: vaultDiscrepancy,
          status: vaultDiscrepancy === 0 ? "MATCHED" : "MISMATCH",
        },
        float: {
          operational: floatOperational,
          gl: floatGLBalance,
          discrepancy: floatDiscrepancy,
          status: floatDiscrepancy === 0 ? "MATCHED" : "MISMATCH",
        },
        cashAtHand: {
          gl: cashAtHandBalance,
        },
        overallDiscrepancy,
        overallStatus: overallDiscrepancy === 0 ? "MATCHED" : "MISMATCH",
        checkedAt: new Date().toISOString(),
        branchId: branchId || "ALL",
      },
    });
  } catch (error) {
    console.error("Error in cash-vs-gl reconciliation:", error);
    return NextResponse.json({ error: "Failed to run reconciliation" }, { status: 500 });
  }
}
