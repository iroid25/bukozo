import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // 1. Get all branches and their vaults
    const branches = await db.branch.findMany({
      include: {
        vaults: {
          include: {
            custodian: {
              select: { name: true, role: true }
            }
          }
        },
      },
    });

    const auditResults = branches.map(branch => {
      const activeVaults = branch.vaults.filter(v => v.isActive);
      const totalBalance = branch.vaults.reduce((sum, v) => sum + v.balance, 0);
      const activeBalance = activeVaults.reduce((sum, v) => sum + v.balance, 0);

      return {
        id: branch.id,
        name: branch.name,
        vaultCount: branch.vaults.length,
        activeVaultCount: activeVaults.length,
        totalBalance,
        activeBalance,
        isCorrupt: activeVaults.length > 1,
        vaults: branch.vaults.map(v => ({
          id: v.id,
          name: v.name,
          balance: v.balance,
          isActive: v.isActive,
          custodian: v.custodian?.name || "N/A",
          createdAt: v.createdAt,
        }))
      };
    });

    // 2. Overall SACCO Summary (Sum across all branches)
    const grandTotalBalance = auditResults.reduce((sum, b) => sum + b.activeBalance, 0);

    return NextResponse.json({
      success: true,
      summary: {
        totalBranches: branches.length,
        corruptBranches: auditResults.filter(b => b.isCorrupt).length,
        grandTotalBalance,
      },
      results: auditResults,
    });

  } catch (error) {
    console.error("Vault Audit Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
