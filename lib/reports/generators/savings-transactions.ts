import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Savings Transactions Report Generator
 * Lists all savings transactions for a period
 */
export class SavingsTransactionsGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Savings Transactions Report',
      'Detailed list of all savings account transactions'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Validate required parameters
    this.validateParameters(params, ['startDate', 'endDate']);

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);

    // Build query
    const where: any = {
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
      account: {
        accountType: {
          isShareAccount: false, hasFixedPeriod: false,
        },
      },
    };

    // Add filters
    if (params.accountId) {
      where.accountId = params.accountId;
    }

    if (params.transactionType) {
      where.type = params.transactionType;
    }

    if (params.tellerId) {
      where.processedByUserId = params.tellerId;
    }

    // Fetch transactions
    const transactions = await db.transaction.findMany({
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
          },
        },
        processedByUser: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        transactionDate: 'desc',
      },
    });

    // Format data
    const reportData = transactions.map(txn => {
      const isDebit = txn.type === 'WITHDRAWAL' || txn.type === 'FEE' || txn.type === 'LOAN_DISBURSEMENT';
      const balanceAfter = txn.account.balance;
      const balanceBefore = isDebit ? balanceAfter + txn.amount : balanceAfter - txn.amount;

      return {
        transactionDate: this.formatDate(txn.transactionDate),
        accountNumber: txn.account.accountNumber,
        memberName: txn.account.member?.user?.name || txn.account.institution?.institutionName || 'N/A',
        accountType: txn.account.accountType.name,
        transactionType: txn.type,
        amount: this.formatCurrency(txn.amount),
        balanceBefore: this.formatCurrency(balanceBefore),
        balanceAfter: this.formatCurrency(balanceAfter),
        reference: txn.transactionRef || 'N/A',
        description: txn.description || 'N/A',
        teller: txn.processedByUser?.name || 'System',
        isReversed: txn.status === 'REVERSED' ? 'Yes' : 'No',
      };
    });

    // Calculate summary by transaction type
    const byType = transactions.reduce((acc, txn) => {
      if (!acc[txn.type]) {
        acc[txn.type] = {
          count: 0,
          total: 0,
        };
      }
      acc[txn.type].count++;
      acc[txn.type].total += txn.amount;
      return acc;
    }, {} as Record<string, any>);

    const typeSummary = Object.entries(byType).map(([type, data]: [string, any]) => ({
      transactionType: type,
      count: data.count,
      total: this.formatCurrency(data.total),
    }));

    // Overall summary
    const summary = {
      periodStart: this.formatDate(startDate),
      periodEnd: this.formatDate(endDate),
      totalTransactions: transactions.length,
      totalDeposits: this.formatCurrency(
        transactions
          .filter(t => t.type === 'DEPOSIT')
          .reduce((sum, t) => sum + t.amount, 0)
      ),
      totalWithdrawals: this.formatCurrency(
        transactions
          .filter(t => t.type === 'WITHDRAWAL')
          .reduce((sum, t) => sum + t.amount, 0)
      ),
      totalInterest: this.formatCurrency(
        transactions
          .filter(t => (t.type as string) === 'INTEREST')
          .reduce((sum, t) => sum + t.amount, 0)
      ),
      reversedTransactions: transactions.filter(t => t.status === 'REVERSED').length,
    };

    return this.buildReportData(
      params,
      { transactions: reportData, typeSummary },
      summary
    );
  }
}
