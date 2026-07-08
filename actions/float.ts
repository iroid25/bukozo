// @ts-nocheck
// "use server";

// import { revalidatePath } from "next/cache";
// import { db } from "@/prisma/db";
// import {
//   TransactionType,
//   UserRole,
//   ReconciliationStatus,
//   ReconciliationType,
// } from "@prisma/client";
// import {
//   FloatAllocationCreateDTO,
//   FloatTransactionCreateDTO,
// } from "@/types/float";

// /* ---------------- Utilities ---------------- */

// function isSameCalendarDay(a?: Date | null, b?: Date | null) {
//   if (!a || !b) return false;
//   const A = new Date(a),
//     B = new Date(b);
//   return (
//     A.getFullYear() === B.getFullYear() &&
//     A.getMonth() === B.getMonth() &&
//     A.getDate() === B.getDate()
//   );
// }

// async function assertAccountant(userId: string) {
//   const u = await db.user.findUnique({
//     where: { id: userId },
//     select: { role: true },
//   });
//   if (!u) return "Allocating user not found";
//   if (u.role !== UserRole.ACCOUNTANT)
//     return "Only an ACCOUNTANT can allocate float";
//   return null;
// }

// /* ---------------- Fetchers ---------------- */

// export async function getAllUserFloats() {
//   try {
//     return await db.userFloat.findMany({
//       include: {
//         user: {
//           include: { branch: { select: { name: true, location: true } } },
//         },
//         floatTransactions: {
//           include: { performedByUser: { select: { name: true, role: true } } },
//           orderBy: { transactionDate: "desc" },
//           take: 5,
//         },
//         floatReconciliation: {
//           include: { reconciledByUser: { select: { name: true, role: true } } },
//           orderBy: { reconciliationDate: "desc" },
//           take: 3,
//         },
//       },
//       orderBy: { user: { name: "asc" } },
//     });
//   } catch (error) {
//     console.error("Error fetching user floats:", error);
//     return [];
//   }
// }

// export async function getAllFloatTransactions() {
//   try {
//     return await db.floatTransaction.findMany({
//       include: {
//         float: {
//           include: {
//             user: {
//               include: { branch: { select: { name: true, location: true } } },
//             },
//           },
//         },
//         performedByUser: { select: { id: true, name: true, role: true } },
//       },
//       orderBy: { transactionDate: "desc" },
//     });
//   } catch (error) {
//     console.error("Error fetching float transactions:", error);
//     return [];
//   }
// }

// export async function getAllFloatAllocations() {
//   try {
//     return await db.floatAllocation.findMany({
//       include: {
//         branch: true,
//         tellerAgent: {
//           select: {
//             id: true,
//             name: true,
//             role: true,
//             email: true,
//             phone: true,
//           },
//         },
//         allocatedByUser: { select: { id: true, name: true, role: true } },
//       },
//       orderBy: { allocationDate: "desc" },
//     });
//   } catch (error) {
//     console.error("Error fetching floats allocations:", error);
//     return [];
//   }
// }

// export async function getAllFloatReconciliations() {
//   try {
//     return await db.floatReconciliation.findMany({
//       include: {
//         float: {
//           include: {
//             user: {
//               include: { branch: { select: { name: true, location: true } } },
//             },
//           },
//         },
//         reconciledByUser: { select: { id: true, name: true, role: true } },
//         approvedByUser: { select: { id: true, name: true, role: true } },
//       },
//       orderBy: { reconciliationDate: "desc" },
//     });
//   } catch (error) {
//     console.error("Error fetching float reconciliations:", error);
//     return [];
//   }
// }

// export async function getFloatStatistics() {
//   try {
//     const [
//       totalFloats,
//       totalBalance,
//       activeFloats,
//       pendingReconciliations,
//       todayAllocations,
//       todayReconciliations,
//     ] = await Promise.all([
//       db.userFloat.count(),
//       db.userFloat.aggregate({ _sum: { balance: true } }),
//       db.userFloat.count({ where: { balance: { gt: 0 } } }),
//       db.userFloat.count({
//         where: {
//           OR: [
//             { lastReconciliation: null },
//             {
//               lastReconciliation: {
//                 lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
//               },
//             },
//           ],
//         },
//       }),
//       db.floatAllocation.count({
//         where: {
//           allocationDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
//         },
//       }),
//       db.floatReconciliation.count({
//         where: {
//           reconciliationDate: {
//             gte: new Date(new Date().setHours(0, 0, 0, 0)),
//           },
//         },
//       }),
//     ]);

//     const branchAllocations = await db.floatAllocation.groupBy({
//       by: ["branchId"],
//       _sum: { amount: true },
//       _count: true,
//       where: {
//         allocationDate: {
//           gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
//         },
//       },
//     });

//     const reconciliationStatus = await db.floatReconciliation.groupBy({
//       by: ["isBalanced"],
//       _count: true,
//       where: {
//         reconciliationDate: {
//           gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
//         },
//       },
//     });

//     return {
//       totalFloats,
//       totalBalance: totalBalance._sum.balance || 0,
//       activeFloats,
//       pendingReconciliations,
//       todayAllocations,
//       todayReconciliations,
//       branchAllocations: branchAllocations.map((i) => ({
//         branchId: i.branchId,
//         amount: i._sum.amount || 0,
//         count: i._count,
//       })),
//       reconciliationStatus: {
//         balanced: reconciliationStatus.find((i) => i.isBalanced)?._count || 0,
//         unbalanced:
//           reconciliationStatus.find((i) => !i.isBalanced)?._count || 0,
//       },
//     };
//   } catch (error) {
//     console.error("Error fetching float statistics:", error);
//     return {
//       totalFloats: 0,
//       totalBalance: 0,
//       activeFloats: 0,
//       pendingReconciliations: 0,
//       todayAllocations: 0,
//       todayReconciliations: 0,
//       branchAllocations: [],
//       reconciliationStatus: { balanced: 0, unbalanced: 0 },
//     };
//   }
// }

// export async function getPendingReconciliations() {
//   try {
//     return await db.floatReconciliation.findMany({
//       where: { status: ReconciliationStatus.PENDING, isEndOfDay: true },
//       include: {
//         float: { include: { user: { include: { branch: true } } } },
//         reconciledByUser: true,
//       },
//       orderBy: { reconciliationDate: "desc" },
//     });
//   } catch (error) {
//     console.error("Error fetching pending reconciliations:", error);
//     return [];
//   }
// }

// export async function getUnreconciledTellers() {
//   try {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     return await db.userFloat.findMany({
//       where: {
//         isActiveForDay: true,
//         OR: [
//           { pendingReconciliation: true },
//           { currentDayStarted: { lt: today } },
//         ],
//       },
//       include: { user: { include: { branch: true } } },
//     });
//   } catch (error) {
//     console.error("Error fetching unreconciled tellers:", error);
//     return [];
//   }
// }

// /* ---------------- Allocation (Accountant-only + day rules) ---------------- */

// export async function createFloatAllocation(
//   data: FloatAllocationCreateDTO,
//   allocatedByUserId: string
// ) {
//   try {
//     const roleError = await assertAccountant(allocatedByUserId);
//     if (roleError) return { error: roleError, data: null };

//     const teller = await db.user.findUnique({
//       where: { id: data.tellerAgentId },
//       include: { userFloat: true },
//     });
//     if (!teller) return { error: "Teller/Agent not found", data: null };
//     if (![UserRole.TELLER, UserRole.AGENT].includes(teller.role as UserRole)) {
//       return {
//         error: "Only tellers and agents can receive float allocations",
//         data: null,
//       };
//     }
//     if (data.amount <= 0)
//       return {
//         error: "Allocation amount must be greater than zero",
//         data: null,
//       };

//     const branch = await db.branch.findUnique({ where: { id: data.branchId } });
//     if (!branch) return { error: "Branch not found", data: null };

//     const f = teller.userFloat;
//     const now = new Date();
//     const isStartOfDay = !f || !f.isActiveForDay;

