import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Manager Dashboard Statistics Generator
 * specific high-level stats for the manager dashboard
 */
export class ManagerDashboardStatsGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Manager Dashboard Statistics',
      'High-level overview statistics for Savings, Shares, and general system status'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // 1. Savings Stats
    const savingsAggregate = await db.account.aggregate({
      _sum: { balance: true },
      _count: { id: true },
      where: {
        status: 'ACTIVE',
        accountType: {
          isShareAccount: false,
          hasFixedPeriod: false,
        },
      }
    });

    const dormantSavingsCount = await db.account.count({
      where: {
        status: 'DORMANT',
        accountType: {
          isShareAccount: false,
          hasFixedPeriod: false,
        },
      },
    });

    // 2. Shares Stats
    const sharesAggregate = await db.account.aggregate({
      _sum: { balance: true, sharesCount: true },
      _count: { id: true },
      where: {
        status: 'ACTIVE',
        accountType: {
          isShareAccount: true,
        },
      }
    });

    // 3. Member Stats
    const totalMembers = await db.member.count();
    const activeMembers = await db.member.count({
      where: { isApproved: true }
    });

    const summary = {
      generatedAt: new Date().toISOString(),
      currency: 'UGX', // Assuming UGX
    };

    const stats = {
      savings: {
        totalBalance: this.formatCurrency(savingsAggregate._sum.balance || 0),
        activeAccounts: savingsAggregate._count.id,
        dormantAccounts: dormantSavingsCount,
      },
      shares: {
        totalCapital: this.formatCurrency(sharesAggregate._sum.balance || 0),
        totalShares: sharesAggregate._sum.sharesCount || 0,
        totalShareholders: sharesAggregate._count.id,
      },
      members: {
        total: totalMembers,
        active: activeMembers,
      },
    };

    return this.buildReportData(params, stats, summary);
  }
}
