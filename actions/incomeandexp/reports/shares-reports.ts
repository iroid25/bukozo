// ============================================================================
// actions/reports/shares-reports.ts - Share Account Reports
// ============================================================================
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, AccountStatus } from "@prisma/client";

async function getBranchFilter() {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  if (user.role === UserRole.ADMIN) return {};
  if (!user.branchId) return { branchId: "no-branch" };
  return { branchId: user.branchId };
}

// ============================================================================
// 1. SHARES ACCOUNT STATEMENT
// ============================================================================
export async function getSharesAccountStatement(
  accountId: string,
  startDate: Date,
  endDate: Date
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    // Get share account (filter by isShareAccount)
    const account = await db.account.findFirst({
      where: {
        id: accountId,
        accountType: { isShareAccount: true },
      },
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
      return { error: "Share account not found", data: null };
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
        sharesPurchased: isCredit ? amount : 0,
        sharesSold: !isCredit ? amount : 0,
        balance: runningBalance,
        processedBy: t.processedByUser?.name,
      };
    });

    return {
      error: null,
      data: {
        reportType: "Shares Account Statement",
        period: { startDate, endDate },
        account: {
          accountNumber: account.accountNumber,
          accountType: account.accountType.name,
          memberName: account.member?.user.name,
          memberNumber: account.member?.memberNumber,
          branch: account.branch.name,
          currentShareValue: account.balance,
        },
        transactions: transactionsWithBalance,
        summary: {
          openingBalance:
            account.balance -
            transactions.reduce(
              (sum, t) => sum + (t.type === "DEPOSIT" ? t.amount : -t.amount),
              0
            ),
          totalSharesPurchased: transactions
            .filter((t) => t.type === "DEPOSIT")
            .reduce((sum, t) => sum + t.amount, 0),
          totalSharesSold: transactions
            .filter((t) => t.type === "WITHDRAWAL")
            .reduce((sum, t) => sum + t.amount, 0),
          closingBalance: account.balance,
          transactionCount: transactions.length,
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating shares statement:", error);
    return { error: "Failed to generate statement", data: null };
  }
}

// ============================================================================
// 2. SHARE ACCOUNTS BALANCE REPORT
// ============================================================================
export async function getShareAccountsBalanceReport(branchId?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      status: AccountStatus.ACTIVE,
      accountType: { isShareAccount: true },
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

    const balancesByBranch = new Map();
    accounts.forEach((acc) => {
      if (!balancesByBranch.has(acc.branch.name)) {
        balancesByBranch.set(acc.branch.name, {
          count: 0,
          totalShares: 0,
          accounts: [],
        });
      }
      const branchGroup = balancesByBranch.get(acc.branch.name);
      branchGroup.count++;
      branchGroup.totalShares += acc.balance;
      branchGroup.accounts.push({
        accountNumber: acc.accountNumber,
        memberName: acc.member?.user.name,
        shareValue: acc.balance,
      });
    });

    const totalShares = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const averageShares =
      accounts.length > 0 ? totalShares / accounts.length : 0;

    return {
      error: null,
      data: {
        reportType: "Share Accounts Balance Report",
        summary: {
          totalShareAccounts: accounts.length,
          totalShareValue: totalShares,
          averageShareValue: averageShares,
          highestShareValue: accounts[0]?.balance || 0,
          lowestShareValue: accounts[accounts.length - 1]?.balance || 0,
        },
        byBranch: Array.from(balancesByBranch.entries()).map(
          ([branch, data]) => ({
            branch,
            accountCount: data.count,
            totalShares: data.totalShares,
            averageShares: data.count > 0 ? data.totalShares / data.count : 0,
          })
        ),
        topShareHolders: accounts.slice(0, 10).map((acc) => ({
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          memberNumber: acc.member?.memberNumber,
          shareValue: acc.balance,
          branch: acc.branch.name,
        })),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating share balance report:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 3. SHARES CONCENTRATION REPORT
// ============================================================================
export async function getSharesConcentrationReport(branchId?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      status: AccountStatus.ACTIVE,
      accountType: { isShareAccount: true },
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
            user: { select: { name: true } },
          },
        },
        branch: true,
      },
      orderBy: { balance: "desc" },
    });

    const totalShares = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    // Calculate concentration (top 10, 20, 50 members)
    const top10 = accounts.slice(0, 10);
    const top20 = accounts.slice(0, 20);
    const top50 = accounts.slice(0, 50);

    const top10Total = top10.reduce((sum, a) => sum + a.balance, 0);
    const top20Total = top20.reduce((sum, a) => sum + a.balance, 0);
    const top50Total = top50.reduce((sum, a) => sum + a.balance, 0);

    return {
      error: null,
      data: {
        reportType: "Shares Concentration Report",
        summary: {
          totalMembers: accounts.length,
          totalShareValue: totalShares,
          concentration: {
            top10Members: {
              count: top10.length,
              totalShares: top10Total,
              percentageOfTotal:
                totalShares > 0 ? (top10Total / totalShares) * 100 : 0,
            },
            top20Members: {
              count: top20.length,
              totalShares: top20Total,
              percentageOfTotal:
                totalShares > 0 ? (top20Total / totalShares) * 100 : 0,
            },
            top50Members: {
              count: top50.length,
              totalShares: top50Total,
              percentageOfTotal:
                totalShares > 0 ? (top50Total / totalShares) * 100 : 0,
            },
          },
        },
        top10Members: top10.map((acc, index) => ({
          rank: index + 1,
          memberName: acc.member?.user.name,
          memberNumber: acc.member?.memberNumber,
          shareValue: acc.balance,
          percentageOfTotal:
            totalShares > 0 ? (acc.balance / totalShares) * 100 : 0,
          branch: acc.branch.name,
        })),
        distributionRanges: calculateDistribution(accounts),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating shares concentration report:", error);
    return { error: "Failed to generate report", data: null };
  }
}

