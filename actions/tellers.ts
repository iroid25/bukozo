"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { startOfDay, endOfDay, subHours } from "date-fns";

export async function getTellerDashboardData() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "TELLER") {
      return { error: "Unauthorized or not a teller" };
    }

    const tellerId = user.id;
    const branchId = user.branchId;
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // 1. Fetch User Float and Reconciliation Status
    const userFloat = await db.userFloat.findUnique({
      where: { userId: tellerId },
      include: {
        user: {
          select: { name: true, image: true }
        }
      }
    });

    // 2. Fetch Daily Transaction Statistics
    const dailyTransactions = await db.transaction.findMany({
      where: {
        processedByUserId: tellerId,
        transactionDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: TransactionStatus.COMPLETED,
      },
    });

    const stats = {
      deposits: {
        amount: dailyTransactions
          .filter(t => t.type === TransactionType.DEPOSIT)
          .reduce((sum, t) => sum + t.amount, 0),
        count: dailyTransactions.filter(t => t.type === TransactionType.DEPOSIT).length,
      },
      withdrawals: {
        amount: dailyTransactions
          .filter(t => t.type === TransactionType.WITHDRAWAL)
          .reduce((sum, t) => sum + (Math.abs(t.amount)), 0),
        count: dailyTransactions.filter(t => t.type === TransactionType.WITHDRAWAL).length,
      },
      totalTransactions: dailyTransactions.length,
      uniquecustomers: new Set(dailyTransactions.map(t => t.memberId || t.institutionId).filter(Boolean)).size,
    };

    // 3. Hourly Activity for Chart (Last 24 hours)
    const last24hStart = subHours(new Date(), 24);
    const hourlyActivityRaw = await db.transaction.findMany({
      where: {
        processedByUserId: tellerId,
        transactionDate: {
          gte: last24hStart,
        },
        status: TransactionStatus.COMPLETED,
      },
      select: {
        transactionDate: true,
        amount: true,
        type: true,
      },
    });

    // Group by hour
    const hourlyData = Array.from({ length: 24 }).map((_, i) => {
      const hourDate = subHours(new Date(), 23 - i);
      const hour = hourDate.getHours();
      const hourTransactions = hourlyActivityRaw.filter(t => 
        new Date(t.transactionDate).getHours() === hour && 
        new Date(t.transactionDate).toDateString() === hourDate.toDateString()
      );
      
      return {
        hour: `${hour}:00`,
        deposits: hourTransactions
          .filter(t => t.type === TransactionType.DEPOSIT)
          .reduce((sum, t) => sum + t.amount, 0),
        withdrawals: hourTransactions
          .filter(t => t.type === TransactionType.WITHDRAWAL)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      };
    });

    // 4. Recent Transactions (Last 50)
    const recentTransactions = await db.transaction.findMany({
      where: {
        processedByUserId: tellerId,
      },
      orderBy: {
        transactionDate: "desc",
      },
      take: 50,
      include: {
        member: {
          include: { user: { select: { name: true } } }
        },
        institution: {
          select: { institutionName: true }
        },
        account: {
          include: { accountType: { select: { name: true } } }
        }
      }
    });

    // 5. Total Balance in Drawer (Based on Float)
    const drawerBalance = userFloat?.balance || 0;

    // 6. Pending Disbursements for this teller
    const pendingDisbursementsCount = await db.loan.count({
      where: {
        allocatedTellerId: tellerId,
        status: "APPROVED",
      },
    });

    return {
      success: true,
      data: {
        user: {
          name: user.name,
          role: user.role,
          image: user.image,
          branchId: user.branchId,
        },
        userFloat,
        stats,
        hourlyData,
        recentTransactions,
        drawerBalance,
        pendingDisbursementsCount,
      }
    };

  } catch (error) {
    console.error("Error fetching teller dashboard data:", error);
    return { error: "Failed to fetch dashboard data" };
  }
}
