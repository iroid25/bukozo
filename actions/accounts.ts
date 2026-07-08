// actions/accounts.ts
"use server";

import { db } from "@/prisma/db";
import { AccountUpdateDTO } from "@/types/accounts";
import { AccountStatus, TransactionType, TransactionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/config/useAuth";

// Fetch all accounts with relations
export async function getAllAccounts() {
  try {
    const accounts = await db.account.findMany({
      include: {
        member: {
          include: {
            user: true,
          },
        },
        institution: {
          include: {
            user: true,
          },
        },
        accountType: true,
        branch: true,
        _count: {
          select: {
            transactions: true,
            deposits: true,
            withdrawals: true,
          },
        },
      },
      orderBy: {
        openedAt: "desc",
      },
    });
    return accounts;
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return [];
  }
}

// Fetch accounts by member ID
export async function getAccountsByMemberId(memberId: string) {
  try {
    const accounts = await db.account.findMany({
      where: { memberId },
      include: {
        accountType: true,
        branch: true,
        _count: {
          select: {
            transactions: true,
            deposits: true,
            withdrawals: true,
          },
        },
      },
      orderBy: {
        openedAt: "desc",
      },
    });
    return accounts;
  } catch (error) {
    console.error("Error fetching member accounts:", error);
    return [];
  }
}

// Fetch single account by ID
export async function getAccountById(id: string) {
  try {
    const account = await db.account.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        institution: {
          include: {
            user: true,
          },
        },
        accountType: true,
        branch: true,
        _count: {
          select: {
            transactions: true,
            deposits: true,
            withdrawals: true,
          },
        },
      },
    });
    return account;
  } catch (error) {
    console.error("Error fetching account:", error);
    return null;
  }
}

// Account creation moved to POST /api/v1/accounts (route handler).
// This stub exists only to avoid breaking any legacy import that has not been updated yet.
export async function createAccount(_data: unknown) {
  return { error: "Use POST /api/v1/accounts instead", data: null };
}

// Update account
export async function updateAccount(data: AccountUpdateDTO) {
  try {
    const updateData: any = {};

    if (data.status !== undefined) {
      updateData.status = data.status;

      if (data.status === AccountStatus.CLOSED) {
        updateData.closedAt = new Date();
      }
    }

    if (data.branchId !== undefined) {
      const branch = await db.branch.findUnique({
        where: { id: data.branchId },
      });

      if (!branch) {
        return {
          error: "Branch not found",
          data: null,
        };
      }
      updateData.branchId = data.branchId;
    }

    const account = await db.account.update({
      where: { id: data.id },
      data: updateData,
      include: {
        member: {
          include: {
            user: true,
          },
        },
        institution: {
          include: {
            user: true,
          },
        },
        accountType: true,
        branch: true,
      },
    });

    revalidatePath("/dashboard/accounts");
    return {
      error: null,
      data: account,
    };
  } catch (error) {
    console.error("Error updating account:", error);
    return {
      error: "Failed to update account. Please try again.",
      data: null,
    };
  }
}

