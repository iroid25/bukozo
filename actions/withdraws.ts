// // actions/withdrawals.ts
// "use server";

// import { revalidatePath } from "next/cache";

// import { TransactionStatus, TransactionType } from "@prisma/client";
// import { db } from "@/prisma/db";
// import { WithdrawalCreateDTO, WithdrawalUpdateDTO } from "@/types/withdraw";

// // Fetch all withdrawals with relations
// export async function getAllWithdrawals() {
//   try {
//     const withdrawals = await db.withdrawal.findMany({
//       include: {
//         transaction: {
//           select: {
//             id: true,
//             transactionRef: true,
//             status: true,
//             description: true,
//           },
//         },
//         member: {
//           include: {
//             user: {
//               select: {
//                 name: true,
//                 email: true,
//                 phone: true,
//                 image: true,
//               },
//             },
//           },
//         },
//         account: {
//           include: {
//             accountType: {
//               select: {
//                 name: true,
//               },
//             },
//             branch: {
//               select: {
//                 name: true,
//                 location: true,
//               },
//             },
//           },
//         },
//         handler: {
//           select: {
//             id: true,
//             name: true,
//             role: true,
//           },
//         },
//       },
//       orderBy: {
//         withdrawalDate: "desc",
//       },
//     });
//     return withdrawals;
//   } catch (error) {
//     console.error("Error fetching withdrawals:", error);
//     return [];
//   }
// }

// // Fetch withdrawals by member ID
// export async function getWithdrawalsByMemberId(memberId: string) {
//   try {
//     const withdrawals = await db.withdrawal.findMany({
//       where: { memberId },
//       include: {
//         transaction: {
//           select: {
//             id: true,
//             transactionRef: true,
//             status: true,
//             description: true,
//           },
//         },
//         account: {
//           include: {
//             accountType: {
//               select: {
//                 name: true,
//               },
//             },
//             branch: {
//               select: {
//                 name: true,
//                 location: true,
//               },
//             },
//           },
//         },
//         handler: {
//           select: {
//             id: true,
//             name: true,
//             role: true,
//           },
//         },
//       },
//       orderBy: {
//         withdrawalDate: "desc",
//       },
//     });
//     return withdrawals;
//   } catch (error) {
//     console.error("Error fetching member withdrawals:", error);
//     return [];
//   }
// }

// // Fetch single withdrawal by ID
// export async function getWithdrawalById(id: string) {
//   try {
//     const withdrawal = await db.withdrawal.findUnique({
//       where: { id },
//       include: {
//         transaction: true,
//         member: {
//           include: {
//             user: true,
//           },
//         },
//         account: {
//           include: {
//             accountType: true,
//             branch: true,
//           },
//         },
//         handler: true,
//       },
//     });
//     return withdrawal;
//   } catch (error) {
//     console.error("Error fetching withdrawal:", error);
//     return null;
//   }
// }

// // Generate unique transaction reference
// async function generateWithdrawalTransactionRef(): Promise<string> {
//   let transactionRef: string;
//   let isUnique = false;
//   let attempts = 0;
//   const maxAttempts = 10;

//   do {
//     const timestamp = Date.now().toString().slice(-8);
//     const random = Math.floor(Math.random() * 10000)
//       .toString()
//       .padStart(4, "0");
//     transactionRef = `WTH${timestamp}${random}`;

//     const existingTransaction = await db.transaction.findUnique({
//       where: { transactionRef },
//     });

//     isUnique = !existingTransaction;
//     attempts++;
//   } while (!isUnique && attempts < maxAttempts);

//   if (!isUnique) {
//     throw new Error("Unable to generate unique transaction reference");
//   }

//   return transactionRef;
// }

// // Create new withdrawal
// export async function createWithdrawal(
//   data: WithdrawalCreateDTO,
//   handlerUserId: string
// ) {
//   try {
//     // Validate member exists
//     const member = await db.member.findUnique({
//       where: { id: data.memberId },
//     });

