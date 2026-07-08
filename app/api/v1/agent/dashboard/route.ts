// app/api/v1/agent/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { TransactionStatus } from "@prisma/client";
import { startOfDay, endOfDay, startOfMonth } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "AGENT") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const today = startOfDay(new Date());
    const endToday = endOfDay(new Date());
    const monthStart = startOfMonth(new Date());

    // Parallel fetching for performance
    const [
      userFloat,
      todayTransactions,
      monthTransactions,
      todayDeposits,
      todayWithdrawals,
      recentActivity
    ] = await Promise.all([
      // User float status
      db.userFloat.findUnique({
        where: { userId: user.id },
        include: {
          floatTransactions: {
            where: {
              transactionDate: {
                gte: today,
                lte: endToday
              }
            },
            orderBy: { transactionDate: "desc" },
            take: 10
          }
        }
      }),

      // Today's transactions
      db.transaction.count({
        where: {
          processedByUserId: user.id,
          transactionDate: {
            gte: today,
            lte: endToday
          },
          status: TransactionStatus.COMPLETED
        }
      }),

      // Month's transactions
      db.transaction.count({
        where: {
          processedByUserId: user.id,
          transactionDate: {
            gte: monthStart
          },
          status: TransactionStatus.COMPLETED
        }
      }),

      // Today's deposits
      db.deposit.aggregate({
        where: {
          handlerUserId: user.id,
          depositDate: {
            gte: today,
            lte: endToday
          }
        },
        _sum: { amount: true },
        _count: { id: true }
      }),

      // Today's withdrawals
      db.withdrawal.aggregate({
        where: {
          handlerUserId: user.id,
          withdrawalDate: {
            gte: today,
            lte: endToday
          }
        },
        _sum: { amount: true },
        _count: { id: true }
      }),

      // Recent activity
      db.transaction.findMany({
        where: {
          processedByUserId: user.id,
          status: TransactionStatus.COMPLETED
        },
        orderBy: { transactionDate: "desc" },
        take: 15,
        include: {
          member: {
            include: {
              user: {
                select: { name: true, firstName: true, lastName: true }
              }
            }
          },
          account: {
            select: { accountNumber: true }
          }
        }
      })
    ]);

    const floatBalance = userFloat?.balance || 0;
    const isActiveForDay = userFloat?.isActiveForDay || false;
    const lastReconciliation = userFloat?.lastReconciliation;

    const depositAmount = todayDeposits._sum.amount || 0;
    const withdrawalAmount = todayWithdrawals._sum.amount || 0;
    const netCashFlow = depositAmount - withdrawalAmount;

    // Build response
    const dashboard = {
      agent: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        branch: user.branchId
      },
      float: {
        balance: floatBalance,
        isActive: isActiveForDay,
        lastReconciliation: lastReconciliation?.toISOString() || null,
        todayTransactions: userFloat?.floatTransactions.length || 0
      },
      stats: {
        today: {
          transactions: todayTransactions,
          deposits: {
            count: todayDeposits._count.id,
            amount: depositAmount
          },
          withdrawals: {
            count: todayWithdrawals._count.id,
            amount: withdrawalAmount
          },
          netCashFlow
        },
        month: {
          transactions: monthTransactions
        }
      },
      recentActivity: recentActivity.map(t => ({
        id: t.id,
        ref: t.transactionRef,
        type: t.type,
        amount: t.amount,
        date: t.transactionDate.toISOString(),
        description: t.description,
        memberName: t.member?.user?.name || 
          `${t.member?.user?.firstName || ''} ${t.member?.user?.lastName || ''}`.trim(),
        accountNumber: t.account?.accountNumber
      })),
      floatTransactions: userFloat?.floatTransactions.map(ft => ({
        id: ft.id,
        type: ft.type,
        amount: ft.amount,
        date: ft.transactionDate.toISOString(),
        description: ft.description
      })) || []
    };

    return NextResponse.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error("❌ Error fetching agent dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dashboard data",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
