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

    const accounts = await db.shareAccount.findMany({
      where,
      include: {
        member: {
          include: {
            user: {
              select: { name: true, email: true, phone: true },
            },
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

    // Institution accounts are in the Account model, not ShareAccount.
    // Query them separately and merge.
    const instWhere: any = {
      accountType: { isShareAccount: true },
      institutionId: { not: null },
    };
    if (params.branchId) instWhere.branchId = params.branchId;
    if (params.status) instWhere.status = params.status;
    if (params.accountTypeId) instWhere.accountTypeId = params.accountTypeId;

    const institutionAccounts = await db.account.findMany({
      where: instWhere,
      include: {
        institution: {
          select: { institutionName: true, user: { select: { name: true } } },
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

    const allAccounts = [...accounts, ...institutionAccounts];

    const reportData = allAccounts.map((account: any) => {
      const sharesCount = account.numberOfShares || 0;
      const sharePrice = account.accountType.sharePrice || 10000;
      const ownerName = account.member?.user?.name || account.institution?.institutionName || account.institution?.user?.name || 'N/A';
      
      return {
        accountNumber: account.accountNumber,
        memberName: ownerName,
        memberPhone: account.member?.user?.phone || 'N/A',
        accountType: account.accountType.name,
        branch: account.branch?.name || 'N/A',
        numberOfShares: sharesCount,
        shareValue: this.formatCurrency(sharePrice),
        totalValue: this.formatCurrency(account.totalValue),
        status: account.status,
        openedDate: this.formatDate(account.openedDate || (account as any).createdAt),
        lastTransactionDate: this.formatDate(account.lastTransactionDate || account.openedDate || (account as any).createdAt),
      };
    });

    const summary = {
      totalAccounts: allAccounts.length,
      totalShares: allAccounts.reduce((sum: number, acc: any) => sum + (acc.numberOfShares || 0), 0),
      totalValue: allAccounts.reduce((sum: number, acc: any) => sum + (acc.totalValue || 0), 0),
      activeAccounts: allAccounts.filter((acc: any) => acc.status === 'ACTIVE').length,
      averageShares: allAccounts.length > 0
        ? allAccounts.reduce((sum: number, acc: any) => sum + (acc.numberOfShares || 0), 0) / allAccounts.length
        : 0,
      averageValue: allAccounts.length > 0
        ? allAccounts.reduce((sum: number, acc: any) => sum + (acc.totalValue || 0), 0) / allAccounts.length
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

