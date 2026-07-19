import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

export class ShareConcentrationGenerator extends BaseReportGenerator {
  constructor() {
    super('Share Concentration Report', 'Analysis of share ownership concentration among members');
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    const [memberAccounts, institutionAccounts] = await Promise.all([
      db.shareAccount.findMany({
        where: {
          status: 'ACTIVE',
        },
        include: {
          member: { include: { user: { select: { name: true } } } },
          accountType: { select: { sharePrice: true } },
        },
        orderBy: { numberOfShares: 'desc' },
      }),
      db.account.findMany({
        where: {
          institutionId: { not: null },
          accountType: { isShareAccount: true },
          status: 'ACTIVE',
        },
        include: {
          institution: { include: { user: { select: { name: true } } } },
          accountType: { select: { sharePrice: true } },
        },
        orderBy: { balance: 'desc' },
      }),
    ]);

    const accounts = [...memberAccounts, ...institutionAccounts.map((a) => ({
      ...a,
      totalValue: a.balance,
      numberOfShares: (a as any).sharesCount || 0,
    }))] as any[];
    accounts.sort((a, b) => (b.numberOfShares || 0) - (a.numberOfShares || 0));

    const totalShares = accounts.reduce((sum, acc) => sum + (acc.numberOfShares || 0), 0);
    
    const reportData = accounts.map((account, index) => {
      const sharesCount = account.numberOfShares || 0;
      const sharePrice = account.accountType.sharePrice || 10000;
      const percentage = totalShares > 0 ? (sharesCount / totalShares) * 100 : 0;
      
      return {
        rank: index + 1,
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || (account as any).institution?.institutionName || 'N/A',
        numberOfShares: sharesCount,
        shareValue: this.formatCurrency(sharePrice),
        totalValue: this.formatCurrency(account.totalValue),
        percentage: this.formatNumber(percentage, 2) + '%',
      };
    });

    // Calculate concentration metrics
    const top10Count = Math.min(10, accounts.length);
    const top10Shares = accounts.slice(0, top10Count).reduce((sum, acc) => sum + (acc.numberOfShares || 0), 0);
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

