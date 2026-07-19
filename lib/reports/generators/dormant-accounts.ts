import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Dormant Accounts Report Generator
 * Lists all dormant savings accounts
 */
export class DormantAccountsGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Dormant Accounts Report',
      'List of savings accounts marked as dormant or inactive for extended period'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Calculate dormancy threshold (default: 6 months)
    const dormancyMonths = params.dormancyMonths || 6;
    const dormancyDate = new Date();
    dormancyDate.setMonth(dormancyDate.getMonth() - dormancyMonths);

    // Build query
    const where: any = {
      status: 'DORMANT',
      accountType: {
        isShareAccount: false, hasFixedPeriod: false,
      },
    };

    // Add branch filter if provided
    if (params.branchId) {
      where.branchId = params.branchId;
    }

    // Fetch dormant accounts
    const accounts = await db.account.findMany({
      where,
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        institution: {
          select: {
            institutionName: true,
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
        openedAt: 'asc',
      },
    });

    // Calculate days since last transaction
    const today = new Date();
    const reportData = await Promise.all(accounts.map(async (account) => {
      // Query actual last transaction date from Transaction model
      const lastTxn = await db.transaction.findFirst({
        where: { accountId: account.id, status: 'COMPLETED' },
        orderBy: { transactionDate: 'desc' },
        select: { transactionDate: true },
      });
      const lastActivity = lastTxn?.transactionDate || account.openedAt;
      const daysSinceActivity = Math.floor(
        (today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || account.institution?.institutionName || 'N/A',
        memberPhone: account.member?.user?.phone || 'N/A',
        accountType: account.accountType.name,
        branch: account.branch?.name || 'N/A',
        balance: this.formatCurrency(account.balance),
        isDormant: 'Yes',
        lastTransactionDate: this.formatDate(lastActivity),
        daysSinceActivity,
        openedDate: this.formatDate(account.openedAt),
        status: account.status,
      };
    }));

    // Count accounts that have never transacted
    const accountIds = accounts.map(a => a.id);
    const txnCounts = await db.transaction.groupBy({
      by: ['accountId'],
      where: { accountId: { in: accountIds }, status: 'COMPLETED' },
      _count: { id: true },
    });
    const accountsWithTxns = new Set(txnCounts.map(tc => tc.accountId));

    // Calculate summary
    const summary = {
      totalDormantAccounts: accounts.length,
      totalBalanceInDormant: accounts.reduce((sum, acc) => sum + acc.balance, 0),
      averageBalance: accounts.length > 0
        ? accounts.reduce((sum, acc) => sum + acc.balance, 0) / accounts.length
        : 0,
      dormancyThresholdDays: dormancyMonths * 30,
      accountsNeverTransacted: accounts.filter(a => !accountsWithTxns.has(a.id)).length,
    };

    // Format summary
    const formattedSummary = {
      totalDormantAccounts: summary.totalDormantAccounts,
      totalBalanceInDormant: this.formatCurrency(summary.totalBalanceInDormant),
      averageBalance: this.formatCurrency(summary.averageBalance),
      dormancyThresholdDays: summary.dormancyThresholdDays,
      accountsNeverTransacted: summary.accountsNeverTransacted,
    };

    return this.buildReportData(params, reportData, formattedSummary);
  }
}
