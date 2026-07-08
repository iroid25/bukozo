// @ts-nocheck
// actions/reconciliation.ts
"use server";

import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import {
  ReconciliationStatus,
  TransactionType,
  UserRole,
  VaultTransactionType,
} from "@prisma/client";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ReconciliationData {
  floatId: string;
  actualCashOnHand: number;
  actualFloatAmount: number;
  reconciledByUserId: string;
  notes?: string;
}

interface ActionResponse {
  success?: boolean;
  error?: string;
  message?: string;
  data?: any;
}

interface ApproveReconciliationParams {
  reconciliationId: string;
  approvedByUserId: string;
  notes?: string;
}

interface ApproveReconciliationResult {
  success: boolean;
  message: string;
  error?: string;
  data?: {
    id: string;
    status: ReconciliationStatus;
    approvalDate: Date;
  };
}

interface ReconciliationResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// ============================================================================
// SUBMIT RECONCILIATION
// ============================================================================

/**
 * Submit EOD Reconciliation - Creates PENDING reconciliation for accountant approval
 */
export async function submitEndOfDayReconciliation(
  data: ReconciliationData
): Promise<ActionResponse> {
  try {
    if (!data.floatId || !data.reconciledByUserId) {
      return { error: "Missing required fields" };
    }

    const actualCashOnHand = Number(data.actualCashOnHand) || 0;
    const actualFloatAmount = Number(data.actualFloatAmount) || 0;

    if (actualCashOnHand < 0 || actualFloatAmount < 0) {
      return { error: "Amounts cannot be negative" };
    }

    const userFloat = await db.userFloat.findUnique({
      where: { id: data.floatId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            branchId: true,
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!userFloat) {
      return { error: "Float not found" };
    }

    if (userFloat.userId !== data.reconciledByUserId) {
      return { error: "You can only reconcile your own float" };
    }

    if (userFloat.pendingReconciliation) {
      return {
        error: "There is already a pending reconciliation awaiting approval.",
      };
    }

    const systemBalance = Number(userFloat.balance) || 0;
    const totalPhysical = actualCashOnHand + actualFloatAmount;
    const variance = totalPhysical - systemBalance;

    const TOLERANCE = 1000;
    const isBalanced = Math.abs(variance) <= TOLERANCE;

    const result = await db.$transaction(async (tx) => {
      const reconciliation = await tx.floatReconciliation.create({
        data: {
          floatId: data.floatId,
          reconciliationDate: new Date(),
          systemBalance: systemBalance,
          actualCash: totalPhysical,
          cashOnHand: actualCashOnHand,
          floatReturned: actualFloatAmount,
          difference: variance,
          isBalanced: isBalanced,
          reconciledByUserId: data.reconciledByUserId,
          status: ReconciliationStatus.PENDING,
          notes: data.notes || null,
          reconciliationType: "END_OF_DAY",
          isEndOfDay: true,
        },
      });

      await tx.userFloat.update({
        where: { id: data.floatId },
        data: {
          pendingReconciliation: true,
          isActiveForDay: false,
          canStartNewDay: false,
        },
      });

      const accountants = await tx.user.findMany({
        where: {
          role: UserRole.ACCOUNTANT,
          branchId: userFloat.user.branchId,
          isActive: true,
        },
      });

      for (const accountant of accountants) {
        await tx.notification.create({
          data: {
            userId: accountant.id,
            type: "IN_APP",
            subject: `🔔 EOD Reconciliation Request: ${userFloat.user.name}`,
            message: `${userFloat.user.name} submitted EOD reconciliation. Amount: UGX ${totalPhysical.toLocaleString()}. ${
              isBalanced
                ? "✅ Balanced"
                : variance > TOLERANCE
                  ? `⚠️ Overage: UGX ${variance.toLocaleString()}`
                  : `❌ Shortage: UGX ${Math.abs(variance).toLocaleString()}`
            }. Approval required.`,
            isRead: false,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: data.reconciledByUserId,
          action: "EOD_RECONCILIATION_SUBMITTED",
          entityType: "FloatReconciliation",
          entityId: reconciliation.id,
          details: JSON.stringify({
            tellerName: userFloat.user.name,
            systemBalance,
            totalPhysical,
            cashOnHand: actualCashOnHand,
            floatAmount: actualFloatAmount,
            variance,
            isBalanced,
          }),
        },
      });

      return {
        reconciliationId: reconciliation.id,
        tellerName: userFloat.user.name,
        variance,
        isBalanced,
      };
    });

    revalidatePath("/dashboard/my-float");
    revalidatePath("/dashboard/floats/my-float");
    revalidatePath("/dashboard/accountant/reconciliations");

    return {
      success: true,
      data: result,
      message:
        "✅ Reconciliation submitted successfully. Awaiting accountant approval.",
    };
  } catch (error) {
    console.error("Error submitting reconciliation:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to submit reconciliation",
    };
  }
}

// ============================================================================
// APPROVE RECONCILIATION (Simple - No Vault Integration)
// ============================================================================

/**
 * Approve a reconciliation (Simple approval without vault integration)
 * Use this for basic approval flow
 * For vault integration, use approveReconciliationWithVault instead
 */
export async function approveReconciliation({
  reconciliationId,
  approvedByUserId,
  notes,
}: ApproveReconciliationParams): Promise<ApproveReconciliationResult> {
  try {
    // Validate inputs
    if (!reconciliationId || !approvedByUserId) {
      return {
        success: false,
        message: "Missing required fields",
        error: "Reconciliation ID and Approver ID are required",
      };
    }

    // Check if the approver exists and has appropriate role
    const approver = await db.user.findUnique({
      where: { id: approvedByUserId },
      select: {
        id: true,
        role: true,
        name: true,
      },
    });

    if (!approver) {
      return {
        success: false,
        message: "Approver not found",
        error: "The specified approver does not exist",
      };
    }

    // Check if approver has permission (ADMIN, BRANCHMANAGER, or ACCOUNTANT)
    const authorizedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
      UserRole.ACCOUNTANT,
    ];

    if (!authorizedRoles.includes(approver.role)) {
      return {
        success: false,
        message: "Unauthorized",
        error: "You do not have permission to approve reconciliations",
      };
    }

    // Check if the reconciliation exists
    const reconciliation = await db.floatReconciliation.findUnique({
      where: { id: reconciliationId },
      include: {
        float: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                branchId: true,
              },
            },
          },
        },
      },
    });

    if (!reconciliation) {
      return {
        success: false,
        message: "Reconciliation not found",
        error: "The specified reconciliation does not exist",
      };
    }

    // Check if already approved or rejected
    if (reconciliation.status === ReconciliationStatus.APPROVED) {
      return {
        success: false,
        message: "Already approved",
        error: "This reconciliation has already been approved",
      };
    }

    if (reconciliation.status === ReconciliationStatus.REJECTED) {
      return {
        success: false,
        message: "Already rejected",
        error: "This reconciliation has already been rejected",
      };
    }

    // Check if pending
    if (reconciliation.status !== ReconciliationStatus.PENDING) {
      return {
        success: false,
        message: "Invalid status",
        error: "Only pending reconciliations can be approved",
      };
    }

    // Prevent self-approval
    if (reconciliation.reconciledByUserId === approvedByUserId) {
      return {
        success: false,
        message: "Self-approval not allowed",
        error: "You cannot approve your own reconciliation",
      };
    }

    // Update the reconciliation status to APPROVED
    const updatedReconciliation = await db.$transaction(async (tx) => {
      const updated = await tx.floatReconciliation.update({
        where: { id: reconciliationId },
        data: {
          status: ReconciliationStatus.APPROVED,
          approvedByUserId: approvedByUserId,
          approvalDate: new Date(),
          notes: notes
            ? `${reconciliation.notes ? reconciliation.notes + "\n\n" : ""}Approval Note: ${notes}`
            : reconciliation.notes,
        },
      });

      // Reset float pending status
      await tx.userFloat.update({
        where: { id: reconciliation.floatId },
        data: {
          pendingReconciliation: false,
          canStartNewDay: true,
        },
      });

      // Create notification for the teller
      await tx.notification.create({
        data: {
          userId: reconciliation.float.userId,
          type: "IN_APP",
          subject: "✅ Reconciliation Approved",
          message: `Your reconciliation has been approved by ${approver.name}. ${
            reconciliation.isBalanced
              ? "✅ Balanced perfectly!"
              : reconciliation.difference > 0
                ? `⚠️ Overage: UGX ${reconciliation.difference.toLocaleString()}`
                : `❌ Shortage: UGX ${Math.abs(reconciliation.difference).toLocaleString()}`
          }`,
          isRead: false,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: approvedByUserId,
          action: "RECONCILIATION_APPROVED",
          entityType: "FloatReconciliation",
          entityId: reconciliation.id,
          details: JSON.stringify({
            tellerName: reconciliation.float.user.name,
            approverName: approver.name,
            systemBalance: reconciliation.systemBalance,
            actualCash: reconciliation.actualCash,
            difference: reconciliation.difference,
            isBalanced: reconciliation.isBalanced,
            notes,
          }),
        },
      });

      return updated;
    });

    // Revalidate relevant paths
    revalidatePath("/dashboard/reconciliation");
    revalidatePath("/dashboard/accounts/suspense");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/accountant/reconciliations");
    revalidatePath("/dashboard/my-float");

    return {
      success: true,
      message: `Reconciliation approved successfully by ${approver.name}`,
      data: {
        id: updatedReconciliation.id,
        status: updatedReconciliation.status,
        approvalDate: updatedReconciliation.approvalDate!,
      },
    };
  } catch (error) {
    console.error("Error approving reconciliation:", error);
    return {
      success: false,
      message: "Failed to approve reconciliation",
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// ============================================================================
// APPROVE RECONCILIATION WITH VAULT INTEGRATION
// ============================================================================

/**
 * Approve reconciliation with vault integration
 * Handles vault transactions, overages, and shortages
 */
export async function approveReconciliationWithVault(
  reconciliationId: string,
  accountantId: string,
  approvalNotes?: string
): Promise<ActionResponse> {
  try {
    const accountant = await db.user.findUnique({
      where: { id: accountantId },
      select: { role: true, name: true, branchId: true },
    });

    if (!accountant) {
      return { error: "Accountant not found" };
    }

    if (
      accountant.role !== UserRole.ACCOUNTANT &&
      accountant.role !== UserRole.ADMIN &&
      accountant.role !== UserRole.BRANCHMANAGER
    ) {
      return {
        error:
          "Only accountants, admins, or branch managers can approve reconciliations",
      };
    }

    const reconciliation = await db.floatReconciliation.findUnique({
      where: { id: reconciliationId },
      include: {
        float: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                branchId: true,
              },
            },
          },
        },
      },
    });

    if (!reconciliation) {
      return { error: "Reconciliation not found" };
    }

    if (reconciliation.status !== ReconciliationStatus.PENDING) {
      return { error: "This reconciliation has already been processed" };
    }

    const branchId =
      accountant.branchId || reconciliation.float.user.branchId;

    let vault = await db.vault.findFirst({
      where: {
        branchId: branchId,
        isActive: true,
      },
    });

    // 1. Resolve suspense account
    let suspenseAccount = await db.suspenseAccount.findFirst({
      where: {
        branchId: reconciliation.float.user.branchId,
        isActive: true,
      },
    });

    if (!suspenseAccount && reconciliation.float.user.branchId) {
      suspenseAccount = await db.suspenseAccount.create({
        data: {
          name: `Branch Suspense Account`,
          branchId: reconciliation.float.user.branchId,
          balance: 0,
          isActive: true,
          description: "Branch suspense account for overages",
        },
      });
    }

    // 2. Prepare balance figures
    const totalPhysical = Number(reconciliation.actualCash);
    const variance = Number(reconciliation.difference);
    const systemBalance = Number(reconciliation.systemBalance);
    const tellerName = reconciliation.float.user.name;

    const TOLERANCE = 1000;
    const isBalanced = Math.abs(variance) <= TOLERANCE;
    const hasOverage = variance > TOLERANCE;
    const hasShortage = variance < -TOLERANCE;

    // Consolidate vault logic inside transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Ensure vault exists (Final check inside transaction)
      let targetVault = await tx.vault.findFirst({
        where: { branchId: branchId, isActive: true },
      });

      if (!targetVault) {
        const branch = await tx.branch.findUnique({
          where: { id: branchId },
          select: { name: true },
        });

        targetVault = await tx.vault.create({
          data: {
            name: `${branch?.name || "Branch"} Vault`,
            branchId: branchId,
            balance: 0,
            physicalCash: 0,
            isActive: true,
            custodianUserId: accountantId,
            location: branch?.name || "Main Branch",
          },
        });
      }

      const vaultId = targetVault.id;
      const currentVaultBalance = targetVault.balance;

      await tx.floatReconciliation.update({
        where: { id: reconciliationId },
        data: {
          status: ReconciliationStatus.APPROVED,
          approvedByUserId: accountantId,
          approvalDate: new Date(),
          notes: approvalNotes || reconciliation.notes,
        },
      });

      const vaultTransaction = await tx.vaultTransaction.create({
        data: {
          vaultId: vaultId,
          type: VaultTransactionType.FLOAT_RETURN,
          amount: totalPhysical,
          balanceBefore: currentVaultBalance,
          balanceAfter: currentVaultBalance + totalPhysical,
          description: `EOD Reconciliation - ${tellerName} (${new Date().toLocaleDateString()})`,
          relatedFloatReconciliationId: reconciliationId,
          relatedUserId: reconciliation.float.userId,
          performedByUserId: accountantId,
        },
      });

      await tx.vault.update({
        where: { id: vaultId },
        data: {
          balance: {
            increment: totalPhysical,
          },
          physicalCash: {
            increment: totalPhysical,
          },
        },
      });

      let suspenseTransactionId = null;
      let shortageRecordId = null;

      if (hasOverage && suspenseAccount) {
        const overageAmount = variance;

        const suspenseTransaction = await tx.suspenseTransaction.create({
          data: {
            suspenseAccountId: suspenseAccount.id,
            type: TransactionType.DEPOSIT,
            amount: overageAmount,
            description: `Overage from ${tellerName} EOD Reconciliation`,
            performedByUserId: accountantId,
            referenceId: reconciliationId,
            referenceType: "FloatReconciliation",
            status: "PENDING_INVESTIGATION",
          },
        });

        await tx.suspenseAccount.update({
          where: { id: suspenseAccount.id },
          data: {
            balance: {
              increment: overageAmount,
            },
          },
        });

        suspenseTransactionId = suspenseTransaction.id;
      }

      if (hasShortage) {
        const shortageAmount = Math.abs(variance);

        const shortageRecord = await tx.cashShortage.create({
          data: {
            userId: reconciliation.float.userId,
            amount: shortageAmount,
            reportedByUserId: accountantId,
            description: `Shortage detected in ${tellerName} EOD Reconciliation`,
            reconciliationId: reconciliationId,
            status: "PENDING",
          },
        });

        shortageRecordId = shortageRecord.id;
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
        },
      });

      await tx.floatTransaction.create({
        data: {
          floatId: reconciliation.floatId,
          type: TransactionType.FLOAT_RECONCILIATION,
          amount: -systemBalance,
          performedByUserId: accountantId,
          description: `EOD Reconciliation Approved - ${tellerName}`,
          relatedTransactionId: reconciliationId,
        },
      });

      await tx.notification.create({
        data: {
          userId: reconciliation.float.userId,
          type: "IN_APP",
          subject: "✅ EOD Reconciliation Approved",
          message: `Your end-of-day reconciliation has been approved by ${accountant.name}. ${
            isBalanced
              ? "✅ Balanced perfectly!"
              : hasOverage
                ? `⚠️ Overage of UGX ${variance.toLocaleString()} sent to suspense.`
                : `❌ Shortage of UGX ${Math.abs(variance).toLocaleString()} recorded.`
          } You can now start a new day.`,
          isRead: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: accountantId,
          action: "EOD_RECONCILIATION_APPROVED",
          entityType: "FloatReconciliation",
          entityId: reconciliationId,
          details: JSON.stringify({
            tellerName,
            accountantName: accountant.name,
            totalPhysical,
            systemBalance,
            variance,
            isBalanced,
            hasOverage,
            hasShortage,
            vaultTransactionId: vaultTransaction.id,
            suspenseTransactionId,
            shortageRecordId,
            approvalNotes,
          }),
        },
      });

      return {
        tellerName,
        variance,
        isBalanced,
        hasOverage,
        hasShortage,
        totalPhysical,
        vaultTransactionId: vaultTransaction.id,
        suspenseTransactionId,
        shortageRecordId,
      };
    });

    revalidatePath("/dashboard/accountant/reconciliations");
    revalidatePath("/dashboard/my-float");
    revalidatePath("/dashboard/accounts/vault");

    return {
      success: true,
      data: result,
      message: `✅ Reconciliation approved! UGX ${result.totalPhysical.toLocaleString()} added to vault.`,
    };
  } catch (error) {
    console.error("Error approving reconciliation:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to approve reconciliation",
    };
  }
}