//     if (isStartOfDay) {
//       if (f && !f.canStartNewDay) {
//         return {
//           error: "Previous day not reconciled. EOD must be approved first.",
//           data: null,
//         };
//       }
//     } else {
//       if (!isSameCalendarDay(f.currentDayStarted, now)) {
//         return {
//           error: "Active day is stale. Submit end-of-day first.",
//           data: null,
//         };
//       }
//       if (f.pendingReconciliation) {
//         return {
//           error: "Reconciliation pending. Additional allocations are blocked.",
//           data: null,
//         };
//       }
//     }

//     const created = await db.$transaction(async (tx) => {
//       const allocation = await tx.floatAllocation.create({
//         data: {
//           branchId: data.branchId,
//           tellerAgentId: data.tellerAgentId,
//           amount: data.amount,
//           description: data.description?.trim() || null,
//           allocatedByUserId,
//         },
//         include: {
//           branch: true,
//           tellerAgent: {
//             select: {
//               id: true,
//               name: true,
//               role: true,
//               email: true,
//               phone: true,
//             },
//           },
//           allocatedByUser: { select: { id: true, name: true, role: true } },
//         },
//       });

//       let uf =
//         f ??
//         (await tx.userFloat.create({
//           data: {
//             userId: data.tellerAgentId,
//             balance: 0,
//             canStartNewDay: true,
//           },
//         }));

//       const startToday = !uf.isActiveForDay;
//       uf = await tx.userFloat.update({
//         where: { id: uf.id },
//         data: {
//           balance: uf.balance + data.amount,
//           ...(startToday
//             ? {
//                 currentDayStarted: now,
//                 isActiveForDay: true,
//                 canStartNewDay: false,
//                 pendingReconciliation: false,
//               }
//             : {}),
//         },
//       });

//       await tx.floatTransaction.create({
//         data: {
//           floatId: uf.id,
//           type: TransactionType.FLOAT_ALLOCATION,
//           amount: data.amount,
//           description: startToday
//             ? "Start-of-day float allocation"
//             : "Same-day top-up allocation",
//           performedByUserId: allocatedByUserId,
//         },
//       });

//       if (startToday) {
//         await tx.floatReconciliation.create({
//           data: {
//             floatId: uf.id,
//             actualCash: uf.balance,
//             systemBalance: uf.balance,
//             difference: 0,
//             isBalanced: true,
//             reconciledByUserId: data.tellerAgentId,
//             status: ReconciliationStatus.APPROVED,
//             approvedByUserId: allocatedByUserId,
//             approvalDate: now,
//             reconciliationType: ReconciliationType.START_OF_DAY,
//             isEndOfDay: false,
//             notes: "Start of day - float received",
//           },
//         });
//       }

//       return allocation;
//     });

//     revalidatePath("/dashboard/floats");
//     return { error: null, data: created };
//   } catch (error: any) {
//     console.error("Error creating float allocation:", error);
//     return {
//       error: "Failed to create float allocation. Please try again.",
//       data: null,
//     };
//   }
// }

// /* ---------------- Transactions / helpers ---------------- */

// export async function createFloatTransaction(
//   data: FloatTransactionCreateDTO,
//   performedByUserId: string
// ) {
//   try {
//     const performingUser = await db.user.findUnique({
//       where: { id: performedByUserId },
//       select: { id: true, name: true, role: true },
//     });
//     if (!performingUser)
//       return { error: "User performing transaction not found", data: null };

//     const userFloat = await db.userFloat.findUnique({
//       where: { id: data.floatId },
//       include: { user: true },
//     });
//     if (!userFloat) return { error: "User float not found", data: null };
//     if (data.amount === 0)
//       return { error: "Transaction amount cannot be zero", data: null };

//     const isOutgoing =
//       [TransactionType.WITHDRAWAL, TransactionType.OTHER].includes(
//         data.type as TransactionType
//       ) && data.amount > 0;
//     if (isOutgoing && userFloat.balance < data.amount) {
//       return { error: "Insufficient float balance", data: null };
//     }

//     const result = await db.$transaction(async (tx) => {
//       const transaction = await tx.floatTransaction.create({
//         data: {
//           floatId: data.floatId,
//           type: data.type,
//           amount: data.amount,
//           description: data.description?.trim() || null,
//           relatedTransactionId: data.relatedTransactionId || null,
//           performedByUserId,
//         },
//         include: {
//           float: {
//             include: {
//               user: {
//                 include: { branch: { select: { name: true, location: true } } },
//               },
//             },
//           },
//           performedByUser: { select: { id: true, name: true, role: true } },
//         },
//       });

//       let balanceChange = 0;
//       switch (data.type as TransactionType) {
//         case TransactionType.FLOAT_ALLOCATION:
//         case TransactionType.FLOAT_PURCHASE:
//         case TransactionType.DEPOSIT:
//           balanceChange = data.amount;
//           break;
//         case TransactionType.WITHDRAWAL:
//           balanceChange = -data.amount;
//           break;
//         case TransactionType.FLOAT_RECONCILIATION:
//           balanceChange = data.amount;
//           break;
//         case TransactionType.OTHER:
//           balanceChange = data.amount;
//           break;
//       }

//       await tx.userFloat.update({
//         where: { id: data.floatId },
//         data: { balance: Math.max(0, userFloat.balance + balanceChange) },
//       });

//       return transaction;
//     });

//     revalidatePath("/dashboard/floats");
//     return { error: null, data: result };
//   } catch (error) {
//     console.error("Error creating float transaction:", error);
//     return {
//       error: "Failed to create float transaction. Please try again.",
//       data: null,
//     };
//   }
// }

// export async function getEligibleFloatUsers() {
//   try {
//     return await db.user.findMany({
//       where: { role: { in: ["TELLER", "AGENT"] }, isActive: true },
//       include: {
//         branch: { select: { id: true, name: true, location: true } },
//         userFloat: { select: { balance: true, lastReconciliation: true } },
//       },
//       orderBy: { name: "asc" },
//     });
//   } catch (error) {
//     console.error("Error fetching eligible float users:", error);
//     return [];
//   }
// }

// export async function getAllBranches() {
//   try {
//     return await db.branch.findMany({ orderBy: { name: "asc" } });
//   } catch (error) {
//     console.error("Error fetching branches:", error);
//     return [];
//   }
// }

// export async function validateUserExists(userId: string) {
//   try {
//     const user = await db.user.findUnique({
//       where: { id: userId },
//       select: { id: true },
//     });
//     return !!user;
//   } catch (error) {
//     console.error("Error validating user:", error);
//     return false;
//   }
// }

// export async function getUserFloatByUserId(userId: string) {
//   try {
//     const userFloat = await db.userFloat.findFirst({
//       where: { userId },
//       include: {
//         user: {
//           include: { branch: { select: { name: true, location: true } } },
//         },
//         floatTransactions: {
//           include: { performedByUser: { select: { name: true, role: true } } },
//           orderBy: { transactionDate: "desc" },
//           take: 10,
//         },
//         floatReconciliation: {
//           include: { reconciledByUser: { select: { name: true, role: true } } },
//           orderBy: { reconciliationDate: "desc" },
//           take: 5,
//         },
//       },
//     });
//     return userFloat;
//   } catch (error) {
//     console.error("Error fetching user float by userId:", error);
//     return null;
//   }
// }

// export async function getFloatTransactions(floatId: string) {
//   try {
//     return await db.floatTransaction.findMany({
//       where: { floatId },
//       include: {
//         float: {
//           include: {
//             user: {
//               include: { branch: { select: { name: true, location: true } } },
//             },
//           },
//         },
//         performedByUser: { select: { id: true, name: true, role: true } },
//       },
//       orderBy: { transactionDate: "desc" },
//     });
//   } catch (error) {
//     console.error("Error fetching float transactions:", error);
//     return [];
//   }
// }

// export async function getFloatReconciliations(floatId: string) {
//   try {
//     return await db.floatReconciliation.findMany({
//       where: { floatId },
//       include: {
//         float: {
//           include: {
//             user: {
//               include: { branch: { select: { name: true, location: true } } },
//             },
//           },
//         },
//         reconciledByUser: { select: { id: true, name: true, role: true } },
//       },
//       orderBy: { reconciliationDate: "desc" },
//     });
//   } catch (error) {
//     console.error("Error fetching float reconciliations:", error);
//     return [];
//   }
// }

