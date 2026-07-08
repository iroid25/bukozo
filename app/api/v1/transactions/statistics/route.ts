// @ts-nocheck

// app/api/v1/transactions/statistics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { db } from "@/prisma/db";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { authOptions } from "@/config/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: any = {};

    if (branchId) {
      where.account = {
        branchId: branchId,
      };
    }

    if (userId) {
      where.processedByUserId = userId;
    }

    // Date range filter
    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) {
        where.transactionDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.transactionDate.lte = new Date(endDate);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch all statistics in parallel
    const [
      totalTransactions,
      totalDeposits,
      totalWithdrawals,
      depositCount,
      withdrawalCount,
      todayTransactions,
      todayDeposits,
      todayWithdrawals,
      pendingCount,
      failedCount,
      completedCount,
      typeBreakdown,
      channelBreakdown,
    ] = await Promise.all([
      // Total transactions count
      db.transaction.count({ where }),

      // Total deposits amount
      db.transaction.aggregate({
        where: {
          ...where,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),

      // Total withdrawals amount
      db.transaction.aggregate({
        where: {
          ...where,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),

      // Deposit count
      db.transaction.count({
        where: {
          ...where,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED,
        },
      }),

      // Withdrawal count
      db.transaction.count({
        where: {
          ...where,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.COMPLETED,
        },
      }),

      // Today's transactions count
      db.transaction.count({
        where: {
          ...where,
          transactionDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),

      // Today's deposits
      db.transaction.aggregate({
        where: {
          ...where,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED,
          transactionDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: { amount: true },
      }),

      // Today's withdrawals
      db.transaction.aggregate({
        where: {
          ...where,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.COMPLETED,
          transactionDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: { amount: true },
      }),

      // Pending count
      db.transaction.count({
        where: { ...where, status: TransactionStatus.PENDING },
      }),

      // Failed count
      db.transaction.count({
        where: { ...where, status: TransactionStatus.FAILED },
      }),

      // Completed count
      db.transaction.count({
        where: { ...where, status: TransactionStatus.COMPLETED },
      }),

      // Type breakdown
      db.transaction.groupBy({
        by: ["type"],
        where: {
          ...where,
          status: TransactionStatus.COMPLETED,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),

      // Channel breakdown
      db.transaction.groupBy({
        by: ["channel"],
        where: {
          ...where,
          status: TransactionStatus.COMPLETED,
          channel: {
            not: null,
          },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    const totalDepositsAmount = totalDeposits._sum.amount || 0;
    const totalWithdrawalsAmount = totalWithdrawals._sum.amount || 0;
    const todayDepositsAmount = todayDeposits._sum.amount || 0;
    const todayWithdrawalsAmount = todayWithdrawals._sum.amount || 0;

    const statistics = {
      totalTransactions,
      totalAmount: totalDepositsAmount + totalWithdrawalsAmount,
      totalDeposits: totalDepositsAmount,
      totalWithdrawals: totalWithdrawalsAmount,
      depositCount,
      withdrawalCount,
      todayTransactions,
      todayAmount: todayDepositsAmount + todayWithdrawalsAmount,
      todayDeposits: {
        amount: todayDepositsAmount,
        count: todayDeposits._count || 0,
      },
      todayWithdrawals: {
        amount: todayWithdrawalsAmount,
        count: todayWithdrawals._count || 0,
      },
      netCashFlow: totalDepositsAmount - totalWithdrawalsAmount,
      todayNetCashFlow: todayDepositsAmount - todayWithdrawalsAmount,
      pendingTransactions: pendingCount,
      failedTransactions: failedCount,
      completedTransactions: completedCount,
      typeBreakdown: typeBreakdown.map((item) => ({
        type: item.type,
        count: item._count._all,
        amount: item._sum.amount || 0,
      })),
      channelBreakdown: channelBreakdown.map((item) => ({
        channel: item.channel || "Unknown",
        count: item._count._all,
        amount: item._sum.amount || 0,
      })),
    };

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error("Error fetching transaction statistics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch transaction statistics",
        data: {
          totalTransactions: 0,
          totalAmount: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          depositCount: 0,
          withdrawalCount: 0,
          todayTransactions: 0,
          todayAmount: 0,
          todayDeposits: { amount: 0, count: 0 },
          todayWithdrawals: { amount: 0, count: 0 },
          netCashFlow: 0,
          todayNetCashFlow: 0,
          pendingTransactions: 0,
          failedTransactions: 0,
          completedTransactions: 0,
          typeBreakdown: [],
          channelBreakdown: [],
        },
      },
      { status: 500 }
    );
  }
}
