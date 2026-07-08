"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export async function getPortfolioConcentrationReport(filters?: {
  branchId?: string;
  officerId?: string;
  loanProductId?: string;
}) {
  const user = await getAuthUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  try {
    const where: any = { status: { in: ["DISBURSED", "OVERDUE"] } };
    
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

    const indLoans = await db.loan.findMany({
      where: indWhere,
      include: {
        loanApplication: { include: { loanProduct: true } },
        branch: true,
        allocatedTeller: true,
        member: { include: { user: true } },
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

    const instLoans = await db.institutionLoan.findMany({
      where: instWhere,
      include: {
        application: { include: { loanProduct: true } },
        allocatedTeller: true,
        institution: { include: { user: { include: { branch: true } } } },
      },
    });

    // Merge logic
    const allActiveLoans = [
      ...indLoans.map((l: any) => ({
        id: l.id,
        outstandingBalance: l.outstandingBalance,
        amountGranted: l.amountGranted,
        productName: l.loanApplication.loanProduct.name,
        branchName: l.branch?.name || "N/A",
        officer: l.allocatedTeller,
        ownerName: l.member.user.name,
        ownerNumber: l.member.memberNumber,
        ownerId: l.memberId,
        type: 'INDIVIDUAL'
      })),
      ...instLoans.map((l: any) => ({
        id: l.id,
        outstandingBalance: l.outstandingBalance,
        amountGranted: l.amountGranted,
        productName: l.application.loanProduct.name,
        branchName: l.branch?.name || "N/A",
        officer: l.allocatedTeller,
        ownerName: l.institution.institutionName,
        ownerNumber: l.institution.institutionNumber,
        ownerId: l.institutionId,
        type: 'INSTITUTION'
      }))
    ];

    const totalPortfolio = allActiveLoans.reduce((sum, loan) => sum + loan.outstandingBalance, 0);

    // By Product
    const productStats = allActiveLoans.reduce((acc, loan) => {
      const product = loan.productName;
      if (!acc[product]) acc[product] = { count: 0, amount: 0, totalDisbursed: 0 };
      acc[product].count++;
      acc[product].amount += loan.outstandingBalance;
      acc[product].totalDisbursed += loan.amountGranted;
      return acc;
    }, {} as Record<string, { count: number; amount: number; totalDisbursed: number }>);

    const byProduct = Object.entries(productStats).map(([product, data]) => ({
      product,
      count: data.count,
      amount: data.amount,
      totalLoanSize: data.totalDisbursed,
      averageLoanSize: data.count > 0 ? data.totalDisbursed / data.count : 0,
      percentage: totalPortfolio > 0 ? (data.amount / totalPortfolio) * 100 : 0,
    }));

    // By Branch
    const branchStats = allActiveLoans.reduce((acc, loan) => {
      const branch = loan.branchName;
      if (!acc[branch]) acc[branch] = { count: 0, amount: 0 };
      acc[branch].count++;
      acc[branch].amount += loan.outstandingBalance;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    const byBranch = Object.entries(branchStats).map(([branch, data]) => ({
      branch,
      count: data.count,
      amount: data.amount,
      percentage: totalPortfolio > 0 ? (data.amount / totalPortfolio) * 100 : 0,
    }));

    // Top Borrowers (Unifying individual and institutions)
    const borrowerStats = allActiveLoans.reduce((acc, loan) => {
      const key = `${loan.type}-${loan.ownerId}`;
      if (!acc[key]) {
        acc[key] = {
          ownerId: loan.ownerId,
          memberName: loan.ownerName,
          memberNumber: loan.ownerNumber,
          count: 0,
          amount: 0,
        };
      }
      acc[key].count++;
      acc[key].amount += loan.outstandingBalance;
      return acc;
    }, {} as Record<string, any>);

    const byBorrower = Object.values(borrowerStats)
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, 20)
      .map((data: any) => ({
        ...data,
        percentage: totalPortfolio > 0 ? (data.amount / totalPortfolio) * 100 : 0,
      }));

    return {
      totalPortfolio,
      totalLoans: allActiveLoans.length,
      concentrations: byProduct.map(p => ({
        category: p.product,
        numberOfLoans: p.count,
        totalAmount: p.amount,
        outstandingBalance: p.amount,
        percentageOfPortfolio: p.percentage,
        averageLoanSize: p.averageLoanSize
      })),
      byBranch,
      topBorrowers: byBorrower,
      filterOptions: {
        officers: Object.values(allActiveLoans.reduce((acc, l) => {
          if (l.officer) {
            acc[l.officer.id] = { id: l.officer.id, name: l.officer.name };
          }
          return acc;
        }, {} as Record<string, { id: string, name: string }>))
      }
    };
  } catch (error) {
    console.error("Error generating unified portfolio concentration report:", error);
    return {
      totalPortfolio: 0,
      totalLoans: 0,
      concentrations: [],
      byBranch: [],
      topBorrowers: [],
      filterOptions: { officers: [] }
    };
  }
}
