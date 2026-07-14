import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

export class ShareConcentrationGenerator extends BaseReportGenerator {
  constructor() {
    super('Share Concentration Report', 'Analysis of share ownership concentration among members');
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    const accounts = await db.account.findMany({
      where: {
        status: 'ACTIVE',
        accountType: {
          isShareAccount: true,
        },
      },
      include: {
        member: { include: { user: { select: { name: true } } } },
        institution: { select: { institutionName: true } },
        accountType: { select: { sharePrice: true } },
      },
      orderBy: { sharesCount: 'desc' },
    });

    const totalShares = accounts.reduce((sum, acc) => sum + (acc.sharesCount || 0), 0);
    
    const reportData = accounts.map((account, index) => {
      const sharesCount = account.sharesCount || 0;
      const sharePrice = account.accountType.sharePrice || 10000;
      const percentage = totalShares > 0 ? (sharesCount / totalShares) * 100 : 0;
      
      return {
        rank: index + 1,
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || account.institution?.institutionName || 'N/A',
        numberOfShares: sharesCount,
        shareValue: this.formatCurrency(sharePrice),
        totalValue: this.formatCurrency(account.balance),
        percentage: this.formatNumber(percentage, 2) + '%',
      };
    });

    // Calculate concentration metrics
    const top10Count = Math.min(10, accounts.length);
    const top10Shares = accounts.slice(0, top10Count).reduce((sum, acc) => sum + (acc.sharesCount || 0), 0);
    const top10Percentage = totalShares > 0 ? (top10Shares / totalShares) * 100 : 0;

    const summary = {
      totalMembers: accounts.length,
      totalShares,
      top10Members: top10Count,
      top10Shares,
      top10Percentage: this.formatNumber(top10Percentage, 2) + '%',
      averageShares: accounts.length > 0 ? Math.round(totalShares / accounts.length) : 0,
    };

    return this.buildReportData(params, reportData, summary);
  }
}

