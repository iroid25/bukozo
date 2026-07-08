// @ts-nocheck
// app/api/v1/accountant/pending-approvals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import {
  UserRole,
  TransactionStatus,
  ReconciliationStatus,
} from "@prisma/client";

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
          error: "You don't have permission to view pending approvals",
        },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const type = searchParams.get("type"); // 'expenditure', 'reconciliation', or 'all'

    let pendingExpenditures = [];
    let pendingFloatReconciliations = [];
    let pendingVaultReconciliations = [];

    // Fetch based on type filter
    if (!type || type === "all" || type === "expenditure") {
      pendingExpenditures = await db.expenditureRecord.findMany({
        where: {
          status: TransactionStatus.PENDING,
        },
        include: {
          category: true,
          submittedBy: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
          branch: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    if (!type || type === "all" || type === "reconciliation") {
      [pendingFloatReconciliations, pendingVaultReconciliations] =
        await Promise.all([
          db.floatReconciliation.findMany({
            where: {
              status: ReconciliationStatus.PENDING,
            },
            include: {
              reconciledByUser: {
                select: {
                  name: true,
                  email: true,
                  role: true,
                },
              },
              float: {
                include: {
                  user: {
                    select: {
                      name: true,
                      branch: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: {
              reconciliationDate: "desc",
            },
          }),

          db.vaultReconciliation.findMany({
            where: {
              status: ReconciliationStatus.PENDING,
            },
            include: {
              reconciledBy: {
                select: {
                  name: true,
                  email: true,
                  role: true,
                },
              },
              vault: {
                select: {
                  name: true,
                  branch: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              reconciliationDate: "desc",
            },
          }),
        ]);
    }

    // Format all approvals into a unified structure
    const allApprovals = [
      ...pendingExpenditures.map((exp) => ({
        id: exp.id,
        type: "EXPENDITURE" as const,
        amount: exp.amount,
        category: exp.category.name,
        description: exp.description || "No description provided",
        submittedBy: exp.submittedBy.name,
        submittedByEmail: exp.submittedBy.email,
        submittedByRole: exp.submittedBy.role,
        submittedAt: exp.createdAt.toISOString(),
        branch: exp.branch?.name || "N/A",
        priority:
          exp.amount > 2000000
            ? "HIGH"
            : exp.amount > 1000000
              ? "MEDIUM"
              : "LOW",
        details: {
          payee: exp.payee,
          paymentMethod: exp.paymentMethod,
          receiptNumber: exp.receiptNumber,
          voucherNo: exp.voucherNo,
        },
      })),

      ...pendingFloatReconciliations.map((rec) => ({
        id: rec.id,
        type: "FLOAT_RECONCILIATION" as const,
        amount: rec.systemBalance,
        category: "Float Reconciliation",
        description: `Float reconciliation for ${rec.float.user.name}`,
        submittedBy: rec.reconciledByUser.name,
        submittedByEmail: rec.reconciledByUser.email,
        submittedByRole: rec.reconciledByUser.role,
        submittedAt: rec.reconciliationDate.toISOString(),
        branch: rec.float.user.branch?.name || "N/A",
        priority: !rec.isBalanced ? "HIGH" : "MEDIUM",
        details: {
          actualCash: rec.actualCash,
          systemBalance: rec.systemBalance,
          difference: rec.difference,
          isBalanced: rec.isBalanced,
          userName: rec.float.user.name,
        },
      })),

      ...pendingVaultReconciliations.map((rec) => ({
        id: rec.id,
        type: "VAULT_RECONCILIATION" as const,
        amount: rec.systemBalance,
        category: "Vault Reconciliation",
        description: `Vault reconciliation for ${rec.vault.name}`,
        submittedBy: rec.reconciledBy.name,
        submittedByEmail: rec.reconciledBy.email,
        submittedByRole: rec.reconciledBy.role,
        submittedAt: rec.reconciliationDate.toISOString(),
        branch: rec.vault.branch?.name || "N/A",
        priority: !rec.isBalanced ? "HIGH" : "LOW",
        details: {
          physicalCash: rec.physicalCash,
          systemBalance: rec.systemBalance,
          difference: rec.difference,
          isBalanced: rec.isBalanced,
          vaultName: rec.vault.name,
        },
      })),
    ];

    // Sort by date (newest first)
    allApprovals.sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    // Apply pagination
    const total = allApprovals.length;
    const paginatedApprovals = allApprovals.slice(offset, offset + limit);

    // Count by type
    const counts = {
      expenditure: pendingExpenditures.length,
      floatReconciliation: pendingFloatReconciliations.length,
      vaultReconciliation: pendingVaultReconciliations.length,
      total,
    };

    return NextResponse.json({
      success: true,
      data: {
        approvals: paginatedApprovals,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        counts,
      },
    });
  } catch (error) {
    console.error("Error fetching pending approvals:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch pending approvals",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
