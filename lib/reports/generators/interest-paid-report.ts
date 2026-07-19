import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Interest Paid Report Generator
 * Shows interest payments made to savings accounts (members and institutions)
 */
export class InterestPaidReportGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Savings Interest Paid Report',
      'Summary of interest payments made to savings accounts'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    this.validateParameters(params, ['startDate', 'endDate']);

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);

    const dateFilter = {
      gte: startDate,
      lte: endDate,
    };

    const [savingsTransactions, genericTransactions] = await Promise.all([
      db.savingsTransaction.findMany({
        where: {
          transactionType: 'INTEREST',
          transactionDate: dateFilter,
          isReversed: false,
        },
        include: {
          account: {
            include: {
              member: {
                include: {
                  user: {
                    select: { name: true },
                  },
                },
              },
              accountType: {
                select: { name: true, interestRate: true },
              },
              branch: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { transactionDate: 'desc' },
      }),
      db.transaction.findMany({
        where: {
          type: 'OTHER',
          status: 'COMPLETED',
          transactionDate: dateFilter,
          description: { contains: 'interest', mode: 'insensitive' },
        },
        include: {
          account: {
            include: {
              member: {
                include: {
                  user: {
                    select: { name: true },
                  },
                },
              },
              institution: {
                select: {
                  id: true,
                  institutionName: true,
                  user: {
                    select: { name: true },
                  },
                },
              },
              accountType: {
                select: { name: true, interestRate: true },
              },
              branch: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { transactionDate: 'desc' },
      }),
    ]);

    const byAccount: Record<string, any> = {};

    for (const txn of savingsTransactions) {
      const accountNumber = txn.account.accountNumber;
      if (!byAccount[accountNumber]) {
        byAccount[accountNumber] = {
          accountNumber,
          ownerName: txn.account.member?.user?.name || 'N/A',
          accountType: txn.account.accountType.name,
          interestRate: txn.account.accountType.interestRate,
          branch: txn.account.branch?.name || 'N/A',
          totalInterest: 0,
          paymentCount: 0,
          payments: [],
        };
      }
      byAccount[accountNumber].totalInterest += txn.amount;
      byAccount[accountNumber].paymentCount++;
      byAccount[accountNumber].payments.push({
        date: this.formatDate(txn.transactionDate),
        amount: this.formatCurrency(txn.amount),
        balance: this.formatCurrency(txn.balanceAfter),
      });
    }

    for (const txn of genericTransactions) {
      const accountNumber = txn.account.accountNumber;
      if (!byAccount[accountNumber]) {
        const inst = txn.account.institution;
        byAccount[accountNumber] = {
          accountNumber,
          ownerName: inst
            ? inst.institutionName || inst.user?.name || 'N/A'
            : txn.account.member?.user?.name || 'N/A',
          accountType: txn.account.accountType.name,
          interestRate: txn.account.accountType.interestRate,
          branch: txn.account.branch?.name || 'N/A',
          totalInterest: 0,
          paymentCount: 0,
          payments: [],
        };
      }
      byAccount[accountNumber].totalInterest += txn.amount;
      byAccount[accountNumber].paymentCount++;
      byAccount[accountNumber].payments.push({
        date: this.formatDate(txn.transactionDate),
        amount: this.formatCurrency(txn.amount),
        balance: '-',
      });
    }

    const reportData = Object.values(byAccount).map((account: any) => ({
      accountNumber: account.accountNumber,
      memberName: account.ownerName,
      accountType: account.accountType,
      interestRate: `${account.interestRate}%`,
      branch: account.branch,
      totalInterest: this.formatCurrency(account.totalInterest),
      paymentCount: account.paymentCount,
      averagePayment: this.formatCurrency(account.totalInterest / account.paymentCount),
    }));

    const totalInterestPaid = Object.values(byAccount).reduce(
      (sum: number, account: any) => sum + account.totalInterest,
      0,
    );
    const totalPayments = Object.values(byAccount).reduce(
      (sum: number, account: any) => sum + account.paymentCount,
      0,
    );

    const summary = {
      periodStart: this.formatDate(startDate),
      periodEnd: this.formatDate(endDate),
      totalAccounts: Object.keys(byAccount).length,
      totalInterestPaid: this.formatCurrency(totalInterestPaid),
      totalBalance: this.formatCurrency(totalInterestPaid),
      totalPayments,
      averageInterestPerAccount: this.formatCurrency(
        Object.keys(byAccount).length > 0
          ? totalInterestPaid / Object.keys(byAccount).length
          : 0
      ),
    };

    return this.buildReportData(params, reportData, summary);
  }
}
