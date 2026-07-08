import { db } from "@/prisma/db";

export interface TellerPerformanceMetrics {
  tellerId: string;
  tellerName: string;
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalLoanRepayments: number;
  totalVolume: number;
  depositVolume: number;
  withdrawalVolume: number;
  repaymentVolume: number;
  averageTransactionSize: number;
  activeDays: number;
  transactionsPerDay: number;
  performanceScore: number;
}

export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

export class TellerPerformanceService {
  async getTellerPerformance(
    tellerId: string,
    dateRange?: DateRange
  ): Promise<TellerPerformanceMetrics | null> {
    const teller = await db.user.findUnique({
      where: { id: tellerId },
      select: { id: true, name: true },
    });

    if (!teller) return null;

    // Build date filter
    const dateFilter = dateRange?.startDate
      ? {
          gte: dateRange.startDate,
          ...(dateRange.endDate && { lte: dateRange.endDate }),
        }
      : {};

    // Get deposits handled by this teller
    const deposits = await db.deposit.findMany({
      where: {
        handlerUserId: tellerId,
        ...(dateRange && { depositDate: dateFilter }),
      },
    });

    // Get withdrawals handled by this teller
    const withdrawals = await db.withdrawal.findMany({
      where: {
        handlerUserId: tellerId,
        ...(dateRange && { withdrawalDate: dateFilter }),
      },
    });

    // Get loan repayments handled by this teller
    const repayments = await db.loanRepayment.findMany({
      where: {
        handlerUserId: tellerId,
        ...(dateRange && { repaymentDate: dateFilter }),
      },
    });

    // Calculate metrics
    const totalDeposits = deposits.length;
    const totalWithdrawals = withdrawals.length;
    const totalLoanRepayments = repayments.length;
    const totalTransactions = totalDeposits + totalWithdrawals + totalLoanRepayments;

    const depositVolume = deposits.reduce((sum, d) => sum + d.amount, 0);
    const withdrawalVolume = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const repaymentVolume = repayments.reduce((sum, r) => sum + r.amount, 0);
    const totalVolume = depositVolume + withdrawalVolume + repaymentVolume;

    const averageTransactionSize = totalTransactions > 0 ? totalVolume / totalTransactions : 0;

    // Calculate active days (unique dates with transactions)
    const allDates = [
      ...deposits.map((d) => d.depositDate.toDateString()),
      ...withdrawals.map((w) => w.withdrawalDate.toDateString()),
      ...repayments.map((r) => r.repaymentDate.toDateString()),
    ];
    const activeDays = new Set(allDates).size;
    const transactionsPerDay = activeDays > 0 ? totalTransactions / activeDays : 0;

    // Calculate performance score
    const performanceScore = this.calculatePerformanceScore({
      totalTransactions,
      totalVolume,
      transactionsPerDay,
    });

    return {
      tellerId: teller.id,
      tellerName: teller.name,
      totalTransactions,
      totalDeposits,
      totalWithdrawals,
      totalLoanRepayments,
      totalVolume: Math.round(totalVolume),
      depositVolume: Math.round(depositVolume),
      withdrawalVolume: Math.round(withdrawalVolume),
      repaymentVolume: Math.round(repaymentVolume),
      averageTransactionSize: Math.round(averageTransactionSize),
      activeDays,
      transactionsPerDay: Math.round(transactionsPerDay * 100) / 100,
      performanceScore: Math.round(performanceScore * 100) / 100,
    };
  }

  async getAllTellersPerformance(dateRange?: DateRange): Promise<TellerPerformanceMetrics[]> {
    // Get all users with TELLER role
    const tellers = await db.user.findMany({
      where: {
        role: "TELLER",
        isActive: true,
      },
      select: { id: true },
    });

    const performanceData = await Promise.all(
      tellers.map((teller) => this.getTellerPerformance(teller.id, dateRange))
    );

    return performanceData.filter((data): data is TellerPerformanceMetrics => data !== null);
  }

  async getTopPerformers(limit: number = 5, dateRange?: DateRange): Promise<TellerPerformanceMetrics[]> {
    const allPerformance = await this.getAllTellersPerformance(dateRange);
    return allPerformance.sort((a, b) => b.performanceScore - a.performanceScore).slice(0, limit);
  }

  private calculatePerformanceScore(metrics: {
    totalTransactions: number;
    totalVolume: number;
    transactionsPerDay: number;
  }): number {
    // Weighted composite score (0-100)
    const transactionCountWeight = 0.4;
    const volumeWeight = 0.4;
    const efficiencyWeight = 0.2;

    // Normalize metrics to 0-100 scale
    const normalizedTransactions = Math.min((metrics.totalTransactions / 1000) * 100, 100);
    const normalizedVolume = Math.min((metrics.totalVolume / 50_000_000) * 100, 100);
    const normalizedEfficiency = Math.min((metrics.transactionsPerDay / 50) * 100, 100);

    const score =
      normalizedTransactions * transactionCountWeight +
      normalizedVolume * volumeWeight +
      normalizedEfficiency * efficiencyWeight;

    return Math.min(score, 100);
  }
}

export const tellerPerformanceService = new TellerPerformanceService();
