"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export async function getLoanOfficerAnalysisReport(filters?: {
  branchId?: string;
  officerId?: string;
}) {
  const user = await getAuthUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  try {
    const whereClause: any = {
      role: { in: ["TELLER", "LOANOFFICER"] },
      isActive: true,
    };

    let bId = filters?.branchId;
    if (["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role) && user.branchId) {
      bId = user.branchId;
    }

    if (bId && bId !== "all") {
      whereClause.branchId = bId;
    }

    if (filters?.officerId && filters.officerId !== "all") {
      whereClause.id = filters.officerId;
    }

    const officers = await db.user.findMany({
      where: whereClause,
      include: {
        allocatedLoans: { include: { repayments: true } },
        institutionLoansAllocated: { include: { repayments: true } },
        loanOfficerApplications: true,
        institutionLoanOfficerApplications: true,
        branch: true,
      },
    });

    const officersData = officers.map((officer) => {
      // Individual metrics
      const indLoans = officer.allocatedLoans || [];
      const indDisbursed = indLoans.reduce((sum, l) => sum + l.amountGranted, 0);
      const indOutstanding = indLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);
      const indRepaid = indLoans.reduce((sum, l) => sum + l.repayments.reduce((rSum, r) => rSum + r.amount, 0), 0);
      const indApplications = officer.loanOfficerApplications || [];

      // Institutional metrics
      const instLoans = officer.institutionLoansAllocated || [];
      const instDisbursed = instLoans.reduce((sum, l) => sum + l.amountGranted, 0);
      const instOutstanding = instLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);
      const instRepaid = instLoans.reduce((sum, l) => sum + l.repayments.reduce((rSum, r) => rSum + r.amount, 0), 0);
      const instApplications = officer.institutionLoanOfficerApplications || [];

      // Combined metrics
      const totalLoans = indLoans.length + instLoans.length;
      const totalDisbursed = indDisbursed + instDisbursed;
      const totalOutstanding = indOutstanding + instOutstanding;
      const totalRepaid = indRepaid + instRepaid;
      const totalApplications = indApplications.length + instApplications.length;

      const overdueLoans = indLoans.filter(l => l.status === "OVERDUE").length + instLoans.filter(l => l.status === "OVERDUE").length;
      const activeLoans = indLoans.filter(l => l.status === "DISBURSED").length + instLoans.filter(l => l.status === "DISBURSED").length;
      const repaidLoans = indLoans.filter(l => l.status === "REPAID").length + instLoans.filter(l => l.status === "REPAID").length;

      const approvedApplications = [
        ...indApplications.filter(a => a.status === "APPROVED" || a.status === "DISBURSED"),
        ...instApplications.filter(a => a.status === "APPROVED" || a.status === "DISBURSED")
      ].length;

      return {
        officerId: officer.id,
        officerName: officer.name,
        email: officer.email,
        role: officer.role,
        branch: officer.branch?.name || "N/A",
        totalLoansManaged: totalLoans,
        activeLoans,
        overdueLoans,
        totalDisbursed,
        totalOutstanding,
        totalRepaid,
        repaidLoans,
        repaymentRate: totalDisbursed > 0 ? (totalRepaid / totalDisbursed) : 0,
        defaultRate: totalLoans > 0 ? (overdueLoans / totalLoans) : 0,
        portfolioAtRisk: totalOutstanding > 0 
          ? (([
              ...indLoans.filter(l => l.status === "OVERDUE"),
              ...instLoans.filter(l => l.status === "OVERDUE")
            ].reduce((sum, l) => sum + l.outstandingBalance, 0)) / totalOutstanding)
          : 0,
        totalApplications,
        applicationsApproved: approvedApplications,
      };
    });

    const summary = {
      totalOfficers: officersData.length,
      totalLoans: officersData.reduce((sum, o) => sum + o.totalLoansManaged, 0),
      totalDisbursed: officersData.reduce((sum, o) => sum + o.totalDisbursed, 0),
      totalOutstanding: officersData.reduce((sum, o) => sum + o.totalOutstanding, 0),
      averageRepaymentRate: officersData.length > 0 
        ? officersData.reduce((sum, o) => sum + o.repaymentRate, 0) / officersData.length 
        : 0,
    };

    return { officers: officersData, summary };
  } catch (error) {
    console.error("Error generating loan officer analysis:", error);
    return { officers: [], summary: { totalOfficers: 0, totalLoans: 0, totalDisbursed: 0, totalOutstanding: 0, averageRepaymentRate: 0 } };
  }
}
