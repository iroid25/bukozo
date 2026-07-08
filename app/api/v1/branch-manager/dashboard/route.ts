// app/api/v1/branch-manager/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveBranchManagerContext } from "@/lib/branch-manager-context";
import {
  AccountStatus,
  AssetStatus,
  LoanStatus,
  TransactionType,
  TransactionStatus,
  UserRole,
} from "@prisma/client";
import { getActiveBranchReserveVault } from "@/lib/reserve-vault";

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

    // Date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    // Parallel data fetching for performance
    const [
      // Members
      totalMembers,
      newMembersThisMonth,
      pendingMemberApprovals,

      // Accounts
      totalAccounts,
      activeAccounts,

      // Staff
      branchStaff,

      // Today's Transactions
      todayTransactions,

      // Monthly Transactions
      monthTransactions,

      // Loans
      activeLoans,
      overdueLoans,
      pendingLoanApplications,
      loanApplicationsToReview,

      // Float
      userFloats,
      pendingReconciliations,

      // Vault
      branchVaults,

      // Recent Activity
      recentTransactions,
      recentDeposits,
      recentWithdrawals,
      recentLoanDisbursements,

      // Approvals Needed
      pendingFloatReconciliations,
      pendingMemberAccounts,
      pendingInstitutions,
      fixedDepositStats,
      maturingSoonCount,
      assetTransferRequests,
      assetDisposalRequests,
    ] = await Promise.all([
      // Members count
      db.member.count({
        where: {
          accounts: {
            some: { branchId },
          },
        },
      }),

      // New members this month
      db.member.count({
        where: {
          accounts: {
            some: {
              branchId,
              openedAt: { gte: firstDayOfMonth },
            },
          },
        },
      }),

      // Pending member approvals
      db.member.count({
        where: {
          accounts: {
            some: { branchId },
          },
          isApproved: false,
        },
      }),

      // Total accounts
      db.account.count({
        where: { branchId },
      }),

      // Active accounts
      db.account.count({
        where: {
          branchId,
          status: AccountStatus.ACTIVE,
        },
      }),

      // Branch staff
      db.user.findMany({
        where: {
          branchId,
          role: {
            in: [
              UserRole.TELLER,
              UserRole.ACCOUNTANT,
              UserRole.BRANCHMANAGER,
              UserRole.AGENT,
              UserRole.LOANOFFICER,
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
          email: true,
          phone: true,
        },
        orderBy: { lastLogin: "desc" },
      }),

      // Today's transactions
      db.transaction.findMany({
        where: {
          account: { branchId },
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

      // Month's transactions
      db.transaction.findMany({
        where: {
          account: { branchId },
          transactionDate: { gte: firstDayOfMonth },
          status: TransactionStatus.COMPLETED,
        },
        select: {
          type: true,
          amount: true,
        },
      }),

      // Active loans
      db.loan.findMany({
        where: {
          branchId,
          status: {
            in: [LoanStatus.DISBURSED, LoanStatus.OVERDUE],
          },
        },
        select: {
          id: true,
          amountGranted: true,
          outstandingBalance: true,
          dueDate: true,
          status: true,
        },
      }),

      // Overdue loans
      db.loan.findMany({
        where: {
          branchId,
          status: LoanStatus.OVERDUE,
        },
        select: {
          outstandingBalance: true,
        },
      }),

      // Pending loan applications (members)
      db.loanApplication.count({
        where: {
          member: { accounts: { some: { branchId } } },
          status: LoanStatus.PENDING,
        },
      }),

      // Loan applications needing manager review (members)
      db.loanApplication.findMany({
        where: {
          member: { accounts: { some: { branchId } } },
          status: LoanStatus.PENDING,
          stage: { in: ["FORWARDED_TO_MANAGER", "IN_ANALYSIS"] },
        },
        select: {
          id: true,
          amountApplied: true,
          applicationDate: true,
          member: {
            select: {
              memberNumber: true,
              user: { select: { name: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { applicationDate: "desc" },
        take: 10,
      }),

      // User floats
      db.userFloat.findMany({
        where: {
          user: { branchId },
        },
        select: {
          balance: true,
          pendingReconciliation: true,
          isActiveForDay: true,
        },
      }),

      // Pending reconciliations count
      db.floatReconciliation.count({
        where: {
          float: {
            user: { branchId },
          },
          status: "PENDING",
        },
      }),

      // Branch vaults
      db.vault.findMany({
        where: {
          branchId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          balance: true,
          physicalCash: true,
        },
      }),

      // Recent transactions
      db.transaction.findMany({
        where: {
          account: { branchId },
          status: TransactionStatus.COMPLETED,
        },
        select: {
          id: true,
          transactionRef: true,
          type: true,
          amount: true,
          transactionDate: true,
          description: true,
          member: {
            select: {
              memberNumber: true,
              user: {
                select: {
                  name: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          account: {
            select: {
              accountNumber: true,
            },
          },
        },
        orderBy: { transactionDate: "desc" },
        take: 10,
      }),

      // Recent deposits
      db.deposit.count({
        where: {
          account: { branchId },
          depositDate: { gte: today },
        },
      }),

      // Recent withdrawals
      db.withdrawal.count({
        where: {
          account: { branchId },
          withdrawalDate: { gte: today },
        },
      }),

      // Recent loan disbursements
      db.loan.findMany({
        where: {
          branchId,
          disbursementDate: { gte: firstDayOfMonth },
        },
        select: {
          id: true,
          amountGranted: true,
          disbursementDate: true,
          member: {
            select: {
              memberNumber: true,
              user: {
                select: {
                  name: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { disbursementDate: "desc" },
        take: 5,
      }),

      // Pending float reconciliations
      db.floatReconciliation.findMany({
        where: {
          float: {
            user: { branchId },
          },
          status: "PENDING",
        },
        select: {
          id: true,
          systemBalance: true,
          actualCash: true,
          difference: true,
          reconciliationDate: true,
          reconciledByUser: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { reconciliationDate: "desc" },
        take: 5,
      }),

      // Pending member accounts
      db.member.findMany({
        where: {
          accounts: {
            some: { branchId },
          },
          isApproved: false,
        },
        select: {
          id: true,
          memberNumber: true,
          registrationDate: true,
          user: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { registrationDate: "desc" },
        take: 5,
      }),

      // Pending institutions
      db.institution.findMany({
        where: {
          user: { branchId },
          isApproved: false,
        },
        select: {
          id: true,
          institutionNumber: true,
          institutionName: true,
          institutionType: true,
          institutionEmail: true,
          institutionPhone: true,
          createdAt: true,
          primaryContactPerson: true,
          primaryContactPhone: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              branch: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Fixed Deposit Stats
      db.fixedDeposit.aggregate({
        where: { 
          branchId,
          status: "ACTIVE",
          isWithdrawn: false
        },
        _count: { id: true },
        _sum: { principalAmount: true }
      }),

      // Fixed Deposits maturing in the next 30 days
      db.fixedDeposit.count({
        where: {
          branchId,
          status: "ACTIVE",
          isWithdrawn: false,
          maturityDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      db.assetTransfer.count({
        where: {
          branchId,
          status: "PENDING_APPROVAL",
        },
      }),

      db.fixedAsset.count({
        where: {
          branchId,
          assetType: "FIXED",
          status: AssetStatus.ACTIVE,
          approvalStatus: "PENDING_APPROVAL",
          disposalDate: { not: null },
        },
      }),
    ]);

    // Institution loan applications needing manager review (fetched separately to avoid type conflicts)
    const [institutionLoanCount, institutionLoanApplicationsToReview] = await Promise.all([
      db.institutionLoanApplication.count({
        where: {
          institution: { accounts: { some: { branchId } } },
          status: LoanStatus.PENDING,
        },
      }),
      db.institutionLoanApplication.findMany({
        where: {
          institution: { accounts: { some: { branchId } } },
          status: LoanStatus.PENDING,
          stage: { in: ["FORWARDED_TO_MANAGER", "IN_ANALYSIS"] },
        },
        select: {
          id: true,
          amountApplied: true,
          applicationDate: true,
          institution: {
            select: {
              institutionNumber: true,
              institutionName: true,
            },
          },
        },
        orderBy: { applicationDate: "desc" },
        take: 10,
      }),
    ]);

    // Calculate statistics
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

    const totalLoanPortfolio = activeLoans.reduce(
      (sum, loan) => sum + Number(loan.amountGranted),
      0
    );
    const totalOutstanding = activeLoans.reduce(
      (sum, loan) => sum + Number(loan.outstandingBalance),
      0
    );
    const overdueAmount = overdueLoans.reduce(
      (sum, loan) => sum + Number(loan.outstandingBalance),
      0
    );

    const totalFloatBalance = userFloats.reduce(
      (sum, f) => sum + Number(f.balance),
      0
    );
    const activeFloats = userFloats.filter((f) => f.isActiveForDay).length;

    const totalVaultBalance = branchVaults.reduce(
      (sum, v) => sum + Number(v.balance),
      0
    );

    const branchLiquidityVault = await getActiveBranchReserveVault(branchId);

    // Build comprehensive dashboard response
    const branch = await db.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        location: true,
      },
    });

    const dashboard = {
      branch,

      overview: {
        totalMembers,
        newMembersThisMonth,
        pendingMemberApprovals,
        totalAccounts,
        activeAccounts,
        totalStaff: branchStaff.length,
        activeStaff: branchStaff.filter((s) => s.isActive).length,
      },

      transactions: {
        today: {
          total: todayTransactions.length,
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
          total: monthTransactions.length,
          deposits: {
            count: monthDeposits.length,
            amount: monthDepositAmount,
          },
          withdrawals: {
            count: monthWithdrawals.length,
            amount: monthWithdrawalAmount,
          },
          netCashFlow: monthDepositAmount - monthWithdrawalAmount,
        },
      },

      loans: {
        active: activeLoans.length,
        overdue: overdueLoans.length,
        pending: pendingLoanApplications + institutionLoanCount,
        totalPortfolio: totalLoanPortfolio,
        totalOutstanding: totalOutstanding,
        overdueAmount: overdueAmount,
        recoveryRate:
          totalLoanPortfolio > 0
            ? ((totalLoanPortfolio - totalOutstanding) / totalLoanPortfolio) *
              100
            : 0,
        portfolioAtRisk:
          totalOutstanding > 0 ? (overdueAmount / totalOutstanding) * 100 : 0,
      },

      float: {
        totalBalance: totalFloatBalance,
        activeFloats,
        pendingReconciliations,
      },

      vault: {
        totalBalance: totalVaultBalance,
        vaults: branchVaults,
      },
      branchLiquidity: branchLiquidityVault?.balance || 0,
      branchLiquidityVault,

      fixedDeposits: {
        count: fixedDepositStats._count.id || 0,
        totalAmount: fixedDepositStats._sum.principalAmount || 0,
        maturingSoon: maturingSoonCount,
      },

      staff: branchStaff.map((s) => ({
        id: s.id,
        name: s.name || `${s.firstName || ""} ${s.lastName || ""}`.trim(),
        role: s.role,
        isActive: s.isActive,
        lastLogin: s.lastLogin?.toISOString() || null,
        email: s.email,
        phone: s.phone,
      })),

      recentActivity: {
        transactions: recentTransactions.map((t) => ({
          id: t.id,
          ref: t.transactionRef,
          type: t.type,
          amount: Number(t.amount),
          date: t.transactionDate.toISOString(),
          description: t.description,
          memberName:
            t.member?.user?.name ||
            `${t.member?.user?.firstName || ""} ${t.member?.user?.lastName || ""}`.trim(),
          memberNumber: t.member?.memberNumber,
          accountNumber: t.account?.accountNumber,
        })),
        loanDisbursements: recentLoanDisbursements.map((l) => ({
          id: l.id,
          amount: Number(l.amountGranted),
          date: l.disbursementDate?.toISOString() || null,
          memberName:
            l.member?.user?.name ||
            `${l.member?.user?.firstName || ""} ${l.member?.user?.lastName || ""}`.trim(),
          memberNumber: l.member?.memberNumber,
        })),
      },

      pendingApprovals: {
        members: pendingMemberAccounts.map((m) => ({
          id: m.id,
          memberNumber: m.memberNumber,
          name:
            m.user?.name ||
            `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim(),
          email: m.user?.email,
          phone: m.user?.phone,
          registrationDate: m.registrationDate.toISOString(),
        })),
        loanApplications: [
          ...loanApplicationsToReview.map((l) => ({
            id: l.id,
            amount: Number(l.amountApplied),
            date: l.applicationDate.toISOString(),
            memberName:
              l.member?.user?.name ||
              `${l.member?.user?.firstName || ""} ${l.member?.user?.lastName || ""}`.trim(),
            memberNumber: l.member?.memberNumber,
            isInstitution: false,
          })),
          ...institutionLoanApplicationsToReview.map((l) => ({
            id: l.id,
            amount: Number(l.amountApplied),
            date: l.applicationDate.toISOString(),
            memberName: l.institution?.institutionName ?? "Unknown Institution",
            memberNumber: l.institution?.institutionNumber,
            isInstitution: true,
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10),
        floatReconciliations: pendingFloatReconciliations.map((r) => ({
          id: r.id,
          systemBalance: Number(r.systemBalance),
          actualCash: Number(r.actualCash),
          difference: Number(r.difference),
          date: r.reconciliationDate.toISOString(),
          reconciledBy:
            r.reconciledByUser?.name ||
            `${r.reconciledByUser?.firstName || ""} ${r.reconciledByUser?.lastName || ""}`.trim(),
          role: r.reconciledByUser?.role,
        })),
        institutions: pendingInstitutions.map((institution) => ({
          id: institution.id,
          institutionNumber: institution.institutionNumber,
          institutionName: institution.institutionName,
          institutionType: institution.institutionType,
          institutionEmail: institution.institutionEmail,
          institutionPhone: institution.institutionPhone,
          primaryContactPerson: institution.primaryContactPerson,
          primaryContactPhone: institution.primaryContactPhone,
          branchName: institution.user.branch?.name || "Unknown",
          createdAt: institution.createdAt.toISOString(),
        })),
      },

      quickStats: {
        todayDeposits: recentDeposits,
        todayWithdrawals: recentWithdrawals,
        activeLoansCount: activeLoans.length,
        overdueLoansCount: overdueLoans.length,
        pendingApprovalsCount:
          pendingMemberApprovals +
          pendingLoanApplications +
          pendingReconciliations +
          pendingInstitutions.length,
        assetRequestsCount: assetTransferRequests + assetDisposalRequests,
      },
    };

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("❌ Error fetching branch manager dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dashboard data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