// /* ---------------- Check if Teller Can Start Day ---------------- */

// export async function canTellerStartDay(userId: string) {
//   try {
//     const user = await db.user.findUnique({
//       where: { id: userId },
//       include: {
//         userFloat: {
//           include: {
//             floatReconciliation: {
//               where: { isEndOfDay: true },
//               orderBy: { reconciliationDate: "desc" },
//               take: 1,
//             },
//           },
//         },
//       },
//     });

//     if (!user) {
//       return {
//         canStart: false,
//         reason: "User not found",
//       };
//     }

//     // Only tellers and agents can start days
//     if (![UserRole.TELLER, UserRole.AGENT].includes(user.role as UserRole)) {
//       return {
//         canStart: false,
//         reason: "Only tellers and agents can start a day",
//       };
//     }

//     const userFloat = user.userFloat;

//     // If no float exists yet, they can start (will be created on first allocation)
//     if (!userFloat) {
//       return {
//         canStart: true,
//         reason: null,
//       };
//     }

//     // If they have an active day already started today
//     if (userFloat.isActiveForDay) {
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);
//       const dayStarted = userFloat.currentDayStarted
//         ? new Date(userFloat.currentDayStarted)
//         : null;

//       if (dayStarted) {
//         dayStarted.setHours(0, 0, 0, 0);

//         if (dayStarted.getTime() === today.getTime()) {
//           return {
//             canStart: false,
//             reason: "Day already started. You have an active float session.",
//           };
//         } else {
//           // Active day is from a previous date (stale)
//           return {
//             canStart: false,
//             reason:
//               "Previous day not closed. Please submit end-of-day reconciliation first.",
//           };
//         }
//       }
//     }

//     // Check if there's a pending reconciliation
//     if (userFloat.pendingReconciliation) {
//       return {
//         canStart: false,
//         reason:
//           "Pending end-of-day reconciliation awaiting approval. Cannot start new day.",
//       };
//     }

//     // Check if they can start a new day (previous day must be reconciled)
//     if (!userFloat.canStartNewDay) {
//       return {
//         canStart: false,
//         reason:
//           "Previous day not properly reconciled. End-of-day must be approved first.",
//       };
//     }

//     // All checks passed
//     return {
//       canStart: true,
//       reason: null,
//     };
//   } catch (error) {
//     console.error("Error checking if teller can start day:", error);
//     return {
//       canStart: false,
//       reason: "Error checking day start eligibility. Please contact support.",
//     };
//   }
// }
// // float reset
// // actions/float.ts - Enhanced resetUserFloat function
// // Replace the existing resetUserFloat function with this enhanced version

// interface FloatResetDTO {
//   userFloatId: string;
//   resetType: "FULL_RESET" | "BALANCE_ONLY" | "STATUS_ONLY";
//   newBalance?: number;
//   reason: string;
// }

// export async function resetUserFloat(
//   data: FloatResetDTO,
//   performedByUserId: string
// ) {
//   try {
//     // Verify user is authorized (ADMIN or ACCOUNTANT)
//     const performingUser = await db.user.findUnique({
//       where: { id: performedByUserId },
//       select: {
//         role: true,
//         name: true,
//         userFloat: {
//           select: {
//             id: true,
//             balance: true,
//           },
//         },
//       },
//     });

//     if (!performingUser) {
//       return { error: "User not found", data: null };
//     }

//     if (!["ADMIN", "ACCOUNTANT"].includes(performingUser.role as string)) {
//       return {
//         error: "Only administrators and accountants can reset float balances",
//         data: null,
//       };
//     }

//     // Get the user float
//     const userFloat = await db.userFloat.findUnique({
//       where: { id: data.userFloatId },
//       include: {
//         user: {
//           select: {
//             name: true,
//             email: true,
//             role: true,
//           },
//         },
//       },
//     });

//     if (!userFloat) {
//       return { error: "User float not found", data: null };
//     }

//     // Validate reason
//     if (!data.reason || data.reason.trim().length < 10) {
//       return {
//         error: "Please provide a detailed reason (minimum 10 characters)",
//         data: null,
//       };
//     }

//     const result = await db.$transaction(async (tx) => {
//       let updateData: any = {};
//       let description = "";
//       let floatReturnedAmount = 0; // Amount being returned to accountant
//       let balanceAdjustment = 0; // Net change in teller's balance

//       // Calculate amounts based on reset type
//       switch (data.resetType) {
//         case "FULL_RESET":
//           floatReturnedAmount = userFloat.balance; // All balance returned
//           balanceAdjustment = -userFloat.balance; // Balance goes to 0
//           updateData = {
//             balance: 0,
//             isActiveForDay: false,
//             canStartNewDay: true,
//             pendingReconciliation: false,
//             currentDayStarted: null,
//             lastReconciliation: new Date(),
//           };
//           description = `Full float reset: Balance of ${formatCurrency(userFloat.balance)} returned to system. All status flags cleared. User can now start new day. Reason: ${data.reason}`;
//           break;

//         case "BALANCE_ONLY":
//           if (data.newBalance === undefined) {
//             throw new Error("New balance is required for BALANCE_ONLY reset");
//           }
//           if (data.newBalance < 0) {
//             throw new Error("Balance cannot be negative");
//           }

//           floatReturnedAmount = Math.max(
//             0,
//             userFloat.balance - data.newBalance
//           );
//           balanceAdjustment = data.newBalance - userFloat.balance;

//           updateData = {
//             balance: data.newBalance,
//           };
//           description = `Balance reset: Changed from ${formatCurrency(userFloat.balance)} to ${formatCurrency(data.newBalance)}. ${floatReturnedAmount > 0 ? `${formatCurrency(floatReturnedAmount)} returned to system.` : `${formatCurrency(Math.abs(balanceAdjustment))} added from system.`} Reason: ${data.reason}`;
//           break;

//         case "STATUS_ONLY":
//           floatReturnedAmount = 0; // No balance change
//           balanceAdjustment = 0;
//           updateData = {
//             isActiveForDay: false,
//             canStartNewDay: true,
//             pendingReconciliation: false,
//             currentDayStarted: null,
//             lastReconciliation: new Date(),
//           };
//           description = `Status reset: Status flags cleared, balance unchanged at ${formatCurrency(userFloat.balance)}. User can now start new day. Reason: ${data.reason}`;
//           break;

//         default:
//           throw new Error("Invalid reset type");
//       }

//       // 1. Update the teller's float
//       const updatedFloat = await tx.userFloat.update({
//         where: { id: data.userFloatId },
//         data: updateData,
//         include: {
//           user: {
//             include: { branch: { select: { name: true, location: true } } },
//           },
//         },
//       });

//       // 2. Log the reset as a float transaction for the teller
//       await tx.floatTransaction.create({
//         data: {
//           floatId: userFloat.id,
//           type: TransactionType.OTHER,
//           amount: balanceAdjustment,
//           description,
//           performedByUserId,
//         },
//       });

//       // 3. Create automatic reconciliation record
//       const reconciliationData = {
//         floatId: userFloat.id,
//         actualCash: data.resetType === "BALANCE_ONLY" ? data.newBalance! : 0,
//         systemBalance: userFloat.balance,
//         cashOnHand: data.resetType === "BALANCE_ONLY" ? data.newBalance! : 0,
//         floatReturned: floatReturnedAmount,
//         difference:
//           data.resetType === "BALANCE_ONLY"
//             ? data.newBalance! - userFloat.balance
//             : -userFloat.balance,
//         isBalanced: true,
//         reconciledByUserId: performedByUserId,
//         status: ReconciliationStatus.APPROVED,
//         approvedByUserId: performedByUserId,
//         approvalDate: new Date(),
//         reconciliationType: ReconciliationType.REGULAR,
//         isEndOfDay: false,
//         notes: `Administrative reset reconciliation - ${data.resetType}: ${data.reason}. Performed by ${performingUser.name}. ${floatReturnedAmount > 0 ? `Float returned: ${formatCurrency(floatReturnedAmount)}` : "No float returned"}. User ${userFloat.user.name} can now start a new day.`,
//       };

