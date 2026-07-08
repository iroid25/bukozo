// app/api/v1/accountant/cash-position/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";
import { subMonths, endOfMonth } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permissions
    const allowedRoles: UserRole[] = [
      UserRole.ACCOUNTANT,
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to view cash position",
        },
        { status: 403 }
      );
    }

    const now = new Date();
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Get current cash position
    const [vaultBalances, floatBalances, vaultDetails, floatDetails] =
      await Promise.all([
        // Sum of all active vault balances
        db.vault.aggregate({
          where: {
            isActive: true,
          },
          _sum: {
            balance: true,
            physicalCash: true,
          },
        }),

        // Sum of all user float balances
        db.userFloat.aggregate({
          _sum: {
            balance: true,
          },
        }),

        // Detailed vault breakdown
        db.vault.findMany({
          where: {
            isActive: true,
          },
          include: {
            branch: {
              select: {
                name: true,
              },
            },
            custodian: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            balance: "desc",
          },
        }),

        // Detailed float breakdown by user
        db.userFloat.findMany({
          where: {
            balance: {
              gt: 0,
            },
          },
          include: {
            user: {
              select: {
                name: true,
                role: true,
                branch: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            balance: "desc",
          },
          take: 10, // Top 10 float holders
        }),
      ]);

    const vaultBalance = vaultBalances._sum.balance || 0;
    const floatBalance = floatBalances._sum.balance || 0;

    // Calculate bank balance from transactions (simplified)
    // In production, you'd have a BankAccount model
    const bankDeposits = await db.$queryRaw<Array<{ total: number }>>`
      SELECT COALESCE(SUM(amount), 0)::float as total
      FROM "Transaction"
      WHERE type = 'DEPOSIT'
        AND status = 'COMPLETED'
        AND channel IN ('BANK_TRANSFER', 'BANK_DEPOSIT')
    `;

    const bankWithdrawals = await db.$queryRaw<Array<{ total: number }>>`
      SELECT COALESCE(SUM(amount), 0)::float as total
      FROM "Transaction"
      WHERE type = 'WITHDRAWAL'
        AND status = 'COMPLETED'
        AND channel IN ('BANK_TRANSFER', 'BANK_WITHDRAWAL')
    `;

    const bankBalance =
      (bankDeposits[0]?.total || 0) - (bankWithdrawals[0]?.total || 0);

    const totalCash = vaultBalance + floatBalance + bankBalance;

    // Get historical comparison (last month)
    const lastMonthCashPosition = await db.$queryRaw<
      Array<{ vault_total: number; float_total: number }>
    >`
      SELECT 
        COALESCE(SUM(v.balance), 0)::float as vault_total,
        COALESCE(SUM(uf.balance), 0)::float as float_total
      FROM "Vault" v
      FULL OUTER JOIN "UserFloat" uf ON true
      WHERE v."isActive" = true
        AND v."updatedAt" <= ${lastMonthEnd}
        OR uf."lastReconciliation" <= ${lastMonthEnd}
    `;

    const previousMonthCash =
      (lastMonthCashPosition[0]?.vault_total || 0) +
      (lastMonthCashPosition[0]?.float_total || 0) +
      bankBalance; // Assuming bank balance is relatively stable

    const cashGrowth =
      previousMonthCash > 0
        ? ((totalCash - previousMonthCash) / previousMonthCash) * 100
        : 0;

    // Format vault details
    const vaultBreakdown = vaultDetails.map((vault) => ({
      id: vault.id,
      name: vault.name,
      balance: vault.balance,
      physicalCash: vault.physicalCash,
      branch: vault.branch?.name || "N/A",
      custodian: vault.custodian?.name || "N/A",
      lastVerified: vault.lastVerified?.toISOString() || null,
      isBalanced: Math.abs(vault.balance - vault.physicalCash) < 100, // Allow 100 UGX difference
    }));

    // Format float details
    const floatBreakdown = floatDetails.map((float) => ({
      id: float.id,
      user: float.user.name,
      role: float.user.role,
      branch: float.user.branch?.name || "N/A",
      balance: float.balance,
      lastReconciliation: float.lastReconciliation?.toISOString() || null,
      isActiveForDay: float.isActiveForDay,
    }));

    // Calculate summary statistics
    const activeVaults = vaultDetails.filter((v) => v.isActive).length;
    const activeFloats = await db.userFloat.count({
      where: {
        balance: {
          gt: 0,
        },
      },
    });

    // Get unreconciled amounts
    const unreconciledFloats = await db.userFloat.count({
      where: {
        pendingReconciliation: true,
      },
    });

    const unreconciledVaults = await db.vaultReconciliation.count({
      where: {
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          vaultBalance,
          floatBalance,
          bankBalance,
          totalCash,
          previousMonthCash,
          cashGrowth: Number(cashGrowth.toFixed(1)),
          activeVaults,
          activeFloats,
        },
        vaultBreakdown,
        floatBreakdown,
        reconciliationStatus: {
          unreconciledFloats,
          unreconciledVaults,
          totalUnreconciled: unreconciledFloats + unreconciledVaults,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching cash position:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cash position",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
