// actions/mobileDeposits.ts
"use server";

import { revalidatePath } from "next/cache";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { db } from "@/prisma/db";

import { getAuthUser } from "@/config/useAuth";
import { MobileMoneyDepositCreateDTO } from "@/types/mobileMoney";

/* ============================================
   FETCH OPERATIONS
   ============================================ */

// Fetch all mobile money deposits
export async function getAllMobileMoneyDeposits() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      channel: "MOBILE_MONEY",
    };

    // Branch-level filtering
    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.account = {
        branchId: user.branchId,
      };
    }

    const deposits = await db.deposit.findMany({
      where: whereClause,
      select: {
        id: true,
        transactionId: true,
        memberId: true,
        institutionId: true,
        accountId: true,
        amount: true,
        depositDate: true,
        handlerUserId: true,
        channel: true,
        mobileMoneyRef: true,
        depositorName: true,
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            status: true,
            description: true,
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
        // ✅ ADD INSTITUTION RELATION
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
        depositDate: "desc",
      },
    });

    return deposits;
  } catch (error) {
    console.error("Error fetching mobile money deposits:", error);
    return [];
  }
}

/* ============================================
   CREATE OPERATIONS
   ============================================ */

// Generate unique transaction reference for mobile money
async function generateMobileMoneyTransactionRef(): Promise<string> {
  let transactionRef: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    transactionRef = `MM${timestamp}${random}`;

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

// Create new mobile money deposit
export async function createMobileMoneyDeposit(
  data: MobileMoneyDepositCreateDTO,
  handlerUserId: string
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { error: "Unauthorized", data: null };
    }

    // Only TELLER and AGENT can create deposits
    if (!["TELLER", "AGENT"].includes(user.role)) {
      return {
        error: "Only tellers and agents can process mobile money deposits",
        data: null,
      };
    }

    // Validate either memberId or institutionId
    if (!data.memberId && !data.institutionId) {
      return {
        error: "Either member or institution must be selected",
        data: null,
      };
    }

    // Validate member if provided
    if (data.memberId) {
      const member = await db.member.findUnique({
        where: { id: data.memberId },
      });

      if (!member) {
        return { error: "Member not found", data: null };
      }
    }

    // Validate institution if provided
    if (data.institutionId) {
      const institution = await db.institution.findUnique({
        where: { id: data.institutionId },
      });

      if (!institution) {
        return { error: "Institution not found", data: null };
      }
    }

    // Validate account exists and belongs to member/institution
    const account = await db.account.findFirst({
      where: {
        id: data.accountId,
        ...(data.memberId ? { memberId: data.memberId } : {}),
        ...(data.institutionId ? { institutionId: data.institutionId } : {}),
        status: "ACTIVE",
      },
      include: {
        accountType: true,
        branch: true,
      },
    });

    if (!account) {
      return {
        error: "Account not found or is not active",
        data: null,
      };
    }

    // Branch-level validation
    if (["TELLER", "AGENT"].includes(user.role)) {
      if (user.branchId !== account.branchId) {
        return {
          error: "Can only process deposits for accounts in your branch",
          data: null,
        };
      }
    }

    // Validate amount
    if (data.amount <= 0) {
      return {
        error: "Deposit amount must be greater than zero",
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
    const existingDeposit = await db.deposit.findFirst({
      where: {
        mobileMoneyRef: data.mobileMoneyRef.trim(),
        channel: "MOBILE_MONEY",
      },
    });

    if (existingDeposit) {
      return {
        error: "This mobile money reference has already been used",
        data: null,
      };
    }

    // Generate unique transaction reference
    const transactionRef = await generateMobileMoneyTransactionRef();

    // Create transaction and deposit in a database transaction
    const result = await db.$transaction(async (tx) => {
      // Create the main transaction record
      const transaction = await tx.transaction.create({
        data: {
          transactionRef,
          memberId: data.memberId || null,
          institutionId: data.institutionId || null,
          accountId: data.accountId,
          type: TransactionType.DEPOSIT,
          amount: data.amount,
          status: TransactionStatus.COMPLETED,
          description:
            data.description || `Mobile Money Deposit - ${data.mobileMoneyRef}`,
          processedByUserId: handlerUserId,
          channel: "MOBILE_MONEY",
          branchId: account.branchId,
        },
      });

      // Create the deposit record
      const deposit = await tx.deposit.create({
        data: {
          transactionId: transaction.id,
          memberId: data.memberId || null,
          institutionId: data.institutionId || null,
          accountId: data.accountId,
          amount: data.amount,
          handlerUserId,
          channel: "MOBILE_MONEY",
          mobileMoneyRef: data.mobileMoneyRef.trim(),
          depositorName: data.depositorName || null,
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

      // Update account balance
      await tx.account.update({
        where: { id: data.accountId },
        data: {
          balance: {
            increment: data.amount,
          },
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: handlerUserId,
          action: "MOBILE_MONEY_DEPOSIT_CREATED",
          entityType: "Deposit",
          entityId: deposit.id,
          details: JSON.stringify({
            transactionRef: transaction.transactionRef,
            amount: data.amount,
            channel: "MOBILE_MONEY",
            mobileMoneyRef: data.mobileMoneyRef,
            accountNumber: account.accountNumber,
          }),
        },
      });

      return deposit;
    });

    revalidatePath("/dashboard/mobile-money/deposits");
    revalidatePath("/dashboard/accounts");

    return {
      error: null,
      data: result,
    };
  } catch (error) {
    console.error("Error creating mobile money deposit:", error);
    return {
      error: "Failed to process mobile money deposit. Please try again.",
      data: null,
    };
  }
}

/* ============================================
   HELPER FUNCTIONS
   ============================================ */

// Get members with active accounts for mobile money deposits
export async function getMembersWithActiveAccountsForMobile() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      isApproved: true,
      accounts: {
        some: {
          status: "ACTIVE",
        },
      },
    };

    // Branch-level filtering
    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.accounts = {
        some: {
          status: "ACTIVE",
          branchId: user.branchId,
        },
      };
    }

    const members = await db.member.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
          },
        },
        accounts: {
          where: {
            status: "ACTIVE",
            ...(user.branchId &&
            ["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)
              ? { branchId: user.branchId }
              : {}),
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
              },
            },
          },
        },
      },
      orderBy: {
        memberNumber: "asc",
      },
    });

    return members;
  } catch (error) {
    console.error("Error fetching members with active accounts:", error);
    return [];
  }
}

