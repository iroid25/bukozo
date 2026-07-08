import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Top/Bottom Savers Report Generator
 * Ranks savings accounts by balance
 */
export class TopBottomSaversGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Top/Bottom Savers Report',
      'Ranking of savings accounts by balance - top performers and bottom performers'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Get limit for top/bottom (default: 10)
    const limit = params.limit || 10;
    const includeTop = params.includeTop !== false; // default true
    const includeBottom = params.includeBottom !== false; // default true

    // Build base query
    const where: any = {
      status: 'ACTIVE', // Only active accounts
      accountType: {
        isShareAccount: false, hasFixedPeriod: false,
      },
    };

    if (params.branchId) {
      where.branchId = params.branchId;
    }

    if (params.accountTypeId) {
      where.accountTypeId = params.accountTypeId;
    }

    // Fetch top savers
    let topSavers: any[] = [];
    if (includeTop) {
      topSavers = await db.account.findMany({
        where,
        include: {
          member: {
            include: {
              user: {
                select: {
                  name: true,
                  phone: true,
                },
              },
            },
          },
          accountType: {
            select: {
              name: true,
            },
          },
          branch: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          balance: 'desc',
        },
        take: limit,
      });
    }

    // Fetch bottom savers (excluding zero balance)
    let bottomSavers: any[] = [];
    if (includeBottom) {
      bottomSavers = await db.account.findMany({
        where: {
          ...where,
          balance: { gt: 0 }, // Exclude zero balance
        },
        include: {
          member: {
            include: {
              user: {
                select: {
                  name: true,
                  phone: true,
                },
              },
            },
          },
          accountType: {
            select: {
              name: true,
            },
          },
          branch: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          balance: 'asc',
        },
        take: limit,
      });
    }

    // Format top savers
    const topSaversData = topSavers.map((account, index) => ({
      rank: index + 1,
      accountNumber: account.accountNumber,
      memberName: account.member?.user?.name || 'N/A',
      memberPhone: account.member?.user?.phone || 'N/A',
      accountType: account.accountType.name,
      branch: account.branch?.name || 'N/A',
      balance: this.formatCurrency(account.balance),
      availableBalance: this.formatCurrency(account.balance),
      openedDate: this.formatDate(account.openedAt),
    }));

    // Format bottom savers
    const bottomSaversData = bottomSavers.map((account, index) => ({
      rank: index + 1,
      accountNumber: account.accountNumber,
      memberName: account.member?.user?.name || 'N/A',
      memberPhone: account.member?.user?.phone || 'N/A',
      accountType: account.accountType.name,
      branch: account.branch?.name || 'N/A',
      balance: this.formatCurrency(account.balance),
      availableBalance: this.formatCurrency(account.balance),
      openedDate: this.formatDate(account.openedAt),
    }));

    // Calculate summary
    const summary = {
      topSaversCount: topSavers.length,
      bottomSaversCount: bottomSavers.length,
      highestBalance: topSavers.length > 0
        ? this.formatCurrency(topSavers[0].balance)
        : this.formatCurrency(0),
      lowestBalance: bottomSavers.length > 0
        ? this.formatCurrency(bottomSavers[0].balance)
        : this.formatCurrency(0),
      topSaversTotalBalance: this.formatCurrency(
        topSavers.reduce((sum, acc) => sum + acc.balance, 0)
      ),
      bottomSaversTotalBalance: this.formatCurrency(
        bottomSavers.reduce((sum, acc) => sum + acc.balance, 0)
      ),
    };

    return this.buildReportData(
      params,
      {
        topSavers: topSaversData,
        bottomSavers: bottomSaversData,
      },
      summary
    );
  }
}