// Close account
export async function closeAccount(id: string, reason?: string) {
  try {
    const account = await db.account.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    if (!account) {
      return {
        error: "Account not found",
        data: null,
      };
    }

    if (account.status === AccountStatus.CLOSED) {
      return {
        error: "Account is already closed",
        data: null,
      };
    }

    if (account.balance > 0) {
      return {
        error:
          "Cannot close account with remaining balance. Please withdraw all funds first.",
        data: null,
      };
    }

    const updatedAccount = await db.account.update({
      where: { id },
      data: {
        status: AccountStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    revalidatePath("/dashboard/accounts");
    return {
      error: null,
      data: updatedAccount,
    };
  } catch (error) {
    console.error("Error closing account:", error);
    return {
      error: "Failed to close account. Please try again.",
      data: null,
    };
  }
}

// Get account balance
export async function getAccountBalance(accountId: string) {
  try {
    const account = await db.account.findUnique({
      where: { id: accountId },
      select: { balance: true },
    });

    return account?.balance || 0;
  } catch (error) {
    console.error("Error fetching account balance:", error);
    return 0;
  }
}

// Get members for account creation
export async function getMembersForAccountCreation() {
  try {
    console.log("Fetching members for account creation...");
      const members = await db.member.findMany({
        where: {
          OR: [
            { approvalStatus: "APPROVED" },
            { fingerprintTemplate: { not: null } },
          ],
        },
        include: {
          user: {
            select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        accounts: {
          where: {
            status: "ACTIVE",
          },
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            branchId: true,
            accountType: true,
            branch: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
      },
      orderBy: {
        memberNumber: "asc",
      },
    });
    return members.filter((member) => member.updatedAt > member.createdAt);
  } catch (error) {
    console.error("Error fetching members:", error);
    return [];
  }
}

// Get institutions for account creation
export async function getInstitutionsForAccountCreation() {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return [];
    }

    const eligibleWhere =
      currentUser.role === "ADMIN"
        ? {
            isApproved: true,
            user: { isActive: true },
            primaryContactPerson: { not: "" },
            primaryContactPhone: { not: "" },
            institutionPhone: { not: "" },
            institutionEmail: { not: "" },
            signatories: {
              some: {
                status: "ACTIVE",
                signatureImage: { not: null },
                phone: { not: "" },
              },
            },
          }
        : currentUser.branchId
          ? {
              isApproved: true,
              user: {
                isActive: true,
                branchId: currentUser.branchId,
              },
              primaryContactPerson: { not: "" },
              primaryContactPhone: { not: "" },
              institutionPhone: { not: "" },
              institutionEmail: { not: "" },
              signatories: {
                some: {
                  status: "ACTIVE",
                  signatureImage: { not: null },
                  phone: { not: "" },
                },
              },
            }
          : null;

    if (!eligibleWhere) {
      return [];
    }

    const institutions = await db.institution.findMany({
      where: eligibleWhere,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        signatories: {
          select: {
            id: true,
            name: true,
            title: true,
            phone: true,
            email: true,
            signatureImage: true,
            status: true,
          },
        },
        accounts: {
          where: {
            status: "ACTIVE",
          },
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            accountType: true,
          },
        },
      },
      orderBy: {
        institutionNumber: "asc",
      },
    });
    return institutions;
  } catch (error) {
    console.error("Error fetching institutions:", error);
    return [];
  }
}

// Get account types for account creation
export async function getAccountTypesForCreation() {
  try {
    const accountTypes = await db.accountType.findMany({
      orderBy: {
        name: "asc",
      },
    });
    return accountTypes;
  } catch (error) {
    console.error("Error fetching account types:", error);
    return [];
  }
}

// Get branches for account creation
export async function getBranchesForCreation() {
  try {
    const branches = await db.branch.findMany({
      orderBy: {
        name: "asc",
      },
    });
    return branches;
  } catch (error) {
    console.error("Error fetching branches:", error);
    return [];
  }
}

// Get member account overview
export async function getMemberAccountOverview(memberId: string) {
  try {
    const transactions = await db.transaction.findMany({
      where: {
        memberId,
        status: "COMPLETED",
      },
    });

    const totalDeposits = transactions
      .filter((t) =>
        ["DEPOSIT", "LOAN_DISBURSEMENT", "TRANSFER_IN"].includes(t.type)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawals = transactions
      .filter((t) =>
        ["WITHDRAWAL", "LOAN_REPAYMENT", "TRANSFER_OUT", "FEE"].includes(t.type)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const accounts = await db.account.findMany({
      where: {
        memberId,
        status: "ACTIVE",
      },
      select: { balance: true },
    });

    const currentBalance = accounts.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    const lastTransaction = await db.transaction.findFirst({
      where: { memberId },
      orderBy: { transactionDate: "desc" },
      select: { transactionDate: true },
    });

    return {
      totalDeposits,
      totalWithdrawals,
      currentBalance,
      totalTransactions: transactions.length,
      lastTransactionDate:
        lastTransaction?.transactionDate?.toISOString() || null,
    };
  } catch (error) {
    console.error("Error fetching member account overview:", error);
    return {
      totalDeposits: 0,
      totalWithdrawals: 0,
      currentBalance: 0,
      totalTransactions: 0,
      lastTransactionDate: null,
    };
  }
}

// Get user's account details and statistics
export async function getMyAccountDetails() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const member = await db.member.findUnique({
      where: { userId: user.id },
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
            createdAt: true,
          },
        },
        accounts: {
          where: { status: "ACTIVE" },
          include: {
            accountType: true,
            branch: true,
            _count: {
              select: {
                transactions: true,
              },
            },
          },
          orderBy: { openedAt: "desc" },
        },
        loans: {
          include: {
            branch: true,
            _count: {
              select: {
                repayments: true,
              },
            },
          },
          orderBy: { disbursementDate: "desc" },
        },
        _count: {
          select: {
            accounts: true,
            loans: true,
          },
        },
      },
    });

    if (!member) {
      throw new Error("Member record not found");
    }

    return member;
  } catch (error) {
    console.error("Error fetching account details:", error);
    throw new Error("Failed to fetch account details");
  }
}

