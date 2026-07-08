// app/api/v1/accountant/expenditure/[id]/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, TransactionStatus } from "@prisma/client";

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
          error: "You don't have permission to reject expenditures",
        },
        { status: 403 }
      );
    }

    // ✅ Await params in Next.js 15
    const params = await props.params;
    const { id } = params;

    const body = await request.json();
    const { rejectionReason } = body;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    // Find the expenditure record
    const expenditure = await db.expenditureRecord.findUnique({
      where: { id },
      include: {
        budgetCategory: true,
        submittedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!expenditure) {
      return NextResponse.json(
        { success: false, error: "Expenditure record not found" },
        { status: 404 }
      );
    }

    if (expenditure.status !== TransactionStatus.PENDING) {
      return NextResponse.json(
        {
          success: false,
          error: `Expenditure has already been ${expenditure.status.toLowerCase()}`,
        },
        { status: 400 }
      );
    }

    // Update expenditure record
    const updatedExpenditure = await db.expenditureRecord.update({
      where: { id },
      data: {
        status: TransactionStatus.FAILED, // Using FAILED to represent rejected
        approvedByUserId: user.id,
        approvedAt: new Date(),
        rejectionReason: rejectionReason.trim(),
      },
      include: {
        budgetCategory: true,
        approvedBy: {
          select: {
            name: true,
          },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "REJECT_EXPENDITURE",
        entityType: "ExpenditureRecord",
        entityId: id,
        oldValue: { status: expenditure.status },
        newValue: {
          status: TransactionStatus.FAILED,
          rejectionReason: rejectionReason.trim(),
        },
        details: `Rejected expenditure of UGX ${expenditure.amount.toLocaleString()} for ${
          expenditure.budgetCategory?.name || "Unknown"
        }. Reason: ${rejectionReason.trim()}`,
        timestamp: new Date(),
      },
    });

    // Create notification for submitter
    await db.notification.create({
      data: {
        userId: expenditure.submittedByUserId,
        type: "IN_APP",
        subject: "Expenditure Rejected",
        message: `Your expenditure request for UGX ${expenditure.amount.toLocaleString()} (${
          expenditure.budgetCategory?.name || "Unknown"
        }) has been rejected by ${user.name}. Reason: ${rejectionReason.trim()}`,
        targetAddress: "/dashboard/expenditure",
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Expenditure rejected successfully",
      data: updatedExpenditure,
    });
  } catch (error) {
    console.error("Error rejecting expenditure:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reject expenditure",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