// ============================================================================
// REJECT RECONCILIATION
// ============================================================================

/**
 * Reject reconciliation
 */
export async function rejectReconciliation(
  reconciliationId: string,
  accountantId: string,
  rejectionReason: string
): Promise<ActionResponse> {
  try {
    const accountant = await db.user.findUnique({
      where: { id: accountantId },
      select: { role: true, name: true },
    });

    if (!accountant) {
      return { error: "Accountant not found" };
    }

    if (
      accountant.role !== UserRole.ACCOUNTANT &&
      accountant.role !== UserRole.ADMIN &&
      accountant.role !== UserRole.BRANCHMANAGER
    ) {
      return {
        error:
          "Only accountants, admins, or branch managers can reject reconciliations",
      };
    }

    const reconciliation = await db.floatReconciliation.findUnique({
      where: { id: reconciliationId },
      include: {
        userFloat: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!reconciliation) {
      return { error: "Reconciliation not found" };
    }

    if (reconciliation.status !== ReconciliationStatus.PENDING) {
      return { error: "This reconciliation has already been processed" };
    }

    const tellerName = reconciliation.float.user.name;

    await db.$transaction(async (tx) => {
      await tx.floatReconciliation.update({
        where: { id: reconciliationId },
        data: {
          status: ReconciliationStatus.REJECTED,
          approvedByUserId: accountantId,
          approvalDate: new Date(),
          rejectionReason: rejectionReason,
        },
      });

      await tx.userFloat.update({
        where: { id: reconciliation.floatId },
        data: {
          pendingReconciliation: false,
          isActiveForDay: true,
          canStartNewDay: false,
        },
      });

      await tx.notification.create({
        data: {
          userId: reconciliation.float.userId,
          type: "IN_APP",
          subject: "❌ EOD Reconciliation Rejected",
          message: `Your reconciliation was rejected by ${accountant.name}. Reason: ${rejectionReason}. Please resubmit with corrections.`,
          isRead: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: accountantId,
          action: "EOD_RECONCILIATION_REJECTED",
          entityType: "FloatReconciliation",
          entityId: reconciliationId,
          details: JSON.stringify({
            tellerName,
            accountantName: accountant.name,
            rejectionReason,
          }),
        },
      });
    });

    revalidatePath("/dashboard/accountant/reconciliations");
    revalidatePath("/dashboard/my-float");

    return {
      success: true,
      message: `Reconciliation rejected for ${tellerName}. Teller can resubmit.`,
    };
  } catch (error) {
    console.error("Error rejecting reconciliation:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to reject reconciliation",
    };
  }
}

// ============================================================================
// GET RECONCILIATIONS
// ============================================================================

/**
 * Get pending reconciliations
 */
export async function getPendingReconciliations(): Promise<any[]> {
  try {
    const reconciliations = await db.floatReconciliation.findMany({
      where: {
        status: ReconciliationStatus.PENDING,
        isEndOfDay: true,
      },
      include: {
        userFloat: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                branchId: true,
                branch: {
                  select: {
                    id: true,
                    name: true,
                    location: true,
                  },
                },
              },
            },
          },
        },
        reconciledByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        reconciliationDate: "asc",
      },
    });

    return reconciliations;
  } catch (error) {
    console.error("Error fetching pending reconciliations:", error);
    return [];
  }
}

