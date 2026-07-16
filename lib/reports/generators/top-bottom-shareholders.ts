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

    const topShareholders = await db.account.findMany({
      where,
      include: {
        member: { include: { user: { select: { name: true, phone: true } } } },
        institution: { select: { institutionName: true, institutionPhone: true } },
        accountType: { select: { name: true } },
      },
      orderBy: { sharesCount: 'desc' },
      take: limit,
    });

    const bottomShareholders = await db.account.findMany({
      where: {
        ...where,
        sharesCount: { gt: 0 },
      },
      include: {
        member: { include: { user: { select: { name: true, phone: true } } } },
        institution: { select: { institutionName: true, institutionPhone: true } },
        accountType: { select: { name: true } },
      },
      orderBy: { sharesCount: 'asc' },
      take: limit,
    });

    const topData = topShareholders.map((acc, i) => ({
      rank: i + 1,
      accountNumber: acc.accountNumber,
      memberName: acc.member?.user?.name || acc.institution?.institutionName || 'N/A',
      memberPhone: acc.member?.user?.phone || acc.institution?.institutionPhone || 'N/A',
      numberOfShares: acc.sharesCount || 0,
      totalValue: this.formatCurrency(acc.balance),
    }));

    const bottomData = bottomShareholders.map((acc, i) => ({
      rank: i + 1,
      accountNumber: acc.accountNumber,
      memberName: acc.member?.user?.name || acc.institution?.institutionName || 'N/A',
      memberPhone: acc.member?.user?.phone || acc.institution?.institutionPhone || 'N/A',
      numberOfShares: acc.sharesCount || 0,
      totalValue: this.formatCurrency(acc.balance),
    }));

    const summary = {
      topShareholdersCount: topShareholders.length,
      bottomShareholdersCount: bottomShareholders.length,
      highestShares: topShareholders[0]?.sharesCount || 0,
      lowestShares: bottomShareholders[0]?.sharesCount || 0,
    };

    return this.buildReportData(params, { topShareholders: topData, bottomShareholders: bottomData }, summary);
  }
}