//     if (!member) {
//       return {
//         error: "Member not found",
//         data: null,
//       };
//     }

//     // Validate account exists and belongs to member
//     const account = await db.account.findFirst({
//       where: {
//         id: data.accountId,
//         memberId: data.memberId,
//         status: "ACTIVE",
//       },
//       include: {
//         accountType: true,
//       },
//     });

//     if (!account) {
//       return {
//         error: "Account not found or is not active",
//         data: null,
//       };
//     }

//     // Validate amount
//     if (data.amount <= 0) {
//       return {
//         error: "Withdrawal amount must be greater than zero",
//         data: null,
//       };
//     }

//     // Check if account has sufficient balance
//     if (account.balance < data.amount) {
//       return {
//         error: `Insufficient balance. Available: ${account.balance}, Requested: ${data.amount}`,
//         data: null,
//       };
//     }

//     // Check if withdrawal would violate minimum balance requirement
//     const newBalance = account.balance - data.amount;
//     if (newBalance < account.accountType.minBalance) {
//       return {
//         error: `Withdrawal would violate minimum balance requirement of ${account.accountType.minBalance}`,
//         data: null,
//       };
//     }

//     // Validate mobile money reference if channel is Mobile Money
//     if (data.channel === "Mobile Money" && !data.mobileMoneyRef?.trim()) {
//       return {
//         error:
//           "Mobile money reference is required for mobile money withdrawals",
//         data: null,
//       };
//     }

//     // Generate unique transaction reference
//     const transactionRef = await generateWithdrawalTransactionRef();

//     // Create transaction and withdrawal in a database transaction
//     const result = await db.$transaction(async (tx) => {
//       // Create the main transaction record
//       const transaction = await tx.transaction.create({
//         data: {
//           transactionRef,
//           memberId: data.memberId,
//           accountId: data.accountId,
//           type: TransactionType.WITHDRAWAL,
//           amount: data.amount,
//           status: TransactionStatus.COMPLETED,
//           description: data.description || `Withdrawal via ${data.channel}`,
//           processedByUserId: handlerUserId,
//           channel: data.channel,
//         },
//       });

//       // Create the withdrawal record
//       const withdrawal = await tx.withdrawal.create({
//         data: {
//           transactionId: transaction.id,
//           memberId: data.memberId,
//           accountId: data.accountId,
//           amount: data.amount,
//           handlerUserId,
//           channel: data.channel,
//           mobileMoneyRef: data.mobileMoneyRef?.trim() || null,
//         },
//         include: {
//           transaction: true,
//           member: {
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

//       // Update account balance
//       await tx.account.update({
//         where: { id: data.accountId },
//         data: {
//           balance: {
//             decrement: data.amount,
//           },
//         },
//       });

//       return withdrawal;
//     });

//     revalidatePath("/dashboard/withdrawals");
//     revalidatePath("/dashboard/accounts");
//     return {
//       error: null,
//       data: result,
//     };
//   } catch (error) {
//     console.error("Error creating withdrawal:", error);
//     return {
//       error: "Failed to create withdrawal. Please try again.",
//       data: null,
//     };
//   }
// }

// // Update withdrawal (limited fields)
// export async function updateWithdrawal(data: WithdrawalUpdateDTO) {
//   try {
//     const updateData: any = {};

//     if (data.description !== undefined) {
//       updateData.description = data.description?.trim() || null;
//     }

//     if (data.mobileMoneyRef !== undefined) {
//       updateData.mobileMoneyRef = data.mobileMoneyRef?.trim() || null;
//     }

//     // Update the transaction description if provided
//     const withdrawal = await db.withdrawal.findUnique({
//       where: { id: data.id },
//       include: { transaction: true },
//     });

//     if (!withdrawal) {
//       return {
//         error: "Withdrawal not found",
//         data: null,
//       };
//     }