/**
 * Get a single reconciliation by ID with all related data
 * Returns comprehensive information including float, user, approver, and transaction details
 */
export async function getReconciliationById(
  reconciliationId: string
): Promise<ReconciliationResult> {
  try {
    // Validate input
    if (!reconciliationId) {
      return {
        success: false,
        error: "Reconciliation ID is required",
        message: "Missing reconciliation ID",
      };
    }

    // Fetch reconciliation with all related data
    const reconciliation = await db.floatReconciliation.findUnique({
      where: { id: reconciliationId },
      include: {
        // Float information
        userFloat: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                branchId: true,
                branch: {
                  select: {
                    id: true,
                    name: true,
                    location: true,
                  },
                },
              },
            },
          },
        },
        // User who reconciled (usually the teller)
        reconciledByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
          },
        },
        // User who approved/rejected (accountant/manager)
        approvedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
          },
        },
        // Related vault transactions (if any)
        vaultTransactions: {
          include: {
            vault: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
            performedByUser: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: {
            transactionDate: "desc",
          },
        },
        // Related shortage records (if any)
        shortages: {
          include: {
            reportedByUser: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: {
            reportedDate: "desc",
          },
        },
      },
    });

    if (!reconciliation) {
      return {
        success: false,
        error: "Reconciliation not found",
        message: "The specified reconciliation does not exist",
      };
    }

    // Calculate additional metadata
    const TOLERANCE = 1000;
    const hasOverage = reconciliation.difference > TOLERANCE;
    const hasShortage = reconciliation.difference < -TOLERANCE;
    const variancePercentage =
      reconciliation.systemBalance > 0
        ? (
            (reconciliation.difference / reconciliation.systemBalance) *
            100
          ).toFixed(2)
        : "0.00";

    // Format the response with computed fields
    const formattedReconciliation = {
      ...reconciliation,
      // Add computed fields
      hasOverage,
      hasShortage,
      variancePercentage,
      varianceAmount: Math.abs(reconciliation.difference),
      // Format dates
      reconciliationDateFormatted:
        reconciliation.reconciliationDate.toLocaleDateString(),
      approvalDateFormatted: reconciliation.approvalDate
        ? reconciliation.approvalDate.toLocaleDateString()
        : null,
      // Status information
      isPending: reconciliation.status === ReconciliationStatus.PENDING,
      isApproved: reconciliation.status === ReconciliationStatus.APPROVED,
      isRejected: reconciliation.status === ReconciliationStatus.REJECTED,
      isUnderReview:
        reconciliation.status === ReconciliationStatus.UNDER_REVIEW,
      // User information
      tellerName: reconciliation.float.user.name,
      tellerEmail: reconciliation.float.user.email,
      branchName: reconciliation.float.user.branch?.name || "N/A",
      branchLocation: reconciliation.float.user.branch?.location || "N/A",
      approverName: reconciliation.approvedByUser?.name || null,
      // Financial summary
      totalPhysicalCash: reconciliation.actualCash,
      expectedAmount: reconciliation.systemBalance,
      // Counts
      vaultTransactionCount: reconciliation.vaultTransactions.length,
      shortageRecordCount: reconciliation.shortages.length,
    };

    return {
      success: true,
      data: formattedReconciliation,
      message: "Reconciliation retrieved successfully",
    };
  } catch (error) {
    console.error("Error fetching reconciliation:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
      message: "Failed to retrieve reconciliation",
    };
  }
}

