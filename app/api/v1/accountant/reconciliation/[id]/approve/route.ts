import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import {
  ReconciliationStatus,
  TransactionType,
  UserRole,
  VaultTransactionType,
} from "@prisma/client";
import { getFloatOpeningBalanceSource } from "@/lib/float-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const allowedRoles: UserRole[] = [
      UserRole.ACCOUNTANT,
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to approve reconciliations",
        },
        { status: 403 }
      );
    }

    const params = await props.params;
    const { id } = params;

    const body = await request.json();
    const { notes } = body;

    const currentUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        role: true,
        branchId: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Approver not found" },
        { status: 404 }
      );
    }

    const reconciliation = await db.floatReconciliation.findUnique({
      where: { id },
      include: {
        float: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                branchId: true,
              },
            },
          },
        },
      },
    });

    if (!reconciliation) {
      return NextResponse.json(
        { success: false, error: "Reconciliation not found" },
        { status: 404 }
      );
    }

    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.branchId &&
      reconciliation.float.user.branchId &&
      currentUser.branchId !== reconciliation.float.user.branchId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You can only approve reconciliations within your branch",
        },
        { status: 403 }
      );
    }

    if (reconciliation.status !== ReconciliationStatus.PENDING) {
      return NextResponse.json(
        {
          success: false,
          error: "This reconciliation has already been processed",
        },
        { status: 400 }
      );
    }

    const branchId =
      reconciliation.float.user.branchId || currentUser.branchId || null;
    const systemBalance = Number(reconciliation.systemBalance) || 0;
    const totalPhysical = Number(reconciliation.actualCash) || 0;
    const variance = Number(reconciliation.difference) || 0;
    const tolerance = 1000;
    const isBalanced = Math.abs(variance) <= tolerance;
    const hasOverage = variance > tolerance;
    const hasShortage = variance < -tolerance;
    const openingBalanceSource = await getFloatOpeningBalanceSource(
      reconciliation.floatId
    );
    const dayStart =
      reconciliation.dayStart ||
      reconciliation.float.currentDayStarted ||
      new Date();
    const dayEnd = reconciliation.dayEnd || new Date();

    const result = await db.$transaction(async (tx) => {
      let vault = null;
      if (branchId) {
        vault = await tx.vault.findFirst({
          where: {
            branchId,
            isActive: true,
          },
        });

        if (!vault) {
          const branch = await tx.branch.findUnique({
            where: { id: branchId },
            select: { name: true },
          });

          vault = await tx.vault.create({
            data: {
              name: `${branch?.name || "Branch"} Vault`,
              branchId,
              balance: 0,
              physicalCash: 0,
              isActive: true,
              custodianUserId: currentUser.id,
              location: branch?.name || "Main Branch",
            },
          });
        }
      }

      const updatedReconciliation = await tx.floatReconciliation.update({
        where: { id },
        data: {
          status: ReconciliationStatus.APPROVED,
          approvedByUserId: currentUser.id,
          approvalDate: new Date(),
          notes: notes ? String(notes).trim() : reconciliation.notes,
        },
      });

      let vaultBalanceAfter: number | null = null;
      if (vault) {
        const balanceBefore = Number(vault.balance) || 0;
        vaultBalanceAfter = balanceBefore + totalPhysical;

        await tx.vaultTransaction.create({
          data: {
            vaultId: vault.id,
            type: VaultTransactionType.FLOAT_RETURN,
            amount: totalPhysical,
            balanceBefore,
            balanceAfter: vaultBalanceAfter,
            description: `EOD Reconciliation - ${reconciliation.float.user.name}`,
            relatedFloatReconciliationId: id,
            relatedUserId: reconciliation.float.user.id,
            performedByUserId: currentUser.id,
          },
        });

        await tx.vault.update({
          where: { id: vault.id },
          data: {
            balance: vaultBalanceAfter,
            physicalCash: {
              increment: totalPhysical,
            },
          },
        });

        if (hasOverage && branchId) {
          const suspenseAccount = await tx.suspenseAccount.findFirst({
            where: {
              branchId,
              isActive: true,
            },
          });

          const suspense =
            suspenseAccount ||
            (await tx.suspenseAccount.create({
              data: {
                name: "Branch Suspense Account",
                branchId,
                balance: 0,
                isActive: true,
                description: "Branch suspense account for overages",
              },
            }));

          await tx.suspenseTransaction.create({
            data: {
              suspenseAccountId: suspense.id,
              type: TransactionType.DEPOSIT,
              amount: variance,
              description: `Overage from ${reconciliation.float.user.name} EOD Reconciliation`,
              performedByUserId: currentUser.id,
              referenceId: id,
              referenceType: "FloatReconciliation",
              status: "PENDING_INVESTIGATION",
            },
          });

          await tx.suspenseAccount.update({
            where: { id: suspense.id },
            data: {
              balance: {
                increment: variance,
              },
            },
          });
        }

        if (hasShortage) {
          await tx.cashShortage.create({
            data: {
              userId: reconciliation.float.user.id,
              amount: Math.abs(variance),
              reportedByUserId: currentUser.id,
              description: `Shortage detected in ${reconciliation.float.user.name} EOD Reconciliation`,
              reconciliationId: id,
              status: "PENDING",
            },
          });
        }
      }

      await tx.userFloat.update({
        where: { id: reconciliation.floatId },
        data: {
          balance: 0,
          pendingReconciliation: false,
          isActiveForDay: false,
          canStartNewDay: true,
          currentDayStarted: null,
          lastReconciliation: new Date(),
          lastDayReconciled: new Date(),
        },
      });

      await tx.floatTransaction.create({
        data: {
          floatId: reconciliation.floatId,
          type: TransactionType.FLOAT_RECONCILIATION,
          amount: -systemBalance,
          performedByUserId: currentUser.id,
          description: `EOD Reconciliation Approved - ${reconciliation.float.user.name}`,
          relatedTransactionId: id,
        },
      });

      await tx.notification.create({
        data: {
          userId: reconciliation.float.user.id,
          type: "IN_APP",
          subject: "Reconciliation Approved",
          message: `Your reconciliation has been approved by ${currentUser.name || "an accountant"}. ${isBalanced ? "The float was balanced." : `Variance of ${formatCurrency(Math.abs(variance))} was recorded.`}`,
          isRead: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RECONCILIATION_APPROVED",
          entityType: "FloatReconciliation",
          entityId: id,
          details: JSON.stringify({
            tellerName: reconciliation.float.user.name,
            approverName: currentUser.name,
            systemBalance,
            openingBalance: openingBalanceSource?.balance ?? systemBalance,
            actualCash: totalPhysical,
            difference: variance,
            isBalanced,
            dayStart,
            dayEnd,
            notes: notes || reconciliation.notes,
          }),
        },
      });

      return {
        updatedReconciliation,
        vaultBalanceAfter,
      };
    });

    revalidatePath("/dashboard/accountant/reconciliations");
    revalidatePath("/dashboard/floats/my-float");
    revalidatePath("/dashboard/floats/distribution/reconciliations");
    revalidatePath("/dashboard/reports");
    revalidatePath(`/dashboard/floats/users/${reconciliation.float.user.id}`);

    return NextResponse.json({
      success: true,
      message: "Reconciliation approved successfully",
      data: {
        id: result.updatedReconciliation.id,
        status: result.updatedReconciliation.status,
        approvalDate: result.updatedReconciliation.approvalDate,
        newFloatBalance: 0,
        floatReturned: totalPhysical,
        variance,
        isBalanced,
        vaultBalanceAfter: result.vaultBalanceAfter,
      },
    });
  } catch (error) {
    console.error("Error approving reconciliation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to approve reconciliation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