//     const result = await db.$transaction(async (tx) => {
//       // Update withdrawal
//       const updatedWithdrawal = await tx.withdrawal.update({
//         where: { id: data.id },
//         data: updateData,
//         include: {
//           transaction: true,
//           member: {
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

//       // Update transaction description if provided
//       if (data.description !== undefined) {
//         await tx.transaction.update({
//           where: { id: withdrawal.transactionId },
//           data: {
//             description: data.description?.trim() || null,
//           },
//         });
//       }

//       return updatedWithdrawal;
//     });

//     revalidatePath("/dashboard/withdrawals");
//     return {
//       error: null,
//       data: result,
//     };
//   } catch (error) {
//     console.error("Error updating withdrawal:", error);
//     return {
//       error: "Failed to update withdrawal. Please try again.",
//       data: null,
//     };
//   }
// }

// // Get withdrawal statistics
// export async function getWithdrawalStatistics() {
//   try {
//     const today = new Date();
//     const startOfDay = new Date(today.setHours(0, 0, 0, 0));
//     const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

//     const [todayWithdrawals, monthWithdrawals, totalWithdrawals] =
//       await Promise.all([
//         db.withdrawal.aggregate({
//           where: {
//             withdrawalDate: {
//               gte: startOfDay,
//             },
//           },
//           _sum: { amount: true },
//           _count: { id: true },
//         }),
//         db.withdrawal.aggregate({
//           where: {
//             withdrawalDate: {
//               gte: startOfMonth,
//             },
//           },
//           _sum: { amount: true },
//           _count: { id: true },
//         }),
//         db.withdrawal.aggregate({
//           _sum: { amount: true },
//           _count: { id: true },
//         }),
//       ]);

//     return {
//       today: {
//         amount: todayWithdrawals._sum.amount || 0,
//         count: todayWithdrawals._count || 0,
//       },
//       thisMonth: {
//         amount: monthWithdrawals._sum.amount || 0,
//         count: monthWithdrawals._count || 0,
//       },
//       total: {
//         amount: totalWithdrawals._sum.amount || 0,
//         count: totalWithdrawals._count || 0,
//       },
//     };
//   } catch (error) {
//     console.error("Error fetching withdrawal statistics:", error);
//     return {
//       today: {
//         amount: 0,
//         count: {
//           id: 0,
//         },
//       },
//       thisMonth: {
//         amount: 0,
//         count: {
//           id: 0,
//         },
//       },
//       total: {
//         amount: 0,
//         count: {
//           id: 0,
//         },
//       },
//     };
//   }
// }

// actions/withdrawals.ts
"use server";

import { revalidatePath } from "next/cache";

import { TransactionStatus, TransactionType } from "@prisma/client";
import { db } from "@/prisma/db";
import type {
  WithdrawalCreateDTO,
  WithdrawalUpdateDTO,
} from "@/types/withdraw";
import { 
  AGENT_WITHDRAWAL_FEES, 
  calculateAgentWithdrawalFee,
} from "@/config/fees";
import { getFeeConfig } from "@/actions/settings/fees";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";
import { TransactionService } from "@/services/transaction.service";