/**
 * Get reconciliation by ID (Minimal version - without related data)
 * Use this when you only need basic reconciliation information
 */
export async function getReconciliationByIdMinimal(
  reconciliationId: string
): Promise<ReconciliationResult> {
  try {
    if (!reconciliationId) {
      return {
        success: false,
        error: "Reconciliation ID is required",
      };
    }

    const reconciliation = await db.floatReconciliation.findUnique({
      where: { id: reconciliationId },
    });

    if (!reconciliation) {
      return {
        success: false,
        error: "Reconciliation not found",
      };
    }

    return {
      success: true,
      data: reconciliation,
      message: "Reconciliation retrieved successfully",
    };
  } catch (error) {
    console.error("Error fetching reconciliation:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get simple reconciliation statistics (4 properties)
 * Use this for AdminSuspenseView and simple dashboards
 */
export async function getReconciliationStats(branchId?: string): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}> {
  try {
    const whereClause: any = {
      isEndOfDay: true,
    };

    if (branchId) {
      whereClause.userFloat = {
        user: {
          branchId: branchId,
        },
      };
    }

    const [total, pending, approved, rejected] = await Promise.all([
      db.floatReconciliation.count({ where: whereClause }),
      db.floatReconciliation.count({
        where: { ...whereClause, status: ReconciliationStatus.PENDING },
      }),
      db.floatReconciliation.count({
        where: { ...whereClause, status: ReconciliationStatus.APPROVED },
      }),
      db.floatReconciliation.count({
        where: { ...whereClause, status: ReconciliationStatus.REJECTED },
      }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
    };
  } catch (error) {
    console.error("Error fetching reconciliation stats:", error);
    return {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
  }
}

/**
 * Get detailed reconciliation statistics
 * Use this for detailed analytics and reports
 */
export async function getReconciliationStatistics(
  branchId?: string
): Promise<any> {
  try {
    const whereClause: any = {
      isEndOfDay: true,
    };

    if (branchId) {
      whereClause.userFloat = {
        user: {
          branchId: branchId,
        },
      };
    }

    const reconciliations = await db.floatReconciliation.findMany({
      where: whereClause,
      include: {
        userFloat: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                branchId: true,
              },
            },
          },
        },
      },
      orderBy: {
        reconciliationDate: "desc",
      },
    });

    const statusCounts = {
      total: reconciliations.length,
      pending: reconciliations.filter(
        (r) => r.status === ReconciliationStatus.PENDING
      ).length,
      approved: reconciliations.filter(
        (r) => r.status === ReconciliationStatus.APPROVED
      ).length,
      rejected: reconciliations.filter(
        (r) => r.status === ReconciliationStatus.REJECTED
      ).length,
      underReview: reconciliations.filter(
        (r) => r.status === ReconciliationStatus.UNDER_REVIEW
      ).length,
    };

    const balancedCount = reconciliations.filter((r) => r.isBalanced).length;
    const unbalancedCount = reconciliations.length - balancedCount;

    const TOLERANCE = 1000;
    const overageCount = reconciliations.filter(
      (r) => r.difference > TOLERANCE
    ).length;
    const shortageCount = reconciliations.filter(
      (r) => r.difference < -TOLERANCE
    ).length;

    const totalSystemBalance = reconciliations.reduce(
      (sum, r) => sum + Number(r.systemBalance),
      0
    );
    const totalActualCash = reconciliations.reduce(
      (sum, r) => sum + Number(r.actualCash),
      0
    );
    const totalVariance = reconciliations.reduce(
      (sum, r) => sum + Number(r.difference),
      0
    );
    const totalOverage = reconciliations
      .filter((r) => r.difference > TOLERANCE)
      .reduce((sum, r) => sum + Number(r.difference), 0);
    const totalShortage = Math.abs(
      reconciliations
        .filter((r) => r.difference < -TOLERANCE)
        .reduce((sum, r) => sum + Number(r.difference), 0)
    );

    const avgVariance =
      reconciliations.length > 0
        ? reconciliations.reduce(
            (sum, r) => sum + Math.abs(Number(r.difference)),
            0
          ) / reconciliations.length
        : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayReconciliations = reconciliations.filter(
      (r) => new Date(r.reconciliationDate) >= today
    );

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekReconciliations = reconciliations.filter(
      (r) => new Date(r.reconciliationDate) >= weekAgo
    );

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthReconciliations = reconciliations.filter(
      (r) => new Date(r.reconciliationDate) >= monthAgo
    );

    const approvalRate =
      reconciliations.length > 0
        ? (statusCounts.approved / reconciliations.length) * 100
        : 0;

    const balancedRate =
      reconciliations.length > 0
        ? (balancedCount / reconciliations.length) * 100
        : 0;

    const approvedReconciliations = reconciliations.filter(
      (r) => r.status === ReconciliationStatus.APPROVED && r.approvalDate
    );

    const avgApprovalTimeMs =
      approvedReconciliations.length > 0
        ? approvedReconciliations.reduce((sum, r) => {
            const submitTime = new Date(r.reconciliationDate).getTime();
            const approvalTime = r.approvalDate
              ? new Date(r.approvalDate).getTime()
              : submitTime;
            return sum + (approvalTime - submitTime);
          }, 0) / approvedReconciliations.length
        : 0;

    const avgApprovalTimeHours = avgApprovalTimeMs / (1000 * 60 * 60);

    const recentActivity = reconciliations.slice(0, 10).map((r) => ({
      id: r.id,
      tellerName: r.userFloat.user.name,
      date: r.reconciliationDate,
      status: r.status,
      difference: r.difference,
      isBalanced: r.isBalanced,
    }));

    return {
      statusCounts,
      balanceAnalysis: {
        balanced: balancedCount,
        unbalanced: unbalancedCount,
        balancedRate: balancedRate.toFixed(2),
      },
      varianceAnalysis: {
        overages: overageCount,
        shortages: shortageCount,
        balanced: balancedCount,
        totalOverage,
        totalShortage,
        totalVariance,
        avgVariance: avgVariance.toFixed(2),
      },
      financialSummary: {
        totalSystemBalance,
        totalActualCash,
        totalVariance,
        totalOverage,
        totalShortage,
      },
      timeMetrics: {
        today: todayReconciliations.length,
        thisWeek: weekReconciliations.length,
        thisMonth: monthReconciliations.length,
      },
      performance: {
        approvalRate: approvalRate.toFixed(2),
        balancedRate: balancedRate.toFixed(2),
        avgApprovalTimeHours: avgApprovalTimeHours.toFixed(2),
      },
      recentActivity,
    };
  } catch (error) {
    console.error("Error fetching reconciliation statistics:", error);
    return {
      statusCounts: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        underReview: 0,
      },
      balanceAnalysis: {
        balanced: 0,
        unbalanced: 0,
        balancedRate: "0.00",
      },
      varianceAnalysis: {
        overages: 0,
        shortages: 0,
        balanced: 0,
        totalOverage: 0,
        totalShortage: 0,
        totalVariance: 0,
        avgVariance: "0.00",
      },
      financialSummary: {
        totalSystemBalance: 0,
        totalActualCash: 0,
        totalVariance: 0,
        totalOverage: 0,
        totalShortage: 0,
      },
      timeMetrics: {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
      },
      performance: {
        approvalRate: "0.00",
        balancedRate: "0.00",
        avgApprovalTimeHours: "0.00",
      },
      recentActivity: [],
    };
  }
}