function calculateDistribution(accounts: any[]) {
  const ranges = [
    { min: 0, max: 100000, label: "0 - 100K" },
    { min: 100000, max: 500000, label: "100K - 500K" },
    { min: 500000, max: 1000000, label: "500K - 1M" },
    { min: 1000000, max: 5000000, label: "1M - 5M" },
    { min: 5000000, max: Infinity, label: "5M+" },
  ];

  return ranges.map((range) => {
    const accountsInRange = accounts.filter(
      (a) => a.balance >= range.min && a.balance < range.max
    );
    return {
      range: range.label,
      count: accountsInRange.length,
      totalValue: accountsInRange.reduce((sum, a) => sum + a.balance, 0),
    };
  });
}

// ============================================================================
// 4. SHARE ACCOUNTS LISTING
// ============================================================================
export async function getShareAccountsListing(filters?: {
  branchId?: string;
  status?: AccountStatus;
  minShares?: number;
  maxShares?: number;
}) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      accountType: { isShareAccount: true },
      ...branchFilter,
    };

    if (filters?.branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = filters.branchId;
    }
    if (filters?.status) {
      whereClause.status = filters.status;
    }
    if (filters?.minShares !== undefined) {
      whereClause.balance = { ...whereClause.balance, gte: filters.minShares };
    }
    if (filters?.maxShares !== undefined) {
      whereClause.balance = { ...whereClause.balance, lte: filters.maxShares };
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
        reportType: "Share Accounts Listing",
        filters,
        accounts: accounts.map((acc) => ({
          accountNumber: acc.accountNumber,
          memberNumber: acc.member?.memberNumber,
          memberName: acc.member?.user.name,
          email: acc.member?.user.email,
          phone: acc.member?.user.phone,
          accountType: acc.accountType.name,
          shareValue: acc.balance,
          status: acc.status,
          openedAt: acc.openedAt,
          closedAt: acc.closedAt,
          branch: acc.branch.name,
        })),
        summary: {
          totalAccounts: accounts.length,
          totalShareValue: accounts.reduce((sum, acc) => sum + acc.balance, 0),
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
    console.error("Error generating share accounts listing:", error);
    return { error: "Failed to generate listing", data: null };
  }
}

