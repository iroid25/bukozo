"use server";

import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { LoanStatus, LoanStage, TransactionType, TransactionStatus, UserRole, AccountStatus, Prisma } from "@prisma/client";
import { getLoanDisbursementReport as getLoanDisbursementReportAction } from "./loanReportService/disbursements";
import { getLoanOutstandingBalanceReport as getLoanOutstandingBalanceReportAction } from "./loanReportService/outstanding";
// Removed faulty import
import { getPortfolioConcentrationReport as getPortfolioConcentrationReportAction } from "./loanReportService/concentration";
import { getLoanOfficerAnalysisReport as getLoanOfficerAnalysisReportAction } from "./loanReportService/officerAnalysis";
import { getApplicationApprovalRejectionReport as getApplicationApprovalRejectionReportAction } from "./loanReportService/applications";
import { calculateLoanSchedule } from "@/lib/loan-calculations";
import { calculateCompoundingPenalty, PenaltyTier, calculateSimplePenaltyEstimation } from "@/lib/penalty-calculations";
import { DEFAULT_PENALTY_TIERS } from "@/config/fees";

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface LoanSummary {
  totalLoans: number;
  totalDisbursed: number;
  totalOutstanding: number;
  totalRepaid: number;
  activeLoans: number;
  overdueLoans: number;
  repaidLoans: number;
  approvalRate: number;
  repaymentRate: number;
  defaultRate: number;
  averageLoanAmount: number;
  averageRepaymentPeriod: number;
}

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}
export interface LoanProductPerformance {
  id: string;
  name: string;
  totalApplications: number;
  approvedApplications: number;
  totalDisbursed: number;
  outstandingBalance: number;
  repaidAmount: number;
  approvalRate: number;
  repaymentRate: number;
}
export interface MonthlyLoanTrend {
  month: string;
  year: number;
  applicationsCount: number;
  approvedCount: number;
  disbursedAmount: number;
  repaymentsAmount: number;
  outstandingAmount: number;
}
export interface LoanAgeAnalysis {
  range: string;
  count: number;
  totalAmount: number;
  outstandingAmount: number;
}
export interface RepaymentChannelStats {
  channel: string;
  count: number;
  amount: number;
  percentage: number;
}

// ==========================================
// 1. LOAN SUMMARY & DASHBOARD ACTIONS
// ==========================================

export async function getLoanSummary(filters: DateRangeFilter & { branchId?: string } = {}) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const result = await db.$transaction(async (prisma: Prisma.TransactionClient) => {
      const bId = ["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role) 
        ? user.branchId 
        : (filters.branchId && filters.branchId !== "all" ? filters.branchId : undefined);
      
      const where: any = {};
      if (bId) where.branchId = bId;
      if (user.role === "LOANOFFICER" || user.role === "TELLER") {
        where.allocatedTellerId = user.id;
      }

      const dateFilter: any = {};
      if (filters.startDate) dateFilter.gte = filters.startDate;
      if (filters.endDate) dateFilter.lte = filters.endDate;

      const indAppWhere: any = { ...where };
      if (Object.keys(dateFilter).length > 0) indAppWhere.applicationDate = dateFilter;
      if (bId) indAppWhere.member = { user: { branchId: bId } };

      const instAppWhere: any = { ...where };
      if (Object.keys(dateFilter).length > 0) instAppWhere.applicationDate = dateFilter;
      if (bId) instAppWhere.institution = { user: { branchId: bId } };

      const loanWhere: any = { ...where };
      if (Object.keys(dateFilter).length > 0) loanWhere.disbursementDate = dateFilter;

      const [
        totalApplications,
        approvedApplicationsCount,
        disbursedStats,
        outstandingStats,
        repaidStats,
        activeCount,
        overdueCount,
        repaidCount,
        // Institutional
        instTotalApplications,
        instApprovedCount,
        instDisbursedStats,
        instOutstandingStats,
        instRepaidStats,
        instActiveCount,
        instOverdueCount,
        instRepaidCount,
      ] = await Promise.all([
        prisma.loanApplication.count({ where: indAppWhere }),
        prisma.loanApplication.count({ where: { ...indAppWhere, status: "APPROVED" } }),
        prisma.loan.aggregate({ where: loanWhere, _sum: { amountGranted: true }, _count: true }),
        prisma.loan.aggregate({ where: { ...loanWhere, status: { in: ["DISBURSED", "OVERDUE"] } }, _sum: { outstandingBalance: true } }),
        prisma.loan.aggregate({ where: loanWhere, _sum: { amountPaid: true } }),
        prisma.loan.count({ where: { ...loanWhere, status: "DISBURSED" } }),
        prisma.loan.count({ where: { ...loanWhere, status: "OVERDUE" } }),
        prisma.loan.count({ where: { ...loanWhere, status: "REPAID" } }),
        
        prisma.institutionLoanApplication.count({ where: instAppWhere }),
        prisma.institutionLoanApplication.count({ where: { ...instAppWhere, status: "APPROVED" } }),
        prisma.institutionLoan.aggregate({ where: loanWhere, _sum: { amountGranted: true }, _count: true }),
        prisma.institutionLoan.aggregate({ where: { ...loanWhere, status: { in: ["DISBURSED", "OVERDUE"] } }, _sum: { outstandingBalance: true } }),
        prisma.institutionLoan.aggregate({ where: loanWhere, _sum: { amountPaid: true } }),
        prisma.institutionLoan.count({ where: { ...loanWhere, status: "DISBURSED" } }),
        prisma.institutionLoan.count({ where: { ...loanWhere, status: "OVERDUE" } }),
        prisma.institutionLoan.count({ where: { ...loanWhere, status: "REPAID" } }),
      ]);

      const totalDisbursed = (disbursedStats._sum.amountGranted || 0) + (instDisbursedStats._sum.amountGranted || 0);
      const totalLoans = (disbursedStats._count || 0) + (instDisbursedStats._count || 0);
      const totalOutstanding = (outstandingStats._sum.outstandingBalance || 0) + (instOutstandingStats._sum.outstandingBalance || 0);
      const totalRepaidAll = (repaidStats._sum.amountPaid || 0) + (instRepaidStats._sum.amountPaid || 0);

      const allApps = totalApplications + instTotalApplications;
      const allApproved = approvedApplicationsCount + instApprovedCount;

      return {
        totalLoans,
        totalDisbursed,
        totalOutstanding,
        totalRepaid: totalRepaidAll,
        activeLoans: activeCount + instActiveCount,
        overdueLoans: overdueCount + instOverdueCount,
        repaidLoans: repaidCount + instRepaidCount,
        approvalRate: allApps > 0 ? (allApproved / allApps) * 100 : 0,
        repaymentRate: totalDisbursed > 0 ? (totalRepaidAll / totalDisbursed) * 100 : 0,
        defaultRate: totalLoans > 0 ? ((overdueCount + instOverdueCount) / totalLoans) * 100 : 0,
        averageLoanAmount: totalLoans > 0 ? totalDisbursed / totalLoans : 0,
      };
    });
    return result;
  } catch (error) {
    console.error("Error fetching unified loan summary:", error);
    return null;
  }
}

export async function getLoanProductPerformance(filters: DateRangeFilter & { branchId?: string } = {}) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const bId = ["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role)
      ? user.branchId
      : (filters.branchId && filters.branchId !== "all" ? filters.branchId : undefined);
    const dateFilter: any = {};
    if (filters.startDate) dateFilter.gte = filters.startDate;
    if (filters.endDate) dateFilter.lte = filters.endDate;

    const indWhere: any = {};
    if (Object.keys(dateFilter).length > 0) indWhere.applicationDate = dateFilter;
    if (bId) indWhere.member = { user: { branchId: bId } };
    if (user.role === "LOANOFFICER" || user.role === "TELLER") indWhere.allocatedTellerId = user.id;

    const instWhere: any = {};
    if (Object.keys(dateFilter).length > 0) instWhere.applicationDate = dateFilter;
    if (bId) instWhere.institution = { user: { branchId: bId } };
    if (user.role === "LOANOFFICER" || user.role === "TELLER") instWhere.allocatedTellerId = user.id;

    const products = await db.loanProduct.findMany({
      include: {
        loanApplications: { where: indWhere, include: { loan: true } },
        institutionLoanApplications: { where: instWhere, include: { institutionLoan: true } },
      },
    });

    return products.map((p) => {
      const apps = [...p.loanApplications, ...p.institutionLoanApplications];
      const approved = apps.filter((a) => a.status === "APPROVED" || a.status === "DISBURSED");
      const loans = apps.map((a) => (a as any).loan || (a as any).institutionLoan).filter(Boolean);

      const totalDisbursed = loans.reduce((sum, l) => sum + (l?.amountGranted || 0), 0);
      const repaidAmount = loans.reduce((sum, l) => sum + (l?.amountPaid || 0), 0);

      return {
        id: p.id,
        name: p.name,
        totalApplications: apps.length,
        approvedApplications: approved.length,
        totalDisbursed,
        outstandingBalance: loans.reduce((sum, l) => sum + (l?.outstandingBalance || 0), 0),
        repaidAmount,
        approvalRate: apps.length > 0 ? (approved.length / apps.length) * 100 : 0,
        repaymentRate: totalDisbursed > 0 ? (repaidAmount / totalDisbursed) * 100 : 0,
      };
    });
  } catch (error) {
    console.error("Error fetching unified product performance:", error);
    return [];
  }
}

