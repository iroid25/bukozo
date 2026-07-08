import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Savings Account Balance Report Generator
 * Shows balance summary for all savings accounts
 */
export class SavingsAccountBalanceGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Savings Account Balance Report',
      'Summary of savings account balances grouped by account type and branch'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Validate date parameters if provided
    const asOfDate = params.asOfDate ? new Date(params.asOfDate) : new Date();

    // Build query filters
    const where: any = {
      accountType: {
        isShareAccount: false, hasFixedPeriod: false,
      },
    };

    if (params.branchId) {
      where.branchId = params.branchId;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.accountTypeId) {
      where.accountTypeId = params.accountTypeId;
    }

    // Fetch accounts with aggregations
    const accounts = await db.account.findMany({
      where,
      include: {
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
        accountHolds: {
          where: {
            isActive: true,
          },
        },
        member: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Group by account type
    const byAccountType = accounts.reduce((acc, account) => {
      const typeName = account.accountType.name;
      const hasActiveHold = account.accountHolds && account.accountHolds.length > 0;
      const holdAmount = hasActiveHold ? account.balance : 0;
      const availableBalance = hasActiveHold ? 0 : account.balance;

      if (!acc[typeName]) {
        acc[typeName] = {
          accountType: typeName,
          accountCount: 0,
          totalBalance: 0,
          totalAvailableBalance: 0,
          totalHoldAmount: 0,
          accounts: [],
        };
      }
      acc[typeName].accountCount++;
      acc[typeName].totalBalance += account.balance;
      acc[typeName].totalAvailableBalance += availableBalance;
      acc[typeName].totalHoldAmount += holdAmount;
      acc[typeName].accounts.push({
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || "N/A",
        balance: this.formatCurrency(account.balance),
        availableBalance: this.formatCurrency(availableBalance),
        minBalance: this.formatCurrency(holdAmount),
        status: account.status,
      });
      return acc;
    }, {} as Record<string, any>);

    // Format account type summary
    const accountTypeSummary = Object.values(byAccountType).map((type: any) => ({
      accountType: type.accountType,
      accountCount: type.accountCount,
      totalBalance: this.formatCurrency(type.totalBalance),
      totalAvailableBalance: this.formatCurrency(type.totalAvailableBalance),
      totalHoldAmount: this.formatCurrency(type.totalHoldAmount),
      averageBalance: this.formatCurrency(type.totalBalance / type.accountCount),
    }));

    // Group by branch if applicable
    const byBranch = accounts.reduce((acc, account) => {
      const branchName = account.branch?.name || 'No Branch';
      if (!acc[branchName]) {
        acc[branchName] = {
          branch: branchName,
          accountCount: 0,
          totalBalance: 0,
        };
      }
      acc[branchName].accountCount++;
      acc[branchName].totalBalance += account.balance;
      return acc;
    }, {} as Record<string, any>);

    const branchSummary = Object.values(byBranch).map((branch: any) => ({
      branch: branch.branch,
      accountCount: branch.accountCount,
      totalBalance: this.formatCurrency(branch.totalBalance),
      averageBalance: this.formatCurrency(branch.totalBalance / branch.accountCount),
    }));

    // Calculate overall summary
    const totalBalanceVal = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalHoldVal = accounts.reduce((sum, acc) => {
      const hasActiveHold = acc.accountHolds && acc.accountHolds.length > 0;
      return sum + (hasActiveHold ? acc.balance : 0);
    }, 0);
    const totalAvailableVal = totalBalanceVal - totalHoldVal;

    const summary = {
      asOfDate: this.formatDate(asOfDate),
      totalAccounts: accounts.length,
      totalBalance: this.formatCurrency(totalBalanceVal),
      totalAvailableBalance: this.formatCurrency(totalAvailableVal),
      totalHoldAmount: this.formatCurrency(totalHoldVal),
      averageBalance: this.formatCurrency(
        accounts.length > 0 ? totalBalanceVal / accounts.length : 0
      ),
    };

    return this.buildReportData(
      params,
      {
        accountTypeSummary,
        branchSummary,
        detailedAccounts: Object.values(byAccountType).flatMap((type: any) => type.accounts),
      },
      summary
    );
  }
}
