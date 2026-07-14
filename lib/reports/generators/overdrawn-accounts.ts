import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Overdrawn Accounts Report Generator
 * Lists all savings accounts with negative balance
 */
export class OverdrawnAccountsGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Savings Overdrawn Accounts Status Report',
      'List of savings accounts with negative balance (overdrawn)'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Build query for overdrawn accounts
    const where: any = {
      accountType: {
        isShareAccount: false, hasFixedPeriod: false,
      },
      balance: {
        lt: 0,
      },
    };

    // Add filters
    if (params.branchId) {
      where.branchId = params.branchId;
    }

    if (params.status) {
      where.status = params.status;
    }

    // Fetch overdrawn accounts
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
        balance: 'asc', // Most negative first
      },
    });

    // Format data
    const reportData = accounts.map(account => {
      const overdrawnAmount = Math.abs(account.balance);
      
      return {
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || account.institution?.institutionName || 'N/A',
        memberPhone: account.member?.user?.phone || 'N/A',
        memberEmail: account.member?.user?.email || 'N/A',
        accountType: account.accountType.name,
        branch: account.branch?.name || 'N/A',
        balance: this.formatCurrency(account.balance),
        overdrawnAmount: this.formatCurrency(overdrawnAmount),
        status: account.status,
        openedDate: this.formatDate(account.openedAt),
        lastTransactionDate: this.formatDate(account.openedAt), // fallback to openedAt
      };
    });

    // Calculate summary
    const totalOverdrawn = accounts.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
    const summary = {
      totalOverdrawnAccounts: accounts.length,
      totalOverdrawnAmount: this.formatCurrency(totalOverdrawn),
      averageOverdrawnAmount: this.formatCurrency(
        accounts.length > 0 ? totalOverdrawn / accounts.length : 0
      ),
      largestOverdraft: accounts.length > 0
        ? this.formatCurrency(Math.abs(accounts[0].balance))
        : this.formatCurrency(0),
      activeOverdrawn: accounts.filter(acc => acc.status === 'ACTIVE').length,
    };

    return this.buildReportData(params, reportData, summary);
  }
}

