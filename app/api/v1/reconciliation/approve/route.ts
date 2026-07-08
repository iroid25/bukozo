import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { UserRole, ReconciliationStatus } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
      UserRole.ACCOUNTANT,
    ];

    if (!allowedRoles.includes(currentUser.role)) {
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

    const approvedReconciliation = await db.floatReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: ReconciliationStatus.APPROVED,
        approvedByUserId: currentUser.id,
        approvalDate: new Date(),
        notes: notes || undefined,
      },
    });

    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "RECONCILIATION_APPROVED",
        entityType: "FloatReconciliation",
        entityId: reconciliationId,
        details: `Approved reconciliation. ${notes ? `Notes: ${notes}` : ""}`,
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
