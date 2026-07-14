import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';
import { ReportQueryBuilder } from '@/lib/reports/query-builder';

/**
 * Savings Account Listing Report Generator
 * Lists all savings accounts with their current balances and status
 */
export class SavingsAccountListingGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Savings Account Listing',
      'Complete listing of all savings accounts with balances and status'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Build query filters
    const where: any = {
      accountType: {
        isShareAccount: false, hasFixedPeriod: false,
      },
    };

    // Branch filter
    if (params.branchId) {
      where.branchId = params.branchId;
    }

    // Status filter
    if (params.status) {
      where.status = params.status;
    }

    // Account type filter
    if (params.accountTypeId) {
      where.accountTypeId = params.accountTypeId;
    }

    // Dormant accounts filter
    if (params.isDormant !== undefined) {
      if (params.isDormant) {
        where.status = 'DORMANT';
      } else {
        where.status = { not: 'DORMANT' };
      }
    }

    // Fetch accounts
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
            interestRate: true,
          },
        },
        accountHolds: {
          where: {
            isActive: true,
          },
        },
        branch: {
          select: {
            name: true,
            location: true,
          },
        },
      },
      orderBy: {
        accountNumber: 'asc',
      },
    });

    // Format data for report
    const reportData = accounts.map(account => {
      const hasActiveHold = account.accountHolds && account.accountHolds.length > 0;
      const availableBalance = hasActiveHold ? 0 : account.balance;
      const isDormant = account.status === 'DORMANT';
      const isOverdrawn = account.balance < 0;

      return {
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || account.institution?.institutionName || 'N/A',
        memberPhone: account.member?.user?.phone || 'N/A',
        accountType: account.accountType.name,
        branch: account.branch?.name || 'N/A',
        balance: this.formatCurrency(account.balance),
        availableBalance: this.formatCurrency(availableBalance),
        status: account.status,
        isDormant: isDormant ? 'Yes' : 'No',
        isOverdrawn: isOverdrawn ? 'Yes' : 'No',
        openedDate: this.formatDate(account.openedAt),
        lastTransactionDate: this.formatDate(account.openedAt), // fallback to openedAt
      };
    });

    // Calculate summary
    const summary = {
      totalAccounts: accounts.length,
      totalBalance: accounts.reduce((sum, acc) => sum + acc.balance, 0),
      activeAccounts: accounts.filter(acc => acc.status === 'ACTIVE').length,
      dormantAccounts: accounts.filter(acc => acc.status === 'DORMANT').length,
      overdrawnAccounts: accounts.filter(acc => acc.balance < 0).length,
      averageBalance: accounts.length > 0
        ? accounts.reduce((sum, acc) => sum + acc.balance, 0) / accounts.length
        : 0,
    };

    // Format summary
    const formattedSummary = {
      totalAccounts: summary.totalAccounts,
      totalBalance: this.formatCurrency(summary.totalBalance),
      activeAccounts: summary.activeAccounts,
      dormantAccounts: summary.dormantAccounts,
      overdrawnAccounts: summary.overdrawnAccounts,
      averageBalance: this.formatCurrency(summary.averageBalance),
    };

    return this.buildReportData(params, reportData, formattedSummary);
  }
}
