"use server";

import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import {
  NotificationType,
  LoanStage,
  LoanStatus,
  UserRole,
} from "@prisma/client";

// ------------------------------
// Utilities
// ------------------------------
async function sendEmail(to: string, subject: string, html: string) {
  // Stub: records a Notification. Swap to your real mailer later.
  try {
    await db.notification.create({
      data: {
        type: NotificationType.EMAIL,
        subject,
        message: html,
        targetAddress: to,
        status: "SENT",
      },
    });
  } catch (e) {
    console.error("sendEmail (fallback Notification) failed:", e);
  }
}

async function writeAudit(
  userId: string,
  action: string,
  entityId: string,
  details?: string
) {
  try {
    await db.auditLog.create({
      data: {
        userId,
        action,
        entityType: "LoanApplication",
        entityId,
        details,
      },
    });
  } catch (e) {
    console.error("audit error:", e);
  }
}

// small helper
function revalidateLoans() {
  revalidatePath("/dashboard/loans/officer");
  revalidatePath("/dashboard/loans/manager");
  revalidatePath("/dashboard/loans/teller");
  revalidatePath("/member/loans/tracking");
}

// ------------------------------
// Officer: create & submit
// ------------------------------
export async function officerCreateAndSubmitApplication(data: {
  memberId: string;
  applicantUserId: string;
  loanProductId: string;
  amountApplied: number;
  purpose?: string;
}) {
  try {
    const app = await db.loanApplication.create({
      data: {
        memberId: data.memberId,
        applicantId: data.applicantUserId,
        loanOfficerId: data.applicantUserId,
        loanProductId: data.loanProductId,
        amountApplied: Number(data.amountApplied),
        purpose: data.purpose?.trim() || null,
        status: LoanStatus.PENDING,
        stage: LoanStage.SUBMITTED,
        submittedAt: new Date(),
      },
      include: {
        member: { include: { user: true } },
        loanProduct: true,
      },
    });

    // Notify all branch managers
    const managers = await db.user.findMany({
      where: { role: UserRole.BRANCHMANAGER },
      select: { email: true, name: true },
    });
    for (const m of managers) {
      if (m?.email) {
        await sendEmail(
          m.email,
          `New Loan Application – ${app.member.user?.name ?? app.memberId}`,
          `<p>Member: <b>${app.member.user?.name ?? app.memberId}</b></p>
           <p>Product: <b>${app.loanProduct.name}</b></p>
           <p>Requested Amount: <b>UGX ${app.amountApplied.toLocaleString()}</b></p>`
        );
      }
    }

    await writeAudit(data.applicantUserId, "APPLICATION_SUBMITTED", app.id);
    revalidateLoans();
    return { error: null, data: app };
  } catch (e) {
    console.error("officerCreateAndSubmitApplication:", e);
    return { error: "Failed to submit application", data: null };
  }
}

// ------------------------------
// Officer: mark IN_ANALYSIS
// ------------------------------
export async function officerProgressAnalysis(
  applicationId: string,
  officerUserId: string
) {
  try {
    const app = await db.loanApplication.update({
      where: { id: applicationId },
      data: { stage: LoanStage.IN_ANALYSIS, inAnalysisAt: new Date(), loanOfficerId: officerUserId },
    });
    await writeAudit(officerUserId, "APPLICATION_IN_ANALYSIS", applicationId);
    revalidateLoans();
    return { error: null, data: app };
  } catch (e) {
    console.error("officerProgressAnalysis:", e);
    return { error: "Failed to mark In Analysis", data: null };
  }
}

// ------------------------------
// Officer: forward to manager
// ------------------------------
export async function officerForwardToManager(
  applicationId: string,
  officerUserId: string
) {
  try {
    const app = await db.loanApplication.update({
      where: { id: applicationId },
      data: {
        stage: LoanStage.FORWARDED_TO_MANAGER,
        forwardedAt: new Date(),
      },
    });

    const managers = await db.user.findMany({
      where: { role: UserRole.BRANCHMANAGER },
      select: { email: true },
    });
    for (const m of managers) {
      if (m?.email) {
        await sendEmail(
          m.email,
          `Loan Application Forwarded – ${applicationId}`,
          `<p>Application <b>${applicationId}</b> was forwarded to you for approval.</p>`
        );
      }
    }

    await writeAudit(officerUserId, "APPLICATION_FORWARDED", applicationId);
    revalidateLoans();
    return { error: null, data: app };
  } catch (e) {
    console.error("officerForwardToManager:", e);
    return { error: "Failed to forward application", data: null };
  }
}

