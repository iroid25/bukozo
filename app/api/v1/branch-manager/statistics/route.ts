// @ts-nocheck
// app/api/v1/branch-manager/statistics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { db } from "@/prisma/db";
import { resolveBranchManagerContext } from "@/lib/branch-manager-context";
import {
  UserRole,
  AccountStatus,
  LoanStatus,
  TransactionType,
  TransactionStatus,
} from "@prisma/client";
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

    const { user, branchId } = await resolveBranchManagerContext(
      {
        id: session.user.id,
        email: session.user.email,
        branchId: (session.user as { branchId?: string | null }).branchId ?? null,
      },
      true
    );

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "User not assigned to a branch" },
        { status: 400 }
      );
    }

    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. Overview Statistics
    const [totalMembers, activeAccounts, staffCount] = await Promise.all([
      // Total members in branch
      db.member.count({
        where: {
          accounts: {
            some: {
              branchId: branchId,
            },
          },
        },
      }),

      // Active accounts
      db.account.count({
        where: {
          branchId: branchId,
          status: AccountStatus.ACTIVE,
        },
      }),

      // Staff information - FIXED: Use isActive instead of status
      db.user.findMany({
        where: {
          branchId: branchId,
          role: {
            in: [
              UserRole.TELLER,
              UserRole.ACCOUNTANT,
              UserRole.BRANCHMANAGER,
              UserRole.AGENT,
            ],
          },
        },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLogin: true,
        },
      }),
    ]);

    const activeStaff = staffCount.filter(
      (staff) => staff.isActive === true
    ).length;

    // 2. Transaction Statistics
    const [todayTransactions, monthTransactions] = await Promise.all([
      db.transaction.findMany({
        where: {
          account: {
            branchId: branchId,
          },
          transactionDate: {
            gte: today,
            lt: tomorrow,
          },
          status: TransactionStatus.COMPLETED,
        },
        select: {
          type: true,
          amount: true,
        },
      }),

      db.transaction.findMany({
        where: {
          account: {
            branchId: branchId,
          },
          transactionDate: {
            gte: firstDayOfMonth,
          },
          status: TransactionStatus.COMPLETED,
        },
        select: {
          type: true,
          amount: true,
        },
      }),
    ]);

    // Process today's transactions
    const todayDeposits = todayTransactions.filter(
      (t) => t.type === TransactionType.DEPOSIT
    );
    const todayWithdrawals = todayTransactions.filter(
      (t) => t.type === TransactionType.WITHDRAWAL
    );

    const todayDepositAmount = todayDeposits.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );
    const todayWithdrawalAmount = todayWithdrawals.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    // Process month's transactions
    const monthDeposits = monthTransactions.filter(
      (t) => t.type === TransactionType.DEPOSIT
    );
    const monthWithdrawals = monthTransactions.filter(
      (t) => t.type === TransactionType.WITHDRAWAL
    );

    const monthDepositAmount = monthDeposits.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );
    const monthWithdrawalAmount = monthWithdrawals.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    // 3. Loan Statistics
    const [activeLoans, overdueLoans, pendingApplications] = await Promise.all([
      db.loan.findMany({
        where: {
          branchId: branchId,
          status: {
            in: [LoanStatus.DISBURSED, LoanStatus.OVERDUE],
          },
        },
        select: {
          amountGranted: true,
          outstandingBalance: true,
          dueDate: true,
        },
      }),

      db.loan.findMany({
        where: {
          branchId: branchId,
          status: LoanStatus.OVERDUE,
          dueDate: {
            lt: new Date(),
          },
        },
        select: {
          outstandingBalance: true,
        },
      }),

      db.loanApplication.count({
        where: {
          member: {
            accounts: {
              some: {
                branchId: branchId,
              },
            },
          },
          status: LoanStatus.PENDING,
        },
      }),
    ]);

    const totalDisbursed = activeLoans.reduce(
      (sum, loan) => sum + Number(loan.amountGranted),
      0
    );
    const outstandingBalance = activeLoans.reduce(
      (sum, loan) => sum + Number(loan.outstandingBalance),
      0
    );
    const overdueAmount = overdueLoans.reduce(
      (sum, loan) => sum + Number(loan.outstandingBalance),
      0
    );

    const recoveryRate =
      totalDisbursed > 0
        ? ((totalDisbursed - outstandingBalance) / totalDisbursed) * 100
        : 0;
    const portfolioAtRisk =
      outstandingBalance > 0 ? (overdueAmount / outstandingBalance) * 100 : 0;

    // 4. Float and Vault Balances
    const [floatRecords, branchVaults] = await Promise.all([
      db.userFloat.findMany({
        where: {
          user: {
            branchId: branchId,
          },
        },
        select: {
          balance: true,
          pendingReconciliation: true,
        },
      }),

      db.vault.findMany({
        where: {
          branchId: branchId,
          isActive: true,
        },
        select: { balance: true },
      }),
    ]);

    const floatBalance = floatRecords.reduce(
      (sum, f) => sum + Number(f.balance),
      0
    );
    const pendingReconciliations = floatRecords.filter(
      (f) => f.pendingReconciliation === true
    ).length;

    const totalVaultBalance = branchVaults.reduce(
      (sum, v) => sum + Number(v.balance),
      0
    );

    // 5. Financial Statistics
    const [incomeRecords, expenditureRecords] = await Promise.all([
      db.incomeRecord.findMany({
        where: {
          branchId: branchId,
          date: {
            gte: firstDayOfMonth,
          },
          status: TransactionStatus.COMPLETED,
        },
        select: {
          amount: true,
        },
      }),

      db.expenditureRecord.findMany({
        where: {
          branchId: branchId,
          date: {
            gte: firstDayOfMonth,
          },
          status: TransactionStatus.APPROVED,
        },
        select: {
          amount: true,
        },
      }),
    ]);

    const monthlyIncome = incomeRecords.reduce(
      (sum, i) => sum + Number(i.amount),
      0
    );
    const monthlyExpenditure = expenditureRecords.reduce(
      (sum, e) => sum + Number(e.amount),
      0
    );

    // Prepare response
    const statistics = {
      overview: {
        totalMembers,
        activeAccounts,
        totalStaff: staffCount.length,
        activeStaff,
      },
      transactions: {
        today: {
          count: todayTransactions.length,
          totalAmount: todayDepositAmount + todayWithdrawalAmount,
          deposits: {
            count: todayDeposits.length,
            amount: todayDepositAmount,
          },
          withdrawals: {
            count: todayWithdrawals.length,
            amount: todayWithdrawalAmount,
          },
          netCashFlow: todayDepositAmount - todayWithdrawalAmount,
        },
        month: {
          count: monthTransactions.length,
          totalAmount: monthDepositAmount + monthWithdrawalAmount,
          deposits: {
            count: monthDeposits.length,
            amount: monthDepositAmount,
          },
          withdrawals: {
            count: monthWithdrawals.length,
            amount: monthWithdrawalAmount,
          },
        },
      },
      loans: {
        activeLoans: activeLoans.length,
        totalDisbursed,
        outstandingBalance,
        overdueLoans: overdueLoans.length,
        overdueAmount,
        pendingApplications,
        recoveryRate,
        portfolioAtRisk,
      },
      float: {
        balance: floatBalance,
        pendingReconciliations,
      },
      vault: {
        balance: totalVaultBalance,
      },
      financials: {
        monthlyIncome,
        monthlyExpenditure,
        netIncome: monthlyIncome - monthlyExpenditure,
      },
      staff: staffCount.map((staff) => ({
        id: staff.id,
        name:
          staff.name ||
          `${staff.firstName || ""} ${staff.lastName || ""}`.trim(),
        role: staff.role,
        status: staff.isActive ? "ACTIVE" : "INACTIVE",
        lastLogin: staff.lastLogin?.toISOString() || null,
      })),
    };

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error("Error fetching branch manager statistics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
