"use server";

import { UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { revalidatePath } from "next/cache";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { TransactionService } from "@/services/transaction.service";
import {
  calculateAgentDepositFee,
  AGENT_DEPOSIT_FEES,
  SCHOOL_FEES_COMMISSION,
} from "@/config/fees";
import { getFeeConfig } from "@/actions/settings/fees";

// actions/deposits.ts - Server Actions for Deposits (All Branches)
// // Get institution's active accounts
// export async function getInstitutionActiveAccounts(institutionId: string) {
//   try {
//     const user = await getAuthUser();
//     if (!user) {
//       throw new Error("Unauthorized");
//     }

//     const whereClause: any = {
//       institutionId,
//       status: "ACTIVE",
//     };

//     if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
//       if (!user.branchId) {
//         throw new Error("User does not have an assigned branch");
//       }
//       whereClause.branchId = user.branchId;
//     }

//     const accounts = await db.account.findMany({
//       where: whereClause,
//       select: {
//         id: true,
//         accountNumber: true,
//         balance: true,
//         accountType: {
//           select: {
//             id: true,
//             name: true,
//             minBalance: true,
//           },
//         },
//         branch: {
//           select: {
//             id: true,
//             name: true,
//           },
//         },
//       },
//       orderBy: {
//         openedAt: "desc",
//       },
//     });

//     return accounts;
//   } catch (error) {
//     console.error("Error fetching institution accounts:", error);
//     throw error;
//   }
// }

// // Get handler's float balance
// export async function getHandlerFloatBalance(handlerId: string) {
//   try {
//     const userFloat = await db.userFloat.findUnique({
//       where: { userId: handlerId },
//       select: {
//         balance: true,
//         isActiveForDay: true,
//       },
//     });

//     if (!userFloat) {
//       return {
//         error: "Float not found for this user",
//         data: null,
//       };
//     }

//     return {
//       data: {
//         userFloat: {
//           balance: userFloat.balance,
//           isActiveForDay: userFloat.isActiveForDay,
//         },
//       },
//     };
//   } catch (error) {
//     console.error("Error fetching float balance:", error);
//     return {
//       error: "Failed to fetch float balance",
//       data: null,
//     };
//   }
// }

// /* ---------------- CREATE OPERATION ---------------- */

// // Create deposit with float validation
// export async function createDeposit(
//   data: DepositCreateDTO,
//   handlerUserId: string
// ) {
//   try {
//     const user = await getAuthUser();
//     if (!user) {
//       return { success: false, error: "Unauthorized" };
//     }

//     // Only TELLER and AGENT can create deposits
//     if (!["TELLER", "AGENT"].includes(user.role)) {
//       return {
//         success: false,
//         error: "Only tellers and agents can process deposits",
//       };
//     }

//     // Check if user has an active float
//     const userFloat = await db.userFloat.findUnique({
//       where: { userId: handlerUserId },
//       select: {
//         id: true,
//         balance: true,
//         isActiveForDay: true,
//         canStartNewDay: true,
//         pendingReconciliation: true,
//       },
//     });

//     if (!userFloat) {
//       return {
//         success: false,
//         error:
//           "You don't have a float account. Please contact your branch manager.",
//       };
//     }

//     if (!userFloat.isActiveForDay) {
//       return {
//         success: false,
//         error: "Your float is not active. Please start your day first.",
//       };
//     }

//     if (userFloat.pendingReconciliation) {
//       return {
//         success: false,
//         error: "Complete end-of-day reconciliation before processing deposits.",
//       };
//     }

//     if (userFloat.balance <= 0) {
//       return {
//         success: false,
//         error: "Your float balance is zero. Request float allocation.",
//       };
//     }

//     // Validate either memberId or institutionId
//     if (!data.memberId && !data.institutionId) {
//       return {
//         success: false,
//         error: "Either member or institution must be selected",
//       };
//     }

//     // Validate amount
//     if (data.amount <= 0) {
//       return {
//         success: false,
//         error: "Deposit amount must be greater than zero",
//       };
//     }

//     // For CASH deposits, ensure sufficient float
//     if (data.channel === "CASH" && userFloat.balance < 1000) {
//       return {
//         success: false,
//         error: `Float balance too low (${formatCurrency(userFloat.balance)}).`,
//       };
//     }

//     // Validate mobile money reference
//     if (data.channel === "MOBILE_MONEY" && !data.mobileMoneyRef?.trim()) {
//       return {
//         success: false,
//         error: "Mobile money reference is required",
//       };
//     }

//     // Validate account
//     const account = await db.account.findFirst({
//       where: {
//         id: data.accountId,
//         ...(data.memberId ? { memberId: data.memberId } : {}),
//         ...(data.institutionId ? { institutionId: data.institutionId } : {}),
//         status: "ACTIVE",
//       },
//       include: {
//         accountType: true,
//         branch: true,
//       },
//     });

//     if (!account) {
//       return {
//         success: false,
//         error: "Account not found or inactive",
//       };
//     }

//     // Verify branch match
//     if (["TELLER", "AGENT"].includes(user.role)) {
//       if (user.branchId !== account.branchId) {
//         return {
//           success: false,
//           error: "Can only process deposits for accounts in your branch",
//         };
//       }
//     }

//     // Create deposit with transaction
//     const deposit = await db.$transaction(async (tx) => {
//       const transactionRef = generateTransactionRef();

//       const transaction = await tx.transaction.create({
//         data: {
//           transactionRef,
//           type: TransactionType.DEPOSIT,
//           amount: data.amount,
//           status: TransactionStatus.COMPLETED,
//           description: data.description || `Deposit via ${data.channel}`,
//           currency: "UGX",
//           branchId: account.branchId,
//           memberId: data.memberId || null,
//           accountId: data.accountId,
//           institutionId: data.institutionId || null,
//           processedByUserId: handlerUserId,
//           channel: data.channel,
//         },
//       });

//       const newDeposit = await tx.deposit.create({
//         data: {
//           transactionId: transaction.id,
//           memberId: data.memberId || null,
//           institutionId: data.institutionId || null,
//           accountId: data.accountId,
//           amount: data.amount,
//           channel: data.channel,
//           mobileMoneyRef: data.mobileMoneyRef?.trim() || null,
//           depositorName: data.depositorName?.trim() || null,
//           depositDate: new Date(),
//           handlerUserId,
//         },
//         include: {
//           transaction: true,
//           member: {
//             include: {
//               user: true,
//             },
//           },
//           institution: {
//             include: {
//               user: true,
//             },
//           },
//           account: {
//             include: {
//               accountType: true,
//               branch: true,
//             },
//           },
//           handler: true,
//         },
//       });

//           entityType: "Deposit",
//           entityId: newDeposit.id,
//           details: JSON.stringify({
//             transactionRef: transaction.transactionRef,
//             amount: data.amount,
//             channel: data.channel,
//             accountNumber: account.accountNumber,
//           }),
//         },
//       });

//       return newDeposit;
//     });

//     revalidatePath("/dashboard/deposits");
//     revalidatePath("/dashboard/accounts");
//     revalidatePath("/dashboard/floats/my-float");

//     return {
//       success: true,
//       deposit,
//       message: `Deposit of ${formatCurrency(data.amount)} processed successfully`,
//     };
//   } catch (error: any) {
//     console.error("Error creating deposit:", error);
//     return {
//       success: false,
//       error: error.message || "Failed to create deposit",
//     };
//   }
// }

// /* ---------------- UTILITY FUNCTIONS ---------------- */

// function formatCurrency(amount: number) {
//   return new Intl.NumberFormat("en-UG", {
//     style: "currency",
//     currency: "UGX",
//     minimumFractionDigits: 0,
//   }).format(amount);
// }

// function generateTransactionRef(): string {
//   const timestamp = Date.now().toString(36).toUpperCase();
//   const random = Math.random().toString(36).substring(2, 8).toUpperCase();
//   return `DEP-${timestamp}-${random}`;
// }

async function getDynamicAgentDepositFees() {
  const result = await getFeeConfig("AGENT_DEPOSIT_FEES");
  return result.success && result.data ? result.data : AGENT_DEPOSIT_FEES;
}

async function getDynamicSchoolFeesConfig() {
  const result = await getFeeConfig("SCHOOL_FEES_COMMISSION");
  return result.success && result.data ? result.data : SCHOOL_FEES_COMMISSION;
}

/* ---------------- TYPES ---------------- */

export interface DepositCreateDTO {
  memberId?: string;
  institutionId?: string;
  accountId: string;
  amount: number;
  channel: string;
  mobileMoneyRef?: string;
  description?: string;
  depositorName?: string;
  depositType?: "DIRECT" | "FEE_PAYMENT";
  feeType?: string;
  studentName?: string;
  studentClass?: string;
  studentYear?: string;
}

export interface DepositStatistics {
  today: {
    amount: number;
    count: number;
  };
  thisMonth: {
    amount: number;
    count: number;
  };
  total: {
    amount: number;
    count: number;
  };
}

/* ---------------- FETCH OPERATIONS - NO BRANCH RESTRICTIONS ---------------- */

// ✅ Fetch all deposits - REMOVED BRANCH FILTERING
export async function getAllDeposits() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {};

    if (
      ["ACCOUNTANT", "TELLER", "AGENT", "BRANCHMANAGER"].includes(user.role)
    ) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      // Filter by the branch where transaction HAPPENED (processing branch)
      whereClause.transaction = {
        branchId: user.branchId,
      };
    }

    // Filter by branch if not ADMIN
    const deposits = await db.deposit.findMany({
      where: whereClause,
      select: {
        id: true,
        transactionId: true,
        memberId: true,
        institutionId: true,
        accountId: true,
        amount: true,
        channel: true,
        mobileMoneyRef: true,
        depositorName: true,
        depositDate: true,
        handlerUserId: true,
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            type: true,
            amount: true,
            status: true,
            description: true,
            currency: true,
            branchId: true,
            notes: true,
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
        depositDate: "desc",
      },
    });

    return deposits;
  } catch (error) {
    console.error("Error fetching deposits:", error);
    throw error;
  }
}