// ------------------------------
// Officer: queue (in-process)
// ------------------------------
export async function listOfficerQueue(officerUserId: string) {
  try {
    const apps = await db.loanApplication.findMany({
      where: {
        applicantId: officerUserId,
        stage: {
          in: [
            LoanStage.SUBMITTED,
            LoanStage.IN_ANALYSIS,
            LoanStage.FORWARDED_TO_MANAGER,
          ],
        },
      },
      orderBy: { applicationDate: "desc" },
      include: {
        member: { include: { user: true } },
        loanProduct: true,
      },
    });
    return apps;
  } catch (e) {
    console.error("listOfficerQueue:", e);
    return [];
  }
}

// ------------------------------
// Manager: approve / reject
// ------------------------------
import { LoanService } from "@/services/loan.service";

export async function managerApprove(
  applicationId: string,
  managerUserId: string,
  approvedAmount: number,
  allocatedTellerId?: string
) {
  try {
    const result = await LoanService.approve({
      applicationId,
      managerId: managerUserId,
      approvedAmount,
      tellerId: allocatedTellerId,
    });

    if (!result.ok) {
      return { error: result.error, data: null };
    }

    revalidateLoans();
    return { error: null, data: result.data };
  } catch (e: any) {
    console.error("managerApprove:", e);
    return { error: e.message || "Approval failed", data: null };
  }
}

export async function managerReject(
  applicationId: string,
  managerUserId: string,
  reason: string
) {
  try {
    const result = await LoanService.reject({
      applicationId,
      managerId: managerUserId,
      reason,
    });

    if (!result.ok) {
      return { error: result.error, data: null };
    }

    revalidateLoans();
    return { error: null, data: result.data };
  } catch (e: any) {
    console.error("managerReject:", e);
    return { error: e.message || "Rejection failed", data: null };
  }
}

// ------------------------------
// Member: submit appeal
// ------------------------------
export async function memberSubmitAppeal(
  memberId: string,
  applicationId: string,
  reason: string
) {
  try {
    const appeal = await db.loanAppeal.create({
      data: { applicationId, memberId, reason },
    });
    await writeAudit(
      memberId,
      "APPLICATION_APPEAL_SUBMITTED",
      applicationId,
      reason
    );
    revalidateLoans();
    return { error: null, data: appeal };
  } catch (e) {
    console.error("memberSubmitAppeal:", e);
    return { error: "Failed to submit appeal", data: null };
  }
}

// ------------------------------
// Loans Officer: disburse (creates Loan)
// ------------------------------
export async function officerDisburse(
  applicationId: string,
  officerUserId: string
) {
  try {
    const result = await LoanService.disburse(applicationId, officerUserId);

    if (!result.ok) {
      return { error: result.error, data: null };
    }

    revalidateLoans();
    return { error: null, data: result.data };
  } catch (e: any) {
    console.error("officerDisburse:", e);
    return { error: e.message || "Disbursement failed", data: null };
  }
}

// ------------------------------
// Queues for Manager/Officer/Member tracking
// ------------------------------
export async function listManagerQueue() {
  try {
    return await db.loanApplication.findMany({
      where: { stage: LoanStage.FORWARDED_TO_MANAGER },
      orderBy: { forwardedAt: "desc" },
      include: { member: { include: { user: true } }, loanProduct: true },
    });
  } catch (e) {
    console.error("listManagerQueue:", e);
    return [];
  }
}

export async function listOfficerAssignments(officerUserId: string) {
  try {
    return await db.loanApplication.findMany({
      where: {
        stage: LoanStage.APPROVED,
        allocatedTellerId: officerUserId,
      },
      orderBy: { approvalDate: "desc" },
      include: { member: { include: { user: true } }, loanProduct: true },
    });
  } catch (e) {
    console.error("listOfficerAssignments:", e);
    return [];
  }
}

export async function memberLoanTracker(memberId: string) {
  try {
    return await db.loanApplication.findMany({
      where: { memberId },
      orderBy: { applicationDate: "desc" },
      include: { loanProduct: true },
    });
  } catch (e) {
    console.error("memberLoanTracker:", e);
    return [];
  }
}
