import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

export class TopBottomShareholdersGenerator extends BaseReportGenerator {
  constructor() {
    super('Top/Bottom Shareholders Report', 'Ranking of shareholders by number of shares held');
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    const limit = params.limit || 10;
    const where: any = {
      status: 'ACTIVE',
      accountType: {
        isShareAccount: true,
      },
    };
    if (params.branchId) where.branchId = params.branchId;

    const topShareholders = await db.shareAccount.findMany({
      where,
      include: {
        member: { include: { user: { select: { name: true, phone: true } } } },
        accountType: { select: { name: true } },
      },
      orderBy: { numberOfShares: 'desc' },
      take: limit,
    });

    const bottomShareholders = await db.shareAccount.findMany({
      where: {
        ...where,
        numberOfShares: { gt: 0 },
      },
      include: {
        member: { include: { user: { select: { name: true, phone: true } } } },
        accountType: { select: { name: true } },
      },
      orderBy: { numberOfShares: 'asc' },
      take: limit,
    });

    const topData = topShareholders.map((acc, i) => ({
      rank: i + 1,
      accountNumber: acc.accountNumber,
      memberName: acc.member?.user?.name || 'N/A',
      memberPhone: acc.member?.user?.phone || 'N/A',
      numberOfShares: acc.numberOfShares || 0,
      totalValue: this.formatCurrency(acc.totalValue),
    }));

    const bottomData = bottomShareholders.map((acc, i) => ({
      rank: i + 1,
      accountNumber: acc.accountNumber,
      memberName: acc.member?.user?.name || 'N/A',
      memberPhone: acc.member?.user?.phone || 'N/A',
      numberOfShares: acc.numberOfShares || 0,
      totalValue: this.formatCurrency(acc.totalValue),
    }));

    const summary = {
      topShareholdersCount: topShareholders.length,
      bottomShareholdersCount: bottomShareholders.length,
      highestShares: topShareholders[0]?.numberOfShares || 0,
      lowestShares: bottomShareholders[0]?.numberOfShares || 0,
    };

    return this.buildReportData(params, { topShareholders: topData, bottomShareholders: bottomData }, summary);
  }
}

