"use server";

import { db } from "@/prisma/db";
import { NotificationType, Prisma, UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import { revalidatePath } from "next/cache";

function getDatabaseAwareErrorMessage(error: unknown, fallback: string) {
  if (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P1001") ||
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Error &&
      error.message.includes("Can't reach database server"))
  ) {
    return "Database unavailable";
  }

  return fallback;
}

/**
 * Get all notifications for the current user (last 50)
 */
export async function getUserNotifications() {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return {
        ok: false,
        error: "Unauthorized",
        data: [],
      };
    }

    const notifications = await db.notification.findMany({
      where: { userId: currentUser.id },
      orderBy: { sentAt: "desc" },
      take: 50,
    });

    return {
      ok: true,
      data: notifications,
      error: null,
    };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return {
      ok: false,
      error: getDatabaseAwareErrorMessage(error, "Failed to fetch notifications"),
      data: [],
    };
  }
}

/**
 * Get unread notifications count
 */
export async function getUnreadNotificationsCount() {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return {
        ok: false,
        error: "Unauthorized",
        data: 0,
      };
    }

    const count = await db.notification.count({
      where: {
        userId: currentUser.id,
        isRead: false,
      },
    });

    return {
      ok: true,
      data: count,
      error: null,
    };
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return {
      ok: false,
      error: getDatabaseAwareErrorMessage(error, "Failed to fetch unread count"),
      data: 0,
    };
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(id: string) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) return { ok: false, error: "Unauthorized" };

    await db.notification.update({
      where: { id, userId: currentUser.id },
      data: { isRead: true },
    });

    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return { ok: false, error: "Failed to update notification" };
  }
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllNotificationsAsRead() {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) return { ok: false, error: "Unauthorized" };

    await db.notification.updateMany({
      where: { userId: currentUser.id, isRead: false },
      data: { isRead: true },
    });

    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (error) {
    console.error("Error marking all as read:", error);
    return { ok: false, error: "Failed to update notifications" };
  }
}

/**
 * Delete a specific notification
 */
export async function deleteNotification(id: string) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) return { ok: false, error: "Unauthorized" };

    await db.notification.delete({
      where: { id, userId: currentUser.id },
    });

    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (error) {
    console.error("Error deleting notification:", error);
    return { ok: false, error: "Failed to delete notification" };
  }
}

/**
 * Notify branch managers about a new user
 */
export async function notifyBranchManagersAboutNewUser(
  userId: string,
  userName: string,
  role: string,
  branchId?: string
) {
  try {
    // 1. Get branch managers
    const branchManagers = await db.user.findMany({
      where: {
        role: UserRole.BRANCHMANAGER,
        isActive: true,
      },
    });

    if (branchManagers.length === 0) return;

    // 2. Create in-app notifications
    const notificationData = branchManagers.map((manager) => ({
      userId: manager.id,
      type: NotificationType.IN_APP,
      subject: "New User Registered",
      message: `A new ${role.toLowerCase()}, ${userName}, has been successfully registered.`,
      status: "PENDING",
    }));

    await db.notification.createMany({
      data: notificationData,
    });

    console.log(`✅ Notified ${branchManagers.length} branch managers about new user: ${userName}`);
  } catch (error) {
    console.error("❌ Error in notifyBranchManagersAboutNewUser:", error);
  }
}

/**
 * Notify branch managers and admins about a new institution loan application
 */