// ✅ Fetch today's deposits - REMOVED BRANCH FILTERING
export async function getTodaysDeposits() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const whereClause: any = {
      depositDate: {
        gte: today,
        lt: tomorrow,
      },
    };

    if (
      ["ACCOUNTANT", "TELLER", "AGENT", "BRANCHMANAGER"].includes(user.role)
    ) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.transaction = {
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
        channel: true,
        mobileMoneyRef: true,
        depositorName: true,
        depositDate: true,
        handlerUserId: true,
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            type: true,
            amount: true,
            status: true,
            description: true,
            currency: true,
            branchId: true,
            notes: true,
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
        depositDate: "desc",
      },
    });

    return deposits;
  } catch (error) {
    console.error("Error fetching today's deposits:", error);
    throw error;
  }
}

// ✅ Fetch monthly deposits - REMOVED BRANCH FILTERING
export async function getMonthlyDeposits() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const whereClause: any = {
      depositDate: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    };

    if (
      ["ACCOUNTANT", "TELLER", "AGENT", "BRANCHMANAGER"].includes(user.role)
    ) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.transaction = {
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
        channel: true,
        mobileMoneyRef: true,
        depositorName: true,
        depositDate: true,
        handlerUserId: true,
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            type: true,
            amount: true,
            status: true,
            description: true,
            currency: true,
            branchId: true,
            notes: true,
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
        depositDate: "desc",
      },
    });

    return deposits;
  } catch (error) {
    console.error("Error fetching monthly deposits:", error);
    throw error;
  }
}