//       await tx.floatReconciliation.create({
//         data: reconciliationData,
//       });

//       // 4. Update accountant's system balance (add returned float)
//       if (floatReturnedAmount > 0 && performingUser.userFloat) {
//         await tx.userFloat.update({
//           where: { id: performingUser.userFloat.id },
//           data: {
//             balance: {
//               increment: floatReturnedAmount,
//             },
//           },
//         });

//         // Log transaction for accountant
//         await tx.floatTransaction.create({
//           data: {
//             floatId: performingUser.userFloat.id,
//             type: TransactionType.FLOAT_RECONCILIATION,
//             amount: floatReturnedAmount,
//             description: `Float returned from reset: ${userFloat.user.name} - ${data.resetType}. ${formatCurrency(floatReturnedAmount)} added to system balance.`,
//             performedByUserId,
//             relatedTransactionId: userFloat.id,
//           },
//         });
//       }

//       // 5. Create audit log
//       await tx.auditLog.create({
//         data: {
//           userId: performedByUserId,
//           action: "FLOAT_RESET_WITH_RECONCILIATION",
//           entityType: "UserFloat",
//           entityId: userFloat.id,
//           oldValue: {
//             balance: userFloat.balance,
//             isActiveForDay: userFloat.isActiveForDay,
//             canStartNewDay: userFloat.canStartNewDay,
//             pendingReconciliation: userFloat.pendingReconciliation,
//             currentDayStarted: userFloat.currentDayStarted,
//             resetType: data.resetType,
//           },
//           newValue: {
//             ...updateData,
//             floatReturned: floatReturnedAmount,
//             accountantBalanceIncreased: floatReturnedAmount > 0,
//           },
//           details: `Float reset with automatic reconciliation performed by ${performingUser.name}. Type: ${data.resetType}. Target User: ${userFloat.user.name} (${userFloat.user.role}). Float returned to system: ${formatCurrency(floatReturnedAmount)}. Reason: ${data.reason}`,
//         },
//       });

//       return {
//         updatedFloat,
//         floatReturned: floatReturnedAmount,
//         reconciled: true,
//         accountantBalanceUpdated: floatReturnedAmount > 0,
//       };
//     });

//     // Revalidate all relevant paths
//     revalidatePath("/dashboard/accountant/reset-float");
//     revalidatePath("/dashboard/floats");
//     revalidatePath("/dashboard/accountant/allocate-float");
//     revalidatePath("/dashboard/accountant/reconciliations");
//     revalidatePath(`/dashboard/floats/users/${userFloat.userId}`);

//     return {
//       error: null,
//       data: result,
//       message: `Float reset successful. ${userFloat.user.name} can now start a new day. ${result.floatReturned > 0 ? `${formatCurrency(result.floatReturned)} returned to system balance.` : ""}`,
//     };
//   } catch (error: any) {
//     console.error("Error resetting user float:", error);
//     return {
//       error: error.message || "Failed to reset float. Please try again.",
//       data: null,
//     };
//   }
// }

// // Helper function to format currency
// function formatCurrency(amount: number) {
//   return new Intl.NumberFormat("en-UG", {
//     style: "currency",
//     currency: "UGX",
//     minimumFractionDigits: 0,
//   }).format(amount);
// }

// // Enhanced function to get accountant's system balance
// export async function getAccountantSystemBalance(accountantId: string) {
//   try {
//     const accountant = await db.user.findUnique({
//       where: { id: accountantId },
//       include: {
//         userFloat: {
//           include: {
//             floatTransactions: {
//               where: {
//                 OR: [
//                   { type: TransactionType.FLOAT_RECONCILIATION },
//                   { type: TransactionType.FLOAT_ALLOCATION },
//                 ],
//               },
//               orderBy: { transactionDate: "desc" },
//               take: 50,
//             },
//           },
//         },
//       },
//     });

//     if (!accountant || !accountant.userFloat) {
//       return {
//         balance: 0,
//         totalAllocated: 0,
//         totalReturned: 0,
//         transactions: [],
//       };
//     }

//     // Calculate totals
//     const totalAllocated = accountant.userFloat.floatTransactions
//       .filter(
//         (t) => t.type === TransactionType.FLOAT_ALLOCATION && t.amount < 0
//       )
//       .reduce((sum, t) => sum + Math.abs(t.amount), 0);

//     const totalReturned = accountant.userFloat.floatTransactions
//       .filter(
//         (t) => t.type === TransactionType.FLOAT_RECONCILIATION && t.amount > 0
//       )
//       .reduce((sum, t) => sum + t.amount, 0);

//     return {
//       balance: accountant.userFloat.balance,
//       totalAllocated,
//       totalReturned,
//       transactions: accountant.userFloat.floatTransactions,
//     };
//   } catch (error) {
//     console.error("Error fetching accountant system balance:", error);
//     return {
//       balance: 0,
//       totalAllocated: 0,
//       totalReturned: 0,
//       transactions: [],
//     };
//   }
// }

// // New function to get reset history with reconciliation details
// export async function getFloatResetHistoryWithReconciliation(
//   userFloatId?: string
// ) {
//   try {
//     const whereClause: any = {
//       action: "FLOAT_RESET_WITH_RECONCILIATION",
//       entityType: "UserFloat",
//     };

//     if (userFloatId) {
//       whereClause.entityId = userFloatId;
//     }

//     const resetHistory = await db.auditLog.findMany({
//       where: whereClause,
//       include: {
//         user: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//             role: true,
//           },
//         },
//       },
//       orderBy: { timestamp: "desc" },
//       take: 100,
//     });

//     return resetHistory.map((log) => ({
//       id: log.id,
//       timestamp: log.timestamp,
//       performedBy: log.user,
//       oldValue: log.oldValue,
//       newValue: log.newValue,
//       details: log.details,
//       floatReturned: (log.newValue as any)?.floatReturned || 0,
//       accountantBalanceUpdated:
//         (log.newValue as any)?.accountantBalanceUpdated || false,
//     }));
//   } catch (error) {
//     console.error("Error festching float reset history:", error);
//     return [];
//   }
// }

// actions/float.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/prisma/db";
import {
  TransactionType,
  UserRole,
  ReconciliationStatus,
  ReconciliationType,
  VaultTransactionType,
} from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

/* ---------------- Utilities ---------------- */

/**
 * Get current user with branch information
 */
async function getCurrentUserWithBranch() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/login"); // Redirect if no session

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
      branchId: true,
      branch: {
        select: {
            id: true,
            name: true,
        },
      },
    },
  });

  if (!user) redirect("/login"); // Redirect if user not in DB
  return user;
}

/**
 * Build branch filter based on user role
 */
function getBranchFilter(user: { role: UserRole; branchId: string | null }) {
  // ACCOUNTANT can only see their branch
  if (user.role === UserRole.ACCOUNTANT) {
    if (!user.branchId) {
      throw new Error("Accountant must be assigned to a branch");
    }
    return { branchId: user.branchId };
  }

  // ADMIN and BRANCHMANAGER can see all branches
  return {};
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

function isSameCalendarDay(a?: Date | null, b?: Date | null) {
  if (!a || !b) return false;
  const A = new Date(a),
    B = new Date(b);
  return (
    A.getFullYear() === B.getFullYear() &&
    A.getMonth() === B.getMonth() &&
    A.getDate() === B.getDate()
  );
}

/* ---------------- Fetchers with Branch Filtering ---------------- */

/**
 * Get all float allocations with branch filtering
 */
export async function getAllFloatAllocations() {
  try {
    const user = await getCurrentUserWithBranch();
    const branchFilter = getBranchFilter(user);

    return await db.floatAllocation.findMany({
      where: branchFilter,
      include: {
        branch: true,
        tellerAgent: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            phone: true,
          },
        },
        allocatedByUser: { select: { id: true, name: true, role: true } },
      },
      orderBy: { allocationDate: "desc" },
    });
  } catch (error) {
    console.error("Error fetching float allocations:", error);
    return [];
  }
}

/**
 * Get eligible float users (tellers/agents) with branch filtering
 */
// export async function getEligibleFloatUsers() {
//   try {
//     const user = await getCurrentUserWithBranch();
//     const branchFilter = getBranchFilter(user);

