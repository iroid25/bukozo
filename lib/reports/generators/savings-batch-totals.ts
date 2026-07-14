import ExcelJS from "exceljs";
import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';
import { getBranchFilterForService } from '@/lib/services/financial-reports';
import { format } from "date-fns";

/**
 * Savings Batch Totals Report Generator
 * Summary of savings transaction batches with totals and counts
 */
export class SavingsBatchTotalsGenerator extends BaseReportGenerator {
  constructor() {
    super(
      'Savings Batch Totals Report',
      'Summary of savings transaction batches with totals and counts'
    );
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    // Validate required parameters
    this.validateParameters(params, ['startDate', 'endDate']);

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    const branchFilter = await getBranchFilterForService(params.user, params.branchId);
    const branchId = branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : null;

    // Fetch live transactions for savings accounts
    const where: any = {
      status: 'COMPLETED',
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
      const key = `BATCH-SAVINGS-${dateStr}-${userId}`;
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
          memberName: transaction.account.member?.user?.name || transaction.account.institution?.institutionName || 'N/A',
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

    return this.buildReportData(params, {
      batches: reportData,
    }, summary);
  }
}

function writeLegacyHeader(sheet: ExcelJS.Worksheet, report: any) {
  sheet.columns = [
    { width: 18 },
    { width: 28 },
    { width: 22 },
    { width: 18 },
    { width: 14 },
    { width: 16 },
  ];

  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = report.sacco_name || "BUKONZO UNITED TEACHERS SACCO";
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.mergeCells("A2:F2");
  sheet.getCell("A2").value = report.location || "KISINGA Kasese District";
  sheet.getCell("A2").font = { bold: true, size: 12 };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.mergeCells("A3:F3");
  sheet.getCell("A3").value = report.title || "Savings Batch Totals Report";
  sheet.getCell("A3").font = { bold: true, size: 14, color: { argb: "FF1D4ED8" } };
  sheet.getCell("A3").alignment = { horizontal: "center" };

  sheet.mergeCells("A4:F4");
  sheet.getCell("A4").value = `Reporting Date: ${report.report_date || report.generatedDate || format(new Date(report.generatedAt || Date.now()), "dd/MM/yyyy")}`;
  sheet.getCell("A4").alignment = { horizontal: "center" };

  sheet.mergeCells("A5:F5");
  sheet.getCell("A5").value = `Product: ${report.product_label || "SAVINGS"}`;
  sheet.getCell("A5").alignment = { horizontal: "center" };

  const generatedAt = report.generatedAt ? new Date(report.generatedAt) : new Date();
  sheet.getCell("F1").value = format(generatedAt, "dd/MM/yyyy");
  sheet.getCell("F2").value = format(generatedAt, "HH:mm:ss");
  sheet.getCell("F1").alignment = { horizontal: "right" };
  sheet.getCell("F2").alignment = { horizontal: "right" };
}

export async function buildSavingsBatchTotalsWorkbook(reportData: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BUKONZO UNITED TEACHERS SACCO";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Batch Totals");
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  const report = reportData?.data || reportData;
  const batches = report?.batches || [];

  writeLegacyHeader(sheet, {
    sacco_name: report?.sacco_name || "BUKONZO UNITED TEACHERS SACCO",
    location: report?.location || "KISINGA Kasese District",
    title: report?.title || reportData?.title || "Savings Batch Totals Report",
    report_date: report?.report_date || reportData?.summary?.periodStart || "",
    product_label: report?.product_label || "SAVINGS",
    generatedAt: reportData?.generatedAt,
  });

  const headerRow = sheet.addRow(["A/C No.", "Name", "Bank Verification No./TIN", "Phone", "Ref. No.", "Balance"]);
  headerRow.font = { bold: true, underline: true };
  headerRow.eachCell((cell) => {
    cell.alignment = { horizontal: "center" };
    cell.border = { bottom: { style: "thin" } };
  });

  let currentRow = sheet.lastRow?.number || 0;

  for (const batch of batches) {
    currentRow += 1;
    sheet.getCell(`A${currentRow}`).value = "BATCH:";
    sheet.getCell(`A${currentRow}`).font = { bold: true, color: { argb: "FF1D4ED8" } };

    currentRow += 1;
    let batchTotal = 0;
    let batchCount = 0;

    for (const member of batch.members || []) {
      batchCount += 1;
      const balance = Number(String(member.balance || "0").replace(/[^\d.-]/g, "")) || 0;
      batchTotal += balance;
      sheet.getRow(currentRow).values = [
        member.accountNumber || "",
        member.memberName || "",
        member.bankVerificationNo || "",
        member.phone || "",
        member.refNo || "",
        balance,
      ];
      sheet.getCell(`F${currentRow}`).numFmt = '#,##0;(#,##0)';
      currentRow += 1;
    }

    sheet.getCell(`B${currentRow}`).value = `Total : ${batchCount}`;
    sheet.getCell(`B${currentRow}`).font = { bold: true, color: { argb: "FF1D4ED8" }, underline: true };
    sheet.getCell(`F${currentRow}`).value = batchTotal;
    sheet.getCell(`F${currentRow}`).font = { bold: true, color: { argb: "FF1D4ED8" }, underline: true };
    sheet.getCell(`F${currentRow}`).numFmt = '#,##0;(#,##0)';
    currentRow += 1;
  }

  if (!batches.length) {
    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = "No batch records found.";
    sheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  }

  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 30;
  sheet.getColumn(3).width = 24;
  sheet.getColumn(4).width = 18;
  sheet.getColumn(5).width = 14;
  sheet.getColumn(6).width = 16;

  return workbook.xlsx.writeBuffer();
}
