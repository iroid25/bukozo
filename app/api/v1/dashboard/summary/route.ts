import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";

// GET /api/v1/dashboard/summary - Get dashboard summary for mobile/desktop apps
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    // Get user's member record if they are a member
    const member = await db.member.findFirst({
      where: { userId },
      select: { id: true },
    });

    // Build summary based on role
    let summary: any = {
      user: {
        name: session.user.name,
        email: session.user.email,
        role: userRole,
      },
    };

    if (member) {
      // Member dashboard
      const [accounts, loans, recentTransactions] = await Promise.all([
        // Get member accounts
        db.account.findMany({
          where: { memberId: member.id, status: "ACTIVE" },
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            accountType: {
              select: {
                name: true,
                interestRate: true,
              },
            },
          },
        }),

        // Get member loans
        db.loan.findMany({
          where: { memberId: member.id, status: { in: ["DISBURSED", "APPROVED"] } },
          select: {
            id: true,
            amountGranted: true,
            outstandingBalance: true,
            dueDate: true,

            status: true,
            loanApplication: {
              select: {
                loanOfficer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          take: 5,
        }),

        // Get recent transactions
        db.transaction.findMany({
          where: { memberId: member.id },
          select: {
            id: true,
            transactionRef: true,
            type: true,
            amount: true,
            status: true,
            transactionDate: true,
          },
          orderBy: { transactionDate: "desc" },
          take: 10,
        }),
      ]);

      const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
      const totalLoanDebt = loans.reduce((sum, loan) => sum + loan.outstandingBalance, 0);

      summary.member = {
        accounts,
        loans,
        recentTransactions,
        summary: {
          totalBalance,
          totalLoanDebt,
          accountCount: accounts.length,
          activeLoanCount: loans.length,
        },
      };
    }

    if (["TELLER", "AGENT", "BRANCHMANAGER", "ACCOUNTANT", "ADMIN"].includes(userRole)) {
      // Staff dashboard
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [todayTransactions, todayDeposits, todayWithdrawals, pendingLoans] = await Promise.all([
        // Today's transaction count
        db.transaction.count({
          where: {
            transactionDate: { gte: today },
            status: "COMPLETED",
          },
        }),

        // Today's deposits total
        db.deposit.aggregate({
          where: { depositDate: { gte: today } },
          _sum: { amount: true },
          _count: { id: true },
        }),

        // Today's withdrawals total
        db.withdrawal.aggregate({
          where: { withdrawalDate: { gte: today } },
          _sum: { amount: true },
          _count: { id: true },
        }),

        // Pending loans
        db.loan.count({
          where: { status: "PENDING" },
        }),
      ]);

      summary.staff = {
        today: {
          transactionCount: todayTransactions,
          deposits: {
            count: todayDeposits._count.id,
            total: todayDeposits._sum.amount || 0,
          },
          withdrawals: {
            count: todayWithdrawals._count.id,
            total: todayWithdrawals._sum.amount || 0,
          },
          netFlow: (todayDeposits._sum.amount || 0) - (todayWithdrawals._sum.amount || 0),
        },
        pending: {
          loans: pendingLoans,
        },
      };

      // Get user's float if they have one
      if (["TELLER", "AGENT"].includes(userRole)) {
        const userFloat = await db.userFloat.findUnique({
          where: { userId },
          select: {
            balance: true,
            lastDayReconciled: true,
          },
        });

        if (userFloat) {
          summary.staff.float = userFloat;
        }
      }
    }

    return successResponse(summary);
  } catch (error: any) {
    console.error("Error fetching dashboard summary:", error);
    return ApiErrors.internalError(error.message);
  }
}
