"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { revalidatePath } from "next/cache";

export async function approveMember(memberId: string) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Unauthorized" };
    }

    const member = await db.member.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    if (!member.fingerprintTemplate) {
      return {
        success: false,
        error: "Member must enroll a fingerprint before approval.",
      };
    }

    if (member.approvalStatus === "APPROVED") {
      return { success: false, error: "Member is already approved" };
    }

    await db.member.update({
      where: { id: memberId },
      data: {
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        approvedByUserId: user.id,
        isApproved: true,
        approvalDate: new Date(),
      },
    });

    // Notify the member
    if (member.userId) {
      await db.notification.create({
        data: {
          userId: member.userId,
          type: "IN_APP",
          subject: "Membership Approved",
          message: `Congratulations! Your membership has been approved. You can now access all SACCO services.`,
          targetAddress: "/dashboard",
          status: "PENDING",
        },
      });
    }

    revalidatePath("/dashboard/members");
    revalidatePath("/dashboard/members/pending");
    return { success: true };
  } catch (error) {
    console.error("Error approving member:", error);
    return { success: false, error: "Failed to approve member" };
  }
}

export async function rejectMember(memberId: string, reason: string) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
      return { success: false, error: "Unauthorized" };
    }

    if (!reason) {
      return { success: false, error: "Rejection reason is required" };
    }

    const member = await db.member.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    await db.member.update({
      where: { id: memberId },
      data: {
        approvalStatus: "REJECTED",
        rejectionReason: reason,
        approvedByUserId: user.id,
      },
    });

    // Notify the member
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

    revalidatePath("/dashboard/members");
    revalidatePath("/dashboard/members/pending");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting member:", error);
    return { success: false, error: "Failed to reject member" };
  }
}
