import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import { ReconciliationStatus, UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
          error: "You don't have permission to reject reconciliations",
        },
        { status: 403 }
      );
    }

    const params = await props.params;
    const { id } = params;

    const body = await request.json();
    const { rejectionReason } = body;

    if (!rejectionReason || String(rejectionReason).trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required" },
        { status: 400 }
      );
    }

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
          error: "You can only reject reconciliations within your branch",
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

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.floatReconciliation.update({
        where: { id },
        data: {
          status: ReconciliationStatus.REJECTED,
          approvedByUserId: currentUser.id,
          approvalDate: new Date(),
          rejectionReason: String(rejectionReason).trim(),
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
          userId: reconciliation.float.user.id,
          type: "IN_APP",
          subject: "Reconciliation Rejected",
          message: `Your reconciliation was rejected by ${currentUser.name || "an accountant"}. Reason: ${String(rejectionReason).trim()}. Please review and resubmit.`,
          isRead: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "EOD_RECONCILIATION_REJECTED",
          entityType: "FloatReconciliation",
          entityId: id,
          details: JSON.stringify({
            tellerName: reconciliation.float.user.name,
            accountantName: currentUser.name,
            rejectionReason: String(rejectionReason).trim(),
          }),
        },
      });

      return updated;
    });

    revalidatePath("/dashboard/accountant/reconciliations");
    revalidatePath("/dashboard/floats/my-float");
    revalidatePath(`/dashboard/floats/users/${reconciliation.float.user.id}`);

    return NextResponse.json({
      success: true,
      message: "Reconciliation rejected successfully",
      data: {
        id: result.id,
        status: result.status,
        approvalDate: result.approvalDate,
      },
    });
  } catch (error) {
    console.error("Error rejecting reconciliation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reject reconciliation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
