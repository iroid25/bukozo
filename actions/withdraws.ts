"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export interface WithdrawalStatistics {
  today: { amount: number; count: number };
  thisMonth: { amount: number; count: number };
  total: { amount: number; count: number };
}

/* ---------------- FETCH OPERATIONS ---------------- */

export async function getAllWithdrawals() {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error("Unauthorized");

    const whereClause: any = {};
    if (
      ["ACCOUNTANT", "TELLER", "AGENT", "BRANCHMANAGER"].includes(user.role)
    ) {
      if (!user.branchId) throw new Error("User does not have an assigned branch");
      whereClause.branchId = user.branchId;
    }

    const withdrawals = await db.withdrawal.findMany({
      where: whereClause,
      orderBy: { withdrawalDate: "desc" },
      include: {
        transaction: true,
        member: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        institution: { select: { institutionName: true } },
        account: {
          select: {
            accountNumber: true,
            accountType: { select: { name: true } },
            branch: { select: { name: true } },
          },
        },
        handler: { select: { name: true } },
      },
    });

    return { success: true, data: withdrawals };
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch withdrawals",
    };
  }
}

export async function getWithdrawalById(id: string) {
  try {
    const withdrawal = await db.withdrawal.findUnique({
      where: { id },
      include: {
        transaction: true,
        member: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        institution: {
          include: {
            signatories: {
              select: {
                id: true, name: true, title: true, isPrimary: true,
                photoImage: true, signatureImage: true,
              },
            },
          },
        },
        account: {
          include: { accountType: true, branch: { select: { name: true } } },
        },
        handler: { select: { name: true, email: true, phone: true } },
      },
    });
    if (!withdrawal) return { success: false, error: "Withdrawal not found" };
    return { success: true, data: withdrawal };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch withdrawal",
    };
  }
}

export async function getWithdrawalStatistics() {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error("Unauthorized");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const baseWhere: any = {};
    if (user.role !== "ADMIN") {
      if (!user.branchId) throw new Error("User does not have an assigned branch");
      baseWhere.branchId = user.branchId;
    }

    const [todayWithdrawals, monthWithdrawals, totalWithdrawals] =
      await Promise.all([
        db.withdrawal.findMany({
          where: { ...baseWhere, withdrawalDate: { gte: todayStart } },
          select: { amount: true },
        }),
        db.withdrawal.findMany({
          where: { ...baseWhere, withdrawalDate: { gte: monthStart } },
          select: { amount: true },
        }),
        db.withdrawal.findMany({
          where: baseWhere,
          select: { amount: true },
        }),
      ]);

    return {
      success: true,
      data: {
        today: {
          amount: todayWithdrawals.reduce((s, w) => s + w.amount, 0),
          count: todayWithdrawals.length,
        },
        thisMonth: {
          amount: monthWithdrawals.reduce((s, w) => s + w.amount, 0),
          count: monthWithdrawals.length,
        },
        total: {
          amount: totalWithdrawals.reduce((s, w) => s + w.amount, 0),
          count: totalWithdrawals.length,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch withdrawal statistics",
    };
  }
}
