import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';

/**
 * Share Account Statement Generator
 * Individual account statement with transaction history
 */
export class ShareAccountStatementGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Share Account Statement',
      'Detailed statement for a specific share account with transaction history'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Validate required parameters
    this.validateParameters(params, ['accountId', 'startDate', 'endDate']);

    const accountId = params.accountId;
    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);

    // Fetch account details and transactions up to endDate
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
                address: true,
              },
            },
          },
        },
        accountType: {
          select: {
            name: true,
            sharePrice: true,
          },
        },
        branch: {
          select: {
            name: true,
            location: true,
          },
        },
        transactions: {
          where: {
            status: {
              in: ['COMPLETED', 'APPROVED'],
            },
            transactionDate: {
              lte: endDate,
            },
          },
          orderBy: {
            transactionDate: 'asc',
          },
          include: {
            processedByUser: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const sharePrice = account.accountType.sharePrice || 10000;
    let runningShares = 0;

    // Map and compute running shares count over all transactions up to endDate
    const allFormattedTransactions = account.transactions.map((txn: any) => {
      const isCredit = txn.type === 'DEPOSIT' || txn.type === 'SHARES_PURCHASE';
      const isDebit = txn.type === 'WITHDRAWAL' || txn.type === 'FEE' || txn.type === 'LOAN_DISBURSEMENT';
      
      const shares = txn.amount / sharePrice;
      const sharesBefore = runningShares;
      if (isCredit) {
        runningShares += shares;
      } else {
        runningShares -= shares;
      }
      const sharesAfter = runningShares;

      return {
        rawDate: txn.transactionDate,
        date: this.formatDate(txn.transactionDate),
        type: txn.type === 'SHARES_PURCHASE' ? 'PURCHASE' : txn.type,
        reference: txn.transactionRef || 'N/A',
        description: txn.description || 'N/A',
        shares,
        pricePerShare: this.formatCurrency(sharePrice),
        amount: this.formatCurrency(txn.amount),
        sharesBefore,
        sharesAfter,
        teller: txn.processedByUser?.name || 'System',
        isCredit,
        rawAmount: txn.amount,
      };
    });

    // Filter to show only transactions within the requested date range
    const periodTransactions = allFormattedTransactions.filter(
      (txn: any) => txn.rawDate >= startDate
    );

    // Format account information
    const accountInfo = {
      accountNumber: account.accountNumber,
      accountType: account.accountType.name,
      memberName: account.member?.user?.name || 'N/A',
      memberPhone: account.member?.user?.phone || 'N/A',
      memberEmail: account.member?.user?.email || 'N/A',
      memberAddress: account.member?.user?.address || 'N/A',
      branch: account.branch?.name || 'N/A',
      currentShares: account.sharesCount || 0,
      currentValue: this.formatCurrency(account.balance),
      openedDate: this.formatDate(account.openedAt),
      status: account.status,
    };

    // Format period transactions for the report view
    const transactions = periodTransactions.map((txn: any) => ({
      date: txn.date,
      type: txn.type,
      reference: txn.reference,
      description: txn.description,
      shares: txn.shares,
      pricePerShare: txn.pricePerShare,
      amount: txn.amount,
      sharesBefore: txn.sharesBefore,
      sharesAfter: txn.sharesAfter,
      teller: txn.teller,
    }));

    // Calculate summaries for the period
    const totalPurchases = periodTransactions
      .filter((t: any) => t.isCredit)
      .reduce((sum: number, t: any) => sum + t.rawAmount, 0);

    const totalSales = periodTransactions
      .filter((t: any) => !t.isCredit)
      .reduce((sum: number, t: any) => sum + t.rawAmount, 0);

    const sharesPurchased = periodTransactions
      .filter((t: any) => t.isCredit)
      .reduce((sum: number, t: any) => sum + t.shares, 0);

    const sharesSold = periodTransactions
      .filter((t: any) => !t.isCredit)
      .reduce((sum: number, t: any) => sum + t.shares, 0);

    const openingShares = periodTransactions.length > 0
      ? periodTransactions[0].sharesBefore
      : runningShares;

    const closingShares = periodTransactions.length > 0
      ? periodTransactions[periodTransactions.length - 1].sharesAfter
      : runningShares;

    const summary = {
      statementPeriod: `${this.formatDate(startDate)} to ${this.formatDate(endDate)}`,
      openingShares,
      closingShares,
      totalPurchases: this.formatCurrency(totalPurchases),
      totalSales: this.formatCurrency(totalSales),
      sharesPurchased,
      sharesSold,
      transactionCount: periodTransactions.length,
    };

    return this.buildReportData(
      params,
      {
        accountInfo,
        transactions,
      },
      summary
    );
  }
}