//     const users = await db.user.findMany({
//       where: {
//         role: { in: ["TELLER", "AGENT"] },
//         isActive: true,
//         ...branchFilter,
//       },
//       include: {
//         branch: {
//           select: {
//             id: true,
//             name: true,
//             location: true,
//           },
//         },
//         userFloat: {
//           select: {
//             id: true,
//             balance: true,
//             isActiveForDay: true,
//             canStartNewDay: true,
//             pendingReconciliation: true,
//             currentDayStarted: true,
//             lastReconciliation: true,
//           },
//         },
//       },
//       orderBy: { name: "asc" },
//     });

//     return users.map((u) => ({
//       id: u.id,
//       name: u.name,
//       email: u.email,
//       role: u.role,
//       branch: u.branch
//         ? {
//             id: u.branch.id,
//             name: u.branch.name,
//             location: u.branch.location,
//           }
//         : undefined,
//       floatStatus: u.userFloat
//         ? {
//             balance: u.userFloat.balance,
//             isActiveForDay: u.userFloat.isActiveForDay,
//             canStartNewDay: u.userFloat.canStartNewDay,
//             pendingReconciliation: u.userFloat.pendingReconciliation,
//             currentDayStarted: u.userFloat.currentDayStarted,
//             lastReconciliation: u.userFloat.lastReconciliation,
//           }
//         : null,
//     }));
//   } catch (error) {
//     console.error("Error fetching eligible float users:", error);
//     return [];
//   }
// }

/**
 * Get all branches - ACCOUNTANT sees only their branch
 */
export async function getAllBranches() {
  try {
    const user = await getCurrentUserWithBranch();

    // Build branch-specific filter for Branch table
    let whereClause = {};

    // ACCOUNTANT can only see their branch
    if (user.role === UserRole.ACCOUNTANT) {
      if (!user.branchId) {
        throw new Error("Accountant must be assigned to a branch");
      }
      whereClause = { id: user.branchId };
    }
    // ADMIN and BRANCHMANAGER see all branches

    return await db.branch.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        location: true,
      },
    });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return [];
  }
}

/**
 * Get pending reconciliations with branch filtering
 */
export async function getPendingReconciliations() {
  try {
    const user = await getCurrentUserWithBranch();
    const branchFilter = getBranchFilter(user);

    return await db.floatReconciliation.findMany({
      where: {
        status: ReconciliationStatus.PENDING,
        isEndOfDay: true,
        float: {
          user: branchFilter,
        },
      },
      include: {
        float: { include: { user: { include: { branch: true } } } },
        reconciledByUser: true,
      },
      orderBy: { reconciliationDate: "desc" },
    });
  } catch (error) {
    console.error("Error fetching pending reconciliations:", error);
    return [];
  }
}

/**
 * Get all user floats with branch filtering
 */
export async function getAllUserFloats() {
  try {
    const user = await getCurrentUserWithBranch();
    const branchFilter = getBranchFilter(user);

    return await db.userFloat.findMany({
      where: {
        user: branchFilter,
      },
      include: {
        user: {
          include: { branch: { select: { name: true, location: true } } },
        },
        floatTransactions: {
          include: { performedByUser: { select: { name: true, role: true } } },
          orderBy: { transactionDate: "desc" },
          take: 5,
        },
        floatReconciliation: {
          include: { reconciledByUser: { select: { name: true, role: true } } },
          orderBy: { reconciliationDate: "desc" },
          take: 3,
        },
      },
      orderBy: { user: { name: "asc" } },
    });
  } catch (error) {
    console.error("Error fetching user floats:", error);
    return [];
  }
}

/**
 * Get all float transactions with branch filtering
 */
export async function getAllFloatTransactions() {
  try {
    const user = await getCurrentUserWithBranch();
    const branchFilter = getBranchFilter(user);

    return await db.floatTransaction.findMany({
      where: {
        float: {
          user: branchFilter,
        },
      },
      include: {
        float: {
          include: {
            user: {
              include: { branch: { select: { name: true, location: true } } },
            },
          },
        },
        performedByUser: { select: { id: true, name: true, role: true } },
      },
      orderBy: { transactionDate: "desc" },
    });
  } catch (error) {
    console.error("Error fetching float transactions:", error);
    return [];
  }
}

/**
 * Get user float by userId with branch check
 */
export async function getUserFloatByUserId(userId: string) {
  try {
    const currentUser = await getCurrentUserWithBranch();
    const branchFilter = getBranchFilter(currentUser);

    const userFloat = await db.userFloat.findFirst({
      where: {
        userId,
        user: branchFilter,
      },
      include: {
        user: {
          include: { branch: { select: { name: true, location: true } } },
        },
        floatTransactions: {
          include: { performedByUser: { select: { name: true, role: true } } },
          orderBy: { transactionDate: "desc" },
          take: 10,
        },
        floatReconciliation: {
          include: { reconciledByUser: { select: { name: true, role: true } } },
          orderBy: { reconciliationDate: "desc" },
          take: 5,
        },
      },
    });
    return userFloat;
  } catch (error) {
    console.error("Error fetching user float by userId:", error);
    return null;
  }
}

/* ---------------- Can Teller Start Day ---------------- */

/**
 * Check if a teller can start a new day
 */