export async function notifyBranchManagersAboutInstitutionLoan(
  loanApplicationId: string,
  institutionName: string,
  amountApplied: number,
  loanProductName: string,
  branchId?: string
) {
  try {
    // 1. Get branch managers (optionally filtered by branch) and admins
    const targetStaff = await db.user.findMany({
      where: {
        role: { in: [UserRole.BRANCHMANAGER, UserRole.ADMIN] },
        isActive: true,
      },
    });

    if (targetStaff.length === 0) return { ok: true };

    const formattedAmount = `UGX ${new Intl.NumberFormat("en-UG").format(amountApplied)}`;

    // 2. Create in-app notifications
    const notificationData = targetStaff.map((staff) => ({
      userId: staff.id,
      type: NotificationType.IN_APP,
      subject: "New Institution Loan Application",
      message: `${institutionName} has applied for a ${loanProductName} of ${formattedAmount}.`,
      status: "PENDING",
    }));

    await db.notification.createMany({
      data: notificationData,
    });

    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (error) {
    console.error("❌ Error notifying about institution loan:", error);
    return { ok: false, error: "Failed to send notifications" };
  }
}

/**
 * Notify institution user about a loan decision (approved/rejected)
 */
export async function notifyInstitutionOfLoanDecision(
  userId: string,
  institutionName: string,
  isApproved: boolean,
  amountApplied: number,
  approvedAmount?: number,
  rejectionReason?: string
) {
  try {
    const formattedApplied = `UGX ${new Intl.NumberFormat("en-UG").format(amountApplied)}`;
    const subject = isApproved ? "Loan Application Approved" : "Loan Application Rejected";
    
    let message: string;
    if (isApproved) {
      const formattedApproved = `UGX ${new Intl.NumberFormat("en-UG").format(approvedAmount || amountApplied)}`;
      message = `Congratulations! The loan application for ${institutionName} has been approved for ${formattedApproved}.`;
    } else {
      message = `The loan application for ${institutionName} of ${formattedApplied} was unfortunately rejected. Reason: ${rejectionReason || "Criteria not met"}.`;
    }

    await db.notification.create({
      data: {
        userId,
        type: NotificationType.IN_APP,
        subject,
        message,
        status: "PENDING",
      },
    });

    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (error) {
    console.error("❌ Error notifying institution of decision:", error);
    return { ok: false, error: "Failed to send notification" };
  }
}

/**
 * Notify institution user about a loan disbursement
 */
export async function notifyInstitutionOfLoanDisbursement(
  userId: string,
  institutionName: string,
  amountGranted: number,
  accountNumber: string,
  dueDate: Date | string
) {
  try {
    const formattedAmount = `UGX ${new Intl.NumberFormat("en-UG").format(amountGranted)}`;
    const formattedDate = new Date(dueDate).toLocaleDateString('en-UG', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });

    await db.notification.create({
      data: {
        userId,
        type: NotificationType.IN_APP,
        subject: "Loan Disbursed Successfully",
        message: `A loan of ${formattedAmount} for ${institutionName} has been disbursed to account ${accountNumber}. First repayment due by ${formattedDate}.`,
        status: "PENDING",
      },
    });

    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (error) {
    console.error("❌ Error notifying institution of disbursement:", error);
    return { ok: false, error: "Failed to send notification" };
  }
}

/**
 * Notify user about their account approval or rejection
 */
export async function notifyUserOfApproval(
  userId: string,
  userName: string,
  isApproved: boolean,
  rejectionReason?: string
) {
  try {
    const subject = isApproved ? "Account Approved" : "Account Registration Update";
    
    let message: string;
    if (isApproved) {
      message = `Congratulations ${userName}! Your account has been approved and is now active. You can now access all features.`;
    } else {
      message = `Hello ${userName}, your account registration was not approved. Reason: ${rejectionReason || "Criteria not met"}. Please contact support for more information.`;
    }

    await db.notification.create({
      data: {
        userId,
        type: NotificationType.IN_APP,
        subject,
        message,
        status: "PENDING",
      },
    });

    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (error) {
    console.error("❌ Error notifying user of approval:", error);
    return { ok: false, error: "Failed to send notification" };
  }
}

/**
 * Notify member about a loan disbursement
 */
export async function notifyMemberOfLoanDisbursement(
  userId: string,
  amountGranted: number,
  accountNumber: string,
  dueDate: Date | string
) {
  try {
    const formattedAmount = `UGX ${new Intl.NumberFormat("en-UG").format(amountGranted)}`;
    const formattedDate = new Date(dueDate).toLocaleDateString('en-UG', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });

    await db.notification.create({
      data: {
        userId,
        type: NotificationType.IN_APP,
        subject: "Loan Disbursed",
        message: `Your loan of ${formattedAmount} has been disbursed to account ${accountNumber}. First repayment due by ${formattedDate}.`,
        status: "PENDING",
      },
    });

    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (error) {
    console.error("❌ Error notifying member of disbursement:", error);
    return { ok: false, error: "Failed to send notification" };
  }
}

/**
 * Notify member about a loan repayment
 */
export async function notifyMemberOfLoanRepayment(
  userId: string,
  amountPaid: number,
  loanProductName: string,
  remainingBalance: number
) {
  try {
    const formattedPaid = `UGX ${new Intl.NumberFormat("en-UG").format(amountPaid)}`;
    const formattedBalance = `UGX ${new Intl.NumberFormat("en-UG").format(remainingBalance)}`;

    await db.notification.create({
      data: {
        userId,
        type: NotificationType.IN_APP,
        subject: "Loan Repayment Received",
        message: `We have received your payment of ${formattedPaid} for your ${loanProductName} loan. Your outstanding balance is now ${formattedBalance}.`,
        status: "PENDING",
      },
    });

    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (error) {
    console.error("❌ Error notifying member of repayment:", error);
    return { ok: false, error: "Failed to send notification" };
  }
}

/**
 * Notify member about any account activity (Generic)
 */
export async function notifyMemberOfAccountActivity(
  userId: string,
  subject: string,
  message: string,
  targetAddress?: string
) {
  try {
    await db.notification.create({
      data: {
        userId,
        type: NotificationType.IN_APP,
        subject,
        message,
        targetAddress,
        status: "PENDING",
      },
    });

    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (error) {
    console.error("❌ Error sending account activity notification:", error);
    return { ok: false, error: "Failed to send notification" };
  }
}