// ✅ Fetch single deposit by ID - REMOVED BRANCH FILTERING
export async function getDepositById(id: string) {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const deposit = await db.deposit.findUnique({
      where: { id },
      select: {
        id: true,
        transactionId: true,
        memberId: true,
        institutionId: true,
        accountId: true,
        amount: true,
        channel: true,
        mobileMoneyRef: true,
        depositorName: true,
        depositDate: true,
        handlerUserId: true,
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            type: true,
            amount: true,
            status: true,
            description: true,
            currency: true,
            branchId: true,
            notes: true,
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
            primaryContactPerson: true,
            primaryContactPhone: true,
            primaryContactEmail: true,
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
    });

    if (!deposit) {
      throw new Error("Deposit not found");
    }

    return deposit;
  } catch (error) {
    console.error("Error fetching deposit:", error);
    throw error;
  }
}

// ✅ Get deposit statistics - REMOVED BRANCH FILTERING
export async function getDepositStatistics(): Promise<DepositStatistics> {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const whereClause: any = {
      transaction: {
        status: TransactionStatus.COMPLETED,
      },
    };

    if (
      ["ACCOUNTANT", "TELLER", "AGENT", "BRANCHMANAGER"].includes(user.role)
    ) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.transaction = {
        ...whereClause.transaction,
        branchId: user.branchId,
      };
    }

    // Statistics filtered by processing branch
    const [todayStats, monthStats, totalStats] = await Promise.all([
      db.deposit.aggregate({
        where: {
          ...whereClause,
          depositDate: {
            gte: today,
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
        amount: Number(todayStats._sum.amount || 0),
        count: todayStats._count,
      },
      thisMonth: {
        amount: Number(monthStats._sum.amount || 0),
        count: monthStats._count,
      },
      total: {
        amount: Number(totalStats._sum.amount || 0),
        count: totalStats._count,
      },
    };
  } catch (error) {
    console.error("Error fetching deposit statistics:", error);
    throw error;
  }
}

/* ---------------- HELPER FUNCTIONS - REMOVED BRANCH FILTERING ---------------- */

// ✅ Get members with active accounts - ALL BRANCHES
export async function getMembersWithActiveAccounts() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      accounts: {
        some: {
          status: "ACTIVE",
        },
      },
    };

    if (user.role !== UserRole.ADMIN) {
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
        accounts: {
          where: {
            status: "ACTIVE",
            ...(whereClause.branchId && { branchId: whereClause.branchId }),
          },
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            accountType: {
              select: {
                name: true,
                isShareAccount: true,
                canWithdraw: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
            institutionId: true,
          },
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
    });

    return members;
  } catch (error) {
    console.error("Error fetching members:", error);
    throw error;
  }
}

