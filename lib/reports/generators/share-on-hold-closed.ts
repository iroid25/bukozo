import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Share Accounts On Hold/Closed Status Generator
 * Lists accounts with ON_HOLD or CLOSED status
 */
export class ShareOnHoldClosedGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Share Accounts On Hold/Closed Status Report',
      'List of share accounts that are on hold, closed, or frozen'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Build query for on hold or closed accounts
    const where: any = {
      accountType: {
        isShareAccount: true,
      },
      OR: [
        {
          status: {
            in: ['INACTIVE', 'CLOSED', 'SUSPENDED'],
          },
        },
        {
          accountHolds: {
            some: {
              isActive: true,
            },
          },
        },
      ],
    };

    // Add filters
    if (params.branchId) {
      where.branchId = params.branchId;
    }

    if (params.specificStatus) {
      delete where.OR;
      if (params.specificStatus === 'ON_HOLD' || params.specificStatus === 'FROZEN') {
        where.accountHolds = {
          some: {
            isActive: true,
          },
        };
      } else {
        where.status = params.specificStatus;
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
          },
        },
      },
      orderBy: [
        { status: 'asc' },
      ],
    });

    // Format data
    const reportData = accounts.map(account => {
      const sharesCount = account.sharesCount || 0;
      const hasActiveHold = account.accountHolds && account.accountHolds.length > 0;
      const displayStatus = hasActiveHold ? 'ON_HOLD' : account.status;
      
      return {
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || account.institution?.institutionName || 'N/A',
        memberPhone: account.member?.user?.phone || 'N/A',
        accountType: account.accountType.name,
        branch: account.branch?.name || 'N/A',
        numberOfShares: sharesCount,
        totalValue: this.formatCurrency(account.balance),
        status: displayStatus,
        openedDate: this.formatDate(account.openedAt),
        closedDate: account.closedAt ? this.formatDate(account.closedAt) : 'N/A',
        lastTransactionDate: this.formatDate(account.openedAt), // fallback
      };
    });

    // Group by status
    const byStatus = accounts.reduce((acc, account) => {
      const sharesCount = account.sharesCount || 0;
      const hasActiveHold = account.accountHolds && account.accountHolds.length > 0;
      const displayStatus = hasActiveHold ? 'ON_HOLD' : account.status;

      if (!acc[displayStatus]) {
        acc[displayStatus] = {
          count: 0,
          totalValue: 0,
          totalShares: 0,
        };
      }
      acc[displayStatus].count++;
      acc[displayStatus].totalValue += account.balance;
      acc[displayStatus].totalShares += sharesCount;
      return acc;
    }, {} as Record<string, any>);

    const statusSummary = Object.entries(byStatus).map(([status, data]: [string, any]) => ({
      status,
      count: data.count,
      totalShares: data.totalShares,
      totalValue: this.formatCurrency(data.totalValue),
    }));

    const summary = {
      totalAccounts: accounts.length,
      totalShares: accounts.reduce((sum, acc) => sum + (acc.sharesCount || 0), 0),
      totalValue: this.formatCurrency(
        accounts.reduce((sum, acc) => sum + acc.balance, 0)
      ),
      statusBreakdown: statusSummary,
    };

    return this.buildReportData(params, reportData, summary);
  }
}

