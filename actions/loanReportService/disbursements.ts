"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export async function getLoanDisbursementReport(filters?: {
  startDate?: Date;
  endDate?: Date;
  branchId?: string;
  officerId?: string;
  loanProductId?: string;
}) {
  const user = await getAuthUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  try {
    const where: any = {
      status: { in: ["DISBURSED", "OVERDUE", "REPAID", "WRITTEN_OFF"] },
    };

    // 1. Role-based restrictions
    if (["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role) && user.branchId) {
      where.branchId = user.branchId;
    } else if (user.role === "LOANOFFICER") {
      where.allocatedTellerId = user.id;
    }

    // 2. Apply filters
    if (filters?.startDate) {
      where.disbursementDate = { gte: filters.startDate };
    }
    if (filters?.endDate) {
      where.disbursementDate = {
        ...(where.disbursementDate || {}),
        lte: filters.endDate,
      };
    }

    if (filters?.branchId && filters.branchId !== "all") {
      // If user is restricted, they can't filter by branch (it's already forced)
      if (!["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role)) {
        where.branchId = filters.branchId;
      }
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
        member: {
          include: {
            user: { select: { name: true } },
            accounts: {
              where: { status: "ACTIVE" },
              take: 1,
              select: { accountNumber: true },
            },
          },
        },
        loanApplication: {
          include: {
            loanProduct: {
              select: { name: true, repaymentPeriodDays: true },
            },
          },
        },
        disbursedByUser: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { disbursementDate: "desc" },
    });

    // Institutional Loans
    const instWhere = { ...where };
    if (filters?.loanProductId && filters.loanProductId !== "all") {
      instWhere.application = { loanProduct: { id: filters.loanProductId } };
    }

    const institutionLoans = await db.institutionLoan.findMany({
      where: instWhere,
      include: {
        institution: {
          include: {
            user: { select: { name: true, branch: { select: { name: true } } } },
          },
        },
        application: {
          include: {
            loanProduct: {
              select: { name: true, repaymentPeriodDays: true },
            },
          },
        },
        allocatedTeller: { select: { name: true } },
      },
      orderBy: { disbursementDate: "desc" },
    });

    // Merge and Map
    const disbursements = [
      ...loans.map((l) => ({
        loanId: l.id,
        memberName: l.member.user.name,
        memberNumber: l.member.memberNumber,
        loanProduct: l.loanApplication.loanProduct.name,
        amountDisbursed: l.amountGranted,
        totalLoanInterest: l.interestAmount,
        totalAmountDue: l.totalAmountDue,
        disbursementDate: l.disbursementDate,
        disbursedBy: l.disbursedByUser?.name || "N/A",
        branch: l.branch?.name || "N/A",
        disbursementMethod: l.disbursementMethod || "CASH",
        accountCredited: l.member.accounts[0]?.accountNumber || "N/A",
        repaymentPeriodDays: l.loanApplication.repaymentPeriodMonths 
          ? l.loanApplication.repaymentPeriodMonths * 30 
          : l.loanApplication.loanProduct.repaymentPeriodDays,
      })),
      ...institutionLoans.map((l) => ({
        loanId: l.id,
        memberName: l.institution.institutionName,
        memberNumber: l.institution.institutionNumber,
        loanProduct: l.application.loanProduct.name,
        amountDisbursed: l.amountGranted,
        totalLoanInterest: (l.totalAmountDue - l.amountGranted) || 0,
        totalAmountDue: l.totalAmountDue,
        disbursementDate: l.disbursementDate,
        disbursedBy: l.allocatedTeller?.name || "N/A",
        branch: l.institution.user?.branch?.name || "N/A",
        disbursementMethod: (l as any).disbursementMethod || "CASH",
        accountCredited: "N/A",
        repaymentPeriodDays: l.application.repaymentPeriodMonths 
          ? l.application.repaymentPeriodMonths * 30 
          : l.application.loanProduct.repaymentPeriodDays,
      }))
    ].sort((a, b) => {
      const dateA = a.disbursementDate ? new Date(a.disbursementDate).getTime() : 0;
      const dateB = b.disbursementDate ? new Date(b.disbursementDate).getTime() : 0;
      return dateB - dateA;
    });

    const totalAmount = disbursements.reduce((sum, d) => sum + d.amountDisbursed, 0);

    const byProduct = Object.entries(
      disbursements.reduce((acc, d) => {
        if (!acc[d.loanProduct]) acc[d.loanProduct] = { count: 0, amount: 0 };
        acc[d.loanProduct].count++;
        acc[d.loanProduct].amount += d.amountDisbursed;
        return acc;
      }, {} as Record<string, { count: number; amount: number }>)
    ).map(([product, data]) => ({ product, ...data }));

    const byBranch = Object.entries(
      disbursements.reduce((acc, d) => {
        if (!acc[d.branch]) acc[d.branch] = { count: 0, amount: 0 };
        acc[d.branch].count++;
        acc[d.branch].amount += d.amountDisbursed;
        return acc;
      }, {} as Record<string, { count: number; amount: number }>)
    ).map(([branch, data]) => ({ branch, ...data }));

    const byMethod = Object.entries(
      disbursements.reduce((acc, d) => {
        if (!acc[d.disbursementMethod]) acc[d.disbursementMethod] = { count: 0, amount: 0 };
        acc[d.disbursementMethod].count++;
        acc[d.disbursementMethod].amount += d.amountDisbursed;
        return acc;
      }, {} as Record<string, { count: number; amount: number }>)
    ).map(([method, data]) => ({ method, ...data }));

    return {
      disbursements,
      summary: {
        totalDisbursements: disbursements.length,
        totalAmount,
        byProduct,
        byBranch,
        byMethod,
      },
    };
  } catch (error) {
    console.error("Error generating unified disbursement report:", error);
    return {
      disbursements: [],
      summary: {
        totalDisbursements: 0,
        totalAmount: 0,
        byProduct: [],
        byBranch: [],
        byMethod: [],
      },
    };
  }
}