export async function getMyAccountStatistics() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const member = await db.member.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!member) {
      throw new Error("Member record not found");
    }

    const accounts = await db.account.findMany({
      where: {
        memberId: member.id,
        status: "ACTIVE",
      },
      select: {
        balance: true,
        accountType: {
          select: {
            name: true,
          },
        },
      },
    });

    const [
      totalTransactions,
      todayTransactions,
      thisMonthTransactions,
      totalDeposits,
      totalWithdrawals,
      pendingTransactions,
      failedTransactions,
    ] = await Promise.all([
      db.transaction.count({
        where: {
          memberId: member.id,
          status: "COMPLETED",
        },
      }),
      db.transaction.count({
        where: {
          memberId: member.id,
          status: "COMPLETED",
          transactionDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      db.transaction.count({
        where: {
          memberId: member.id,
          status: "COMPLETED",
          transactionDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      db.transaction.aggregate({
        where: {
          memberId: member.id,
          status: "COMPLETED",
          type: { in: ["DEPOSIT", "LOAN_DISBURSEMENT"] },
        },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: {
          memberId: member.id,
          status: "COMPLETED",
          type: { in: ["WITHDRAWAL", "LOAN_REPAYMENT"] },
        },
        _sum: { amount: true },
      }),
      db.transaction.count({
        where: {
          memberId: member.id,
          status: "PENDING",
        },
      }),
      db.transaction.count({
        where: {
          memberId: member.id,
          status: "FAILED",
        },
      }),
    ]);

    const totalBalance = accounts.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    const loanStats = await db.loan.aggregate({
      where: { memberId: member.id },
      _sum: {
        amountGranted: true,
        outstandingBalance: true,
        amountPaid: true,
      },
      _count: true,
    });

    const activeLoansCount = await db.loan.count({
      where: {
        memberId: member.id,
        status: { in: ["DISBURSED", "OVERDUE"] },
      },
    });

    const typeBreakdown = await db.transaction.groupBy({
      by: ["type"],
      where: {
        memberId: member.id,
        status: "COMPLETED",
      },
      _count: true,
      _sum: { amount: true },
    });

    const channelBreakdown = await db.transaction.groupBy({
      by: ["channel"],
      where: {
        memberId: member.id,
        status: "COMPLETED",
        channel: { not: null },
      },
      _count: true,
      _sum: { amount: true },
    });

    return {
      totalBalance,
      accountsCount: accounts.length,
      accountBalances: accounts.map((account) => ({
        type: account.accountType.name,
        balance: account.balance,
      })),
      totalTransactions,
      todayTransactions,
      thisMonthTransactions,
      todayAmount: 0,
      pendingTransactions,
      failedTransactions,
      totalDeposits: totalDeposits._sum.amount || 0,
      totalWithdrawals: totalWithdrawals._sum.amount || 0,
      totalLoans: loanStats._count || 0,
      activeLoans: activeLoansCount,
      totalLoanAmount: loanStats._sum.amountGranted || 0,
      outstandingLoanBalance: loanStats._sum.outstandingBalance || 0,
      totalLoanRepaid: loanStats._sum.amountPaid || 0,
      typeBreakdown: typeBreakdown.map((item) => ({
        type: item.type,
        count: item._count,
        amount: item._sum.amount || 0,
      })),
      channelBreakdown: channelBreakdown.map((item) => ({
        channel: item.channel || "UNKNOWN",
        count: item._count,
        amount: item._sum.amount || 0,
      })),
    };
  } catch (error) {
    console.error("Error fetching account statistics:", error);
    return {
      totalBalance: 0,
      accountsCount: 0,
      accountBalances: [],
      totalTransactions: 0,
      todayTransactions: 0,
      thisMonthTransactions: 0,
      todayAmount: 0,
      pendingTransactions: 0,
      failedTransactions: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalLoans: 0,
      activeLoans: 0,
      totalLoanAmount: 0,
      outstandingLoanBalance: 0,
      totalLoanRepaid: 0,
      typeBreakdown: [],
      channelBreakdown: [],
    };
  }
}

export async function getMyTransactions() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const member = await db.member.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!member) {
      throw new Error("Member record not found");
    }

    const transactions = await db.transaction.findMany({
      where: {
        memberId: member.id,
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        processedByUser: {
          select: {
            name: true,
            role: true,
          },
        },
        deposit: {
          include: {
            handler: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        withdrawal: {
          include: {
            handler: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    return transactions;
  } catch (error) {
    console.error("Error fetching user transactions:", error);
    return [];
  }
}

// Update account fee settings (Custom overrides)
export async function updateAccountFees(data: {
  accountId: string;
  customFlatWithdrawalFee: number | null;
  customWithdrawalFeePercentage: number | null;
}) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    // Strict RBAC: Only Admin can override fees
    if (user.role !== "ADMIN" && user.role !== "ACCOUNTANT") {
      return {
        error: "Permission denied. Only Admins/Accountants can set custom fees.",
        data: null,
      };
    }

    const { accountId, customFlatWithdrawalFee, customWithdrawalFeePercentage } =
      data;

    const account = await db.account.update({
      where: { id: accountId },
      data: {
        customFlatWithdrawalFee,
        customWithdrawalFeePercentage,
      },
    });

    revalidatePath(`/dashboard/accounts/${accountId}`);
    revalidatePath("/dashboard/withdraw-test");

    return { error: null, data: account };
  } catch (error) {
    console.error("Error updating account fees:", error);
    return {
      error: "Failed to update account fees",
      data: null,
    };
  }
}

/**
 * Break a Fixed Deposit account prematurely
 * Transfer principal back to voluntary savings and close account without interest
 */
export async function breakFixedDeposit(accountId: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    // Find the fixed deposit account
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        accountType: true,
        member: true,
        institution: true,
      },
    });

    if (!account) return { error: "Account not found", data: null };
    if (!account.accountType.hasFixedPeriod) return { error: "This is not a fixed deposit account", data: null };
    if (account.status !== AccountStatus.ACTIVE) return { error: "Account is not active", data: null };

    // Find target account (Funding source or any voluntary savings)
    let targetAccountId = account.fundingSourceAccountId;
    
    if (!targetAccountId) {
      const voluntarySavings = await db.account.findFirst({
        where: {
          ...(account.memberId ? { memberId: account.memberId } : {}),
          ...(account.institutionId ? { institutionId: account.institutionId } : {}),
          accountType: { name: { in: ["VOLUNTARY_SAVINGS", "Voluntary Savings", "Savings Account"] } },
          status: AccountStatus.ACTIVE,
        },
      });
      if (!voluntarySavings) return { error: "No active voluntary savings account found to return funds to", data: null };
      targetAccountId = voluntarySavings.id;
    }

    const targetAccount = await db.account.findUnique({ where: { id: targetAccountId! } });
    if (!targetAccount) return { error: "Target savings account not found", data: null };

    const principalAmount = account.balance;

    // Transaction to move funds and close account
    const result = await db.$transaction(async (tx) => {
      // 1. Debit Fixed Deposit and Close
      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: 0,
          status: AccountStatus.CLOSED,
          closedAt: new Date(),
        },
      });

      // 2. Credit Target Account
      await tx.account.update({
        where: { id: targetAccountId! },
        data: { balance: { increment: principalAmount } },
      });

      const transactionRef = `BRK-FD-${Date.now()}`;

      // 3. Create Transaction Records
      await tx.transaction.create({
        data: {
          transactionRef,
          type: TransactionType.TRANSFER,
          amount: principalAmount,
          status: TransactionStatus.COMPLETED,
          description: `Premature Break: Transfer from Fixed Deposit ${account.accountNumber} to ${targetAccount.accountNumber}. Interest forfeited.`,
          accountId: targetAccountId!,
          memberId: account.memberId,
          institutionId: account.institutionId,
          processedByUserId: user.id,
          channel: "INTERNAL",
        },
      });

      await tx.transaction.create({
        data: {
          transactionRef: `${transactionRef}-SRC`,
          type: TransactionType.TRANSFER,
          amount: principalAmount,
          status: TransactionStatus.COMPLETED,
          description: `Premature Break: Transfer to ${targetAccount.accountNumber}. Interest forfeited.`,
          accountId: account.id,
          memberId: account.memberId,
          institutionId: account.institutionId,
          processedByUserId: user.id,
          channel: "INTERNAL",
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "BREAK_FIXED_DEPOSIT",
          entityType: "Account",
          entityId: account.id,
          details: `Fixed deposit ${account.accountNumber} broken prematurely by ${user.name}. Principal ${principalAmount.toLocaleString()} transferred to ${targetAccount.accountNumber}.`,
        },
      });

      return account;
    });

    revalidatePath("/dashboard/accounts");
    revalidatePath(`/dashboard/accounts/${accountId}`);
    
    return { error: null, data: result };
  } catch (error) {
    console.error("Error breaking fixed deposit:", error);
    return { error: "Failed to break fixed deposit", data: null };
  }
}
