// app/api/v1/reconciliation/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { UserRole, ReconciliationStatus } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";

/**
 * POST /api/v1/reconciliation/approve - Approve a float reconciliation
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    // Check permissions
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
      UserRole.ACCOUNTANT,
    ];
    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return NextResponse.json(
        { error: "You don't have permission to approve reconciliations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reconciliationId, notes } = body;

    if (!reconciliationId) {
      return NextResponse.json(
        { error: "Reconciliation ID is required" },
        { status: 400 }
      );
    }

    // Check if reconciliation exists
    const existingReconciliation = await db.floatReconciliation.findUnique({
      where: { id: reconciliationId },
      include: {
        reconciledByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!existingReconciliation) {
      return NextResponse.json(
        { error: "Reconciliation not found" },
        { status: 404 }
      );
    }

    // Check if already approved
    if (existingReconciliation.status === ReconciliationStatus.APPROVED) {
      return NextResponse.json(
        { error: "This reconciliation has already been approved" },
        { status: 400 }
      );
    }

    // Approve the reconciliation
    const approvedReconciliation = await db.floatReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: ReconciliationStatus.APPROVED,
        approvedByUserId: currentUser.id,
        approvalDate: new Date(),
        notes: notes || existingReconciliation.notes,
      },
      include: {
        reconciledByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "RECONCILIATION_APPROVED",
        entityType: "FloatReconciliation",
        entityId: reconciliationId,
        details: `Approved float reconciliation. Difference: ${existingReconciliation.difference}. ${notes ? `Notes: ${notes}` : ""}`,
      },
    });

    return NextResponse.json(
      {
        message: "Reconciliation approved successfully",
        data: approvedReconciliation,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error approving reconciliation:", error);
    return NextResponse.json(
      { error: "Failed to approve reconciliation" },
      { status: 500 }
    );
  }
}
