// acccount-details.ts
"use server";

import { db } from "@/prisma/db";

// import { notFound } from "next/navigation";

export async function getAccountDetails(accountId: string) {
  try {
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        institution: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        accountType: true,
        branch: true,
        transactions: {
          include: {
            processedByUser: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            transactionDate: "desc",
          },
          take: 50, // Limit to recent 50 transactions
        },
        deposits: {
          include: {
            handler: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            depositDate: "desc",
          },
          take: 20,
        },
        withdrawals: {
          include: {
            handler: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            withdrawalDate: "desc",
          },
          take: 20,
        },
      },
    });

    if (!account) {
      return null;
    }

    return account;
  } catch (error) {
    console.error("Error fetching account details:", error);
    return null;
    // throw new Error("Failed to fetch account details");
  }
}

export async function getAccountTransactions(
  accountId: string,
  page: number = 1,
  limit: number = 20,
  type?: string
) {
  try {
    const skip = (page - 1) * limit;

    const whereClause: any = {
      accountId: accountId,
    };

    if (type && type !== "all") {
      whereClause.type = type;
    }

    const [transactions, totalCount] = await Promise.all([
      db.transaction.findMany({
        where: whereClause,
        include: {
          processedByUser: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          transactionDate: "desc",
        },
        skip,
        take: limit,
      }),
      db.transaction.count({
        where: whereClause,
      }),
    ]);

    return {
      transactions,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error("Error fetching account transactions:", error);
    throw new Error("Failed to fetch account transactions");
  }
}

export async function getAccountDeposits(
  accountId: string,
  page: number = 1,
  limit: number = 20
) {
  try {
    const skip = (page - 1) * limit;

    const [deposits, totalCount] = await Promise.all([
      db.deposit.findMany({
        where: { accountId },
        include: {
          handler: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          depositDate: "desc",
        },
        skip,
        take: limit,
      }),
      db.deposit.count({
        where: { accountId },
      }),
    ]);

    return {
      deposits,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error("Error fetching account deposits:", error);
    throw new Error("Failed to fetch account deposits");
  }
}

export async function getAccountWithdrawals(
  accountId: string,
  page: number = 1,
  limit: number = 20
) {
  try {
    const skip = (page - 1) * limit;

    const [withdrawals, totalCount] = await Promise.all([
      db.withdrawal.findMany({
        where: { accountId },
        include: {
          handler: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          withdrawalDate: "desc",
        },
        skip,
        take: limit,
      }),
      db.withdrawal.count({
        where: { accountId },
      }),
    ]);

    return {
      withdrawals,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error("Error fetching account withdrawals:", error);
    throw new Error("Failed to fetch account withdrawals");
  }
}

export async function getAccountSummary(accountId: string) {
  try {
    const [
      totalDeposits,
      totalWithdrawals,
      transactionCount,
      recentTransactions,
    ] = await Promise.all([
      db.deposit.aggregate({
        where: { accountId },
        _sum: { amount: true },
        _count: true,
      }),
      db.withdrawal.aggregate({
        where: { accountId },
        _sum: { amount: true },
        _count: true,
      }),
      db.transaction.count({
        where: { accountId },
      }),
      db.transaction.findMany({
        where: { accountId },
        orderBy: { transactionDate: "desc" },
        take: 5,
        include: {
          processedByUser: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    return {
      totalDeposits: totalDeposits._sum.amount || 0,
      totalWithdrawals: totalWithdrawals._sum.amount || 0,
      depositsCount: totalDeposits._count,
      withdrawalsCount: totalWithdrawals._count,
      transactionCount,
      recentTransactions,
    };
  } catch (error) {
    console.error("Error fetching account summary:", error);
    throw new Error("Failed to fetch account summary");
  }
}
