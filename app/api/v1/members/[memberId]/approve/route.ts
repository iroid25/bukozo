import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";

// PUT /api/v1/members/{memberId}/approve - Approve a member
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const user = session.user as any;
    if (!["ADMIN", "BRANCHMANAGER"].includes(user.role)) {
      return ApiErrors.forbidden("Only admins and branch managers can approve members");
    }

    const { memberId } = await params;

    const member = await db.member.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!member) return ApiErrors.notFound("Member");

    if (member.approvalStatus === "APPROVED") {
      return ApiErrors.validationError("Member is already approved");
    }

    await db.member.update({
      where: { id: memberId },
      data: {
        isApproved: true,
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        approvedByUserId: user.id,
      },
    });

    // Send in-app notification
    if (member.userId) {
      await db.notification.create({
        data: {
          userId: member.userId,
          type: "IN_APP",
          subject: "Membership Approved",
          message: "Congratulations! Your membership has been approved. You can now access all SACCO services.",
          targetAddress: "/dashboard",
          status: "PENDING",
        },
      });
    }

    return successResponse({ memberId }, "Member approved successfully");
  } catch (error: any) {
    console.error("Error approving member:", error);
    return ApiErrors.internalError(error.message);
  }
}

// DELETE /api/v1/members/{memberId}/approve - Reject a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const user = session.user as any;
    if (!["ADMIN", "BRANCHMANAGER"].includes(user.role)) {
      return ApiErrors.forbidden("Only admins and branch managers can reject members");
    }

    const { memberId } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return ApiErrors.validationError("Rejection reason is required");
    }

    const member = await db.member.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!member) return ApiErrors.notFound("Member");

    await db.member.update({
      where: { id: memberId },
      data: {
        isApproved: false,
        approvalStatus: "REJECTED",
        rejectionReason: reason,
        approvedByUserId: user.id,
      },
    });

    // Send in-app notification
    if (member.userId) {
      await db.notification.create({
        data: {
          userId: member.userId,
          type: "IN_APP",
          subject: "Membership Application Update",
          message: `Your membership application was not approved. Reason: ${reason}. Please contact the office for more details.`,
          status: "PENDING",
        },
      });
    }

    return successResponse({ memberId }, "Member rejected");
  } catch (error: any) {
    console.error("Error rejecting member:", error);
    return ApiErrors.internalError(error.message);
  }
}