// ✅ Get institutions with active accounts - ALL BRANCHES
export async function getInstitutionsWithActiveAccounts() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      accounts: {
        some: {
          status: "ACTIVE",
        },
      },
    };

    if (user.role !== UserRole.ADMIN) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.accounts.some.branchId = user.branchId;
    }

    const institutions = await db.institution.findMany({
      where: whereClause,
      select: {
        id: true,
        institutionNumber: true,
        institutionName: true,
        institutionType: true,
        institutionEmail: true,
        institutionPhone: true,
        accounts: {
          where: {
            status: "ACTIVE",
          },
          select: {
            id: true,
            accountNumber: true,
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
    console.error("Error fetching institutions:", error);
    throw error;
  }
}

// ✅ Get member's active accounts - ALL BRANCHES
export async function getMemberActiveAccounts(memberId: string) {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const accounts = await db.account.findMany({
      where: {
        memberId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        accountNumber: true,
        balance: true,
        customFlatWithdrawalFee: true,
        customWithdrawalFeePercentage: true,
        accountType: {
          select: {
            id: true,
            name: true,
            minBalance: true,
            flatWithdrawalFee: true,
            withdrawalFeePercentage: true,
            isShareAccount: true,
            canWithdraw: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        institutionId: true,
      },
      orderBy: {
        openedAt: "desc",
      },
    });

    return accounts;
  } catch (error) {
    console.error("Error fetching member accounts:", error);
    throw error;
  }
}

// ✅ Get institution's active accounts - ALL BRANCHES
export async function getInstitutionActiveAccounts(institutionId: string) {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const accounts = await db.account.findMany({
      where: {
        institutionId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        accountNumber: true,
        balance: true,
        accountType: {
          select: {
            id: true,
            name: true,
            minBalance: true,
            isShareAccount: true,
            canWithdraw: true,
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
        openedAt: "desc",
      },
    });

    return accounts;
  } catch (error) {
    console.error("Error fetching institution accounts:", error);
    throw error;
  }
}

// Get handler's float balance
export async function getHandlerFloatBalance(handlerId: string) {
  try {
    const userFloat = await db.userFloat.findUnique({
      where: { userId: handlerId },
      select: {
        balance: true,
        isActiveForDay: true,
      },
    });

    if (!userFloat) {
      return {
        error: "Float not found for this user",
        data: null,
      };
    }

    return {
      data: {
        userFloat: {
          balance: userFloat.balance,
          isActiveForDay: userFloat.isActiveForDay,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching float balance:", error);
    return {
      error: "Failed to fetch float balance",
      data: null,
    };
  }
}

/* ---------------- CREATE OPERATION - KEPT BRANCH VALIDATION FOR TELLERS ---------------- */

// ⚠️ Create deposit - TELLERS can still only deposit to any branch
export async function createDeposit(
  data: DepositCreateDTO,
  handlerUserId: string,
) {
  try {
    const result = await TransactionService.processDeposit(data, handlerUserId);

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    revalidatePath("/dashboard/deposits");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/floats/my-float");

    return {
      success: true,
      deposit: result.data,
      message: `Deposit processed successfully`,
    };
  } catch (error: any) {
    console.error("Error creating deposit:", error);
    return {
      success: false,
      error: error.message || "Failed to create deposit",
    };
  }
}

/* ---------------- UTILITY FUNCTIONS ---------------- */

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

function generateTransactionRef(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DEP-${timestamp}-${random}`;
}
