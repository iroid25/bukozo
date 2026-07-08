"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export async function getLoanOutstandingBalanceReport(filters?: {
  branchId?: string;
  officerId?: string;
  loanProductId?: string;
  agingBracket?: string;
  status?: string;
}) {
  const user = await getAuthUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  try {
    const statusFilter = filters?.status && filters.status !== "all" 
      ? [filters.status] 
      : ["DISBURSED", "OVERDUE"];

    const where: any = {
      status: { in: statusFilter },
    };

    // 1. Force branchId for restricted roles
    let bId = filters?.branchId;
    if (["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role) && user.branchId) {
      bId = user.branchId;
    }

    if (bId && bId !== "all") {
      where.branchId = bId;
    }

    if (filters?.officerId && filters.officerId !== "all") {
      where.allocatedTellerId = filters.officerId;
    }

    // Individual Loans
    const indWhere = { ...where };
    if (filters?.loanProductId && filters.loanProductId !== "all") {
      indWhere.loanApplication = { loanProductId: filters.loanProductId };
    }

    const loans = await db.loan.findMany({
      where: indWhere,
      include: {
        member: { include: { user: true } },
        branch: true,
        loanApplication: { include: { loanProduct: true } },
        allocatedTeller: true,
        // Include unpaid schedules to calculate aging
        schedules: {
          where: { status: { not: "PAID" } },
          orderBy: { period: "asc" },
          take: 1
        }
      },
    });

    // Institutional Loans
    const instWhere: any = { ...where };
    if (bId && bId !== "all") {
      instWhere.institution = { user: { branchId: bId } };
    }
    if (filters?.loanProductId && filters.loanProductId !== "all") {
      instWhere.application = { loanProduct: { id: filters.loanProductId } };
    }

    const institutionLoans = await db.institutionLoan.findMany({
      where: instWhere,
      include: {
        institution: { include: { user: { include: { branch: true } } } },
        application: { include: { loanProduct: true } },
        allocatedTeller: true,
      },
    });

    const now = new Date();

    const calculateAging = (schedules: any[]) => {
      if (!schedules || schedules.length === 0) return { daysInArrears: 0, bracket: "Current" };
      const earliest = schedules[0];
      const dueDate = new Date(earliest.dueDate || earliest.duedate);
      if (dueDate >= now) return { daysInArrears: 0, bracket: "Current" };

      const diffTime = Math.max(0, now.getTime() - dueDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let bracket = "Current";
      if (diffDays > 365) bracket = "365+ days";
      else if (diffDays > 180) bracket = "181-365 days";
      else if (diffDays > 90) bracket = "91-180 days";
      else if (diffDays > 60) bracket = "61-90 days";
      else if (diffDays > 30) bracket = "31-60 days";
      else if (diffDays > 0) bracket = "1-30 days";

      return { daysInArrears: diffDays, bracket };
    };

    const indLoansData = loans.map((loan) => {
      const aging = calculateAging(loan.schedules);
      return {
        loanId: loan.id,
        memberNumber: loan.member.memberNumber,
        memberName: loan.member.user.name,
        memberPhone: loan.member.user.phone || "N/A",
        loanProduct: loan.loanApplication.loanProduct.name,
        disbursedAmount: loan.amountGranted,
        totalInterest: loan.interestAmount || 0,
        totalPenalty: loan.penaltyPaid || 0,
        outstandingPrincipal: loan.amountGranted - (loan.principalPaid || 0),
        outstandingInterest: (loan.interestAmount || 0) - (loan.interestPaid || 0),
        outstandingPenalty: 0,
        totalOutstanding: loan.outstandingBalance,
        totalDue: loan.totalAmountDue,
        principalDue: loan.amountGranted,
        interestDue: loan.interestAmount || 0,
        penaltyDue: loan.penaltyPaid || 0,
        daysInArrears: aging.daysInArrears,
        agingBracket: aging.bracket,
        loanOfficer: loan.allocatedTeller?.name || "N/A",
        branch: loan.branch?.name || "N/A",
        status: loan.status,
      };
    });

    const instLoansData = await Promise.all(institutionLoans.map(async (loan) => {
      // Raw SQL for institutional schedules
      const instSchedules = await db.$queryRaw<any[]>`
        SELECT * FROM "InstitutionLoanRepaymentSchedule" 
        WHERE "loanId" = ${loan.id} AND "status" != 'PAID'
        ORDER BY "period" ASC LIMIT 1
      `;
      const aging = calculateAging(instSchedules);
      
      const interestAmount = loan.totalAmountDue - loan.amountGranted;

      return {
        loanId: loan.id,
        memberNumber: loan.institution.institutionNumber,
        memberName: loan.institution.institutionName,
        memberPhone: loan.institution.user?.phone || "N/A",
        loanProduct: loan.application.loanProduct.name,
        disbursedAmount: loan.amountGranted,
        totalInterest: interestAmount || 0,
        totalPenalty: loan.penaltyPaid || 0,
        outstandingPrincipal: loan.amountGranted - (loan.principalPaid || 0),
        outstandingInterest: (interestAmount || 0) - (loan.interestPaid || 0),
        outstandingPenalty: 0,
        totalOutstanding: loan.outstandingBalance,
        totalDue: loan.totalAmountDue,
        principalDue: loan.amountGranted,
        interestDue: interestAmount || 0,
        penaltyDue: loan.penaltyPaid || 0,
        daysInArrears: aging.daysInArrears,
        agingBracket: aging.bracket,
        loanOfficer: loan.allocatedTeller?.name || "N/A",
        branch: loan.institution.user?.branch?.name || "N/A",
        status: loan.status,
      };
    }));

    const reportData = [
      ...indLoansData,
      ...instLoansData
    ].filter(l => {
        if (filters?.agingBracket && filters.agingBracket !== "all") {
            return l.agingBracket === filters.agingBracket;
        }
        return true;
    });

    const summary = {
      totalLoans: reportData.length,
      totalPrincipalDue: reportData.reduce((sum, l) => sum + l.principalDue, 0),
      totalInterestDue: reportData.reduce((sum, l) => sum + l.interestDue, 0),
      totalPenaltyDue: reportData.reduce((sum, l) => sum + l.penaltyDue, 0),
      totalDue: reportData.reduce((sum, l) => sum + l.totalDue, 0),
      totalOutstandingPrincipal: reportData.reduce((sum, l) => sum + l.outstandingPrincipal, 0),
      totalOutstandingInterest: reportData.reduce((sum, l) => sum + l.outstandingInterest, 0),
      totalOutstandingPenalty: reportData.reduce((sum, l) => sum + l.outstandingPenalty, 0),
      totalOutstanding: reportData.reduce((sum, l) => sum + l.totalOutstanding, 0),
      percentageRecovered: (reportData.length > 0 && reportData.reduce((sum, l) => sum + l.totalDue, 0) > 0) 
        ? (reportData.reduce((sum, l) => sum + (l.totalDue - l.totalOutstanding), 0) / reportData.reduce((sum, l) => sum + l.totalDue, 0)) * 100 
        : 0,
      agingAnalysis: {
        current: reportData.filter((l) => l.agingBracket === "Current").length,
        oneToThirty: reportData.filter((l) => l.agingBracket === "1-30 days").length,
        thirtyOneToSixty: reportData.filter((l) => l.agingBracket === "31-60 days").length,
        sixtyOneToNinety: reportData.filter((l) => l.agingBracket === "61-90 days").length,
        ninetyPlus: reportData.filter((l) => ["91-180 days", "181-365 days", "365+ days"].includes(l.agingBracket)).length,
      },
    };

    return { loans: reportData, summary };
  } catch (error) {
    console.error("Error generating unified outstanding balance report:", error);
    return { loans: [], summary: { totalLoans: 0, totalPrincipalDue: 0, totalInterestDue: 0, totalPenaltyDue: 0, totalDue: 0, totalOutstandingPrincipal: 0, totalOutstandingInterest: 0, totalOutstandingPenalty: 0, totalOutstanding: 0, percentageRecovered: 0, agingAnalysis: { current: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, ninetyPlus: 0 } } };
  }
}
