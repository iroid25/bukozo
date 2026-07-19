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

    const [topShareholders, bottomShareholders, institutionAccounts] = await Promise.all([
      db.shareAccount.findMany({
        where,
        include: {
          member: { include: { user: { select: { name: true, phone: true } } } },
          accountType: { select: { name: true } },
        },
        orderBy: { numberOfShares: 'desc' },
        take: limit,
      }),
      db.shareAccount.findMany({
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
      }),
      db.account.findMany({
        where: {
          institutionId: { not: null },
          accountType: { isShareAccount: true },
          status: 'ACTIVE',
          ...(params.branchId ? { branchId: params.branchId } : {}),
        },
        include: {
          institution: { include: { user: { select: { name: true, phone: true } } } },
          accountType: { select: { name: true } },
        },
      }),
    ]);

    const normalizedInstitution = institutionAccounts.map((a) => ({
      ...a,
      totalValue: a.balance,
      numberOfShares: (a as any).sharesCount || 0,
    }));
    const allShareholders = [...topShareholders, ...normalizedInstitution] as any[];
    allShareholders.sort((a: any, b: any) => (b.numberOfShares || 0) - (a.numberOfShares || 0));
    const allBottomShareholders = allShareholders.filter((a: any) => (a.numberOfShares || 0) > 0)
      .sort((a: any, b: any) => (a.numberOfShares || 0) - (b.numberOfShares || 0));

    const topData = allShareholders.slice(0, limit).map((acc, i) => ({
      rank: i + 1,
      accountNumber: acc.accountNumber,
      memberName: acc.member?.user?.name || (acc as any).institution?.institutionName || 'N/A',
      memberPhone: acc.member?.user?.phone || (acc as any).institution?.user?.phone || 'N/A',
      numberOfShares: acc.numberOfShares || 0,
      totalValue: this.formatCurrency(acc.totalValue),
    }));

    const bottomData = allBottomShareholders.slice(0, limit).map((acc, i) => ({
      rank: i + 1,
      accountNumber: acc.accountNumber,
      memberName: acc.member?.user?.name || (acc as any).institution?.institutionName || 'N/A',
      memberPhone: acc.member?.user?.phone || (acc as any).institution?.user?.phone || 'N/A',
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

