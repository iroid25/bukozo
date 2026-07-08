// actions/transaction-details.ts
"use server";

import { db } from "@/prisma/db";
import { notFound } from "next/navigation";

/**
 * Get detailed transaction information
 */
export async function getTransactionDetails(transactionId: string) {
  try {
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
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
          select: {
            id: true,
            institutionNumber: true,
            institutionName: true,
            institutionEmail: true,
            institutionPhone: true,
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
        account: {
          include: {
            accountType: {
              select: {
                id: true,
                name: true,
                interestRate: true,
                minBalance: true,
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
        },
        processedByUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            role: true,
            email: true,
          },
        },
        deposit: {
          include: {
            handler: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        withdrawal: {
          include: {
            handler: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      notFound();
    }

    return transaction;
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    throw error;
  }
}

/**
 * Get related transactions (reversals, fees, etc.)
 */
export async function getRelatedTransactions(transactionId: string) {
  try {
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        transactionRef: true,
        relatedTransactionId: true,
        type: true,
        amount: true,
      },
    });

    if (!transaction) {
      return {
        reversals: [],
        fees: [],
        related: [],
      };
    }

    // Find reversal transactions
    // Look for transactions that reference this one as reversed
    const reversals = await db.transaction.findMany({
      where: {
        OR: [
          // Transactions that have this transaction as their related transaction and are reversals
          {
            relatedTransactionId: transactionId,
            type: "OTHER",
            description: {
              contains: "reversal",
              mode: "insensitive",
            },
          },
          // Transactions with REV- prefix in reference
          {
            transactionRef: {
              startsWith: `REV-${transaction.transactionRef}`,
            },
          },
        ],
      },
      include: {
        processedByUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        member: {
          select: {
            memberNumber: true,
            user: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        institution: {
          select: {
            institutionNumber: true,
            institutionName: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    // Find fee transactions
    const fees = await db.transaction.findMany({
      where: {
        OR: [
          // Fee type transactions related to this transaction
          {
            relatedTransactionId: transactionId,
            type: "FEE",
          },
          // Transactions with FEE- prefix in reference
          {
            transactionRef: {
              startsWith: `FEE-${transaction.transactionRef}`,
            },
          },
        ],
      },
      include: {
        processedByUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    // Find related transactions
    let related: any[] = [];

    if (transaction.relatedTransactionId) {
      // Get the related transaction
      const relatedTransaction = await db.transaction.findUnique({
        where: { id: transaction.relatedTransactionId },
        include: {
          processedByUser: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          member: {
            select: {
              memberNumber: true,
              user: {
                select: {
                  name: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          institution: {
            select: {
              institutionNumber: true,
              institutionName: true,
            },
          },
        },
      });

      if (relatedTransaction) {
        related.push(relatedTransaction);
      }
    }

    // Also find transactions that reference this transaction
    const referencingTransactions = await db.transaction.findMany({
      where: {
        relatedTransactionId: transactionId,
        id: {
          notIn: [...reversals.map((r) => r.id), ...fees.map((f) => f.id)],
        },
      },
      include: {
        processedByUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        member: {
          select: {
            memberNumber: true,
            user: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        institution: {
          select: {
            institutionNumber: true,
            institutionName: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    related = [...related, ...referencingTransactions];

    return {
      reversals,
      fees,
      related,
    };
  } catch (error) {
    console.error("Error fetching related transactions:", error);
    return {
      reversals: [],
      fees: [],
      related: [],
    };
  }
}

/**
 * Get audit log for transaction
 */
export async function getTransactionAuditLog(transactionId: string) {
  try {
    const auditLogs = await db.auditLog.findMany({
      where: {
        entityType: "Transaction",
        entityId: transactionId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            role: true,
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    return auditLogs;
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return [];
  }
}

/**
 * Get account transaction history (before and after this transaction)
 */
export async function getAccountTransactionHistory(
  accountId: string,
  currentTransactionId: string,
  limit: number = 10
) {
  try {
    const transactions = await db.transaction.findMany({
      where: {
        accountId,
        id: {
          not: currentTransactionId,
        },
      },
      include: {
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        institution: {
          select: {
            id: true,
            institutionNumber: true,
            institutionName: true,
          },
        },
        processedByUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
      take: limit,
    });

    return transactions;
  } catch (error) {
    console.error("Error fetching account transaction history:", error);
    return [];
  }
}
