import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Share Account Listing Report Generator
 * Lists all share accounts with their holdings
 */
export class ShareAccountListingGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Share Account Listing',
      'Complete listing of all share accounts with holdings and values'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    const where: any = {
      accountType: {
        isShareAccount: true,
      },
    };

    if (params.branchId) where.branchId = params.branchId;
    if (params.status) where.status = params.status;
    if (params.accountTypeId) where.accountTypeId = params.accountTypeId;

    const accounts = await db.account.findMany({
      where,
      include: {
        member: {
          include: {
            user: {
              select: { name: true, email: true, phone: true },
            },
          },
        },
        institution: {
          select: {
            institutionName: true,
          },
        },
        accountType: {
          select: { name: true, sharePrice: true },
        },
        branch: {
          select: { name: true },
        },
      },
      orderBy: { accountNumber: 'asc' },
    });

    const reportData = accounts.map(account => {
      const sharesCount = account.sharesCount || 0;
      const sharePrice = account.accountType.sharePrice || 10000;
      
      return {
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || account.institution?.institutionName || 'N/A',
        memberPhone: account.member?.user?.phone || 'N/A',
        accountType: account.accountType.name,
        branch: account.branch?.name || 'N/A',
        numberOfShares: sharesCount,
        shareValue: this.formatCurrency(sharePrice),
        totalValue: this.formatCurrency(account.balance),
        status: account.status,
        openedDate: this.formatDate(account.openedAt),
        lastTransactionDate: this.formatDate(account.openedAt), // fallback
      };
    });

    const summary = {
      totalAccounts: accounts.length,
      totalShares: accounts.reduce((sum, acc) => sum + (acc.sharesCount || 0), 0),
      totalValue: accounts.reduce((sum, acc) => sum + acc.balance, 0),
      activeAccounts: accounts.filter(acc => acc.status === 'ACTIVE').length,
      averageShares: accounts.length > 0
        ? accounts.reduce((sum, acc) => sum + (acc.sharesCount || 0), 0) / accounts.length
        : 0,
      averageValue: accounts.length > 0
        ? accounts.reduce((sum, acc) => sum + acc.balance, 0) / accounts.length
        : 0,
    };

    const formattedSummary = {
      ...summary,
      totalValue: this.formatCurrency(summary.totalValue),
      averageValue: this.formatCurrency(summary.averageValue),
    };

    return this.buildReportData(params, reportData, formattedSummary);
  }
}

