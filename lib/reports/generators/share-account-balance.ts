import { BaseReportGenerator, ReportData } from '@/lib/reports';
import { db } from '@/prisma/db';
import { getBranchFilterForService } from '@/lib/services/financial-reports';

const ACCOUNT_NAME_TO_PRODUCT: Record<string, string> = {
  "affiliate shares": "300501",
  "ordinary shares": "300502",
  "associate shares": "300503",
};

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

    const [memberAccounts, institutionAccounts] = await Promise.all([
      db.shareAccount.findMany({
        where,
        include: {
          accountType: {
            select: {
              name: true,
              sharePrice: true,
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
        },
      }),
      db.account.findMany({
        where: {
          institutionId: { not: null },
          accountType: { isShareAccount: true },
          ...(branchId ? { branchId } : {}),
          ...(params.status ? { status: params.status } : {}),
        },
        include: {
          accountType: {
            select: {
              name: true,
              sharePrice: true,
            },
          },
          branch: { select: { id: true, name: true } },
          institution: {
            select: {
              institutionNumber: true,
              institutionName: true,
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
        },
      }),
    ]);

    const accounts = [...memberAccounts, ...institutionAccounts.map((a) => ({
      ...a,
      totalValue: a.balance,
      numberOfShares: (a as any).sharesCount || 0,
      member: null,
    }))];

    const byAccountType = accounts.reduce((acc, account) => {
      const typeName = account.accountType.name || "";
      const code = ACCOUNT_NAME_TO_PRODUCT[typeName.toLowerCase().trim()] || account.accountTypeId || typeName;
      const name = typeName || code;
      const sharesCount = account.numberOfShares || 0;
      
      if (!acc[code]) {
        acc[code] = { code, name, accountCount: 0, totalBlocked: 0, totalValue: 0, accounts: [] as any[] };
      }
      const row = {
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || (account as any).institution?.institutionName || "N/A",
        physicalPostalAddress: account.member?.user?.address || (account as any).institution?.user?.address || "",
        refNo: account.member?.memberNumber || (account as any).institution?.institutionNumber || "N/A",
        amountBlocked: 0,
        balance: account.totalValue,
        drCr: account.totalValue >= 0 ? "CR" : "DR",
        phone: account.member?.user?.phone || (account as any).institution?.user?.phone || "",
        bankVerificationNo: account.member?.user?.nationalId || (account as any).institution?.user?.nationalId || null,
        sharesCount,
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
      averageShares: type.accounts.length > 0
        ? Math.round(type.accounts.reduce((sum: number, acc: any) => sum + (acc.sharesCount || 0), 0) / type.accounts.length)
        : 0,
    }));

    const summary = {
      totalAccounts: accounts.length,
      totalShares: accounts.reduce((sum, acc) => sum + (acc.numberOfShares || 0), 0),
      totalValue: this.formatCurrency(accounts.reduce((sum, acc) => sum + acc.totalValue, 0)),
      averageShares: accounts.length > 0 
        ? Math.round(accounts.reduce((sum, acc) => sum + (acc.numberOfShares || 0), 0) / accounts.length)
        : 0,
    };

    return this.buildReportData(params, {
      accountTypeSummary,
      products: Object.values(byAccountType),
      accounts: accounts.map((account) => ({
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || (account as any).institution?.institutionName || "N/A",
        physicalPostalAddress: account.member?.user?.address || (account as any).institution?.user?.address || "",
        refNo: account.member?.memberNumber || (account as any).institution?.institutionNumber || "N/A",
        amountBlocked: 0,
        balance: account.totalValue,
        drCr: account.totalValue >= 0 ? "CR" : "DR",
        phone: account.member?.user?.phone || (account as any).institution?.user?.phone || "",
        bankVerificationNo: account.member?.user?.nationalId || (account as any).institution?.user?.nationalId || null,
        productCode: ACCOUNT_NAME_TO_PRODUCT[(account.accountType.name || "").toLowerCase().trim()] || account.accountTypeId || account.accountType.name,
        productName: account.accountType.name || "",
      })),
      branchLabel: branchId ? accounts[0]?.branch?.name || "Selected Branch" : "All Branches",
    }, summary);
  }
}
