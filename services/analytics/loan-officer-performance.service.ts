import { db } from "@/prisma/db";
import { LoanStatus } from "@prisma/client";

export interface OfficerPerformanceMetrics {
  officerId: string;
  officerName: string;
  totalLoans: number;
  portfolioValue: number;
  activeLoans: number;
  repaidLoans: number;
  overdueLoans: number;
  defaultedLoans: number;
  repaymentRate: number;
  defaultRate: number;
  approvalRate: number;
  averageLoanSize: number;
  performanceScore: number;
}

export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

export class LoanOfficerPerformanceService {
  async getOfficerPerformance(
    officerId: string,
    dateRange?: DateRange
  ): Promise<OfficerPerformanceMetrics | null> {
    const officer = await db.user.findUnique({
      where: { id: officerId },
      select: { id: true, name: true },
    });

    if (!officer) return null;

    // Build date filter
    const dateFilter = dateRange?.startDate
      ? {
          applicationDate: {
            gte: dateRange.startDate,
            ...(dateRange.endDate && { lte: dateRange.endDate }),
          },
        }
      : {};

    // Get all applications managed by this officer
    const applications = await db.loanApplication.findMany({
      where: {
        loanOfficerId: officerId,
        ...dateFilter,
      },
      include: {
        loan: {
          include: {
            repayments: true,
          },
        },
      },
    });

    // Calculate metrics
    const totalApplications = applications.length;
    const approvedApplications = applications.filter(
      (app) => app.status === LoanStatus.APPROVED || app.status === LoanStatus.DISBURSED || app.loan
    );
    const disbursedLoans = applications.filter((app) => app.loan).map((app) => app.loan!);

    const totalLoans = disbursedLoans.length;
    const portfolioValue = disbursedLoans.reduce((sum, loan) => sum + loan.amountGranted, 0);
    const activeLoans = disbursedLoans.filter((loan) => loan.status === LoanStatus.DISBURSED).length;
    const repaidLoans = disbursedLoans.filter((loan) => loan.status === LoanStatus.REPAID).length;
    const overdueLoans = disbursedLoans.filter((loan) => loan.status === LoanStatus.OVERDUE).length;
    const defaultedLoans = disbursedLoans.filter((loan) => loan.status === LoanStatus.WRITTEN_OFF).length;

    const repaymentRate = totalLoans > 0 ? (repaidLoans / totalLoans) * 100 : 0;
    const defaultRate = totalLoans > 0 ? (defaultedLoans / totalLoans) * 100 : 0;
    const approvalRate = totalApplications > 0 ? (approvedApplications.length / totalApplications) * 100 : 0;
    const averageLoanSize = totalLoans > 0 ? portfolioValue / totalLoans : 0;

    // Calculate performance score (weighted composite)
    const performanceScore = this.calculatePerformanceScore({
      repaymentRate,
      defaultRate,
      approvalRate,
      portfolioValue,
    });

    return {
      officerId: officer.id,
      officerName: officer.name,
      totalLoans,
      portfolioValue,
      activeLoans,
      repaidLoans,
      overdueLoans,
      defaultedLoans,
      repaymentRate: Math.round(repaymentRate * 100) / 100,
      defaultRate: Math.round(defaultRate * 100) / 100,
      approvalRate: Math.round(approvalRate * 100) / 100,
      averageLoanSize: Math.round(averageLoanSize),
      performanceScore: Math.round(performanceScore * 100) / 100,
    };
  }

  async getAllOfficersPerformance(dateRange?: DateRange): Promise<OfficerPerformanceMetrics[]> {
    // Get all users with LOANOFFICER role
    const officers = await db.user.findMany({
      where: {
        role: "LOANOFFICER",
        isActive: true,
      },
      select: { id: true },
    });

    const performanceData = await Promise.all(
      officers.map((officer) => this.getOfficerPerformance(officer.id, dateRange))
    );

    return performanceData.filter((data): data is OfficerPerformanceMetrics => data !== null);
  }

  async getTopPerformers(limit: number = 5, dateRange?: DateRange): Promise<OfficerPerformanceMetrics[]> {
    const allPerformance = await this.getAllOfficersPerformance(dateRange);
    return allPerformance.sort((a, b) => b.performanceScore - a.performanceScore).slice(0, limit);
  }

  private calculatePerformanceScore(metrics: {
    repaymentRate: number;
    defaultRate: number;
    approvalRate: number;
    portfolioValue: number;
  }): number {
    // Weighted composite score (0-100)
    const repaymentWeight = 0.4;
    const portfolioWeight = 0.3;
    const approvalWeight = 0.2;
    const defaultPenalty = 0.1;

    // Normalize portfolio value to 0-100 scale (assuming max portfolio is 100M)
    const normalizedPortfolio = Math.min((metrics.portfolioValue / 100_000_000) * 100, 100);

    const score =
      metrics.repaymentRate * repaymentWeight +
      normalizedPortfolio * portfolioWeight +
      metrics.approvalRate * approvalWeight +
      (100 - metrics.defaultRate) * defaultPenalty;

    return Math.min(score, 100);
  }
}

export const loanOfficerPerformanceService = new LoanOfficerPerformanceService();
