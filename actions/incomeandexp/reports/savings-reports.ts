// ============================================================================
// actions/reports/savings-reports.ts - Savings Account Reports
// ============================================================================
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, AccountStatus } from "@prisma/client";

// Helper function to get branch filter
async function getBranchFilter() {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  if (user.role === UserRole.ADMIN) return {};
  if (!user.branchId) return { branchId: "no-branch" };
  return { branchId: user.branchId };
}

// ============================================================================
// 1. SAVINGS ACCOUNT STATEMENT
// ============================================================================
export async function getSavingsAccountStatement(
  accountId: string,
  startDate: Date,
  endDate: Date
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        accountType: true,
        member: {
          select: {
            memberNumber: true,
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        branch: true,
      },
    });

    if (!account) {
      return { error: "Account not found", data: null };
    }

    const transactions = await db.transaction.findMany({
      where: {
        accountId,
        transactionDate: { gte: startDate, lte: endDate },
        status: "COMPLETED",
      },
      include: {
        deposit: true,
        withdrawal: true,
        processedByUser: { select: { name: true } },
      },
      orderBy: { transactionDate: "asc" },
    });

    let runningBalance = account.balance;
    const transactionsWithBalance = transactions.map((t) => {
      const amount = t.amount;
      const isCredit = t.type === "DEPOSIT";
      runningBalance = isCredit
        ? runningBalance + amount
        : runningBalance - amount;

      return {
        date: t.transactionDate,
        reference: t.transactionRef,
        description: t.description,
        debit: !isCredit ? amount : 0,
        credit: isCredit ? amount : 0,
        balance: runningBalance,
        processedBy: t.processedByUser?.name,
      };
    });

    return {
      error: null,
      data: {
        reportType: "Savings Account Statement",
        period: { startDate, endDate },
        account: {
          accountNumber: account.accountNumber,
          accountType: account.accountType.name,
          memberName: account.member?.user.name,
          memberNumber: account.member?.memberNumber,
          branch: account.branch.name,
          currentBalance: account.balance,
        },
        transactions: transactionsWithBalance,
        summary: {
          openingBalance:
            account.balance -
            transactions.reduce(
              (sum, t) => sum + (t.type === "DEPOSIT" ? t.amount : -t.amount),
              0
            ),
          totalDebits: transactions
            .filter((t) => t.type === "WITHDRAWAL")
            .reduce((sum, t) => sum + t.amount, 0),
          totalCredits: transactions
            .filter((t) => t.type === "DEPOSIT")
            .reduce((sum, t) => sum + t.amount, 0),
          closingBalance: account.balance,
          transactionCount: transactions.length,
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating account statement:", error);
    return { error: "Failed to generate statement", data: null };
  }
}

// ============================================================================
// 2. SAVINGS ACCOUNTS BALANCE REPORT
// ============================================================================
export async function getSavingsAccountsBalanceReport(
  branchId?: string,
  accountTypeId?: string
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      status: AccountStatus.ACTIVE,
      ...branchFilter,
    };

    if (branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = branchId;
    }
    if (accountTypeId) {
      whereClause.accountTypeId = accountTypeId;
    }

    const accounts = await db.account.findMany({
      where: whereClause,
      include: {
        accountType: true,
        member: {
          select: {
            memberNumber: true,
            user: { select: { name: true, phone: true } },
          },
        },
        branch: true,
      },
      orderBy: { balance: "desc" },
    });

    const balancesByType = new Map();
    const balancesByBranch = new Map();

    accounts.forEach((acc) => {
      // Group by account type
      if (!balancesByType.has(acc.accountType.name)) {
        balancesByType.set(acc.accountType.name, {
          count: 0,
          totalBalance: 0,
          accounts: [],
        });
      }
      const typeGroup = balancesByType.get(acc.accountType.name);
      typeGroup.count++;
      typeGroup.totalBalance += acc.balance;
      typeGroup.accounts.push({
        accountNumber: acc.accountNumber,
        memberName: acc.member?.user.name,
        balance: acc.balance,
      });

      // Group by branch
      if (!balancesByBranch.has(acc.branch.name)) {
        balancesByBranch.set(acc.branch.name, {
          count: 0,
          totalBalance: 0,
        });
      }
      const branchGroup = balancesByBranch.get(acc.branch.name);
      branchGroup.count++;
      branchGroup.totalBalance += acc.balance;
    });

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const averageBalance =
      accounts.length > 0 ? totalBalance / accounts.length : 0;

    return {
      error: null,
      data: {
        reportType: "Savings Accounts Balance Report",
        summary: {
          totalAccounts: accounts.length,
          totalBalance,
          averageBalance,
          highestBalance: accounts[0]?.balance || 0,
          lowestBalance: accounts[accounts.length - 1]?.balance || 0,
        },
        byAccountType: Array.from(balancesByType.entries()).map(
          ([type, data]) => ({
            accountType: type,
            ...data,
            averageBalance: data.count > 0 ? data.totalBalance / data.count : 0,
          })
        ),
        byBranch: Array.from(balancesByBranch.entries()).map(
          ([branch, data]) => ({
            branch,
            ...data,
            averageBalance: data.count > 0 ? data.totalBalance / data.count : 0,
          })
        ),
        topAccounts: accounts.slice(0, 10).map((acc) => ({
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          accountType: acc.accountType.name,
          balance: acc.balance,
          branch: acc.branch.name,
        })),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating balance report:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 3. SAVINGS ACCOUNTS LISTING
// ============================================================================
export async function getSavingsAccountsListing(filters?: {
  branchId?: string;
  accountTypeId?: string;
  status?: AccountStatus;
  minBalance?: number;
  maxBalance?: number;
}) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = { ...branchFilter };

    if (filters?.branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = filters.branchId;
    }
    if (filters?.accountTypeId) {
      whereClause.accountTypeId = filters.accountTypeId;
    }
    if (filters?.status) {
      whereClause.status = filters.status;
    }
    if (filters?.minBalance !== undefined) {
      whereClause.balance = { ...whereClause.balance, gte: filters.minBalance };
    }
    if (filters?.maxBalance !== undefined) {
      whereClause.balance = { ...whereClause.balance, lte: filters.maxBalance };
    }

    const accounts = await db.account.findMany({
      where: whereClause,
      include: {
        accountType: true,
        member: {
          select: {
            memberNumber: true,
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        branch: true,
      },
      orderBy: { accountNumber: "asc" },
    });

    return {
      error: null,
      data: {
        reportType: "Savings Accounts Listing",
        filters,
        accounts: accounts.map((acc) => ({
          accountNumber: acc.accountNumber,
          memberNumber: acc.member?.memberNumber,
          memberName: acc.member?.user.name,
          email: acc.member?.user.email,
          phone: acc.member?.user.phone,
          accountType: acc.accountType.name,
          balance: acc.balance,
          status: acc.status,
          openedAt: acc.openedAt,
          closedAt: acc.closedAt,
          branch: acc.branch.name,
        })),
        summary: {
          totalAccounts: accounts.length,
          totalBalance: accounts.reduce((sum, acc) => sum + acc.balance, 0),
          byStatus: accounts.reduce(
            (acc, curr) => {
              acc[curr.status] = (acc[curr.status] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          ),
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating accounts listing:", error);
    return { error: "Failed to generate listing", data: null };
  }
}

// ============================================================================
// 4. ACCOUNTS ON HOLD/CLOSED STATUS REPORT
// ============================================================================
export async function getAccountsOnHoldClosedReport(branchId?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      status: { in: [AccountStatus.SUSPENDED, AccountStatus.CLOSED] },
      ...branchFilter,
    };

    if (branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = branchId;
    }

    const accounts = await db.account.findMany({
      where: whereClause,
      include: {
        accountType: true,
        member: {
          select: {
            memberNumber: true,
            user: { select: { name: true, phone: true } },
          },
        },
        branch: true,
      },
      orderBy: { closedAt: "desc" },
    });

    const suspendedAccounts = accounts.filter(
      (a) => a.status === AccountStatus.SUSPENDED
    );
    const closedAccounts = accounts.filter(
      (a) => a.status === AccountStatus.CLOSED
    );

    return {
      error: null,
      data: {
        reportType: "Accounts On Hold/Closed Status Report",
        summary: {
          totalSuspended: suspendedAccounts.length,
          totalClosed: closedAccounts.length,
          totalAffected: accounts.length,
          suspendedBalance: suspendedAccounts.reduce(
            (sum, a) => sum + a.balance,
            0
          ),
          closedBalance: closedAccounts.reduce((sum, a) => sum + a.balance, 0),
        },
        suspendedAccounts: suspendedAccounts.map((acc) => ({
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          accountType: acc.accountType.name,
          balance: acc.balance,
          branch: acc.branch.name,
          openedAt: acc.openedAt,
        })),
        closedAccounts: closedAccounts.map((acc) => ({
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          accountType: acc.accountType.name,
          balance: acc.balance,
          branch: acc.branch.name,
          openedAt: acc.openedAt,
          closedAt: acc.closedAt,
        })),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating on hold/closed report:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 5. DORMANT ACCOUNTS REPORT
// ============================================================================
export async function getDormantAccountsReport(
  inactiveDays: number = 180,
  branchId?: string
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    const accounts = await db.account.findMany({
      where: {
        status: AccountStatus.ACTIVE,
        ...branchFilter,
        ...(branchId && user.role === UserRole.ADMIN && { branchId }),
      },
      include: {
        accountType: true,
        member: {
          select: {
            memberNumber: true,
            user: { select: { name: true, phone: true } },
          },
        },
        branch: true,
        transactions: {
          orderBy: { transactionDate: "desc" },
          take: 1,
        },
      },
    });

    const dormantAccounts = accounts.filter((acc) => {
      if (acc.transactions.length === 0) return true;
      return acc.transactions[0].transactionDate < cutoffDate;
    });

    return {
      error: null,
      data: {
        reportType: "Dormant Accounts Report",
        criteria: {
          inactiveDays,
          cutoffDate,
        },
        summary: {
          totalDormantAccounts: dormantAccounts.length,
          totalBalance: dormantAccounts.reduce((sum, a) => sum + a.balance, 0),
          percentageOfTotal:
            accounts.length > 0
              ? (dormantAccounts.length / accounts.length) * 100
              : 0,
        },
        dormantAccounts: dormantAccounts.map((acc) => ({
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          memberNumber: acc.member?.memberNumber,
          accountType: acc.accountType.name,
          balance: acc.balance,
          lastTransactionDate:
            acc.transactions[0]?.transactionDate || acc.openedAt,
          daysSinceLastTransaction: Math.floor(
            (new Date().getTime() -
              (
                acc.transactions[0]?.transactionDate || acc.openedAt
              ).getTime()) /
              (1000 * 60 * 60 * 24)
          ),
          branch: acc.branch.name,
        })),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating dormant accounts report:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 6. SAVINGS WITH ZERO BALANCE REPORT
// ============================================================================
export async function getSavingsZeroBalanceReport(branchId?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      balance: 0,
      status: AccountStatus.ACTIVE,
      ...branchFilter,
    };

    if (branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = branchId;
    }

    const accounts = await db.account.findMany({
      where: whereClause,
      include: {
        accountType: true,
        member: {
          select: {
            memberNumber: true,
            user: { select: { name: true, phone: true } },
          },
        },
        branch: true,
        transactions: {
          orderBy: { transactionDate: "desc" },
          take: 1,
        },
      },
    });

    return {
      error: null,
      data: {
        reportType: "Savings with Zero Balance Report",
        summary: {
          totalZeroBalanceAccounts: accounts.length,
          byAccountType: accounts.reduce(
            (acc, curr) => {
              acc[curr.accountType.name] =
                (acc[curr.accountType.name] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          ),
        },
        accounts: accounts.map((acc) => ({
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          memberNumber: acc.member?.memberNumber,
          accountType: acc.accountType.name,
          openedAt: acc.openedAt,
          lastTransactionDate: acc.transactions[0]?.transactionDate,
          daysSinceOpened: Math.floor(
            (new Date().getTime() - acc.openedAt.getTime()) /
              (1000 * 60 * 60 * 24)
          ),
          branch: acc.branch.name,
        })),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating zero balance report:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 7. SAVINGS OVERDRAWN ACCOUNTS STATUS REPORT
// ============================================================================
export async function getSavingsOverdrawnAccountsReport(branchId?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      balance: { lt: 0 },
      ...branchFilter,
    };

    if (branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = branchId;
    }

    const accounts = await db.account.findMany({
      where: whereClause,
      include: {
        accountType: true,
        member: {
          select: {
            memberNumber: true,
            user: { select: { name: true, phone: true } },
          },
        },
        branch: true,
      },
      orderBy: { balance: "asc" },
    });

    const totalOverdrawn = Math.abs(
      accounts.reduce((sum, a) => sum + a.balance, 0)
    );

    return {
      error: null,
      data: {
        reportType: "Savings Overdrawn Accounts Status Report",
        summary: {
          totalOverdrawnAccounts: accounts.length,
          totalOverdrawnAmount: totalOverdrawn,
          averageOverdraft:
            accounts.length > 0 ? totalOverdrawn / accounts.length : 0,
          largestOverdraft: accounts[0]?.balance
            ? Math.abs(accounts[0].balance)
            : 0,
        },
        accounts: accounts.map((acc) => ({
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          memberNumber: acc.member?.memberNumber,
          accountType: acc.accountType.name,
          overdraftAmount: Math.abs(acc.balance),
          branch: acc.branch.name,
          status: acc.status,
        })),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating overdrawn accounts report:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 8. TOP/BOTTOM SAVERS REPORT
// ============================================================================
export async function getTopBottomSaversReport(
  limit: number = 20,
  branchId?: string
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      status: AccountStatus.ACTIVE,
      ...branchFilter,
    };

    if (branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = branchId;
    }

    const accounts = await db.account.findMany({
      where: whereClause,
      include: {
        accountType: true,
        member: {
          select: {
            memberNumber: true,
            user: { select: { name: true, phone: true } },
          },
        },
        branch: true,
      },
      orderBy: { balance: "desc" },
    });

    const topSavers = accounts.slice(0, limit);
    const bottomSavers = accounts.slice(-limit).reverse();

    return {
      error: null,
      data: {
        reportType: "Top/Bottom Savers Report",
        limit,
        summary: {
          totalAccounts: accounts.length,
          totalSavings: accounts.reduce((sum, a) => sum + a.balance, 0),
          averageSavings:
            accounts.length > 0
              ? accounts.reduce((sum, a) => sum + a.balance, 0) /
                accounts.length
              : 0,
          topSaversTotal: topSavers.reduce((sum, a) => sum + a.balance, 0),
          bottomSaversTotal: bottomSavers.reduce(
            (sum, a) => sum + a.balance,
            0
          ),
        },
        topSavers: topSavers.map((acc, index) => ({
          rank: index + 1,
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          memberNumber: acc.member?.memberNumber,
          accountType: acc.accountType.name,
          balance: acc.balance,
          branch: acc.branch.name,
        })),
        bottomSavers: bottomSavers.map((acc, index) => ({
          rank: accounts.length - limit + index + 1,
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          memberNumber: acc.member?.memberNumber,
          accountType: acc.accountType.name,
          balance: acc.balance,
          branch: acc.branch.name,
        })),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating top/bottom savers report:", error);
    return { error: "Failed to generate report", data: null };
  }
}
