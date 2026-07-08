"use server";

import { db } from "@/prisma/db";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { TransactionService } from "@/services/transaction.service";
import {
  TransactionCreateDTO,
  TransactionUpdateDTO,
  TransactionReverseDTO,
} from "@/types/transactions";

/**
 * Fetch all transactions with complete relations
 */
export async function getAllTransactions() {
  const result = await TransactionService.getAllTransactions();
  if (!result.ok) return [];
  return result.data;
}

/**
 * Get transaction statistics
 */
export async function getTransactionStatistics() {
  const result = await TransactionService.getStatistics();
  if (!result.ok) {
    return {
      success: false,
      data: {
        totalTransactions: 0,
        totalAmount: 0,
        todayTransactions: 0,
        todayAmount: 0,
        pendingTransactions: 0,
        failedTransactions: 0,
        typeBreakdown: [],
        channelBreakdown: [],
      },
    };
  }
  return { success: true, data: result.data };
}

/**
 * Get transactions by member
 */
export async function getTransactionsByMember(memberId: string) {
  try {
    const transactions = await db.transaction.findMany({
      where: {
        memberId,
      },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        processedByUser: true,
        deposit: {
          include: {
            handler: true,
          },
        },
        withdrawal: {
          include: {
            handler: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    return transactions;
  } catch (error) {
    console.error("Error fetching member transactions:", error);
    return [];
  }
}

/**
 * Get transactions by institution
 */
export async function getTransactionsByInstitution(institutionId: string) {
  try {
    const transactions = await db.transaction.findMany({
      where: {
        institutionId,
      },
      include: {
        institution: {
          include: {
            user: true,
          },
        },
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        processedByUser: true,
        deposit: {
          include: {
            handler: true,
          },
        },
        withdrawal: {
          include: {
            handler: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    return transactions;
  } catch (error) {
    console.error("Error fetching institution transactions:", error);
    return [];
  }
}

/**
 * Get transactions by account
 */
export async function getTransactionsByAccount(accountId: string) {
  try {
    const transactions = await db.transaction.findMany({
      where: {
        accountId,
      },
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
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        processedByUser: true,
        deposit: {
          include: {
            handler: true,
          },
        },
        withdrawal: {
          include: {
            handler: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    return transactions;
  } catch (error) {
    console.error("Error fetching account transactions:", error);
    return [];
  }
}

/**
 * Create a new transaction
 */
export async function createTransaction(data: TransactionCreateDTO) {
  try {
    // Generate transaction reference if not provided
    const transactionRef =
      data.transactionRef ||
      `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Start transaction
    const result = await db.$transaction(async (tx) => {
      // Validate account exists and get current balance
      const account = await tx.account.findUnique({
        where: { id: data.accountId },
        include: {
          accountType: true,
        },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      // Fixed Deposit Withdrawal Restriction
      if (data.type === TransactionType.WITHDRAWAL && account.accountType.hasFixedPeriod) {
        const today = new Date();
        const maturityDate = account.fixingEndDate;
        if (!maturityDate || today < maturityDate) {
          throw new Error("Direct withdrawal from Fixed Deposit is blocked before maturity. Please use 'Break Deposit' to close the account prematurely.");
        }
      }

      // Check if withdrawal amount exceeds balance
      if (
        data.type === TransactionType.WITHDRAWAL &&
        data.amount > account.balance
      ) {
        throw new Error(
          `Insufficient balance. Available: ${account.balance}, Requested: ${data.amount}`
        );
      }

      // Create the transaction
      const transaction = await tx.transaction.create({
        data: {
          transactionRef,
          memberId: data.memberId,
          institutionId: data.institutionId,
          accountId: data.accountId,
          type: data.type,
          amount: data.amount,
          status: data.status || TransactionStatus.COMPLETED,
          description: data.description || `${data.type} transaction`,
          transactionDate: data.transactionDate || new Date(),
          processedByUserId: data.userId,
          externalReference: data.externalReference,
          channel: data.channel || "Cash",
          paymentMethod: data.paymentMethod,
          paymentReference: data.paymentReference,
          notes: data.notes,
        },
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
          account: {
            include: {
              accountType: true,
              branch: true,
            },
          },
        },
      });

      // Update account balance
      let newBalance = account.balance;
      if (data.type === TransactionType.DEPOSIT) {
        newBalance += data.amount;
      } else if (data.type === TransactionType.WITHDRAWAL) {
        newBalance -= data.amount;
      }

      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: newBalance },
      });

      // Create deposit record if it's a deposit
      if (data.type === TransactionType.DEPOSIT) {
        await tx.deposit.create({
          data: {
            transactionId: transaction.id,
            memberId: data.memberId,
            institutionId: data.institutionId,
            accountId: data.accountId,
            amount: data.amount,
            handlerUserId: data.userId,
            channel: data.channel || "Cash",
            mobileMoneyRef: data.mobileMoneyRef,
            depositorName: data.depositorName,
          },
        });
      }

      // Create withdrawal record if it's a withdrawal
      if (data.type === TransactionType.WITHDRAWAL) {
        await tx.withdrawal.create({
          data: {
            transactionId: transaction.id,
            memberId: data.memberId,
            institutionId: data.institutionId,
            accountId: data.accountId,
            amount: data.amount,
            handlerUserId: data.userId,
            channel: data.channel || "Cash",
            mobileMoneyRef: data.mobileMoneyRef,
          },
        });
      }

      return transaction;
    });

    revalidatePath("/dashboard/transactions");
    revalidatePath(`/dashboard/accounts/${data.accountId}`);

    return {
      success: true,
      data: result,
      message: "Transaction created successfully",
    };
  } catch (error) {
    console.error("Error creating transaction:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create transaction",
    };
  }
}

/**
 * Update transaction
 */
export async function updateTransaction(data: TransactionUpdateDTO) {
  try {
    const transaction = await db.transaction.update({
      where: {
        id: data.id,
      },
      data: {
        description: data.description,
        status: data.status,
        externalReference: data.externalReference,
      },
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
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
      },
    });

    revalidatePath("/dashboard/transactions");
    revalidatePath(`/dashboard/transactions/${data.id}`);

    return {
      success: true,
      data: transaction,
      message: "Transaction updated successfully",
    };
  } catch (error) {
    console.error("Error updating transaction:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update transaction",
    };
  }
}

/**
 * Reverse a transaction
 */
export async function reverseTransaction(data: TransactionReverseDTO) {
  try {
    // Get the original transaction
    const originalTransaction = await db.transaction.findUnique({
      where: { id: data.transactionId },
      include: {
        account: true,
      },
    });

    if (!originalTransaction) {
      return {
        success: false,
        error: "Transaction not found",
      };
    }

    // Check if transaction can be reversed
    if (originalTransaction.status !== TransactionStatus.COMPLETED) {
      return {
        success: false,
        error: "Only completed transactions can be reversed",
      };
    }

    // Check if within 24 hours
    const hoursSinceTransaction =
      (Date.now() - new Date(originalTransaction.transactionDate).getTime()) /
      (1000 * 60 * 60);

    if (hoursSinceTransaction > 24) {
      return {
        success: false,
        error: "Transactions can only be reversed within 24 hours",
      };
    }

    // Create reversal transaction in a transaction
    const result = await db.$transaction(async (tx) => {
      const reversalRef = `REV-${originalTransaction.transactionRef}`;

      const reversalTransaction = await tx.transaction.create({
        data: {
          transactionRef: reversalRef,
          memberId: originalTransaction.memberId,
          institutionId: originalTransaction.institutionId,
          accountId: originalTransaction.accountId,
          type: originalTransaction.type,
          amount: -originalTransaction.amount,
          status: TransactionStatus.COMPLETED,
          description: `Reversal of ${originalTransaction.transactionRef}: ${data.reason}`,
          transactionDate: new Date(),
          processedByUserId: data.userId,
          relatedTransactionId: originalTransaction.id,
          channel: originalTransaction.channel,
        },
      });

      // Mark original transaction as reversed
      await tx.transaction.update({
        where: { id: data.transactionId },
        data: {
          status: TransactionStatus.REVERSED,
          relatedTransactionId: reversalTransaction.id,
        },
      });

      // Update account balance
      const account = originalTransaction.account;
      if (account) {
        let newBalance = account.balance;
        if (originalTransaction.type === TransactionType.DEPOSIT) {
          newBalance -= originalTransaction.amount;
        } else if (originalTransaction.type === TransactionType.WITHDRAWAL) {
          newBalance += originalTransaction.amount;
        }

        await tx.account.update({
          where: { id: account.id },
          data: { balance: newBalance },
        });
      }

      return reversalTransaction;
    });

    revalidatePath("/dashboard/transactions");
    revalidatePath(`/dashboard/transactions/${data.transactionId}`);

    return {
      success: true,
      data: result,
      message: "Transaction reversed successfully",
    };
  } catch (error) {
    console.error("Error reversing transaction:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to reverse transaction",
    };
  }
}

/**
 * Get transaction by ID
 */
export async function getTransactionById(transactionId: string) {
  try {
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
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
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        processedByUser: true,
        deposit: {
          include: {
            handler: true,
          },
        },
        withdrawal: {
          include: {
            handler: true,
          },
        },
      },
    });

    return transaction;
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return null;
  }
}

/**
 * Get members for transaction dropdown/selection
 */
export async function getMembersForTransaction() {
  try {
    const members = await db.member.findMany({
      where: {
        isApproved: true,
      },
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
        accounts: {
          where: {
            status: "ACTIVE",
          },
          include: {
            accountType: true,
            branch: true,
          },
        },
      },
      orderBy: {
        memberNumber: "asc",
      },
    });

    return members;
  } catch (error) {
    console.error("Error fetching members:", error);
    return [];
  }
}

/**
 * Get institutions for transaction dropdown/selection
 */
export async function getInstitutionsForTransaction() {
  try {
    const institutions = await db.institution.findMany({
      where: {
        isApproved: true,
        accounts: {
          some: {
            status: "ACTIVE",
          },
        },
      },
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
        accounts: {
          where: {
            status: "ACTIVE",
          },
          include: {
            accountType: {
              select: {
                id: true,
                name: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
          orderBy: {
            accountNumber: "desc",
          },
        },
      },
      orderBy: {
        institutionName: "asc",
      },
    });

    return institutions;
  } catch (error) {
    console.error("Error fetching institutions for transaction:", error);
    return [];
  }
}

/**
 * Get accounts by member ID
 */
export async function getAccountsByMember(memberId: string) {
  try {
    const accounts = await db.account.findMany({
      where: {
        memberId,
        status: "ACTIVE",
      },
      include: {
        accountType: {
          select: {
            id: true,
            name: true,
            minBalance: true,
            interestRate: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
      orderBy: {
        accountNumber: "desc",
      },
    });

    return accounts;
  } catch (error) {
    console.error("Error fetching accounts by member:", error);
    return [];
  }
}

/**
 * Get accounts by institution ID
 */
export async function getAccountsByInstitution(institutionId: string) {
  try {
    const accounts = await db.account.findMany({
      where: {
        institutionId,
        status: "ACTIVE",
      },
      include: {
        accountType: {
          select: {
            id: true,
            name: true,
            minBalance: true,
            interestRate: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
      orderBy: {
        accountNumber: "desc",
      },
    });

    return accounts;
  } catch (error) {
    console.error("Error fetching accounts by institution:", error);
    return [];
  }
}
