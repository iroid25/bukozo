"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export async function getApplicationApprovalRejectionReport(filters?: {
  branchId?: string;
  officerId?: string;
  loanProductId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  const user = await getAuthUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  try {
    const where: any = {};

    if (filters?.startDate || filters?.endDate) {
      where.applicationDate = {};
      if (filters.startDate) where.applicationDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.applicationDate.lte = new Date(filters.endDate);
    }

    if (filters?.status && filters.status !== "all") {
      where.status = filters.status;
    }

    if (filters?.officerId && filters.officerId !== "all") {
      where.allocatedTellerId = filters.officerId;
    }

    // 1. Force branchId for restricted roles
    let bId = filters?.branchId;
    if (["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role) && user.branchId) {
      bId = user.branchId;
    }

    // Individual Applications
    const indWhere = { ...where };
    if (bId && bId !== "all") {
      indWhere.member = { user: { branchId: bId } };
    }
    if (filters?.loanProductId && filters.loanProductId !== "all") {
      indWhere.loanProductId = filters.loanProductId;
    }

    const applications = await db.loanApplication.findMany({
      where: indWhere,
      include: {
        member: { include: { user: true } },
        loanProduct: true,
        allocatedTeller: true,
        approver: true,
        loan: { include: { branch: true } },
      },
      orderBy: { applicationDate: "desc" },
    });

    // Institutional Applications
    const instWhere = { ...where };
    if (bId && bId !== "all") {
      instWhere.institution = { user: { branchId: bId } };
    }
    if (filters?.loanProductId && filters.loanProductId !== "all") {
      instWhere.loanProductId = filters.loanProductId;
    }

    const instApplications = await db.institutionLoanApplication.findMany({
      where: instWhere,
      include: {
        institution: { include: { user: { include: { branch: true } } } },
        loanProduct: true,
        allocatedTeller: true,
        institutionLoan: true, // Renamed from 'loan' and removed invalid 'branch' include
      },
      orderBy: { applicationDate: "desc" },
    });

    // Merge and Map
    const allApplications = [
      ...applications.map((app: any) => ({
        applicationId: app.id,
        memberNumber: app.member.memberNumber,
        memberName: app.member.user.name,
        loanProduct: app.loanProduct.name,
        amountApplied: app.amountApplied,
        approvedAmount: app.approvedAmount,
        applicationDate: app.applicationDate.toISOString(),
        status: app.status,
        rejectionReason: app.rejectionReason,
        approver: app.approver?.name || "N/A",
        loanStatus: app.loan?.status || "N/A",
        loanOfficer: app.allocatedTeller?.name || "N/A",
        branch: app.loan?.branch?.name || app.member.user?.branch?.name || app.member.user?.branchId || "N/A",
      })),
      ...instApplications.map((app: any) => ({
        applicationId: app.id,
        memberNumber: app.institution.institutionNumber,
        memberName: app.institution.institutionName,
        loanProduct: app.loanProduct.name,
        amountApplied: app.amountApplied,
        approvedAmount: app.approvedAmount || app.amountApplied, // Fallback if not approved yet
        applicationDate: app.applicationDate.toISOString(),
        status: app.status,
        rejectionReason: app.rejectionReason,
        approver: app.approver?.name || "N/A",
        loanStatus: app.institutionLoan?.status || "N/A",
        loanOfficer: app.allocatedTeller?.name || "N/A",
        branch: app.institution.user?.branch?.name || "N/A",
      }))
    ].sort((a, b) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime());

    const pending = allApplications.filter((a) => a.status === "PENDING" || a.status === "UNDER_REVIEW");
    const approved = allApplications.filter((a) => a.status === "APPROVED" || a.status === "DISBURSED");
    const rejected = allApplications.filter((a) => a.status === "REJECTED");

    return {
      applications: allApplications,
      summary: {
        totalApplications: allApplications.length,
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        approvalRate: allApplications.length > 0 ? (approved.length / allApplications.length) * 100 : 0,
        rejectionRate: allApplications.length > 0 ? (rejected.length / allApplications.length) * 100 : 0,
        totalAmountApplied: allApplications.reduce((sum, a) => sum + a.amountApplied, 0),
        totalAmountApproved: approved.reduce((sum, a) => sum + (a.approvedAmount || a.amountApplied), 0),
      },
    };
  } catch (error) {
    console.error("Error generating unified application report:", error);
    return {
      applications: [],
      summary: {
        totalApplications: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        approvalRate: 0,
        rejectionRate: 0,
        totalAmountApplied: 0,
        totalAmountApproved: 0,
      },
    };
  }
}
