import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Interest Paid Report Generator
 * Shows interest payments made to savings accounts
 */
export class InterestPaidReportGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Savings Interest Paid Report',
      'Summary of interest payments made to savings accounts'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Validate required parameters
    this.validateParameters(params, ['startDate', 'endDate']);

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);

    // Build query for interest transactions
    const where: any = {
      transactionType: 'INTEREST',
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Fetch interest transactions
    const transactions = await db.savingsTransaction.findMany({
      where,
      include: {
        account: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            accountType: {
              select: {
                name: true,
                interestRate: true,
              },
            },
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        transactionDate: 'desc',
      },
    });

    // Group by account
    const byAccount = transactions.reduce((acc, txn) => {
      const accountNumber = txn.account.accountNumber;
      if (!acc[accountNumber]) {
        acc[accountNumber] = {
          accountNumber,
          memberName: txn.account.member?.user?.name || 'N/A',
          accountType: txn.account.accountType.name,
          interestRate: txn.account.accountType.interestRate,
          branch: txn.account.branch?.name || 'N/A',
          totalInterest: 0,
          paymentCount: 0,
          payments: [],
        };
      }
      acc[accountNumber].totalInterest += txn.amount;
      acc[accountNumber].paymentCount++;
      acc[accountNumber].payments.push({
        date: this.formatDate(txn.transactionDate),
        amount: this.formatCurrency(txn.amount),
        balance: this.formatCurrency(txn.balanceAfter),
      });
      return acc;
    }, {} as Record<string, any>);

    // Format report data
    const reportData = Object.values(byAccount).map((account: any) => ({
      accountNumber: account.accountNumber,
      memberName: account.memberName,
      accountType: account.accountType,
      interestRate: `${account.interestRate}%`,
      branch: account.branch,
      totalInterest: this.formatCurrency(account.totalInterest),
      paymentCount: account.paymentCount,
      averagePayment: this.formatCurrency(account.totalInterest / account.paymentCount),
    }));

    // Calculate summary
    const totalInterestPaid = transactions.reduce((sum, txn) => sum + txn.amount, 0);
    const summary = {
      periodStart: this.formatDate(startDate),
      periodEnd: this.formatDate(endDate),
      totalAccounts: Object.keys(byAccount).length,
      totalInterestPaid: this.formatCurrency(totalInterestPaid),
      totalBalance: this.formatCurrency(totalInterestPaid), // alias for shared summary card
      totalPayments: transactions.length,
      averageInterestPerAccount: this.formatCurrency(
        Object.keys(byAccount).length > 0
          ? totalInterestPaid / Object.keys(byAccount).length
          : 0
      ),
    };

    return this.buildReportData(params, reportData, summary);
  }
}