export async function getMonthlyLoanTrends(months: number = 6, filters?: { branchId?: string }) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const indAppWhere: any = { applicationDate: { gte: startDate } };
    const instAppWhere: any = { applicationDate: { gte: startDate } };
    const indRepayWhere: any = { repaymentDate: { gte: startDate } };
    const instRepayWhere: any = { repaymentDate: { gte: startDate } };

    let bId = filters?.branchId;
    if (["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role)) {
      bId = user.branchId;
    }

    if (bId && bId !== "all") {
      indAppWhere.member = { user: { branchId: bId } };
      instAppWhere.institution = { user: { branchId: bId } };
      indRepayWhere.loan = { branchId: bId };
      instRepayWhere.loan = { branchId: bId };
    }

    const [indApps, instApps, indRepay, instRepay] = await Promise.all([
      db.loanApplication.findMany({ where: indAppWhere, include: { loan: true } }),
      db.institutionLoanApplication.findMany({ where: instAppWhere, include: { institutionLoan: true } }),
      db.loanRepayment.findMany({ where: indRepayWhere }),
      db.institutionLoanRepayment.findMany({ where: instRepayWhere }),
    ]);

    const applications = [...indApps, ...instApps];
    const repayments = [...indRepay, ...instRepay];

    const monthlyData: Record<string, MonthlyLoanTrend> = {};
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      monthlyData[key] = {
        month: d.toLocaleString("default", { month: "long" }),
        year: d.getFullYear(),
        applicationsCount: 0,
        approvedCount: 0,
        disbursedAmount: 0,
        repaymentsAmount: 0,
        outstandingAmount: 0,
      };
    }

    applications.forEach((app) => {
      const d = new Date(app.applicationDate);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (monthlyData[key]) {
        monthlyData[key].applicationsCount++;
        const loan = (app as any).loan || (app as any).institutionLoan;
        if (app.status === "APPROVED" || app.status === "DISBURSED") {
          monthlyData[key].approvedCount++;
          if (loan) {
            monthlyData[key].disbursedAmount += loan.amountGranted;
            monthlyData[key].outstandingAmount += loan.outstandingBalance;
          }
        }
      }
    });

    repayments.forEach((rep) => {
      const d = new Date(rep.repaymentDate);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (monthlyData[key]) {
        monthlyData[key].repaymentsAmount += rep.amount;
      }
    });

    return Object.values(monthlyData);
  } catch (error) {
    console.error("Error fetching monthly trends:", error);
    return [];
  }
}

// ==========================================
// 2. DETAILED REPORT ACTIONS
// ==========================================

export async function getLoanRepaymentReport(filters: DateRangeFilter & { branchId?: string }) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const where: any = {};
    if (filters.startDate) where.repaymentDate = { gte: filters.startDate };
    if (filters.endDate) where.repaymentDate = { ...(where.repaymentDate || {}), lte: filters.endDate };
    
    const branchId = ["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role)
      ? user.branchId
      : (filters.branchId && filters.branchId !== "all" ? filters.branchId : undefined);

    // Individual Repayments
    const indWhere = { ...where };
    if (branchId) indWhere.loan = { branchId };
    
    if (user.role === "LOANOFFICER" || user.role === "TELLER") {
      indWhere.loan = { ...indWhere.loan, allocatedTellerId: user.id };
    }

    const repayments = await db.loanRepayment.findMany({
      where: indWhere,
      include: {
        loan: {
          include: {
            member: { include: { user: { select: { name: true } } } },
            loanApplication: { include: { loanProduct: { select: { name: true } } } },
          },
        },
        handler: { select: { name: true } },
      },
      orderBy: { repaymentDate: "desc" },
    });

    // Institutional Repayments
    const instWhere: any = { ...where };
    // InstitutionLoan has no branchId, so we can't filter by branch directly
    if (user.role === "LOANOFFICER" || user.role === "TELLER") {
      instWhere.loan = { allocatedTellerId: user.id };
    }

    const instRepayments = await db.institutionLoanRepayment.findMany({
      where: instWhere,
      include: {
        loan: {
          include: {
            institution: { select: { institutionName: true, institutionNumber: true } },
            application: { include: { loanProduct: { select: { name: true } } } },
          },
        },
      },
      orderBy: { repaymentDate: "desc" },
    });

    // Merge and Map
    const allRepayments = [
      ...repayments.map((r) => ({
        id: r.id,
        repaymentDate: r.repaymentDate,
        memberName: r.loan.member.user.name,
        memberNumber: r.loan.member.memberNumber,
        loanProduct: r.loan.loanApplication.loanProduct.name,
        amount: r.amount,
        principalPaid: r.principalPaid,
        interestPaid: r.interestPaid,
        penaltyPaid: r.penaltyPaid,
        channel: r.channel,
        transactionId: r.transactionId,
        collectedBy: r.handler?.name || "N/A",
      })),
      ...instRepayments.map((r) => ({
        id: r.id,
        repaymentDate: r.repaymentDate,
        memberName: r.loan.institution.institutionName,
        memberNumber: r.loan.institution.institutionNumber,
        loanProduct: r.loan.application.loanProduct.name,
        amount: r.amount,
        principalPaid: r.principalPaid,
        interestPaid: r.interestPaid,
        penaltyPaid: 0,
        channel: r.channel,
        transactionId: (r as any).transactionId || "N/A",
        collectedBy: "N/A",
      }))

    ].sort((a: any, b: any) => new Date(b.repaymentDate).getTime() - new Date(a.repaymentDate).getTime());

    return allRepayments;
  } catch (error) {
    console.error("Error fetching unified repayment report:", error);
    return [];
  }
}

