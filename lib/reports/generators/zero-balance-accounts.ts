import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Zero Balance Accounts Report Generator
 * Lists all savings accounts with zero or near-zero balance
 */
export class ZeroBalanceAccountsGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Savings Zero Balance Report',
      'List of savings accounts with zero or minimal balance'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Define zero balance threshold (default: 0, can be small amount like 100)
    const balanceThreshold = params.balanceThreshold || 0;

    // Build query
    const where: any = {
      accountType: {
        isShareAccount: false, hasFixedPeriod: false,
      },
      balance: {
        lte: balanceThreshold,
      },
    };

    // Add filters
    if (params.branchId) {
      where.branchId = params.branchId;
    }

    if (params.status) {
      where.status = params.status;
    }

    // Fetch zero balance accounts
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
        transactions: {
          select: {
            transactionDate: true,
          },
          orderBy: {
            transactionDate: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        balance: 'asc',
      },
    });

    // Format data - filter out CLOSED accounts by default unless explicitly filtered for
    const filteredAccounts = params.status
      ? accounts
      : accounts.filter(acc => acc.status !== 'CLOSED');

    const reportData = filteredAccounts.map(account => {
      const lastTx = account.transactions?.[0];
      const lastTxDate = lastTx ? lastTx.transactionDate : account.openedAt;

      return {
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || 'N/A',
        memberPhone: account.member?.user?.phone || 'N/A',
        accountType: account.accountType.name,
        branch: account.branch?.name || 'N/A',
        balance: this.formatCurrency(account.balance),
        status: account.status,
        isDormant: account.status === 'DORMANT' ? 'Yes' : 'No',
        openedDate: this.formatDate(account.openedAt),
        lastTransactionDate: this.formatDate(lastTxDate),
      };
    });

    // Calculate summary based on all zero balance accounts
    const summary = {
      totalZeroBalanceAccounts: accounts.length,
      exactlyZero: accounts.filter(acc => acc.balance === 0).length,
      nearZero: accounts.filter(acc => acc.balance > 0 && acc.balance <= balanceThreshold).length,
      activeZeroBalance: accounts.filter(acc => acc.status === 'ACTIVE').length,
      closedZeroBalance: accounts.filter(acc => acc.status === 'CLOSED').length,
      balanceThreshold: this.formatCurrency(balanceThreshold),
    };

    return this.buildReportData(params, reportData, summary);
  }
}

