import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';
import { getBranchFilterForService } from '@/lib/services/financial-reports';
import { format } from "date-fns";

/**
 * Share Batch Totals Report Generator
 * Summary of transaction batches
 */
export class ShareBatchTotalsGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Share Batch Totals Report',
      'Summary of share transaction batches with totals and counts'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Validate required parameters
    this.validateParameters(params, ['startDate', 'endDate']);

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    const branchFilter = await getBranchFilterForService(params.user, params.branchId);
    const branchId = branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : null;

    // Fetch live transactions for share accounts
    const where: any = {
      status: 'COMPLETED',
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
      account: {
        accountType: {
          isShareAccount: true,
        },
      },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    if (params.tellerId) {
      where.processedByUserId = params.tellerId;
    }

    const transactions = await db.transaction.findMany({
      where,
      include: {
        account: {
          include: {
            member: {
              select: {
                memberNumber: true,
                user: {
                  select: {
                    name: true,
                    phone: true,
                    nationalId: true,
                    address: true,
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
          },
        },
        processedByUser: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        transactionDate: 'asc',
      },
    });

    // Group transactions by processor and date to form virtual batches
    const grouped: Record<string, typeof transactions> = {};
    for (const txn of transactions) {
      const dateStr = format(txn.transactionDate, 'yyyy-MM-dd');
      const userId = txn.processedByUserId || 'system';
      const key = `BATCH-SHARES-${dateStr}-${userId}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(txn);
    }

    // Format virtual batches
    const reportData = Object.entries(grouped).map(([batchNumber, txns]) => {
      const representative = txns[0];
      const processorName = representative.processedByUser?.name || 'System';
      // extract date part
      const parts = batchNumber.split('-');
      const dateStr = `${parts[2]}-${parts[3]}-${parts[4]}`;
      const totalAmount = txns.reduce((sum, t) => sum + t.amount, 0);

      return {
        batchNumber,
        processedDate: this.formatDate(new Date(dateStr)),
        processor: processorName,
        approver: 'System',
        approvedDate: this.formatDate(new Date(dateStr)),
        status: 'POSTED',
        totalTransactions: txns.length,
        totalAmount: this.formatCurrency(totalAmount),
        averageTransaction: this.formatCurrency(totalAmount / txns.length),
        members: txns.map((transaction) => ({
          accountNumber: transaction.account.accountNumber,
          memberName: transaction.account.member?.user?.name || 'N/A',
          phone: transaction.account.member?.user?.phone || '',
          bankVerificationNo: transaction.account.member?.user?.nationalId || null,
          refNo: transaction.account.member?.memberNumber || 'N/A',
          balance: this.formatCurrency(transaction.account.balance),
          transactionAmount: this.formatCurrency(transaction.amount),
          teller: processorName,
        })),
        rawTotalAmount: totalAmount,
      };
    });

    const totalAmountSum = reportData.reduce((sum, b) => sum + b.rawTotalAmount, 0);
    const totalTxnCount = reportData.reduce((sum, b) => sum + b.totalTransactions, 0);

    // Overall summary
    const summary = {
      periodStart: this.formatDate(startDate),
      periodEnd: this.formatDate(endDate),
      totalBatches: reportData.length,
      totalTransactions: totalTxnCount,
      totalAmount: this.formatCurrency(totalAmountSum),
      pendingBatches: 0,
      approvedBatches: 0,
      postedBatches: reportData.length,
      rejectedBatches: 0,
      statusBreakdown: [
        {
          status: 'POSTED',
          batchCount: reportData.length,
          totalAmount: this.formatCurrency(totalAmountSum),
          totalTransactions: totalTxnCount,
        }
      ],
    };

    return this.buildReportData(params, reportData, summary);
  }
}

