"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export interface DepositStatistics {
  today: { amount: number; count: number };
  thisMonth: { amount: number; count: number };
  total: { amount: number; count: number };
}

/* ---------------- FETCH OPERATIONS ---------------- */

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
      whereClause.branchId = user.branchId;
    }

    const deposits = await db.deposit.findMany({
      where: whereClause,
      orderBy: { depositDate: "desc" },
      include: {
        transaction: true,
        member: {
          include: {
            user: {
              select: { name: true, email: true, phone: true },
            },
          },
        },
        institution: {
          select: { institutionName: true },
        },
        account: {
          select: {
            accountNumber: true,
            accountType: { select: { name: true } },
            branch: { select: { name: true } },
          },
        },
        handler: { select: { name: true, email: true, phone: true } },
      },
    });

    return { success: true, data: deposits };
  } catch (error) {
    console.error("Error fetching deposits:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch deposits",
    };
  }
}

export async function getTodaysDeposits() {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error("Unauthorized");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const whereClause: any = {
      depositDate: { gte: today },
    };

    if (user.role !== "ADMIN") {
      if (!user.branchId) throw new Error("User does not have an assigned branch");
      whereClause.branchId = user.branchId;
    }

    const deposits = await db.deposit.findMany({
      where: whereClause,
      orderBy: { depositDate: "desc" },
      include: {
        transaction: true,
        member: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
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
        handler: { select: { name: true, email: true, phone: true } },
      },
    });

    return { success: true, data: deposits };
  } catch (error) {
    console.error("Error fetching today's deposits:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch today's deposits",
    };
  }
}

export async function getMonthlyDeposits() {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error("Unauthorized");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const whereClause: any = {
      createdAt: { gte: startOfMonth },
    };

    if (user.role !== "ADMIN") {
      if (!user.branchId) throw new Error("User does not have an assigned branch");
      whereClause.branchId = user.branchId;
    }

    const deposits = await db.deposit.findMany({
      where: whereClause,
      orderBy: { depositDate: "desc" },
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
        handler: { select: { name: true, email: true } },
      },
    });

    return { success: true, data: deposits };
  } catch (error) {
    console.error("Error fetching monthly deposits:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch monthly deposits",
    };
  }
}

export async function getDepositById(id: string) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error("Unauthorized");

    const deposit = await db.deposit.findUnique({
      where: { id },
      include: {
        transaction: true,
        member: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        institution: { select: { institutionName: true } },
        account: {
          include: {
            accountType: true,
            branch: { select: { name: true } },
          },
        },
        handler: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!deposit) {
      return { success: false, error: "Deposit not found" };
    }

    if (
      user.role !== "ADMIN" &&
      deposit.account?.branchId !== user.branchId
    ) {
      return { success: false, error: "Unauthorized to view this deposit" };
    }

    return { success: true, data: deposit };
  } catch (error) {
    console.error("Error fetching deposit:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch deposit",
    };
  }
}

export async function getDepositStatistics() {
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

    const [todayDeposits, monthDeposits, totalDeposits] = await Promise.all([
      db.deposit.findMany({
        where: { ...baseWhere, depositDate: { gte: todayStart } },
        select: { amount: true },
      }),
      db.deposit.findMany({
        where: { ...baseWhere, depositDate: { gte: monthStart } },
        select: { amount: true },
      }),
      db.deposit.findMany({
        where: baseWhere,
        select: { amount: true },
      }),
    ]);

    return {
      success: true,
      data: {
        today: {
          amount: todayDeposits.reduce((sum, d) => sum + d.amount, 0),
          count: todayDeposits.length,
        },
        thisMonth: {
          amount: monthDeposits.reduce((sum, d) => sum + d.amount, 0),
          count: monthDeposits.length,
        },
        total: {
          amount: totalDeposits.reduce((sum, d) => sum + d.amount, 0),
          count: totalDeposits.length,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching deposit statistics:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch deposit statistics",
    };
  }
}

export async function getHandlerFloatBalance(handlerId: string) {
  try {
    const userFloat = await db.userFloat.findUnique({
      where: { userId: handlerId },
      select: { id: true, balance: true },
    });
    return { success: true, data: userFloat || null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch float",
    };
  }
}