// Get institutions with active accounts for mobile money deposits
export async function getInstitutionsWithActiveAccountsForMobile() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      isApproved: true,
      accounts: {
        some: {
          status: "ACTIVE",
        },
      },
    };

    // Branch-level filtering
    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.accounts = {
        some: {
          status: "ACTIVE",
          branchId: user.branchId,
        },
      };
    }

    const institutions = await db.institution.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
          },
        },
        accounts: {
          where: {
            status: "ACTIVE",
            ...(user.branchId &&
            ["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)
              ? { branchId: user.branchId }
              : {}),
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
              },
            },
          },
        },
      },
      orderBy: {
        institutionName: "asc",
      },
    });

    return institutions;
  } catch (error) {
    console.error("Error fetching institutions with active accounts:", error);
    return [];
  }
}

/* ============================================
   STATISTICS
   ============================================ */

// Get mobile money deposit statistics
export async function getMobileMoneyDepositStatistics() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const tomorrow = new Date(startOfDay);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const whereClause: any = {
      channel: "MOBILE_MONEY",
    };

    // Branch-level filtering
    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.account = {
        branchId: user.branchId,
      };
    }

    const [todayDeposits, monthDeposits, totalDeposits] = await Promise.all([
      db.deposit.aggregate({
        where: {
          ...whereClause,
          depositDate: {
            gte: startOfDay,
            lt: tomorrow,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.deposit.aggregate({
        where: {
          ...whereClause,
          depositDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.deposit.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      today: {
        amount: Number(todayDeposits._sum.amount || 0),
        count: todayDeposits._count,
      },
      thisMonth: {
        amount: Number(monthDeposits._sum.amount || 0),
        count: monthDeposits._count,
      },
      total: {
        amount: Number(totalDeposits._sum.amount || 0),
        count: totalDeposits._count,
      },
    };
  } catch (error) {
    console.error("Error fetching mobile money deposit statistics:", error);
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
// Add these functions at the end of your mobileLoanRepayments.ts file, before the utility functions

/* ---------------- HELPER FUNCTIONS ---------------- */

// Get members with active loans for mobile money repayments
export async function getMembersWithActiveLoansForMobile() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      isApproved: true,
      loans: {
        some: {
          status: { in: ["DISBURSED", "OVERDUE"] },
          outstandingBalance: {
            gt: 0,
          },
        },
      },
    };

    // Add branch filtering for non-admin roles
    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.loans.some.branchId = user.branchId;
    }

    const members = await db.member.findMany({
      where: whereClause,
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
        loans: {
          where: {
            status: { in: ["DISBURSED", "OVERDUE"] },
            outstandingBalance: {
              gt: 0,
            },
          },
          select: {
            id: true,
            amountGranted: true,
            outstandingBalance: true,
            dueDate: true,
            loanApplication: {
              select: {
                loanProduct: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        memberNumber: "asc",
      },
    });

    return members;
  } catch (error) {
    console.error("Error fetching members with active loans:", error);
    return [];
  }
}

// Get member's active loans
export async function getMemberActiveLoans(memberId: string) {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      memberId,
      status: { in: ["DISBURSED", "OVERDUE"] },
      outstandingBalance: {
        gt: 0,
      },
    };

    // Add branch filtering for non-admin roles
    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.branchId = user.branchId;
    }

    const loans = await db.loan.findMany({
      where: whereClause,
      select: {
        id: true,
        amountGranted: true,
        interestRate: true,
        totalAmountDue: true,
        amountPaid: true,
        outstandingBalance: true,
        disbursementDate: true,
        dueDate: true,
        status: true,
        loanApplication: {
          select: {
            id: true,
            loanProduct: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        disbursementDate: "desc",
      },
    });

    return loans;
  } catch (error) {
    console.error("Error fetching member active loans:", error);
    return [];
  }
}