async function getDynamicAgentWithdrawalFees() {
  const result = await getFeeConfig("AGENT_WITHDRAWAL_FEES");
  return (result.success && result.data) ? result.data : AGENT_WITHDRAWAL_FEES;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Fetch all withdrawals with relations
export async function getAllWithdrawals() {
  try {
    const withdrawals = await db.withdrawal.findMany({
      include: {
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            status: true,
            description: true,
          },
        },
        institution: {
          select: {
            id: true,
            institutionName: true,
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
            accountType: {
              select: {
                name: true,
              },
            },
            branch: {
              select: {
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
    console.error("Error fetching withdrawals:", error);
    return [];
  }
}

// Fetch withdrawals by member ID
export async function getWithdrawalsByMemberId(memberId: string) {
  try {
    const withdrawals = await db.withdrawal.findMany({
      where: { memberId },
      include: {
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            status: true,
            description: true,
          },
        },
        account: {
          include: {
            accountType: {
              select: {
                name: true,
              },
            },
            branch: {
              select: {
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
    console.error("Error fetching member withdrawals:", error);
    return [];
  }
}

// Fetch single withdrawal by ID
export async function getWithdrawalById(id: string) {
  try {
    const withdrawal = await db.withdrawal.findUnique({
      where: { id },
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
            signatories: true,
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
    return withdrawal;
  } catch (error) {
    console.error("Error fetching withdrawal:", error);
    return null;
  }
}

// Generate unique transaction reference
async function generateWithdrawalTransactionRef(): Promise<string> {
  let transactionRef: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    transactionRef = `WTH${timestamp}${random}`;

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

// Create new withdrawal
export async function createWithdrawal(
  data: WithdrawalCreateDTO,
  handlerUserId: string
) {
  try {
    const result = await TransactionService.processWithdrawal(data, handlerUserId);
    
    if (!result.ok) {
      return {
        error: result.error,
        data: null,
      };
    }

    try {
      revalidatePath("/dashboard/withdrawals");
      revalidatePath("/dashboard/accounts");
      revalidatePath("/dashboard/floats/my-float");
    } catch {}

    return {
      error: null,
      data: result.data,
    };
  } catch (error) {
    console.error("Error creating withdrawal:", error);
    return {
      error: "Failed to create withdrawal. Please try again.",
      data: null,
    };
  }
}

// Update withdrawal (limited fields)
export async function updateWithdrawal(data: WithdrawalUpdateDTO) {
  try {
    const updateData: any = {};

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    if (data.mobileMoneyRef !== undefined) {
      updateData.mobileMoneyRef = data.mobileMoneyRef?.trim() || null;
    }

    // Update the transaction description if provided
    const withdrawal = await db.withdrawal.findUnique({
      where: { id: data.id },
      include: { transaction: true },
    });

    if (!withdrawal) {
      return {
        error: "Withdrawal not found",
        data: null,
      };
    }

    const result = await db.$transaction(async (tx) => {
      // Update withdrawal
      const updatedWithdrawal = await tx.withdrawal.update({
        where: { id: data.id },
        data: updateData,
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

      // Update transaction description if provided
      if (data.description !== undefined) {
        await tx.transaction.update({
          where: { id: withdrawal.transactionId },
          data: {
            description: data.description?.trim() || null,
          },
        });
      }

      return updatedWithdrawal;
    });

    revalidatePath("/dashboard/withdrawals");
    return {
      error: null,
      data: result,
    };
  } catch (error) {
    console.error("Error updating withdrawal:", error);
    return {
      error: "Failed to update withdrawal. Please try again.",
      data: null,
    };
  }
}

// Get withdrawal statistics
export async function getWithdrawalStatistics() {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayWithdrawals, monthWithdrawals, totalWithdrawals] =
      await Promise.all([
        db.withdrawal.aggregate({
          where: {
            withdrawalDate: {
              gte: startOfDay,
            },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        db.withdrawal.aggregate({
          where: {
            withdrawalDate: {
              gte: startOfMonth,
            },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        db.withdrawal.aggregate({
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

    return {
      today: {
        amount: todayWithdrawals._sum.amount || 0,
        count: todayWithdrawals._count || 0,
      },
      thisMonth: {
        amount: monthWithdrawals._sum.amount || 0,
        count: monthWithdrawals._count || 0,
      },
      total: {
        amount: totalWithdrawals._sum.amount || 0,
        count: totalWithdrawals._count || 0,
      },
    };
  } catch (error) {
    console.error("Error fetching withdrawal statistics:", error);
    return {
      today: {
        amount: 0,
        count: {
          id: 0,
        },
      },
      thisMonth: {
        amount: 0,
        count: {
          id: 0,
        },
      },
      total: {
        amount: 0,
        count: {
          id: 0,
        },
      },
    };
  }
}