export async function getWrittenOffLoansReport(filters?: any) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    console.log("[WrittenOff] Starting written-off loans report, filters:", filters);
    
    const where: any = { status: "WRITTEN_OFF" };
    if (filters?.branchId && filters.branchId !== "all") {
      where.branchId = filters.branchId;
    } else if (["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role)) {
      where.branchId = user.branchId;
    }
    if (filters?.officerId && filters.officerId !== "all") {
      where.allocatedTellerId = filters.officerId;
    }

    console.log("[WrittenOff] Query where clause:", JSON.stringify(where));

    const loans = await db.loan.findMany({
      where,
      include: {
        member: { include: { user: { select: { name: true, phone: true } } } },
        loanApplication: { include: { loanProduct: { select: { name: true } } } },
        branch: { select: { name: true } },
        allocatedTeller: { select: { name: true } },
        repayments: { select: { amount: true } },
        writeOffs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    console.log("[WrittenOff] Found", loans.length, "loans with WRITTEN_OFF status");

    // If no loans with WRITTEN_OFF status, also check for loans with approved write-off records
    let allLoans = loans;
    if (loans.length === 0) {
      console.log("[WrittenOff] No WRITTEN_OFF status loans, checking LoanWriteOff records...");
      const writeOffRecords = await db.loanWriteOff.findMany({
        where: { status: "APPROVED" },
        include: {
          loan: {
            include: {
              member: { include: { user: { select: { name: true, phone: true } } } },
              loanApplication: { include: { loanProduct: { select: { name: true } } } },
              branch: { select: { name: true } },
              allocatedTeller: { select: { name: true } },
              repayments: { select: { amount: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      console.log("[WrittenOff] Found", writeOffRecords.length, "approved LoanWriteOff records");

      // Map write-off records to loan data format
      const writeOffLoanData = writeOffRecords.map(wo => {
        const l = wo.loan;
        const amountPaid = l.repayments.reduce((sum, r) => sum + r.amount, 0);
        return {
          loanId: l.id,
          memberName: l.member.user.name,
          memberNumber: l.member.memberNumber,
          memberPhone: l.member.user.phone || "N/A",
          loanProduct: l.loanApplication.loanProduct.name,
          principalAmount: l.amountGranted,
          totalAmountDue: l.totalAmountDue,
          amountPaid,
          writtenOffAmount: wo.totalBalance,
          disbursementDate: l.disbursementDate,
          writeOffDate: wo.dateWrittenOff || wo.approvedAt || l.updatedAt,
          reason: wo.reason,
          loanOfficer: l.allocatedTeller?.name || "N/A",
          branch: l.branch?.name || "N/A",
        };
      });

      const totalPrincipal = writeOffLoanData.reduce((sum, l) => sum + l.principalAmount, 0);
      const totalAmountWrittenOff = writeOffLoanData.reduce((sum, l) => sum + l.writtenOffAmount, 0);

      return {
        loans: writeOffLoanData,
        summary: {
          totalLoans: writeOffLoanData.length,
          totalPrincipal,
          totalAmountWrittenOff,
        },
      };
    }

    const loanData = allLoans.map(l => {
      const writeOff = l.writeOffs?.[0];
      const amountPaid = l.repayments.reduce((sum, r) => sum + r.amount, 0);
      return {
        loanId: l.id,
        memberName: l.member.user.name,
        memberNumber: l.member.memberNumber,
        memberPhone: l.member.user.phone || "N/A",
        loanProduct: l.loanApplication.loanProduct.name,
        principalAmount: l.amountGranted,
        totalAmountDue: l.totalAmountDue,
        amountPaid,
        writtenOffAmount: writeOff?.totalBalance || l.outstandingBalance,
        disbursementDate: l.disbursementDate,
        writeOffDate: writeOff?.dateWrittenOff || writeOff?.approvedAt || l.updatedAt,
        reason: writeOff?.reason || "Policy write-off",
        loanOfficer: l.allocatedTeller?.name || "N/A",
      branch: l.branch?.name || "N/A",
      };
    });

    const totalPrincipal = loanData.reduce((sum, l) => sum + l.principalAmount, 0);

    return {
      loans: loanData,
      summary: {
        totalLoans: loanData.length,
        totalPrincipal,
        totalAmountWrittenOff: loanData.reduce((sum: number, l) => sum + l.writtenOffAmount, 0),
      },
    };
  } catch (error) {
    console.error("[WrittenOff] Error fetching written off report:", error);
    return {
      loans: [],
      summary: { totalLoans: 0, totalPrincipal: 0, totalAmountWrittenOff: 0 },
    };
    }
}

export async function getPaidOffLoansReport(filters?: any) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  try {
    const where: any = { status: "REPAID" };
    if (filters?.branchId && filters.branchId !== "all") where.branchId = filters.branchId;
    if (filters?.officerId && filters.officerId !== "all") where.allocatedTellerId = filters.officerId;
    
    const loans = await db.loan.findMany({
       where,
       include: {
         member: { include: { user: { select: { name: true, phone: true } } } },
         loanApplication: { include: { loanProduct: { select: { name: true } } } },
         allocatedTeller: { select: { name: true } },
         branch: { select: { name: true } },
       }
    });
    
    const paidOffLoans = loans.map(l => {
      const completionDate = l.updatedAt;
      const dueDate = l.dueDate;
      let daysEarlyOrLate = 0;
      if (dueDate && completionDate) {
        const diffMs = new Date(dueDate).getTime() - new Date(completionDate).getTime();
        daysEarlyOrLate = Math.round(diffMs / (1000 * 60 * 60 * 24));
      }
      return {
        loanId: l.id,
        memberName: l.member.user.name,
        memberNumber: l.member.memberNumber,
        memberPhone: l.member.user.phone || "N/A",
        loanProduct: l.loanApplication.loanProduct.name,
        principalAmount: l.amountGranted,
        totalRepaid: l.amountPaid,
        completionDate,
        dueDate,
        daysEarlyOrLate,
        loanOfficer: l.allocatedTeller?.name || "N/A",
        branch: l.branch?.name || "N/A",
      };
    });
    
    const summary = {
      totalLoans: paidOffLoans.length,
      totalPrincipal: paidOffLoans.reduce((s: number, l: any) => s + l.principalAmount, 0),
      totalRepaid: paidOffLoans.reduce((s: number, l: any) => s + l.totalRepaid, 0),
      averageDaysToCompletion: paidOffLoans.length > 0
        ? paidOffLoans.reduce((s: number, l: any) => s + Math.abs(l.daysEarlyOrLate), 0) / paidOffLoans.length
        : 0,
    };
    
    return { loans: paidOffLoans, summary };
  } catch (error) { 
    console.error("Error in getPaidOffLoansReport:", error);
    return { loans: [], summary: { totalLoans: 0, totalPrincipal: 0, totalRepaid: 0, averageDaysToCompletion: 0 } }; 
  }
}

export async function getDetailedLoanReport(filters?: any) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  try {
    const loans = await db.loan.findMany({
       include: {
         member: { include: { user: { select: { name: true, email: true, phone: true } } } },
         loanApplication: { include: { loanProduct: { select: { name: true } } } },
         branch: { select: { name: true } },
         disbursedByUser: { select: { name: true } },
         repayments: { select: { repaymentDate: true }, orderBy: { repaymentDate: "desc" } },
       },
       take: 100,
    });
    return loans.map(l => {
       const now = new Date();
       const dueDate = l.dueDate ? new Date(l.dueDate) : null;
       const daysPastDue = dueDate && now > dueDate ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
       return {
         loanId: l.id,
         memberName: l.member.user.name,
         memberEmail: l.member.user.email || "N/A",
         memberPhone: l.member.user.phone || "N/A",
         loanProduct: l.loanApplication.loanProduct.name,
         amountGranted: l.amountGranted,
         interestRate: l.interestRate,
         totalAmountDue: l.totalAmountDue,
         outstandingBalance: l.outstandingBalance,
         amountPaid: l.amountPaid,
         status: l.status,
         disbursementDate: l.disbursementDate,
         dueDate: l.dueDate,
         disbursedBy: l.disbursedByUser?.name || "N/A",
         branch: l.branch?.name || "N/A",
         repaymentCount: l.repayments.length,
         lastRepaymentDate: l.repayments[0]?.repaymentDate || null,
         daysPastDue,
       };
    });
  } catch (error) { return []; }
}

// Add these to satisfy the API route import list
export async function getLoanAgeAnalysis(filters: DateRangeFilter & { branchId?: string } = {}) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const bId = ["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role)
      ? user.branchId
      : (filters.branchId && filters.branchId !== "all" ? filters.branchId : undefined);
    
    const where: any = {
      status: { in: ["DISBURSED", "OVERDUE"] },
    };
    if (bId) where.branchId = bId;
    if (user.role === "LOANOFFICER" || user.role === "TELLER") {
      where.allocatedTellerId = user.id;
    }

    const loans = await db.loan.findMany({
      where,
      select: {
        amountGranted: true,
        outstandingBalance: true,
        disbursementDate: true,
      },
    });

    const now = new Date();
    const ageAnalysis: Record<string, LoanAgeAnalysis> = {
      "0-3 Months": { range: "0-3 Months", count: 0, totalAmount: 0, outstandingAmount: 0 },
      "3-6 Months": { range: "3-6 Months", count: 0, totalAmount: 0, outstandingAmount: 0 },
      "6-12 Months": { range: "6-12 Months", count: 0, totalAmount: 0, outstandingAmount: 0 },
      "12+ Months": { range: "12+ Months", count: 0, totalAmount: 0, outstandingAmount: 0 },
    };

    loans.forEach((loan) => {
      if (!loan.disbursementDate) return;
      const ageMonths = (now.getTime() - new Date(loan.disbursementDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
      
      let range = "12+ Months";
      if (ageMonths <= 3) range = "0-3 Months";
      else if (ageMonths <= 6) range = "3-6 Months";
      else if (ageMonths <= 12) range = "6-12 Months";

      ageAnalysis[range].count++;
      ageAnalysis[range].totalAmount += loan.amountGranted;
      ageAnalysis[range].outstandingAmount += loan.outstandingBalance;
    });

    return Object.values(ageAnalysis);
  } catch (error) {
    console.error("Error fetching age analysis:", error);
    return [];
  }
}

export async function getRepaymentChannelStats(filters: DateRangeFilter & { branchId?: string } = {}) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const bId = ["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role)
      ? user.branchId
      : (filters.branchId && filters.branchId !== "all" ? filters.branchId : undefined);
    
    const where: any = {};
    if (filters.startDate) where.repaymentDate = { gte: filters.startDate };
    if (filters.endDate) where.repaymentDate = { ...where.repaymentDate, lte: filters.endDate };
    if (bId) where.loan = { branchId: bId };

    const repayments = await db.loanRepayment.findMany({
      where,
      select: {
        amount: true,
        channel: true,
      },
    });

    const channelMap: Record<string, { count: number; amount: number }> = {};
    let totalAmount = 0;

    repayments.forEach((r) => {
      const channel = r.channel || "UNKNOWN";
      if (!channelMap[channel]) {
        channelMap[channel] = { count: 0, amount: 0 };
      }
      channelMap[channel].count++;
      channelMap[channel].amount += r.amount;
      totalAmount += r.amount;
    });

    return Object.entries(channelMap).map(([channel, stats]) => ({
      channel,
      count: stats.count,
      amount: stats.amount,
      percentage: totalAmount > 0 ? (stats.amount / totalAmount) * 100 : 0,
    }));
  } catch (error) {
    console.error("Error fetching repayment channel stats:", error);
    return [];
  }
}
export async function getActiveLoansByOfficer(filters?: { branchId?: string; officerId?: string }) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const whereClause: any = {
      status: { in: ["DISBURSED", "OVERDUE"] },
    };

    if (filters?.branchId && filters.branchId !== "all") {
      whereClause.branchId = filters.branchId;
    }

    if (filters?.officerId && filters.officerId !== "all") {
      whereClause.allocatedTellerId = filters.officerId;
    }

    const loans = await db.loan.findMany({
      where: whereClause,
      include: {
        member: {
          include: { user: true },
        },
        branch: true,
        loanApplication: {
          include: { loanProduct: true },
        },
        allocatedTeller: true,
      },
      orderBy: { disbursementDate: "desc" },
    });

    const loanData = loans.map((loan) => ({
      loanId: loan.id,
      memberName: loan.member.user.name,
      memberNumber: loan.member.memberNumber,
      memberPhone: loan.member.user.phone || "N/A",
      loanProduct: loan.loanApplication.loanProduct.name,
      principalAmount: loan.amountGranted,
      outstandingBalance: loan.outstandingBalance,
      disbursementDate: loan.disbursementDate,
      dueDate: loan.dueDate,
      status: loan.status,
      loanOfficer: loan.allocatedTeller?.name || "N/A",
      branch: loan.branch?.name || "N/A",
    }));

    const totalPrincipal = loanData.reduce((sum, l) => sum + l.principalAmount, 0);
    const totalOutstanding = loanData.reduce((sum, l) => sum + l.outstandingBalance, 0);

    return {
      loans: loanData,
      summary: {
        totalActiveLoans: loanData.length,
        totalPrincipal,
        totalOutstanding,
        averageLoanSize: loanData.length > 0 ? totalPrincipal / loanData.length : 0,
      },
    };
  } catch (error) {
    console.error("Error generating active loans by officer report:", error);
    return {
      loans: [],
      summary: { totalActiveLoans: 0, totalPrincipal: 0, totalOutstanding: 0, averageLoanSize: 0 },
    };
  }
}
export async function getLoanDuesVsRepaymentReport(filters?: { startDate?: Date; endDate?: Date; branchId?: string; officerId?: string }) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const whereDue: any = {};
    const whereRepaid: any = {};

    if (filters?.startDate) {
      whereDue.dueDate = { gte: filters.startDate };
      whereRepaid.repaymentDate = { gte: filters.startDate };
    }
    if (filters?.endDate) {
      whereDue.dueDate = { ...(whereDue.dueDate || {}), lte: filters.endDate };
      whereRepaid.repaymentDate = { ...(whereRepaid.repaymentDate || {}), lte: filters.endDate };
    }

    // Role-based filtering
    let allowedBranchId = filters?.branchId;
    if (["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role)) {
        allowedBranchId = user.branchId;
    }
    
    let allowedOfficerId = filters?.officerId;
    if ((user.role === "LOANOFFICER" || user.role === "TELLER") && (!filters?.officerId || filters.officerId === "all")) {
        allowedOfficerId = user.id;
    }

    // 1. Fetch Individual Data
    const indSchedulesWhere = { ...whereDue };
    const indRepaymentsWhere = { ...whereRepaid };
    
    if (allowedBranchId && allowedBranchId !== "all") {
        indSchedulesWhere.loan = { branchId: allowedBranchId };
        indRepaymentsWhere.loan = { branchId: allowedBranchId };
    }
    if (allowedOfficerId && allowedOfficerId !== "all") {
        indSchedulesWhere.loan = { ...indSchedulesWhere.loan, allocatedTellerId: allowedOfficerId };
        indRepaymentsWhere.loan = { ...indRepaymentsWhere.loan, allocatedTellerId: allowedOfficerId };
    }

    const [indSchedules, indRepayments] = await Promise.all([
      db.loanRepaymentSchedule.findMany({
        where: indSchedulesWhere,
        include: {
          loan: {
            include: {
              member: { include: { user: { select: { name: true } } } },
              loanApplication: { include: { loanProduct: { select: { name: true } } } },
            }
          }
        }
      }),
      db.loanRepayment.findMany({
        where: indRepaymentsWhere,
        include: {
          loan: {
              include: {
                  member: { include: { user: { select: { name: true } } } },
                  loanApplication: { include: { loanProduct: { select: { name: true } } } }
              }
          }
        }
      })
    ]);

    // 2. Fetch Institutional Data
    const instSchedulesWhere = { ...whereDue };
    const instRepaymentsWhere: any = { ...whereRepaid };

    if (allowedOfficerId && allowedOfficerId !== "all") {
        instSchedulesWhere.loan = { allocatedTellerId: allowedOfficerId };
        instRepaymentsWhere.loan = { allocatedTellerId: allowedOfficerId };
    }

    const [instSchedules, instRepayments] = await Promise.all([
      // Use raw SQL for institutional schedules due to Prisma stale client issue
      db.$queryRaw<any[]>`
        SELECT s.*, l."allocatedTellerId"
        FROM "InstitutionLoanRepaymentSchedule" s
        JOIN "InstitutionLoan" l ON s."loanId" = l.id
        WHERE 1=1
        ${filters?.startDate ? Prisma.sql`AND s."dueDate" >= ${filters.startDate}` : Prisma.empty}
        ${filters?.endDate ? Prisma.sql`AND s."dueDate" <= ${filters.endDate}` : Prisma.empty}
        ${(allowedOfficerId && allowedOfficerId !== "all") ? Prisma.sql`AND l."allocatedTellerId" = ${allowedOfficerId}` : Prisma.empty}
      `,
      db.institutionLoanRepayment.findMany({
        where: instRepaymentsWhere,
        include: {
          loan: {
              include: {
                  institution: { select: { institutionName: true, institutionNumber: true } },
                  application: { include: { loanProduct: { select: { name: true } } } }
              }
          }
        }
      })
    ]);

    // Grouping logic based on Loan ID, Product, and Member
    const reportMap = new Map<string, any>();

    const getMapKey = (loanId: string, periodDate: Date) => {
        return `${loanId}_${periodDate.toISOString().substring(0, 7)}`; // Group by loan and month
    };

    // Process Individual Schedules (Dues)
    indSchedules.forEach(s => {
        const key = getMapKey(s.loanId, s.dueDate);
        if (!reportMap.has(key)) {
            reportMap.set(key, {
                loanId: s.loanId,
                memberName: s.loan.member.user.name,
                memberNumber: s.loan.member.memberNumber,
                loanProduct: s.loan.loanApplication.loanProduct.name,
                period: s.dueDate.toISOString().substring(0, 7),
                principalDue: 0,
                interestDue: 0,
                totalDue: 0,
                principalPaid: 0,
                interestPaid: 0,
                totalPaid: 0
            });
        }
        const entry = reportMap.get(key);
        entry.principalDue += s.principalPayment;
        entry.interestDue += s.interestPayment;
        entry.totalDue += s.totalPayment;
        reportMap.set(key, entry);
    });

    // Process Individual Repayments
    indRepayments.forEach(r => {
        const key = getMapKey(r.loanId, r.repaymentDate);
        if (!reportMap.has(key)) {
            reportMap.set(key, {
                loanId: r.loanId,
                memberName: r.loan.member.user.name,
                memberNumber: r.loan.member.memberNumber,
                loanProduct: r.loan.loanApplication.loanProduct.name,
                period: r.repaymentDate.toISOString().substring(0, 7),
                principalDue: 0,
                interestDue: 0,
                totalDue: 0,
                principalPaid: 0,
                interestPaid: 0,
                totalPaid: 0
            });
        }
        const entry = reportMap.get(key);
        entry.principalPaid += r.principalPaid;
        entry.interestPaid += r.interestPaid;
        entry.totalPaid += r.amount;
        reportMap.set(key, entry);
    });

    // Now need to fetch institutional loans for name mapping for the raw schedules
    const instLoanIds = [...new Set(instSchedules.map((s: any) => s.loanId))];
    const instLoansForNames = instLoanIds.length > 0 ? await db.institutionLoan.findMany({
        where: { id: { in: instLoanIds } },
        include: {
            institution: { select: { institutionName: true, institutionNumber: true } },
            application: { include: { loanProduct: { select: { name: true } } } }
        }
    }) : [];
    
    const instLoanMap = new Map(instLoansForNames.map(l => [l.id, l]));

    // Process Institutional Schedules (Dues)
    instSchedules.forEach((s: any) => {
        const dueDate = new Date(s.dueDate || s.duedate);
        const key = getMapKey(s.loanId || s.loanid, dueDate);
        
        const loanData = instLoanMap.get(s.loanId || s.loanid);
        const memberName = loanData?.institution.institutionName || "Unknown";
        const memberNumber = loanData?.institution.institutionNumber || "Unknown";
        const loanProduct = loanData?.application.loanProduct.name || "Unknown";

        if (!reportMap.has(key)) {
            reportMap.set(key, {
                loanId: s.loanId || s.loanid,
                memberName,
                memberNumber,
                loanProduct,
                period: dueDate.toISOString().substring(0, 7),
                principalDue: 0,
                interestDue: 0,
                totalDue: 0,
                principalPaid: 0,
                interestPaid: 0,
                totalPaid: 0
            });
        }
        const entry = reportMap.get(key);
        const getVal = (v: any) => v === undefined || v === null ? 0 : v;
        entry.principalDue += getVal(s.principalPayment || s.principalpayment || s.principal_payment);
        entry.interestDue += getVal(s.interestPayment || s.interestpayment || s.interest_payment);
        entry.totalDue += getVal(s.totalPayment || s.totalpayment || s.total_payment);
        reportMap.set(key, entry);
    });

    // Process Institutional Repayments
    instRepayments.forEach(r => {
        const key = getMapKey(r.loanId, r.repaymentDate);
        if (!reportMap.has(key)) {
            reportMap.set(key, {
                loanId: r.loanId,
                memberName: r.loan.institution.institutionName,
                memberNumber: r.loan.institution.institutionNumber,
                loanProduct: r.loan.application.loanProduct.name,
                period: r.repaymentDate.toISOString().substring(0, 7),
                principalDue: 0,
                interestDue: 0,
                totalDue: 0,
                principalPaid: 0,
                interestPaid: 0,
                totalPaid: 0
            });
        }
        const entry = reportMap.get(key);
        entry.principalPaid += r.principalPaid;
        entry.interestPaid += r.interestPaid;
        entry.totalPaid += r.amount;
        reportMap.set(key, entry);
    });

    let resultList = Array.from(reportMap.values());
    
    // Calculate performance variance
    resultList = resultList.map(item => ({
        ...item,
        varianceTotal: item.totalPaid - item.totalDue,
        collectionRate: item.totalDue > 0 ? (item.totalPaid / item.totalDue) * 100 : (item.totalPaid > 0 ? 100 : 0)
    }));
    
    // Sort by period descending, then name
    resultList.sort((a, b) => {
        if (b.period !== a.period) return b.period.localeCompare(a.period);
        return a.memberName.localeCompare(b.memberName);
    });

    const summary = {
        totalPrincipalDue: resultList.reduce((sum, item) => sum + item.principalDue, 0),
        totalInterestDue: resultList.reduce((sum, item) => sum + item.interestDue, 0),
        totalDue: resultList.reduce((sum, item) => sum + item.totalDue, 0),
        
        totalPrincipalPaid: resultList.reduce((sum, item) => sum + item.principalPaid, 0),
        totalInterestPaid: resultList.reduce((sum, item) => sum + item.interestPaid, 0),
        totalPaid: resultList.reduce((sum, item) => sum + item.totalPaid, 0),
        
        overallVariance: resultList.reduce((sum, item) => sum + item.varianceTotal, 0),
        overallCollectionRate: 0
    };
    
    summary.overallCollectionRate = summary.totalDue > 0 ? (summary.totalPaid / summary.totalDue) * 100 : (summary.totalPaid > 0 ? 100 : 0);

    return { records: resultList, summary };
    
  } catch (error) {
    console.error("Error generating due vs repayment report:", error);
    return { records: [], summary: { totalPrincipalDue: 0, totalInterestDue: 0, totalDue: 0, totalPrincipalPaid: 0, totalInterestPaid: 0, totalPaid: 0, overallVariance: 0, overallCollectionRate: 0 } };
  }
}
export async function getLoanArrearsByAge(filters?: { branchId?: string; officerId?: string }) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    let bId = filters?.branchId;
    if (["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role)) {
      bId = user.branchId;
    }

    const where: any = {
      status: { in: ["DISBURSED", "OVERDUE"] }
    };

    if (bId && bId !== "all") {
      where.branchId = bId;
    }
    if (filters?.officerId && filters.officerId !== "all") {
      where.allocatedTellerId = filters.officerId;
    }

    // Individual Loans
    const overdueLoans = await db.loan.findMany({
      where: where,
      select: {
        id: true,
        amountGranted: true,
        outstandingBalance: true,
        interestAmount: true,
        interestPaid: true,
        principalPaid: true,
        penaltyPaid: true,
        dueDate: true,
        member: { select: { memberNumber: true, user: { select: { name: true } } } },
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
    const instOverdueLoans = await db.institutionLoan.findMany({
      where: instWhere,
      include: { institution: { include: { user: true } } }
    });

    const now = new Date();
    const brackets: Record<string, { numberOfLoans: number; principalArrears: number; interestArrears: number; penaltyArrears: number; totalArrears: number; members: Array<{ name: string; memberNumber: string; amount: number }> }> = {
      "1-30 days": { numberOfLoans: 0, principalArrears: 0, interestArrears: 0, penaltyArrears: 0, totalArrears: 0, members: [] },
      "31-60 days": { numberOfLoans: 0, principalArrears: 0, interestArrears: 0, penaltyArrears: 0, totalArrears: 0, members: [] },
      "61-90 days": { numberOfLoans: 0, principalArrears: 0, interestArrears: 0, penaltyArrears: 0, totalArrears: 0, members: [] },
      "91-180 days": { numberOfLoans: 0, principalArrears: 0, interestArrears: 0, penaltyArrears: 0, totalArrears: 0, members: [] },
      "181-365 days": { numberOfLoans: 0, principalArrears: 0, interestArrears: 0, penaltyArrears: 0, totalArrears: 0, members: [] },
      "365+ days": { numberOfLoans: 0, principalArrears: 0, interestArrears: 0, penaltyArrears: 0, totalArrears: 0, members: [] },
    };

    // Fetch global penalty config outside the loop to avoid N+1 and await scope issues
    const penaltyConfig = await db.globalFeeConfiguration.findUnique({
      where: { key: "PENALTY_CONFIG" }
    });
    const tiers = penaltyConfig ? (penaltyConfig.value as unknown as PenaltyTier[]) : DEFAULT_PENALTY_TIERS;

    const processLoan = (loan: any, isInstitutional: boolean = false) => {
      let daysOverdue = 0;
      
      // Try to get aging from schedule first
      if (loan.schedules && loan.schedules.length > 0) {
        const schedule = loan.schedules[0];
        const dueDate = new Date(schedule.dueDate || schedule.duedate);
        if (dueDate < now) {
          daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        }
      } else {
        // Fallback to loan maturity date
        const dueDate = new Date(loan.dueDate);
        if (dueDate < now) {
          daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      if (daysOverdue <= 0) return;

      let bracket: string;
      if (daysOverdue <= 30) bracket = "1-30 days";
      else if (daysOverdue <= 60) bracket = "31-60 days";
      else if (daysOverdue <= 90) bracket = "61-90 days";
      else if (daysOverdue <= 180) bracket = "91-180 days";
      else if (daysOverdue <= 365) bracket = "181-365 days";
      else bracket = "365+ days";

      const outstanding = loan.outstandingBalance || 0;

      let accruedPenalty = 0;
      const schedules = loan.schedules || [];
      
      if (schedules.length > 0) {
        const installments = schedules.map((s: any) => ({
          period: s.period,
          principalArrears: s.principalPayment - (s.paidPrincipal || 0),
          interestArrears: s.interestPayment - (s.paidInterest || 0),
          daysOverdue: Math.floor((now.getTime() - new Date(s.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        })).filter((i: any) => i.daysOverdue > 0);
        
        accruedPenalty = calculateCompoundingPenalty(installments, tiers);
      } else {
        // Fallback to simple estimation if no schedules are loaded
        accruedPenalty = calculateSimplePenaltyEstimation(outstanding, daysOverdue, tiers);
      }

      // Adjust for penalty already paid
      accruedPenalty = Math.max(0, accruedPenalty - (loan.penaltyPaid || 0));
      const principalArrears = Math.max(0, loan.amountGranted - (loan.principalPaid || 0));
      const interestArrears = Math.max(0, (loan.interestAmount || 0) - (loan.interestPaid || 0));

      brackets[bracket].numberOfLoans++;
      brackets[bracket].principalArrears += principalArrears;
      brackets[bracket].interestArrears += interestArrears;
      brackets[bracket].penaltyArrears += accruedPenalty;
      brackets[bracket].totalArrears += principalArrears + interestArrears + accruedPenalty;
      
      const memberName = isInstitutional ? (loan.institution.institutionName) : (loan.member.user.name || "Unknown");
      const memberNumber = isInstitutional ? (loan.institution.institutionNumber) : (loan.member.memberNumber);

      brackets[bracket].members.push({
        name: memberName,
        memberNumber: memberNumber,
        amount: principalArrears + interestArrears + accruedPenalty,
      });
    };

    // Process both individual and institutional loans
    for (const loan of overdueLoans) processLoan(loan, false);
    for (const loan of instOverdueLoans) {
        // Institutional schedules need separate query usually, or we use fallback
        const instSchedules = await db.$queryRaw<any[]>`
            SELECT * FROM "InstitutionLoanRepaymentSchedule" 
            WHERE "loanId" = ${loan.id} AND "status" != 'PAID'
            ORDER BY "period" ASC LIMIT 1
        `;
        processLoan({ ...loan, schedules: instSchedules }, true);
    }

    const grandTotal = Object.values(brackets).reduce((sum, b) => sum + b.totalArrears, 0);

    const agingBrackets = Object.entries(brackets)
      .map(([name, b]) => ({
        agingBracket: name,
        ...b,
        percentage: grandTotal > 0 ? (b.totalArrears / grandTotal) * 100 : 0,
      }))
      .filter(b => b.numberOfLoans > 0);

    return {
      agingBrackets,
      summary: {
        totalLoans: agingBrackets.reduce((sum, b) => sum + b.numberOfLoans, 0),
        totalPrincipalArrears: agingBrackets.reduce((sum: number, b) => sum + b.principalArrears, 0),
        totalInterestArrears: agingBrackets.reduce((sum: number, b) => sum + b.interestArrears, 0),
        totalPenaltyArrears: agingBrackets.reduce((sum, b) => sum + b.penaltyArrears, 0),
        totalArrears: grandTotal,
      },
    };
  } catch (error) {
    console.error("Error generating arrears by age report:", error);
    return {
      agingBrackets: [],
      summary: { totalLoans: 0, totalPrincipalArrears: 0, totalInterestArrears: 0, totalPenaltyArrears: 0, totalArrears: 0 },
    };
  }
}
export async function getLoanGuarantorsReport() { return []; }
export async function getTopBottomBorrowersReport(limit?: number) { return { topBorrowers: [], bottomBorrowers: [], bestPerformers: [], worstPerformers: [], summary: { totalBorrowers: 0, totalBorrowed: 0, totalOutstanding: 0, averageLoanSize: 0 } }; }
export async function getBorrowersDetailsReport() { return []; }
export async function getDailyDemandSheet() { return []; }
export async function getLoanCollateralReport() { return []; }
export async function getRepaymentScheduleReport(filters: { branchId?: string; officerId?: string; loanId?: string } = {}) {
  try {
    const loans = await db.loan.findMany({
      where: {
        ...(filters.loanId 
          ? { id: filters.loanId } 
          : { status: { in: ["DISBURSED", "OVERDUE", "REPAID"] } }),
        ...(filters.branchId && filters.branchId !== "all" ? { branchId: filters.branchId } : {}),
        ...(filters.officerId && filters.officerId !== "all" ? { loanApplication: { loanOfficerId: filters.officerId } } : {}),
      },
      include: {
        member: { include: { user: true } },
        loanApplication: { include: { loanProduct: true, loanOfficer: true } },
        schedules: { orderBy: { period: "asc" } },
        branch: true
      }
    });

    const allSchedules: any[] = [];
    let totalPrincipalDue = 0;
    let totalInterestDue = 0;
    let totalDue = 0;

    for (const loan of loans) {
      loan.schedules.forEach((item: any) => {
        allSchedules.push({
          id: item.id,
          loanId: loan.id,
          memberName: loan.member.user.name,
          memberNumber: loan.member.memberNumber,
          loanProduct: loan.loanApplication.loanProduct.name,
          dueDate: item.dueDate,
          installmentNumber: item.period,
          principalDue: item.principalPayment,
          interestDue: item.interestPayment,
          totalDue: item.totalPayment,
          balance: item.remainingBalance,
          status: item.status,
          paidAmount: item.paidAmount,
          loanOfficer: loan.loanApplication.loanOfficer?.name || "N/A",
          branch: loan.branch?.name || "N/A",
          disbursementDate: loan.disbursementDate
        });

        if (item.status !== "PAID") {
          totalPrincipalDue += item.principalPayment;
          totalInterestDue += item.interestPayment;
          totalDue += item.totalPayment;
        }
      });
    }

    // Adjust summary calculation to reflect remaining due specifically
    const totalPaid = allSchedules.reduce((sum: number, s: any) => sum + (s.paidAmount || 0), 0);
    const totalScheduledAmount = allSchedules.reduce((sum: number, s: any) => sum + s.totalDue, 0);

    return {
      schedules: allSchedules.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
      summary: {
        totalScheduledPayments: allSchedules.length,
        totalPrincipalDue: allSchedules.reduce((sum: number, s: any) => sum + s.principalDue, 0),
        totalInterestDue: allSchedules.reduce((sum: number, s: any) => sum + s.interestDue, 0),
        totalDue: totalScheduledAmount,
        totalPaid,
        totalBalance: Math.max(0, totalScheduledAmount - totalPaid)
      }
    };
  } catch (error) {
    console.error("Error generating repayment schedule report:", error);
    return {
      schedules: [],
      summary: { totalScheduledPayments: 0, totalPrincipalDue: 0, totalInterestDue: 0, totalDue: 0, totalPaid: 0, totalBalance: 0 }
    };
  }
}
export async function getLoanLedgerCardsReport(filters?: {
  branchId?: string;
  officerId?: string;
  memberId?: string;
  institutionId?: string;
}) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const whereClause: any = {
      status: { in: ["DISBURSED", "OVERDUE", "REPAID"] },
    };

    if (filters?.branchId && filters.branchId !== "all") {
      whereClause.branchId = filters.branchId;
    }
    if (filters?.officerId && filters.officerId !== "all") {
      whereClause.allocatedTellerId = filters.officerId;
    }
    if (filters?.memberId && filters.memberId !== "all") {
      whereClause.memberId = filters.memberId;
    }

    const [individualLoans, institutionLoans] = await Promise.all([
      db.loan.findMany({
        where: whereClause,
        include: {
          member: { include: { user: true } },
          branch: true,
          loanApplication: { include: { loanProduct: true } },
          allocatedTeller: true,
          ledgerTransactions: { orderBy: { transactionDate: "asc" } },
          schedules: { orderBy: { period: "asc" } },
        },
        orderBy: { disbursementDate: "desc" },
      }),
      // For institution loans, skip only when an individual member filter is active
      !filters?.memberId || filters.memberId === "all" ? db.institutionLoan.findMany({
        where: {
          status: { in: ["DISBURSED", "OVERDUE", "REPAID"] },
          ...(filters?.institutionId &&
            filters.institutionId !== "all" && {
              institutionId: filters.institutionId,
            }),
          ...(filters?.officerId && filters.officerId !== "all" && { allocatedTellerId: filters.officerId }),
        },
        include: {
          institution: { include: { user: { include: { branch: true } } } },
          application: { include: { loanProduct: true } },
          allocatedTeller: true,
          schedules: { orderBy: { period: "asc" } },
        },
        orderBy: { disbursementDate: "desc" },
      }) : Promise.resolve([])
    ]);

    const transactions: any[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    // Process Individual Loans
    for (const loan of individualLoans) {
      const memberName = loan.member.user.name;
      const memberNumber = loan.member.memberNumber;
      const loanOfficer = loan.allocatedTeller?.name || "N/A";
      const branch = loan.branch?.name || "N/A";
      const principalAmount = loan.amountGranted;
      const interestAmount = loan.interestAmount || loan.schedules.reduce((sum: number, s: any) => sum + (s.interestPayment || 0), 0);

      totalCredits += principalAmount + interestAmount;

      loan.ledgerTransactions.forEach(tx => {
        if (tx.transactionType === "REPAYMENT") {
          totalDebits += (tx.creditPrincipal + tx.creditInterest); // For repayments, it's credit to loan balance
        }

        transactions.push({
          transactionDate: tx.transactionDate,
          transactionType: tx.transactionType,
          voucherNo: tx.voucherNo || tx.id.substring(0, 8).toUpperCase(),
          memberName,
          memberNumber,
          loanId: loan.id,
          debitPrincipal: tx.debitPrincipal,
          debitInterest: tx.debitInterest,
          creditPrincipal: tx.creditPrincipal,
          creditInterest: tx.creditInterest,
          totalDebit: tx.debitPrincipal + tx.debitInterest,
          totalCredit: tx.creditPrincipal + tx.creditInterest,
          balancePrincipal: tx.balancePrincipal,
          balanceInterest: tx.balanceInterest,
          balanceTotal: tx.balanceTotal,
          loanOfficer,
          branch,
        });
      });
    }

    // Process Institution Loans
    for (const loan of institutionLoans as any[]) {
      const memberName = loan.institution.institutionName;
      const memberNumber = loan.institution.institutionNumber;
      const loanOfficer = loan.allocatedTeller?.name || "N/A";
      const branch = loan.institution.user?.branch?.name || "N/A";
      const principalAmount = loan.amountGranted;
      
      // Fetch institutional transactions separately via raw SQL to bypass stale Prisma client
      const instTransactions = await db.$queryRaw<any[]>`
        SELECT * FROM "InstitutionLoanLedgerTransaction" 
        WHERE "loanId" = ${loan.id} 
        ORDER BY "transactionDate" ASC
      `;
      
      const instSchedules = await db.$queryRaw<any[]>`
        SELECT * FROM "InstitutionLoanRepaymentSchedule" 
        WHERE "loanId" = ${loan.id} 
        ORDER BY "period" ASC
      `;

      const getVal = (v: any, fallback: any = 0) => v === undefined || v === null ? fallback : v;
      const interestAmount = (loan.totalAmountDue - loan.amountGranted) || instSchedules.reduce((sum: number, s: any) => sum + getVal(s.interestPayment || s.interest_payment), 0);

      totalCredits += principalAmount + interestAmount;

      instTransactions.forEach((tx: any) => {
        const type = tx.transactionType || tx.transaction_type;
        if (type === "REPAYMENT") {
          totalDebits += (getVal(tx.creditPrincipal || tx.credit_principal) + getVal(tx.creditInterest || tx.credit_interest));
        }

        transactions.push({
          transactionDate: tx.transactionDate || tx.transaction_date,
          transactionType: type,
          voucherNo: tx.voucherNo || tx.voucherno || tx.voucher_no || tx.id.substring(0, 8).toUpperCase(),
          memberName,
          memberNumber,
          loanId: loan.id,
          debitPrincipal: getVal(tx.debitPrincipal || tx.debit_principal),
          debitInterest: getVal(tx.debitInterest || tx.debit_interest),
          creditPrincipal: getVal(tx.creditPrincipal || tx.credit_principal),
          creditInterest: getVal(tx.creditInterest || tx.credit_interest),
          totalDebit: getVal(tx.debitPrincipal || tx.debit_principal) + getVal(tx.debitInterest || tx.debit_interest),
          totalCredit: getVal(tx.creditPrincipal || tx.credit_principal) + getVal(tx.creditInterest || tx.credit_interest),
          balancePrincipal: getVal(tx.balancePrincipal || tx.balance_principal),
          balanceInterest: getVal(tx.balanceInterest || tx.balance_interest),
          balanceTotal: getVal(tx.balanceTotal || tx.balancetotal || tx.balance_total),
          loanOfficer,
          branch,
        });
      });
    }

    // Sort all transactions by date descending for the listing
    transactions.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

    return {
      transactions,
      summary: {
        totalTransactions: transactions.length,
        totalDebits,
        totalCredits,
        totalLoans: individualLoans.length + institutionLoans.length,
      },
    };
  } catch (error) {
    console.error("Error generating loan ledger cards report:", error);
    return {
      transactions: [],
      summary: { totalTransactions: 0, totalDebits: 0, totalCredits: 0, totalLoans: 0 },
    };
  }
}
export async function getLoanRepaymentHistoryReport(filters?: any) { return []; }
export async function getLoanLedgerCard(loanId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    // 1. Try Individual Loan
    let loan = await db.loan.findUnique({
      where: { id: loanId },
      include: {
        member: { include: { user: true } },
        branch: true,
        loanApplication: { include: { loanProduct: true } },
        allocatedTeller: true,
        ledgerTransactions: { orderBy: { transactionDate: "asc" } },
        schedules: { orderBy: { period: "asc" } },
      },
    });

    let memberName = "";
    let memberNumber = "";
    let loanOfficer = "";
    let branch = "N/A";
    let loanProduct = "";
    let principalAmount = 0;
    let interestAmount = 0;
    let disbursementDate: Date | null = null;
    let status = "";
    let ledgerTransactions: any[] = [];
    let schedules: any[] = [];

    if (loan) {
      memberName = loan.member.user.name;
      memberNumber = loan.member.memberNumber;
      loanOfficer = loan.allocatedTeller?.name || "N/A";
      branch = loan.branch?.name || "N/A";
      loanProduct = loan.loanApplication.loanProduct.name;
      principalAmount = loan.amountGranted;
      disbursementDate = loan.disbursementDate;
      status = loan.status;
      ledgerTransactions = loan.ledgerTransactions;
      schedules = loan.schedules;
      interestAmount = loan.interestAmount || schedules.reduce((sum: number, s: any) => sum + (s.interestPayment || 0), 0);
    } else {
      // 2. Try Institution Loan
      const instLoan = await db.institutionLoan.findUnique({
        where: { id: loanId },
        include: {
          institution: { include: { user: { include: { branch: true } } } },
          application: { include: { loanProduct: true, loanOfficer: true } },
          allocatedTeller: true,
        }
      });

      if (!instLoan) throw new Error("Loan not found");

      // Fetch separately via raw SQL to avoid stale client validation error
      ledgerTransactions = await db.$queryRaw<any[]>`
        SELECT * FROM "InstitutionLoanLedgerTransaction" 
        WHERE "loanId" = ${loanId} 
        ORDER BY "transactionDate" ASC
      `;
      schedules = await db.$queryRaw<any[]>`
        SELECT * FROM "InstitutionLoanRepaymentSchedule" 
        WHERE "loanId" = ${loanId} 
        ORDER BY "period" ASC
      `;

      memberName = instLoan.institution.institutionName;
      memberNumber = instLoan.institution.institutionNumber;
      loanOfficer = instLoan.application.loanOfficer?.name || instLoan.allocatedTeller?.name || "N/A";
      branch = instLoan.institution.user?.branch?.name || "N/A";
      loanProduct = instLoan.application.loanProduct.name;
      principalAmount = instLoan.amountGranted;
      disbursementDate = instLoan.disbursementDate;
      // Robust stats calculation
      const getVal = (v: any, fallback: any = 0) => v === undefined || v === null ? fallback : v;
      interestAmount = (instLoan.totalAmountDue - instLoan.amountGranted) || schedules.reduce((sum: number, s: any) => sum + getVal(s.interestPayment || s.interestpayment || s.interest_payment), 0);
    }

    const transactions = ledgerTransactions.map((tx: any) => {
      const getVal = (v: any, fallback: any = 0) => v === undefined || v === null ? fallback : v;
      
      return {
        date: tx.transactionDate || tx.transactiondate || tx.transaction_date,
        description: tx.transactionType || tx.transactiontype || tx.transaction_type,
        reference: tx.voucherNo || tx.voucherno || tx.voucher_no || tx.id.substring(0, 8).toUpperCase(),
        debitPrincipal: getVal(tx.debitPrincipal || tx.debitprincipal || tx.debit_principal),
        debitInterest: getVal(tx.debitInterest || tx.debitinterest || tx.debit_interest),
        creditPrincipal: getVal(tx.creditPrincipal || tx.creditprincipal || tx.credit_principal),
        creditInterest: getVal(tx.creditInterest || tx.creditinterest || tx.credit_interest),
        totalDebit: getVal(tx.debitPrincipal || tx.debit_principal) + getVal(tx.debitInterest || tx.debit_interest),
        totalCredit: getVal(tx.creditPrincipal || tx.credit_principal) + getVal(tx.creditInterest || tx.credit_interest),
        balancePrincipal: getVal(tx.balancePrincipal || tx.balanceprincipal || tx.balance_principal),
        balanceInterest: getVal(tx.balanceInterest || tx.balanceinterest || tx.balance_interest),
        balance: getVal(tx.balanceTotal || tx.balancetotal || tx.balance_total),
      };
    });

    const getVal = (v: any, fallback: any = 0) => v === undefined || v === null ? fallback : v;
    const totalPrincipalPaid = ledgerTransactions.reduce((sum: number, tx: any) => sum + getVal(tx.creditPrincipal || tx.creditprincipal || tx.credit_principal), 0);
    const totalInterestPaid = ledgerTransactions.reduce((sum: number, tx: any) => sum + getVal(tx.creditInterest || tx.creditinterest || tx.credit_interest), 0);
    const totalPayments = totalPrincipalPaid + totalInterestPaid;
    const currentBalance = ledgerTransactions.length > 0 
        ? getVal(ledgerTransactions[ledgerTransactions.length - 1].balanceTotal || ledgerTransactions[ledgerTransactions.length - 1].balancetotal || ledgerTransactions[ledgerTransactions.length - 1].balance_total)
        : (principalAmount + interestAmount);

    return {
      loanDetails: {
        id: loanId,
        memberName,
        memberNumber,
        loanProduct,
        principalAmount,
        interestAmount,
        totalAmountDue: principalAmount + interestAmount,
        disbursementDate,
        status,
        loanOfficer,
        branch,
      },
      transactions,
      summary: {
        totalCredits: principalAmount + interestAmount,
        totalDebits: totalPayments,
        totalPrincipalPaid,
        totalInterestPaid,
        currentBalance,
      }
    };
  } catch (error) {
    console.error("Error generating loan ledger card:", error);
    throw error;
  }
}

export async function getLoanRepaymentSchedule(loanId: string) {
  try {
    // 1. Try to find an individual loan
    let loan = await db.loan.findUnique({
      where: { id: loanId },
      include: {
        member: { include: { user: true } },
        loanApplication: { include: { loanProduct: true, loanOfficer: true } },
        schedules: { orderBy: { period: "asc" } },
        branch: true
      }
    });

    let schedules: any[] = [];
    let loanDetails: any = null;

    if (loan) {
      loanDetails = {
        id: loan.id,
        memberName: loan.member.user.name,
        memberNumber: loan.member.memberNumber,
        loanProduct: loan.loanApplication.loanProduct.name,
        disbursementDate: loan.disbursementDate,
        loanOfficer: loan.loanApplication.loanOfficer?.name || "N/A",
        branch: loan.branch?.name || "N/A",
        status: loan.status,
      };
      
      schedules = loan.schedules.map((item: any) => ({
        id: item.id,
        loanId: loan.id,
        memberName: loanDetails.memberName,
        memberNumber: loanDetails.memberNumber,
        loanProduct: loanDetails.loanProduct,
        dueDate: item.dueDate,
        installmentNumber: item.period,
        principalDue: item.principalPayment,
        interestDue: item.interestPayment,
        totalDue: item.totalPayment,
        balance: item.remainingBalance,
        status: item.status,
        paidAmount: item.paidAmount,
        loanOfficer: loanDetails.loanOfficer,
        branch: loanDetails.branch,
        disbursementDate: loanDetails.disbursementDate
      }));
    } else {
      // 2. Try to find an institution loan
      const instLoan = await db.institutionLoan.findUnique({
        where: { id: loanId },
        include: {
          institution: { include: { user: { include: { branch: true } } } },
          application: { include: { loanProduct: true, loanOfficer: true } },
        }
      });

      if (!instLoan) {
        throw new Error(`Loan with ID ${loanId} not found`);
      }

      // Fetch schedules via raw SQL to bypass stale Prisma Client lack of model definition
      const rawSchedules = await db.$queryRaw<any[]>`
        SELECT * FROM "InstitutionLoanRepaymentSchedule" 
        WHERE "loanId" = ${loanId} 
        ORDER BY "period" ASC
      `;

      loanDetails = {
        id: instLoan.id,
        memberName: instLoan.institution.institutionName,
        memberNumber: instLoan.institution.institutionNumber,
        loanProduct: instLoan.application.loanProduct.name,
        disbursementDate: instLoan.disbursementDate,
        loanOfficer: instLoan.application.loanOfficer?.name || "N/A",
        branch: instLoan.institution.user?.branch?.name || "N/A",
        status: instLoan.status,
      };

      schedules = rawSchedules.map((item: any) => {
        // Robust mapping for raw query results (handling potential casing issues)
        const getVal = (v: any, fallback: any = 0) => v === undefined || v === null ? fallback : v;
        
        return {
          id: item.id,
          loanId: instLoan.id,
          memberName: loanDetails.memberName,
          memberNumber: loanDetails.memberNumber,
          loanProduct: loanDetails.loanProduct,
          dueDate: item.dueDate || item.duedate,
          installmentNumber: getVal(item.period || item.installmentNumber),
          principalDue: getVal(item.principalPayment || item.principalpayment || item.principal_payment),
          interestDue: getVal(item.interestPayment || item.interestpayment || item.interest_payment),
          totalDue: getVal(item.totalPayment || item.totalpayment || item.total_payment),
          balance: getVal(item.remainingBalance || item.remainingbalance || item.remaining_balance),
          status: item.status || "PENDING",
          paidAmount: getVal(item.paidAmount || item.paidamount || item.paid_amount),
          loanOfficer: loanDetails.loanOfficer,
          branch: loanDetails.branch,
          disbursementDate: loanDetails.disbursementDate
        };
      });
    }

    const totalPaid = schedules.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
    const totalPrincipalDue = schedules.reduce((sum, s) => sum + s.principalDue, 0);
    const totalInterestDue = schedules.reduce((sum, s) => sum + s.interestDue, 0);
    const totalDue = totalPrincipalDue + totalInterestDue;

    return {
      loanDetails,
      schedules,
      summary: {
        totalScheduledPayments: schedules.length,
        totalPrincipalDue,
        totalInterestDue,
        totalDue,
        totalPaid,
        totalBalance: Math.max(0, totalDue - totalPaid)
      }
    };
  } catch (error) {
    console.error("Error generating loan repayment schedule:", error);
    throw error;
  }
}

export async function getLoanPortfolioReport(filters?: { branchId?: string; officerId?: string }) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  try {
    // 1. Force branchId for restricted roles
    let bId = filters?.branchId;
    if (["BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(user.role) && user.branchId) {
      bId = user.branchId;
    }

    const where: any = {
      status: { in: ["DISBURSED", "OVERDUE", "REPAID"] }
    };

    if (bId && bId !== "all") {
      where.branchId = bId;
    }

    if (filters?.officerId && filters.officerId !== "all") {
      where.allocatedTellerId = filters.officerId;
    }

    // Role-based restrictions for Loan Officers
    if (user.role === "LOANOFFICER" || user.role === "TELLER") {
      where.allocatedTellerId = user.id;
    }

    const [products, branches, officers, allLoans, allInstLoans] = await Promise.all([
      db.loanProduct.findMany(),
      db.branch.findMany({ select: { id: true, name: true } }),
      db.user.findMany({
        where: { role: { in: ["LOANOFFICER", "TELLER"] }, branchId: bId || undefined },
        select: { id: true, name: true }
      }),
      db.loan.findMany({
        where: where,
        include: { loanApplication: { include: { loanProduct: true } }, branch: true, allocatedTeller: true }
      }),
      db.institutionLoan.findMany({
        where: {
          ...where,
          // Institutional loans might need branch scoping via institution.user
          ...(bId && bId !== "all" ? { institution: { user: { branchId: bId } } } : {})
        },
        include: { application: { include: { loanProduct: true } }, institution: { include: { user: { include: { branch: true } } } }, allocatedTeller: true }
      })
    ]);

    const combinedLoans = [
      ...allLoans.map(l => ({
        ...l,
        productName: l.loanApplication.loanProduct.name,
        productId: l.loanApplication.loanProduct.id,
        branchName: l.branch?.name || "Main Branch",
        officerName: l.allocatedTeller?.name || "Unassigned"
      })),
      ...allInstLoans.map(l => ({
        ...l,
        productName: l.application.loanProduct.name,
        productId: l.application.loanProduct.id,
        branchName: l.institution.user.branch?.name || "Main Branch",
        officerName: l.allocatedTeller?.name || "Unassigned"
      }))
    ];

    // Helper to calculate stats for a subset of loans
    const calculateStats = (loans: any[]) => {
      const activeLoans = loans.filter(l => l.status === "DISBURSED" || l.status === "OVERDUE");
      const overdueLoans = loans.filter(l => l.status === "OVERDUE");
      const repaidLoans = loans.filter(l => l.status === "REPAID");
      
      const totalDisbursed = loans.reduce((sum, l) => sum + l.amountGranted, 0);
      const totalOutstanding = loans.reduce((sum, l) => sum + l.outstandingBalance, 0);
      const totalRepaid = loans.reduce((sum, l) => sum + (l.amountPaid || 0), 0);
      const overdueBalance = overdueLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);

      return {
        totalLoans: loans.length,
        totalDisbursed,
        totalOutstanding,
        totalRepaid,
        activeLoans: activeLoans.length,
        overdueLoans: overdueLoans.length,
        repaidLoans: repaidLoans.length,
        portfolioAtRisk: totalOutstanding > 0 ? (overdueBalance / totalOutstanding) * 100 : 0,
        recoveryRate: totalDisbursed > 0 ? (totalRepaid / totalDisbursed) * 100 : 0
      };
    };

    const byProduct = products.map(p => {
      const productLoans = combinedLoans.filter(l => l.productId === p.id);
      return {
        productId: p.id,
        productName: p.name,
        ...calculateStats(productLoans)
      };
    });

    const byBranch = branches.map(b => {
      const branchLoans = combinedLoans.filter((l: any) => l.branchId === b.id || l.institution?.user?.branchId === b.id);
      return {
        branchName: b.name,
        ...calculateStats(branchLoans)
      };
    });

    const byOfficer = officers.map(o => {
      const officerLoans = combinedLoans.filter(l => l.allocatedTellerId === o.id);
      return {
        officerName: o.name,
        performanceScore: calculateStats(officerLoans).recoveryRate, // Simple performance score
        ...calculateStats(officerLoans)
      };
    });

    const summary = calculateStats(combinedLoans);

    return {
      byProduct: byProduct.filter(p => p.totalLoans > 0),
      byBranch: byBranch.filter(b => b.totalLoans > 0),
      byOfficer: byOfficer.filter(o => o.totalLoans > 0),
      summary,
      userName: user.name,
      userRole: user.role,
      branchName: bId ? branches.find(b => b.id === bId)?.name : null,
      filterOptions: {
        branches: branches.map(b => ({ id: b.id, name: b.name })),
        officers: officers.map(o => ({ id: o.id, name: o.name }))
      }
    };
  } catch (error) {
    console.error("Error generating portfolio report:", error);
    return { 
      byProduct: [], 
      byBranch: [], 
      byOfficer: [], 
      summary: { totalLoans: 0, totalDisbursed: 0, totalOutstanding: 0, totalRepaid: 0, activeLoans: 0, overdueLoans: 0, repaidLoans: 0, portfolioAtRisk: 0, recoveryRate: 0 },
      filterOptions: { branches: [], officers: [] }
    };
  }
}

export async function getLoanArrearsReport(filters?: any) {
  // Arrears report should include all loans that have actual arrears (daysInArrears > 0)
  // regardless of whether their status is 'OVERDUE' or 'DISBURSED'
  const result = await getLoanOutstandingBalanceReportAction({
    ...filters,
    status: "all" 
  });
  
  if (result.loans) {
    result.loans = result.loans.filter((l: any) => l.daysInArrears > 0);
    // Update summary totals based on filtered list
    const summary = result.summary as any;
    summary.totalPrincipalArrears = result.loans.reduce((sum: number, l: any) => sum + (l.principalArrears || l.outstandingPrincipal || 0), 0);
    summary.totalInterestArrears = result.loans.reduce((sum: number, l: any) => sum + (l.interestArrears || l.outstandingInterest || 0), 0);
    summary.totalArrears = result.loans.reduce((sum: number, l: any) => sum + (l.totalArrears || l.totalOutstanding || 0), 0);
    result.summary.totalLoans = result.loans.length;
  }
  
  // Return the full result object, UI must handle it correctly
  return result;
}

export async function getLoanOverdueReport(filters?: any) {
  // Overdue report is also the outstanding report filtered for overdue status
  const result = await getLoanOutstandingBalanceReportAction({
    ...filters,
    status: "OVERDUE"
  });
  return result;
}

export async function getWrittenOffLoansRepaymentReport(filters?: any) { return []; }
export async function getRescheduledLoanReport(filters?: any) { return []; }