export async function canTellerStartDay(userId: string) {
  try {
    if (!userId) {
      return {
        canStart: false,
        reason: "User ID is required",
        userFloat: null,
      };
    }

    const userFloat = await db.userFloat.findFirst({
      where: { userId: userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!userFloat) {
      return {
        canStart: false,
        reason:
          "No float account found. Please contact your branch manager to create one.",
        userFloat: null,
      };
    }

    if (userFloat.pendingReconciliation) {
      return {
        canStart: false,
        reason:
          "You have a pending reconciliation awaiting approval. Cannot start a new day until approved.",
        userFloat: userFloat,
        hasPendingReconciliation: true,
      };
    }

    if (userFloat.isActiveForDay) {
      return {
        canStart: false,
        reason:
          "Your day is already active. Complete end-of-day reconciliation before starting a new day.",
        userFloat: userFloat,
        isDayActive: true,
      };
    }

    if (!userFloat.canStartNewDay) {
      return {
        canStart: false,
        reason:
          "Cannot start new day. Please complete previous day's reconciliation or contact accountant.",
        userFloat: userFloat,
      };
    }

    const minimumBalance = 0;
    if (userFloat.balance < minimumBalance) {
      return {
        canStart: false,
        reason: `Insufficient float balance. Minimum required: UGX ${minimumBalance.toLocaleString()}`,
        userFloat: userFloat,
      };
    }

    return {
      canStart: true,
      reason: "You can start a new day",
      userFloat: userFloat,
      currentBalance: userFloat.balance,
    };
  } catch (error) {
    console.error("Error checking if teller can start day:", error);
    return {
      canStart: false,
      reason: "Error checking day status. Please contact support.",
      userFloat: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Start a new day for a teller
 */
export async function startTellerDay(userId: string) {
  try {
    if (!userId) {
      return {
        success: false,
        error: "User ID is required",
      };
    }

    const dayCheck = await canTellerStartDay(userId);

    if (!dayCheck.canStart) {
      return {
        success: false,
        error: dayCheck.reason,
      };
    }

    const userFloat = await db.userFloat.findFirst({
      where: { userId: userId },
    });

    if (!userFloat) {
      return {
        success: false,
        error: "Float not found",
      };
    }

    await db.$transaction(async (tx) => {
      await tx.userFloat.update({
        where: { id: userFloat.id },
        data: {
          isActiveForDay: true,
          canStartNewDay: false,
          currentDayStarted: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: userId,
          action: "DAY_STARTED",
          entityType: "UserFloat",
          entityId: userFloat.id,
          details: JSON.stringify({
            startBalance: userFloat.balance,
            startTime: new Date(),
          }),
        },
      });
    });

    revalidatePath("/dashboard/floats/my-float");

    return {
      success: true,
      message: "Day started successfully",
      startBalance: userFloat.balance,
    };
  } catch (error) {
    console.error("Error starting teller day:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start day",
    };
  }
}

/* ---------------- Float Allocation with Branch Check ---------------- */

export async function createFloatAllocation(
  data: {
    tellerAgentId: string;
    branchId: string;
    amount: number;
    description?: string;
  },
  allocatorId: string
) {
  try {
    console.log("🎯 Starting float allocation process:", {
      tellerAgentId: data.tellerAgentId,
      branchId: data.branchId,
      amount: data.amount,
      allocatorId,
    });

    if (!data.tellerAgentId || !data.branchId || !allocatorId) {
      return { error: "Missing required fields" };
    }

    if (data.amount <= 0) {
      return { error: "Amount must be greater than zero" };
    }

    // Get current user to check branch permissions
    const currentUser = await getCurrentUserWithBranch();

    // ACCOUNTANT can only allocate to their own branch
    if (currentUser.role === UserRole.ACCOUNTANT) {
      if (data.branchId !== currentUser.branchId) {
        return {
          error: "You can only allocate float to tellers in your branch",
        };
      }
    }

    const allocator = await db.user.findUnique({
      where: { id: allocatorId },
      select: {
        role: true,
        name: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!allocator) {
      return { error: "Allocator not found" };
    }

    console.log("👤 Allocator:", allocator.name, allocator.role);

    const authorizedRoles: UserRole[] = [
      UserRole.ACCOUNTANT,
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
    ];
    if (!authorizedRoles.includes(allocator.role as UserRole)) {
      return {
        error:
          "Only accountants, admins, and branch managers can allocate float",
      };
    }

    const tellerAgent = await db.user.findUnique({
      where: { id: data.tellerAgentId },
      include: {
        userFloat: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!tellerAgent) {
      return { error: "Teller/Agent not found" };
    }

    if (!tellerAgent.isActive) {
      return { error: "Teller/Agent is not active" };
    }

    // Verify teller is in the same branch (for ACCOUNTANT)
    if (currentUser.role === UserRole.ACCOUNTANT) {
      if (tellerAgent.branchId !== currentUser.branchId) {
        return {
          error: "Cannot allocate float to tellers outside your branch",
        };
      }
    }

    console.log("👥 Teller/Agent:", tellerAgent.name, tellerAgent.role);

    if (tellerAgent.userFloat) {
      if (tellerAgent.userFloat.pendingReconciliation) {
        return {
          error:
            "Cannot allocate float. Teller has pending end-of-day reconciliation.",
        };
      }

      // if (!tellerAgent.userFloat.canStartNewDay) {
      //   return {
      //     error: "Cannot allocate float. Previous day not reconciled.",
      //   };
      // }

      if (
        tellerAgent.userFloat.isActiveForDay &&
        tellerAgent.userFloat.currentDayStarted
      ) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayStarted = new Date(tellerAgent.userFloat.currentDayStarted);
        dayStarted.setHours(0, 0, 0, 0);

        if (dayStarted.getTime() < today.getTime()) {
          return {
            error:
              "Cannot allocate float. Teller's active day is stale. Must submit EOD first.",
          };
        }
      }
    }

    // ✅ Branch-centric vault lookup (Prevents multiple vaults for same branch)
    let vault = await db.vault.findFirst({
      where: {
        branchId: allocator.branchId!,
        isActive: true,
      },
    });

    console.log(
      "🏦 Vault lookup (Branch-centric):",
      vault ? `Found ${vault.name} (Balance: ${vault.balance})` : "Not found"
    );

    if (!vault) {
      if (
        allocator.role !== UserRole.ACCOUNTANT &&
        allocator.role !== UserRole.ADMIN
      ) {
        return {
          error: "Vault not found. Please contact system administrator.",
        };
      }

      if (!allocator.branchId) {
        return { error: "Branch information required to initialize vault" };
      }

      // Special case: If an accountant is initializing, they become the custodian
      const INITIAL_BALANCE = 60000000;

      console.log("💰 Initializing new Branch Vault with balance:", INITIAL_BALANCE);

      try {
        vault = await db.$transaction(async (tx) => {
          // Double check inside transaction to avoid race conditions
          const existingVault = await tx.vault.findFirst({
            where: { branchId: allocator.branchId!, isActive: true },
          });

          if (existingVault) return existingVault;

          const newVault = await tx.vault.create({
            data: {
              name: `Branch Vault - ${allocator.branch?.name || "Main"}`,
              branchId: allocator.branchId!,
              balance: INITIAL_BALANCE,
              physicalCash: INITIAL_BALANCE,
              custodianUserId: allocatorId,
              isActive: true,
              location: "Main Office",
            },
          });

          await tx.vaultTransaction.create({
            data: {
              vaultId: newVault.id,
              type: VaultTransactionType.INITIAL_DEPOSIT,
              amount: INITIAL_BALANCE,
              balanceBefore: 0,
              balanceAfter: INITIAL_BALANCE,
              description: "Initial vault setup - 60M UGX",
              performedByUserId: allocatorId,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: allocatorId,
              action: "VAULT_INITIALIZED",
              entityType: "Vault",
              entityId: newVault.id,
              details: JSON.stringify({
                initialBalance: INITIAL_BALANCE,
                vaultName: newVault.name,
                triggeredBy: "FLOAT_ALLOCATION_REQUEST",
              }),
            },
          });

          return newVault;
        });

        console.log(
          `✅ Vault initialized successfully with ${INITIAL_BALANCE} UGX`
        );
      } catch (error) {
        console.error("❌ Error initializing vault:", error);
        return {
          error: "Failed to initialize vault. Please try again.",
        };
      }
    }

    if (!vault || vault.balance < data.amount) {
      console.error("💸 Insufficient vault balance:", {
        available: vault?.balance || 0,
        requested: data.amount,
      });
      return {
        error: `Insufficient vault balance. Available: ${formatCurrency(vault?.balance || 0)}, Requested: ${formatCurrency(data.amount)}`,
      };
    }

    console.log("✓ Vault balance sufficient");

    const branch = await db.branch.findUnique({
      where: { id: data.branchId },
    });

    if (!branch) {
      return { error: "Branch not found" };
    }

    console.log("💼 Starting database transaction...");

    const result = await db.$transaction(async (tx) => {
      const newVaultBalance = vault.balance - data.amount;

      await tx.vault.update({
        where: { id: vault.id },
        data: {
          balance: newVaultBalance,
          lastVerified: new Date(),
        },
      });

      console.log(
        `📉 Vault balance updated: ${vault.balance} → ${newVaultBalance}`
      );

      await tx.vaultTransaction.create({
        data: {
          vaultId: vault.id,
          type: VaultTransactionType.FLOAT_ALLOCATION,
          amount: -data.amount,
          balanceBefore: vault.balance,
          balanceAfter: newVaultBalance,
          description: `Float allocation to ${tellerAgent.name} (${tellerAgent.role}) - ${data.description || "Daily float"}`,
          performedByUserId: allocatorId,
          relatedUserId: data.tellerAgentId,
        },
      });

      let userFloat = tellerAgent.userFloat;

      if (!userFloat) {
        console.log("🆕 Creating new float record for user");
        userFloat = await tx.userFloat.create({
          data: {
            userId: data.tellerAgentId,
            balance: data.amount,
            lastReconciliation: null,
            isActiveForDay: true,
            currentDayStarted: new Date(),
            canStartNewDay: false,
            pendingReconciliation: false,
          },
        });
      } else {
        const newFloatBalance = userFloat.balance + data.amount;
        console.log(
          `📈 Updating float balance: ${userFloat.balance} → ${newFloatBalance}`
        );

        await tx.userFloat.update({
          where: { id: userFloat.id },
          data: {
            balance: newFloatBalance,
            isActiveForDay: true,
            currentDayStarted: userFloat.currentDayStarted || new Date(),
            canStartNewDay: false,
          },
        });

        userFloat = { ...userFloat, balance: newFloatBalance };
      }

      const floatAllocation = await tx.floatAllocation.create({
        data: {
          branchId: data.branchId,
          tellerAgentId: data.tellerAgentId,
          amount: data.amount,
          allocationDate: new Date(),
          allocatedByUserId: allocatorId,
          description: data.description || null,
        },
        include: {
          tellerAgent: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
          allocatedByUser: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

      await tx.floatTransaction.create({
        data: {
          floatId: userFloat.id,
          type: TransactionType.FLOAT_ALLOCATION,
          amount: data.amount,
          transactionDate: new Date(),
          description: `Float allocated by ${allocator.name} - ${data.description || "Daily float"}`,
          performedByUserId: allocatorId,
          relatedTransactionId: floatAllocation.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: allocatorId,
          action: "FLOAT_ALLOCATED_WITH_VAULT",
          entityType: "FloatAllocation",
          entityId: floatAllocation.id,
          details: JSON.stringify({
            allocatorName: allocator.name,
            tellerName: tellerAgent.name,
            tellerRole: tellerAgent.role,
            branchName: branch.name,
            amount: data.amount,
            vaultBalanceBefore: vault.balance,
            vaultBalanceAfter: newVaultBalance,
            floatBalanceBefore: tellerAgent.userFloat?.balance || 0,
            floatBalanceAfter: userFloat.balance,
            description: data.description,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      return {
        allocation: floatAllocation,
        vaultBalance: newVaultBalance,
        floatBalance: userFloat.balance,
      };
    });

    console.log("✅ Transaction completed successfully");

    revalidatePath("/dashboard/accountant/vault");
    revalidatePath("/dashboard/accountant/allocate-float");
    revalidatePath("/dashboard/accountant/allocate-float/floattwo");
    revalidatePath("/dashboard/floats");
    revalidatePath("/dashboard/my-float");
    revalidatePath("/dashboard/expenditure");
    revalidatePath(`/dashboard/floats/users/${data.tellerAgentId}`);

    return {
      success: true,
      message: `Successfully allocated ${formatCurrency(data.amount)} to ${tellerAgent.name}`,
      data: result,
    };
  } catch (error) {
    console.error("💥 Error creating float allocation:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create float allocation",
    };
  }
}

/* ---------------- Other Functions ---------------- */

export async function validateUserExists(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return !!user;
  } catch (error) {
    console.error("Error validating user:", error);
    return false;
  }
}

export async function getFloatStatistics() {
  try {
    const user = await getCurrentUserWithBranch();
    const branchFilter = getBranchFilter(user);

    const [
      totalFloats,
      totalBalance,
      activeFloats,
      pendingReconciliations,
      todayAllocations,
      todayReconciliations,
    ] = await Promise.all([
      db.userFloat.count({ where: { user: branchFilter } }),
      db.userFloat.aggregate({
        where: { user: branchFilter },
        _sum: { balance: true },
      }),
      db.userFloat.count({
        where: { balance: { gt: 0 }, user: branchFilter },
      }),
      db.userFloat.count({
        where: {
          user: branchFilter,
          OR: [
            { lastReconciliation: null },
            {
              lastReconciliation: {
                lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
      }),
      db.floatAllocation.count({
        where: {
          ...branchFilter,
          allocationDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      db.floatReconciliation.count({
        where: {
          float: { user: branchFilter },
          reconciliationDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    const branchAllocations = await db.floatAllocation.groupBy({
      by: ["branchId"],
      _sum: { amount: true },
      _count: true,
      where: {
        ...branchFilter,
        allocationDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const reconciliationStatus = await db.floatReconciliation.groupBy({
      by: ["isBalanced"],
      _count: true,
      where: {
        float: { user: branchFilter },
        reconciliationDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    return {
      totalFloats,
      totalBalance: totalBalance._sum.balance || 0,
      activeFloats,
      pendingReconciliations,
      todayAllocations,
      todayReconciliations,
      branchAllocations: branchAllocations.map((i) => ({
        branchId: i.branchId,
        amount: i._sum.amount || 0,
        count: i._count,
      })),
      reconciliationStatus: {
        balanced: reconciliationStatus.find((i) => i.isBalanced)?._count || 0,
        unbalanced:
          reconciliationStatus.find((i) => !i.isBalanced)?._count || 0,
      },
    };
  } catch (error) {
    console.error("Error fetching float statistics:", error);
    return {
      totalFloats: 0,
      totalBalance: 0,
      activeFloats: 0,
      pendingReconciliations: 0,
      todayAllocations: 0,
      todayReconciliations: 0,
      branchAllocations: [],
      reconciliationStatus: { balanced: 0, unbalanced: 0 },
    };
  }
}

export async function getUnreconciledTellers() {
  try {
    const user = await getCurrentUserWithBranch();
    const branchFilter = getBranchFilter(user);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await db.userFloat.findMany({
      where: {
        user: branchFilter,
        isActiveForDay: true,
        OR: [
          { pendingReconciliation: true },
          { currentDayStarted: { lt: today } },
        ],
      },
      include: { user: { include: { branch: true } } },
    });
  } catch (error) {
    console.error("Error fetching unreconciled tellers:", error);
    return [];
  }
}

export async function getAllFloatReconciliations() {
  try {
    const user = await getCurrentUserWithBranch();
    const branchFilter = getBranchFilter(user);

    return await db.floatReconciliation.findMany({
      where: {
        float: {
          user: branchFilter,
        },
      },
      include: {
        float: {
          include: {
            user: {
              include: { branch: { select: { name: true, location: true } } },
            },
          },
        },
        reconciledByUser: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
      },
      orderBy: { reconciliationDate: "desc" },
    });
  } catch (error) {
    console.error("Error fetching float reconciliations:", error);
    return [];
  }
}

export async function getFloatTransactions(floatId: string) {
  try {
    const user = await getCurrentUserWithBranch();
    const branchFilter = getBranchFilter(user);

    // First check if the float belongs to the user's branch
    const userFloat = await db.userFloat.findFirst({
      where: {
        id: floatId,
        user: branchFilter,
      },
    });

    if (!userFloat) {
      return [];
    }

    return await db.floatTransaction.findMany({
      where: { floatId },
      include: {
        float: {
          include: {
            user: {
              include: { branch: { select: { name: true, location: true } } },
            },
          },
        },
        performedByUser: { select: { id: true, name: true, role: true } },
      },
      orderBy: { transactionDate: "desc" },
    });
  } catch (error) {
    console.error("Error fetching float transactions:", error);
    return [];
  }
}

export async function getFloatReconciliations(floatId: string) {
  try {
    const user = await getCurrentUserWithBranch();
    const branchFilter = getBranchFilter(user);

    // First check if the float belongs to the user's branch
    const userFloat = await db.userFloat.findFirst({
      where: {
        id: floatId,
        user: branchFilter,
      },
    });

    if (!userFloat) {
      return [];
    }

    return await db.floatReconciliation.findMany({
      where: { floatId },
      include: {
        float: {
          include: {
            user: {
              include: { branch: { select: { name: true, location: true } } },
            },
          },
        },
        reconciledByUser: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            phone: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
      },
      orderBy: { reconciliationDate: "desc" },
    });
  } catch (error) {
    console.error("Error fetching float reconciliations:", error);
    return [];
  }
}

interface FloatAllocationData {
  tellerAgentId: string;
  branchId: string;
  amount: number;
  allocatedByUserId: string;
  notes?: string;
}

interface ActionResponse {
  success?: boolean;
  error?: string;
  message?: string;
  data?: any;
}

/**
 * Allocate float to teller/agent with vault deduction
 * ✅ Reduces accountant's vault balance
 * ✅ Increases teller's float balance
 * ✅ Creates all necessary transaction records
 */
export async function allocateFloatWithVaultDeduction(
  data: FloatAllocationData
): Promise<ActionResponse> {
  try {
    // Validate input
    if (!data.tellerAgentId || !data.branchId || !data.allocatedByUserId) {
      return { error: "Missing required fields" };
    }

    const amount = Number(data.amount);
    if (amount <= 0) {
      return { error: "Amount must be greater than zero" };
    }

    if (amount < 1000) {
      return { error: "Minimum allocation is UGX 1,000" };
    }

    // Get allocator (accountant)
    const allocator = await db.user.findUnique({
      where: { id: data.allocatedByUserId },
      select: {
        id: true,
        name: true,
        role: true,
        branchId: true,
      },
    });

    if (!allocator) {
      return { error: "Allocator not found" };
    }

    // Verify allocator has permission
    if (
      allocator.role !== UserRole.ACCOUNTANT &&
      allocator.role !== UserRole.ADMIN &&
      allocator.role !== UserRole.BRANCHMANAGER
    ) {
      return {
        error:
          "Only accountants, admins, or branch managers can allocate float",
      };
    }

    // Get teller/agent
    const teller = await db.user.findUnique({
      where: { id: data.tellerAgentId },
      include: {
        userFloat: true,
      },
    });

    if (!teller) {
      return { error: "Teller/agent not found" };
    }

    // Verify teller role
    if (teller.role !== UserRole.TELLER && teller.role !== UserRole.AGENT) {
      return { error: "Can only allocate float to tellers or agents" };
    }

    // ✅ Check for pending reconciliation
    if (teller.userFloat?.pendingReconciliation) {
      return {
        error: `${teller.name} has a pending reconciliation. Please wait for it to be processed before allocating new float.`,
      };
    }

    // Get branch
    const branch = await db.branch.findUnique({
      where: { id: data.branchId },
    });

    if (!branch) {
      return { error: "Branch not found" };
    }

    // ✅ Get accountant's vault (CRITICAL)
    const vault = await db.vault.findFirst({
      where: {
        branchId: allocator.branchId || data.branchId,
        isActive: true,
      },
    });

    if (!vault) {
      return {
        error:
          "No active vault found for your branch. Please contact system administrator.",
      };
    }

    // ✅ Check vault has sufficient balance
    if (vault.balance < amount) {
      return {
        error: `Insufficient vault balance. Available: UGX ${vault.balance.toLocaleString()}, Required: UGX ${amount.toLocaleString()}`,
      };
    }

    // Perform allocation with vault deduction
    const result = await db.$transaction(async (tx) => {
      // 1. Get or create teller's float
      let userFloat = teller.userFloat;

      if (!userFloat) {
        userFloat = await tx.userFloat.create({
          data: {
            userId: teller.id,
            balance: 0,
            isActiveForDay: false,
            canStartNewDay: true,
            pendingReconciliation: false,
          },
        });
      }

      const previousBalance = userFloat.balance;
      const newBalance = previousBalance + amount;

      // 2. Update teller's float balance
      await tx.userFloat.update({
        where: { id: userFloat.id },
        data: {
          balance: newBalance,
          canStartNewDay: true,
        },
      });

      // 3. Create float allocation record
      const allocation = await tx.floatAllocation.create({
        data: {
          tellerAgentId: teller.id,
          branchId: data.branchId,
          amount: amount,
          allocatedByUserId: data.allocatedByUserId,
          allocationDate: new Date(),
          notes: data.notes,
        },
      });

      // 4. Create float transaction record
      await tx.floatTransaction.create({
        data: {
          floatId: userFloat.id,
          type: TransactionType.FLOAT_ALLOCATION,
          amount: amount,
          performedByUserId: data.allocatedByUserId,
          description: `Float allocation from ${allocator.name}`,
          relatedTransactionId: allocation.id,
        },
      });

      // 5. ✅ REDUCE VAULT BALANCE (Critical step)
      const vaultBalanceBefore = vault.balance;
      const vaultBalanceAfter = vaultBalanceBefore - amount;

      await tx.vault.update({
        where: { id: vault.id },
        data: {
          balance: vaultBalanceAfter,
          physicalCash: {
            decrement: amount,
          },
        },
      });

      // 6. ✅ Create vault transaction record
      await tx.vaultTransaction.create({
        data: {
          vaultId: vault.id,
          type: VaultTransactionType.FLOAT_ALLOCATION,
          amount: -amount, // Negative because it's leaving the vault
          balanceBefore: vaultBalanceBefore,
          balanceAfter: vaultBalanceAfter,
          description: `Float allocated to ${teller.name}`,
          relatedFloatAllocationId: allocation.id,
          relatedUserId: teller.id,
          performedByUserId: data.allocatedByUserId,
        },
      });

      // 7. Create notification for teller
      await tx.notification.create({
        data: {
          userId: teller.id,
          type: "IN_APP",
          subject: "💰 Float Allocated",
          message: `You have received UGX ${amount.toLocaleString()} float allocation from ${allocator.name}. Your new balance is UGX ${newBalance.toLocaleString()}.`,
          isRead: false,
        },
      });

      // 8. Audit log
      await tx.auditLog.create({
        data: {
          userId: data.allocatedByUserId,
          action: "FLOAT_ALLOCATED_WITH_VAULT_DEDUCTION",
          entityType: "FloatAllocation",
          entityId: allocation.id,
          details: JSON.stringify({
            tellerName: teller.name,
            tellerEmail: teller.email,
            allocatorName: allocator.name,
            branchName: branch.name,
            amount: amount,
            previousFloatBalance: previousBalance,
            newFloatBalance: newBalance,
            vaultBalanceBefore: vaultBalanceBefore,
            vaultBalanceAfter: vaultBalanceAfter,
            notes: data.notes,
          }),
        },
      });

      return {
        allocationId: allocation.id,
        tellerName: teller.name,
        previousBalance,
        newBalance,
        vaultBalanceBefore,
        vaultBalanceAfter,
        amount,
      };
    });

    // Revalidate relevant paths
    revalidatePath("/dashboard/accountant/allocate-float");
    revalidatePath("/dashboard/accountant/reconciliations");
    revalidatePath("/dashboard/floats");
    revalidatePath("/dashboard/my-float");
    revalidatePath("/dashboard/accounts/vault");

    return {
      success: true,
      data: result,
      message: `✅ Float allocated successfully! UGX ${amount.toLocaleString()} allocated to ${result.tellerName}. Vault balance reduced to UGX ${result.vaultBalanceAfter.toLocaleString()}.`,
    };
  } catch (error) {
    console.error("Error allocating float:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to allocate float",
    };
  }
}

/**
 * Get accountant's vault balance
 * Used by the frontend to display current vault balance
 */
export async function getAccountantVaultBalance(
  accountantId: string
): Promise<{ balance: number; vaultId?: string }> {
  try {
    const accountant = await db.user.findUnique({
      where: { id: accountantId },
      select: { branchId: true },
    });

    if (!accountant?.branchId) {
      return { balance: 0 };
    }

    const vault = await db.vault.findFirst({
      where: {
        branchId: accountant.branchId,
        isActive: true,
      },
      select: {
        id: true,
        balance: true,
      },
    });

    return {
      balance: vault?.balance || 0,
      vaultId: vault?.id,
    };
  } catch (error) {
    console.error("Error fetching vault balance:", error);
    return { balance: 0 };
  }
}
/**
 * Get eligible float users (tellers/agents) with branch filtering
 * ✅ Only returns users with 0 balance who can receive new float
 */
/**
 * Get all tellers and agents (not just eligible ones)
 * Returns everyone with their float status so form can decide eligibility
 */
export async function getEligibleFloatUsers() {
  try {
    const user = await getCurrentUserWithBranch();
    const branchFilter = getBranchFilter(user);

    const users = await db.user.findMany({
      where: {
        role: { in: ["TELLER", "AGENT"] },
        isActive: true,
        ...branchFilter,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        userFloat: {
          select: {
            id: true,
            balance: true,
            isActiveForDay: true,
            canStartNewDay: true,
            pendingReconciliation: true,
            currentDayStarted: true,
            lastReconciliation: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Return ALL users with their status
    // The form will determine eligibility based on floatStatus
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      branch: u.branch
        ? {
            id: u.branch.id,
            name: u.branch.name,
            location: u.branch.location,
          }
        : undefined,
      floatStatus: u.userFloat
        ? {
            balance: u.userFloat.balance,
            isActiveForDay: u.userFloat.isActiveForDay,
            canStartNewDay: u.userFloat.canStartNewDay,
            pendingReconciliation: u.userFloat.pendingReconciliation,
            currentDayStarted: u.userFloat.currentDayStarted,
            lastReconciliation: u.userFloat.lastReconciliation,
          }
        : null,
    }));
  } catch (error) {
    console.error("Error fetching eligible float users:", error);
    return [];
  }
}