// ============================================================================
// 5. SHARE BATCH TOTALS REPORT
// ============================================================================
export async function getShareBatchTotalsReport(
  startDate: Date,
  endDate: Date,
  branchId?: string
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();

    const transactions = await db.transaction.findMany({
      where: {
        transactionDate: { gte: startDate, lte: endDate },
        status: "COMPLETED",
        account: {
          accountType: { isShareAccount: true },
        },
        ...branchFilter,
      },
      include: {
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        processedByUser: { select: { name: true } },
      },
      orderBy: { transactionDate: "asc" },
    });

    // Group by date
    const batchesByDate = new Map();
    transactions.forEach((t) => {
      const dateKey = t.transactionDate.toISOString().split("T")[0];
      if (!batchesByDate.has(dateKey)) {
        batchesByDate.set(dateKey, {
          date: t.transactionDate,
          purchases: 0,
          sales: 0,
          netChange: 0,
          transactionCount: 0,
        });
      }
      const batch = batchesByDate.get(dateKey);
      if (t.type === "DEPOSIT") {
        batch.purchases += t.amount;
        batch.netChange += t.amount;
      } else if (t.type === "WITHDRAWAL") {
        batch.sales += t.amount;
        batch.netChange -= t.amount;
      }
      batch.transactionCount++;
    });

    return {
      error: null,
      data: {
        reportType: "Share Batch Totals Report",
        period: { startDate, endDate },
        summary: {
          totalTransactions: transactions.length,
          totalPurchases: transactions
            .filter((t) => t.type === "DEPOSIT")
            .reduce((sum, t) => sum + t.amount, 0),
          totalSales: transactions
            .filter((t) => t.type === "WITHDRAWAL")
            .reduce((sum, t) => sum + t.amount, 0),
          netShareChange: transactions.reduce(
            (sum, t) => sum + (t.type === "DEPOSIT" ? t.amount : -t.amount),
            0
          ),
        },
        dailyBatches: Array.from(batchesByDate.values()).sort(
          (a, b) => a.date.getTime() - b.date.getTime()
        ),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating share batch totals:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 6-8. REUSE SIMILAR FUNCTIONS FROM SAVINGS
// ============================================================================
export async function getShareAccountsOnHoldClosedReport(branchId?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      status: { in: [AccountStatus.SUSPENDED, AccountStatus.CLOSED] },
      accountType: { isShareAccount: true },
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
        reportType: "Share Accounts On Hold/Closed Status Report",
        summary: {
          totalSuspended: suspendedAccounts.length,
          totalClosed: closedAccounts.length,
          totalAffected: accounts.length,
          suspendedShareValue: suspendedAccounts.reduce(
            (sum, a) => sum + a.balance,
            0
          ),
          closedShareValue: closedAccounts.reduce(
            (sum, a) => sum + a.balance,
            0
          ),
        },
        suspendedAccounts: suspendedAccounts.map((acc) => ({
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          shareValue: acc.balance,
          branch: acc.branch.name,
          openedAt: acc.openedAt,
        })),
        closedAccounts: closedAccounts.map((acc) => ({
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          shareValue: acc.balance,
          branch: acc.branch.name,
          openedAt: acc.openedAt,
          closedAt: acc.closedAt,
        })),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating share on hold/closed report:", error);
    return { error: "Failed to generate report", data: null };
  }
}

export async function getShareZeroBalanceReport(branchId?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      balance: 0,
      status: AccountStatus.ACTIVE,
      accountType: { isShareAccount: true },
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
    });

    return {
      error: null,
      data: {
        reportType: "Share Zero Balance Report",
        summary: {
          totalZeroBalanceAccounts: accounts.length,
        },
        accounts: accounts.map((acc) => ({
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          memberNumber: acc.member?.memberNumber,
          openedAt: acc.openedAt,
          branch: acc.branch.name,
        })),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating share zero balance report:", error);
    return { error: "Failed to generate report", data: null };
  }
}

export async function getTopBottomShareHoldersReport(
  limit: number = 20,
  branchId?: string
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      status: AccountStatus.ACTIVE,
      accountType: { isShareAccount: true },
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

    const topHolders = accounts.slice(0, limit);
    const bottomHolders = accounts.slice(-limit).reverse();

    return {
      error: null,
      data: {
        reportType: "Top/Bottom Share Holders Report",
        limit,
        summary: {
          totalAccounts: accounts.length,
          totalShares: accounts.reduce((sum, a) => sum + a.balance, 0),
          averageShares:
            accounts.length > 0
              ? accounts.reduce((sum, a) => sum + a.balance, 0) /
                accounts.length
              : 0,
        },
        topHolders: topHolders.map((acc, index) => ({
          rank: index + 1,
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          memberNumber: acc.member?.memberNumber,
          shareValue: acc.balance,
          branch: acc.branch.name,
        })),
        bottomHolders: bottomHolders.map((acc, index) => ({
          rank: accounts.length - limit + index + 1,
          accountNumber: acc.accountNumber,
          memberName: acc.member?.user.name,
          memberNumber: acc.member?.memberNumber,
          shareValue: acc.balance,
          branch: acc.branch.name,
        })),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating top/bottom share holders report:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 9. SHARE TRANSACTIONS REPORT
// ============================================================================
export async function getShareTransactionsReport(
  startDate: Date,
  endDate: Date,
  branchId?: string,
  transactionType?: "DEPOSIT" | "WITHDRAWAL"
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      transactionDate: { gte: startDate, lte: endDate },
      status: "COMPLETED",
      account: {
        accountType: { isShareAccount: true },
      },
      ...branchFilter,
    };

    if (branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = branchId;
    }
    if (transactionType) {
      whereClause.type = transactionType;
    }

    const transactions = await db.transaction.findMany({
      where: whereClause,
      include: {
        account: {
          include: {
            accountType: true,
            member: {
              select: {
                memberNumber: true,
                user: { select: { name: true } },
              },
            },
            branch: true,
          },
        },
        processedByUser: { select: { name: true } },
      },
      orderBy: { transactionDate: "desc" },
    });

    return {
      error: null,
      data: {
        reportType: "Share Transactions Report",
        period: { startDate, endDate },
        summary: {
          totalTransactions: transactions.length,
          totalPurchases: transactions
            .filter((t) => t.type === "DEPOSIT")
            .reduce((sum, t) => sum + t.amount, 0),
          totalSales: transactions
            .filter((t) => t.type === "WITHDRAWAL")
            .reduce((sum, t) => sum + t.amount, 0),
          netChange: transactions.reduce(
            (sum, t) => sum + (t.type === "DEPOSIT" ? t.amount : -t.amount),
            0
          ),
        },
        transactions: transactions.map((t) => ({
          date: t.transactionDate,
          reference: t.transactionRef,
          accountNumber: t.account.accountNumber,
          memberName: t.account.member?.user.name,
          memberNumber: t.account.member?.memberNumber,
          type: t.type,
          amount: t.amount,
          description: t.description,
          processedBy: t.processedByUser?.name,
          branch: t.account.branch.name,
        })),
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating share transactions report:", error);
    return { error: "Failed to generate report", data: null };
  }
}
