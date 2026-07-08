// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { db } from "@/prisma/db";
import { MobileMoneyWithdrawalCreateDTO } from "@/types/mobileMoney";
import { getFeeConfig } from "@/actions/settings/fees";
import { 
  MOBILE_MONEY_TRANSFER_FEES, 
  MOBILE_MONEY_SERVICE_FEE, 
  calculateMobileMoneyFee 
} from "@/config/fees";

// Helper to get fee tiers dynamically or fallback
async function getDynamicMobileFees() {
  const result = await getFeeConfig("MOBILE_MONEY_FEES");
  return (result.success && result.data) ? result.data : MOBILE_MONEY_TRANSFER_FEES;
}

// Fetch all mobile money withdrawals
export async function getAllMobileMoneyWithdrawals() {
  try {
    const withdrawals = await db.withdrawal.findMany({
      where: {
        channel: "Mobile Money",
      },
      select: {
        id: true,
        transactionId: true,
        memberId: true,
        institutionId: true,
        accountId: true,
        amount: true,
        withdrawalDate: true,
        handlerUserId: true,
        channel: true,
        mobileMoneyRef: true,
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            status: true,
            description: true,
            transactionDate: true,
          },
        },
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: {
              select: {
                id: true,
                name: true,
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
            institutionType: true,
            institutionEmail: true,
            institutionPhone: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        account: {
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            accountType: {
              select: {
                id: true,
                name: true,
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
        handler: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        withdrawalDate: "desc",
      },
    });

    return withdrawals;
  } catch (error) {
    console.error("Error fetching mobile money withdrawals:", error);
    return [];
  }
}

// Generate unique transaction reference for mobile money withdrawal
async function generateMobileMoneyWithdrawalRef(): Promise<string> {
  let transactionRef: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    transactionRef = `MW${timestamp}${random}`;

    const existingTransaction = await db.transaction.findUnique({
      where: { transactionRef },
    });

    isUnique = !existingTransaction;
    attempts++;
  } while (!isUnique && attempts < maxAttempts);

  if (!isUnique) {
    throw new Error("Unable to generate unique transaction reference");
  }

  return transactionRef;
}

// Create new mobile money withdrawal
export async function createMobileMoneyWithdrawal(
  data: MobileMoneyWithdrawalCreateDTO,
  handlerUserId: string
) {
  try {
    // Check if either memberId or institutionId is provided
    if (!data.memberId && !data.institutionId) {
      return {
        error: "Either member or institution must be specified",
        data: null,
      };
    }

    // Validate member if memberId is provided
    if (data.memberId) {
      const member = await db.member.findUnique({
        where: { id: data.memberId },
      });

      if (!member) {
        return {
          error: "Member not found",
          data: null,
        };
      }
    }

    // Validate institution if institutionId is provided
    if (data.institutionId) {
      const institution = await db.institution.findUnique({
        where: { id: data.institutionId },
      });

      if (!institution) {
        return {
          error: "Institution not found",
          data: null,
        };
      }
    }

    // Validate account exists and belongs to member or institution
    const account = await db.account.findFirst({
      where: {
        id: data.accountId,
        ...(data.memberId ? { memberId: data.memberId } : {}),
        ...(data.institutionId ? { institutionId: data.institutionId } : {}),
        status: "ACTIVE",
      },
      include: {
        accountType: true,
      },
    });

    if (!account) {
      return {
        error: "Account not found or is not active",
        data: null,
      };
    }

    // Restrict to Voluntary Savings Only
    if (!account.accountType.name.toLowerCase().includes("voluntary")) {
      return {
        error: "Mobile money withdrawals are only allowed from Voluntary Savings accounts.",
        data: null,
      };
    }

    // Validate amount
    if (data.amount <= 0) {
      return {
        error: "Withdrawal amount must be greater than zero",
        data: null,
      };
    }

    // 3. Calculate Fees (Dynamic)
    const feeTiers = await getDynamicMobileFees();
    // Re-implement calculation locally to support dynamic tiers structure
    const transferFee = (feeTiers as any).find((t: any) => data.amount >= t.min && (t.max === 0 || data.amount <= t.max))?.fee || 0;
    
    // Fallback to config function if zero (or handle as 0) - logic kept simple for now:
    
    const serviceFee = MOBILE_MONEY_SERVICE_FEE;
    const totalDeduction = data.amount + transferFee + serviceFee;

    // Check if account has sufficient balance
    if (account.balance < totalDeduction) {
      return {
        error: `Insufficient funds. Required: ${totalDeduction.toLocaleString()} (Amount: ${data.amount}, Fee: ${transferFee}, Service: ${serviceFee}). Available: ${account.balance.toLocaleString()}`,
        data: null,
      };
    }

    // Check minimum balance requirement
    if (account.balance - totalDeduction < account.accountType.minBalance) {
      return {
        error: `Withdrawal would leave account below minimum balance of ${account.accountType.minBalance}`,
        data: null,
      };
    }

    // Validate mobile money reference
    if (!data.mobileMoneyRef?.trim()) {
      return {
        error: "Mobile money reference is required",
        data: null,
      };
    }

    // Check if mobile money reference already exists
    const existingWithdrawal = await db.withdrawal.findFirst({
      where: {
        mobileMoneyRef: data.mobileMoneyRef.trim(),
        channel: "Mobile Money",
      },
    });

    if (existingWithdrawal) {
      return {
        error: "This mobile money reference has already been used",
        data: null,
      };
    }

    // Generate unique transaction reference
    const transactionRef = await generateMobileMoneyWithdrawalRef();

    // Create transaction and withdrawal in a database transaction
    const result = await db.$transaction(async (tx:any) => {
      // Create the main transaction record
      const transaction = await tx.transaction.create({
        data: {
          transactionRef,
          memberId: data.memberId || null,
          institutionId: data.institutionId || null,
          accountId: data.accountId,
          type: TransactionType.WITHDRAWAL,
          amount: data.amount, // Record principal amount
          status: TransactionStatus.COMPLETED,
          description:
            data.description ||
            `Mobile Money Withdrawal - ${data.mobileMoneyRef}. Fees: ${transferFee + serviceFee}`,
          processedByUserId: handlerUserId,
          channel: "Mobile Money",
        },
      });

      // Create the withdrawal record
      const withdrawal = await tx.withdrawal.create({
        data: {
          transactionId: transaction.id,
          memberId: data.memberId || null,
          institutionId: data.institutionId || null,
          accountId: data.accountId,
          amount: data.amount,
          handlerUserId,
          channel: "Mobile Money",
          mobileMoneyRef: data.mobileMoneyRef.trim(),
        },
        include: {
          transaction: true,
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
          handler: true,
        },
      });

      // Update account balance (Deduct Principal + Fees)
      await tx.account.update({
        where: { id: data.accountId },
        data: {
          balance: {
            decrement: totalDeduction,
          },
        },
      });

      return withdrawal;
    });

    revalidatePath("/dashboard/mobile-money/withdrawals");
    revalidatePath("/dashboard/accounts");
    return {
      error: null,
      data: result,
    };
  } catch (error) {
    console.error("Error creating mobile money withdrawal:", error);
    return {
      error: "Failed to process mobile money withdrawal. Please try again.",
      data: null,
    };
  }
}

// Get mobile money withdrawal statistics
export async function getMobileMoneyWithdrawalStatistics() {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayWithdrawals, monthWithdrawals, totalWithdrawals] =
      await Promise.all([
        db.withdrawal.aggregate({
          where: {
            channel: "Mobile Money",
            withdrawalDate: {
              gte: startOfDay,
            },
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        db.withdrawal.aggregate({
          where: {
            channel: "Mobile Money",
            withdrawalDate: {
              gte: startOfMonth,
            },
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        db.withdrawal.aggregate({
          where: {
            channel: "Mobile Money",
            withdrawalDate: {
              gte: startOfMonth,
            },
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ]);

    return {
      today: {
        amount: todayWithdrawals._sum.amount || 0,
        count: todayWithdrawals._count._all,
      },
      thisMonth: {
        amount: monthWithdrawals._sum.amount || 0,
        count: monthWithdrawals._count._all,
      },
      total: {
        amount: totalWithdrawals._sum.amount || 0,
        count: totalWithdrawals._count._all,
      },
    };
  } catch (error) {
    console.error("Error fetching mobile money withdrawal statistics:", error);
    return {
      today: {
        amount: 0,
        count: 0,
      },
      thisMonth: {
        amount: 0,
        count: 0,
      },
      total: {
        amount: 0,
        count: 0,
      },
    };
  }
}
