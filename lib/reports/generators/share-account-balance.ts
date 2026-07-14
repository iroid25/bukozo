import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';
import { getBranchFilterForService } from '@/lib/services/financial-reports';

export class ShareAccountBalanceGenerator extends BaseReportGenerator {
  constructor() {
    super('Share Account Balance Report', 'Summary of share account balances and holdings');
  }

  async generateData(params: Record<string, any>): Promise<ReportData> {
    const branchFilter = await getBranchFilterForService(params.user, params.branchId);
    const branchId = branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : undefined;
    
    const where: any = {
      accountType: {
        isShareAccount: true,
      },
    };
    
    if (branchId) where.branchId = branchId;
    if (params.status) where.status = params.status;

    // Query Account model (includes both member and institution share accounts)
    const accounts = await db.account.findMany({
      where,
      include: {
        accountType: {
          select: {
            name: true,
            sharePrice: true,
            ledgerAccount: {
              select: {
                accountCode: true,
                accountName: true,
              },
            },
          },
        },
        branch: { select: { id: true, name: true } },
        member: {
          select: {
            memberNumber: true,
            user: {
              select: {
                name: true,
                phone: true,
                address: true,
                nationalId: true,
              },
            },
          },
        },
        institution: {
          select: {
            institutionName: true,
            institutionNumber: true,
          },
        },
      },
    });

    const byAccountType = accounts.reduce((acc, account) => {
      const code = account.accountType.ledgerAccount?.accountCode || account.accountNumber.split(".")[0] || account.accountType.name;
      const name = account.accountType.ledgerAccount?.accountName || account.accountType.name;
      const sharesCount = account.sharesCount || 0;
      
      if (!acc[code]) {
        acc[code] = { code, name, accountCount: 0, totalBlocked: 0, totalValue: 0, accounts: [] as any[] };
      }
      const row = {
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || account.institution?.institutionName || "N/A",
        physicalPostalAddress: account.member?.user?.address || "",
        refNo: account.member?.memberNumber || account.institution?.institutionNumber || "N/A",
        amountBlocked: 0,
        balance: account.balance,
        drCr: account.balance >= 0 ? "CR" : "DR",
        phone: account.member?.user?.phone || "",
        bankVerificationNo: account.member?.user?.nationalId || null,
      };
      acc[code].accountCount++;
      acc[code].totalBlocked += row.amountBlocked;
      acc[code].totalValue += row.balance;
      acc[code].accounts.push(row);
      return acc;
    }, {} as Record<string, any>);

    const accountTypeSummary = Object.values(byAccountType).map((type: any) => ({
      accountType: `${type.code} - ${type.name}`,
      accountCount: type.accountCount,
      totalBlocked: this.formatCurrency(type.totalBlocked),
      totalValue: this.formatCurrency(type.totalValue),
      averageShares: 0,
    }));

    const summary = {
      totalAccounts: accounts.length,
      totalShares: accounts.reduce((sum, acc) => sum + (acc.sharesCount || 0), 0),
      totalValue: this.formatCurrency(accounts.reduce((sum, acc) => sum + acc.balance, 0)),
      averageShares: accounts.length > 0 
        ? Math.round(accounts.reduce((sum, acc) => sum + (acc.sharesCount || 0), 0) / accounts.length)
        : 0,
    };

    return this.buildReportData(params, {
      accountTypeSummary,
      products: Object.values(byAccountType),
      accounts: accounts.map((account) => ({
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || account.institution?.institutionName || "N/A",
        physicalPostalAddress: account.member?.user?.address || "",
        refNo: account.member?.memberNumber || account.institution?.institutionNumber || "N/A",
        amountBlocked: 0,
        balance: account.balance,
        drCr: account.balance >= 0 ? "CR" : "DR",
        phone: account.member?.user?.phone || "",
        bankVerificationNo: account.member?.user?.nationalId || null,
        productCode: account.accountType.ledgerAccount?.accountCode || account.accountNumber.split(".")[0] || account.accountType.name,
        productName: account.accountType.ledgerAccount?.accountName || account.accountType.name,
      })),
      branchLabel: branchId ? accounts[0]?.branch?.name || "Selected Branch" : "All Branches",
    }, summary);
  }
}
