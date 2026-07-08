// @ts-nocheck
// app/api/v1/accountant/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import {
  TransactionStatus,
  UserRole,
  ReconciliationStatus,
  TransactionType,
  AccountStatus,
  LoanStatus,
} from "@prisma/client";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  format,
} from "date-fns";
import { Prisma } from "@prisma/client";
import {
  getActiveBranchReserveVault,
  getOrganisationalReserveVault,
} from "@/lib/reserve-vault";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user has accountant permissions
    const allowedRoles: UserRole[] = [
      UserRole.ACCOUNTANT,
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to access this dashboard",
        },
        { status: 403 }
      );
    }

    // Get date ranges
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const yearStart = startOfYear(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Operational date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const firstDayOfMonth = monthStart;

    // Determine branch filter for scoped roles
    const scopedRoles: UserRole[] = [UserRole.ACCOUNTANT, UserRole.BRANCHMANAGER, UserRole.TELLER];
    const isScopedUser = scopedRoles.includes(user.role);
    const branchFilter = isScopedUser && user.branchId ? { branchId: user.branchId } : {};

    // ===========================================
    // 1. OVERVIEW & OPERATIONAL DATA
    // ===========================================
    const [
      currentMonthIncome,
      currentMonthExpenditure,
      lastMonthIncome,
      lastMonthExpenditure,
      
      // Operational Metrics (New)
      totalMembers,
      newMembersThisMonth,
      totalAccounts,
      activeAccounts,
      branchStaff,
      todayTransactions,
      monthTransactions,
      activeLoans,
      branchVaults,
      userFloats,
    ] = await Promise.all([
      // Current month income
      db.incomeRecord.aggregate({
        where: {
          status: TransactionStatus.COMPLETED,
          recordDate: {
            gte: monthStart,
            lte: monthEnd,
          },
          ...branchFilter,
        },
        _sum: { amount: true },
      }),

      // Current month expenditure
      db.expenditureRecord.aggregate({
        where: {
          status: TransactionStatus.COMPLETED,
          recordDate: {
            gte: monthStart,
            lte: monthEnd,
          },
          ...branchFilter,
        },
        _sum: { amount: true },
      }),

      // Last month income
      db.incomeRecord.aggregate({
        where: {
          status: TransactionStatus.COMPLETED,
          recordDate: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
          ...branchFilter,
        },
        _sum: { amount: true },
      }),

      // Last month expenditure
      db.expenditureRecord.aggregate({
        where: {
          status: TransactionStatus.COMPLETED,
          recordDate: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
          ...branchFilter,
        },
        _sum: { amount: true },
      }),

      // Members count
      isScopedUser && user.branchId ? db.member.count({
        where: {
          accounts: { some: { branchId: user.branchId } },
        },
      }) : Promise.resolve(0),

      // New members this month
      isScopedUser && user.branchId ? db.member.count({
        where: {
          accounts: {
            some: {
              branchId: user.branchId,
              openedAt: { gte: firstDayOfMonth },
            },
          },
        },
      }) : Promise.resolve(0),

      // Total accounts
      isScopedUser && user.branchId ? db.account.count({
        where: { branchId: user.branchId },
      }) : Promise.resolve(0),

      // Active accounts
      isScopedUser && user.branchId ? db.account.count({
        where: {
          branchId: user.branchId,
          status: AccountStatus.ACTIVE,
        },
      }) : Promise.resolve(0),

      // Branch staff
      isScopedUser && user.branchId ? db.user.findMany({
        where: {
          branchId: user.branchId,
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
          role: true,
          isActive: true,
        },
      }) : Promise.resolve([]),

      // Today's transactions
      isScopedUser && user.branchId ? db.transaction.findMany({
        where: {
          account: { branchId: user.branchId },
          transactionDate: { gte: today, lt: tomorrow },
          status: TransactionStatus.COMPLETED,
        },
        select: { id: true, type: true, amount: true, transactionDate: true, member: { select: { user: { select: { name: true } } } } },
      }) : Promise.resolve([]),

      // Month's transactions
      isScopedUser && user.branchId ? db.transaction.findMany({
        where: {
          account: { branchId: user.branchId },
          transactionDate: { gte: firstDayOfMonth },
          status: TransactionStatus.COMPLETED,
        },
        select: { type: true, amount: true },
      }) : Promise.resolve([]),

      // Active loans
      db.loan.findMany({
        where: {
          ...branchFilter,
          status: { in: [LoanStatus.DISBURSED, LoanStatus.OVERDUE] },
        },
        select: { outstandingBalance: true, status: true },
      }),

      // Branch vaults
      db.vault.findMany({
        where: { ...branchFilter, isActive: true },
        select: { id: true, name: true, balance: true },
      }),

      // User floats
      db.userFloat.findMany({
        where: {
          ...(isScopedUser && user.branchId ? { user: { branchId: user.branchId } } : {})
        },
        select: { balance: true },
      }),
    ]);

    const branchLiquidityVault = user.branchId
      ? await getActiveBranchReserveVault(user.branchId)
      : user.role === UserRole.ADMIN
        ? await getOrganisationalReserveVault()
        : null;

    const totalIncome = currentMonthIncome._sum.amount || 0;
    const totalExpenditure = currentMonthExpenditure._sum.amount || 0;
    const netIncome = totalIncome - totalExpenditure;

    const lastMonthIncomeTotal = lastMonthIncome._sum.amount || 0;
    const lastMonthExpenditureTotal = lastMonthExpenditure._sum.amount || 0;

    const incomeGrowth =
      lastMonthIncomeTotal > 0
        ? ((totalIncome - lastMonthIncomeTotal) / lastMonthIncomeTotal) * 100
        : 0;

    const expenditureGrowth =
      lastMonthExpenditureTotal > 0
        ? ((totalExpenditure - lastMonthExpenditureTotal) /
            lastMonthExpenditureTotal) *
          100
        : 0;

    // ===========================================
    // 2. PENDING APPROVALS COUNT
    // ===========================================
    const [
      pendingExpenditures,
      pendingFloatReconciliations,
      pendingVaultReconciliations,
    ] = await Promise.all([
      db.expenditureRecord.count({
        where: {
          status: TransactionStatus.PENDING,
          ...branchFilter,
        },
      }),

      db.floatReconciliation.count({
        where: {
          status: ReconciliationStatus.PENDING,
          ...(isScopedUser && user.branchId ? { float: { user: { branchId: user.branchId } } } : {}),
        },
      }),

      db.vaultReconciliation.count({
        where: {
          status: ReconciliationStatus.PENDING,
          ...(isScopedUser && user.branchId ? { vault: { branchId: user.branchId } } : {}),
        },
      }),
    ]);

    const pendingApprovals =
      pendingExpenditures +
      pendingFloatReconciliations +
      pendingVaultReconciliations;

    // ===========================================
    // 3. BUDGET PERFORMANCE (YEAR TO DATE)
    // ===========================================
    const currentYear = now.getFullYear();

    // Get all budgets for current year
    const yearBudgets = await db.budget.findMany({
      where: {
        year: currentYear,
        isActive: true,
        ...branchFilter,
      },
      include: {
        category: true,
      },
    });

    const totalBudget = yearBudgets.reduce(
      (sum, budget) => sum + budget.amount,
      0
    );

    // Get year-to-date expenditure
    const ytdExpenditure = await db.expenditureRecord.aggregate({
      where: {
        status: TransactionStatus.COMPLETED,
        recordDate: {
          gte: yearStart,
          lte: now,
        },
        ...branchFilter,
      },
      _sum: { amount: true },
    });

    const actualSpent = ytdExpenditure._sum.amount || 0;
    const variance = totalBudget - actualSpent;
    const percentageUsed =
      totalBudget > 0 ? (actualSpent / totalBudget) * 100 : 0;
    const onTrack = percentageUsed <= 85; // Under 85% is considered on track

    // ===========================================
    // 4. CASH POSITION
    // ===========================================
    const [vaultBalances, floatBalances, lastMonthCash] = await Promise.all([
      // Sum of all active vault balances
      db.vault.aggregate({
        where: {
          isActive: true,
          ...branchFilter,
        },
        _sum: {
          balance: true,
        },
      }),

      // Sum of all user float balances
      db.userFloat.aggregate({
        where: {
          ...(isScopedUser && user.branchId ? {
             user: { branchId: user.branchId }
          } : {})
        },
        _sum: {
          balance: true,
        },
      }),

      // Last month's total cash (for growth calculation)
      isScopedUser && user.branchId 
        ? db.$queryRaw<Array<{ total: number }>>(
            Prisma.sql`
              SELECT 
                COALESCE(SUM(v.balance), 0) + COALESCE(SUM(uf.balance), 0) as total
              FROM "Vault" v
              CROSS JOIN "UserFloat" uf
              LEFT JOIN "User" u ON uf."userId" = u.id
              WHERE v."isActive" = true 
                AND v."branchId" = ${user.branchId}
                AND v."updatedAt" <= ${lastMonthEnd}
                AND u."branchId" = ${user.branchId}
            `
          )
        : db.$queryRaw<Array<{ total: number }>>(
            Prisma.sql`
              SELECT 
                COALESCE(SUM(v.balance), 0) + COALESCE(SUM(uf.balance), 0) as total
              FROM "Vault" v
              CROSS JOIN "UserFloat" uf
              WHERE v."isActive" = true
                AND v."updatedAt" <= ${lastMonthEnd}
            `
          ),
    ]);

    const vaultBalance = vaultBalances._sum.balance || 0;
    const floatBalance = floatBalances._sum.balance || 0;

    // Derive bank balance from imported bank statement lines (credits minus debits)
    const [bankCredits, bankDebits] = await Promise.all([
      db.bankStatementLine.aggregate({ _sum: { amount: true }, where: { direction: "CREDIT" } }),
      db.bankStatementLine.aggregate({ _sum: { amount: true }, where: { direction: "DEBIT" } }),
    ]);
    const bankBalance = Number(bankCredits._sum.amount || 0) - Number(bankDebits._sum.amount || 0);

    const totalCash = vaultBalance + floatBalance + bankBalance;
    const previousMonthCash = lastMonthCash[0]?.total || totalCash;
    const cashGrowth =
      previousMonthCash > 0
        ? ((totalCash - previousMonthCash) / previousMonthCash) * 100
        : 0;

    // ===========================================
    // 5. RECONCILIATION STATUS
    // ===========================================
    const suspenseTransactions = await db.suspenseTransaction.count({
      where: {
        status: "PENDING_INVESTIGATION",
        ...(isScopedUser && user.branchId ? {
          suspenseAccount: { branchId: user.branchId }
        } : {})
      },
    });

    const reconciliation = {
      pendingFloatReconciliations,
      pendingVaultReconciliations,
      suspenseTransactions,
      totalPending:
        pendingFloatReconciliations +
        pendingVaultReconciliations +
        suspenseTransactions,
    };

    // ===========================================
    // 6. MONTHLY TRENDS (Last 6 months)
    // ===========================================
    const monthlyTrends = await (isScopedUser && user.branchId 
      ? db.$queryRaw<Array<{ month: string; income: number; expenditure: number; net_income: number; }>>(
          Prisma.sql`
            WITH months AS (
              SELECT generate_series(
                date_trunc('month', CURRENT_DATE - INTERVAL '5 months'),
                date_trunc('month', CURRENT_DATE),
                '1 month'::interval
              ) AS month
            ),
            income_data AS (
              SELECT 
                date_trunc('month', "recordDate") AS month,
                SUM(amount) AS total_income
              FROM "IncomeRecord"
              WHERE status IN ('COMPLETED', 'APPROVED')
                AND "recordDate" >= CURRENT_DATE - INTERVAL '6 months'
                AND "branchId" = ${user.branchId}
              GROUP BY date_trunc('month', "recordDate")
            ),
            expenditure_data AS (
              SELECT 
                date_trunc('month', "recordDate") AS month,
                SUM(amount) AS total_expenditure
              FROM "ExpenditureRecord"
              WHERE status = 'COMPLETED'
                AND "recordDate" >= CURRENT_DATE - INTERVAL '6 months'
                AND "branchId" = ${user.branchId}
              GROUP BY date_trunc('month', "recordDate")
            )
            SELECT 
              TO_CHAR(m.month, 'Mon') AS month,
              COALESCE(i.total_income::float, 0) AS income,
              COALESCE(e.total_expenditure::float, 0) AS expenditure,
              COALESCE(i.total_income::float, 0) - COALESCE(e.total_expenditure::float, 0) AS net_income
            FROM months m
            LEFT JOIN income_data i ON m.month = i.month
            LEFT JOIN expenditure_data e ON m.month = e.month
            ORDER BY m.month
          `
        )
      : db.$queryRaw<Array<{ month: string; income: number; expenditure: number; net_income: number; }>>(
          Prisma.sql`
            WITH months AS (
              SELECT generate_series(
                date_trunc('month', CURRENT_DATE - INTERVAL '5 months'),
                date_trunc('month', CURRENT_DATE),
                '1 month'::interval
              ) AS month
            ),
            income_data AS (
              SELECT 
                date_trunc('month', "recordDate") AS month,
                SUM(amount) AS total_income
              FROM "IncomeRecord"
              WHERE status IN ('COMPLETED', 'APPROVED')
                AND "recordDate" >= CURRENT_DATE - INTERVAL '6 months'
              GROUP BY date_trunc('month', "recordDate")
            ),
            expenditure_data AS (
              SELECT 
                date_trunc('month', "recordDate") AS month,
                SUM(amount) AS total_expenditure
              FROM "ExpenditureRecord"
              WHERE status = 'COMPLETED'
                AND "recordDate" >= CURRENT_DATE - INTERVAL '6 months'
              GROUP BY date_trunc('month', "recordDate")
            )
            SELECT 
              TO_CHAR(m.month, 'Mon') AS month,
              COALESCE(i.total_income::float, 0) AS income,
              COALESCE(e.total_expenditure::float, 0) AS expenditure,
              COALESCE(i.total_income::float, 0) - COALESCE(e.total_expenditure::float, 0) AS net_income
            FROM months m
            LEFT JOIN income_data i ON m.month = i.month
            LEFT JOIN expenditure_data e ON m.month = e.month
            ORDER BY m.month
          `
        ));

    // ===========================================
    // 7. CATEGORY BREAKDOWN
    // ===========================================
    // ✅ FIXED: Changed categoryId to budgetCategoryId
    const [incomeByCategory, expenditureByCategory] = await Promise.all([
      // Income by category
      db.incomeRecord.groupBy({
        by: ["budgetCategoryId"],
        where: {
          status: TransactionStatus.COMPLETED,
          recordDate: {
            gte: monthStart,
            lte: monthEnd,
          },
          budgetCategoryId: { not: null },
          ...branchFilter,
        },
        _sum: {
          amount: true,
        },
      }),

      // Expenditure by category
      db.expenditureRecord.groupBy({
        by: ["budgetCategoryId"],
        where: {
          status: TransactionStatus.COMPLETED,
          recordDate: {
            gte: monthStart,
            lte: monthEnd,
          },
          budgetCategoryId: { not: null },
          ...branchFilter,
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    // ✅ FIXED: Changed to budgetCategory instead of incomeCategory/expenditureCategory
    // Fetch category details
    const incomeCategoryIds = incomeByCategory
      .map((c) => c.budgetCategoryId)
      .filter((id): id is string => id !== null);
    const expenditureCategoryIds = expenditureByCategory
      .map((c) => c.budgetCategoryId)
      .filter((id): id is string => id !== null);

    const [incomeCategories, expenditureCategories] = await Promise.all([
      db.budgetCategory.findMany({
        where: {
          id: { in: incomeCategoryIds },
        },
      }),

      db.budgetCategory.findMany({
        where: {
          id: { in: expenditureCategoryIds },
        },
      }),
    ]);

    // Map categories with colors
    const colorPalette = {
      income: [
        "#10b981",
        "#14b8a6",
        "#06b6d4",
        "#0ea5e9",
        "#3b82f6",
        "#6366f1",
      ],
      expenditure: [
        "#ef4444",
        "#f97316",
        "#f59e0b",
        "#eab308",
        "#84cc16",
        "#22c55e",
      ],
    };

    const incomeBreakdown = incomeByCategory.map((item, index) => {
      const category = incomeCategories.find(
        (c) => c.id === item.budgetCategoryId
      );
      return {
        name: category?.name || "Unknown",
        value: item._sum.amount || 0,
        color: colorPalette.income[index % colorPalette.income.length],
      };
    });

    const expenditureBreakdown = expenditureByCategory.map((item, index) => {
      const category = expenditureCategories.find(
        (c) => c.id === item.budgetCategoryId
      );
      return {
        name: category?.name || "Unknown",
        value: item._sum.amount || 0,
        color:
          colorPalette.expenditure[index % colorPalette.expenditure.length],
      };
    });

    // ===========================================
    // 8. BUDGET VS ACTUAL (Top 5 categories)
    // ===========================================
    const budgetVsActual = await db.budget.findMany({
      where: {
        year: currentYear,
        isActive: true,
      },
      include: {
        category: true,
      },
      take: 5,
      orderBy: {
        amount: "desc",
      },
    });

    // Get actual expenditure for each budget category
    const budgetCategoryIds = budgetVsActual.map((b) => b.categoryId);
    const actualExpenditures = await db.expenditureRecord.groupBy({
      by: ["budgetCategoryId"],
      where: {
        budgetCategoryId: { in: budgetCategoryIds },
        status: TransactionStatus.COMPLETED,
        recordDate: {
          gte: yearStart,
          lte: now,
        },
        ...branchFilter,
      },
      _sum: {
        amount: true,
      },
    });

    const budgetVsActualData = budgetVsActual.map((budget) => {
      const actual = actualExpenditures.find(
        (a) => a.budgetCategoryId === budget.categoryId
      );
      const actualAmount = actual?._sum.amount || 0;
      const budgetedAmount = budget.amount;
      const varianceAmount = budgetedAmount - actualAmount;
      const percentageUsed =
        budgetedAmount > 0 ? (actualAmount / budgetedAmount) * 100 : 0;

      let status = "On Target";
      if (percentageUsed < 90) status = "Under Budget";
      if (percentageUsed > 100) status = "Over Budget";

      return {
        category: budget.category.name,
        budgeted: budgetedAmount,
        actual: actualAmount,
        variance: varianceAmount,
        status,
        percentageUsed,
      };
    });

    // ===========================================
    // 9. PENDING APPROVALS (Detailed)
    // ===========================================
    const [
      pendingExpenditureDetails,
      pendingFloatReconciliationDetails,
      pendingVaultReconciliationDetails,
    ] = await Promise.all([
      db.expenditureRecord.findMany({
        where: {
          status: TransactionStatus.PENDING,
          ...branchFilter,
        },
        include: {
          budgetCategory: true,
          submittedBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      }),

      db.floatReconciliation.findMany({
        where: {
          status: ReconciliationStatus.PENDING,
          ...(isScopedUser && user.branchId ? { float: { user: { branchId: user.branchId } } } : {}),
        },
        include: {
          reconciledByUser: {
            select: {
              name: true,
            },
          },
          float: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          reconciliationDate: "desc",
        },
        take: 3,
      }),

      db.vaultReconciliation.findMany({
        where: {
          status: ReconciliationStatus.PENDING,
          ...(isScopedUser && user.branchId ? { vault: { branchId: user.branchId } } : {}),
        },
        include: {
          reconciledBy: {
            select: {
              name: true,
            },
          },
          vault: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          reconciliationDate: "desc",
        },
        take: 2,
      }),
    ]);

    const pendingApprovalsList = [
      ...pendingExpenditureDetails.map((exp) => ({
        id: exp.id,
        type: "EXPENDITURE" as const,
        amount: exp.amount,
        category: exp.budgetCategory?.name || "Unknown",
        description: exp.description || "No description",
        submittedBy: exp.submittedBy.name,
        submittedAt: exp.createdAt.toISOString(),
        priority:
          exp.amount > 2000000
            ? "HIGH"
            : exp.amount > 1000000
              ? "MEDIUM"
              : "LOW",
      })),
      ...pendingFloatReconciliationDetails.map((rec) => ({
        id: rec.id,
        type: "RECONCILIATION" as const,
        amount: rec.systemBalance,
        category: "Float Reconciliation",
        description: `${rec.float.user.name} - Float reconciliation`,
        submittedBy: rec.reconciledByUser.name,
        submittedAt: rec.reconciliationDate.toISOString(),
        priority: !rec.isBalanced ? "HIGH" : "MEDIUM",
      })),
      ...pendingVaultReconciliationDetails.map((rec) => ({
        id: rec.id,
        type: "RECONCILIATION" as const,
        amount: rec.systemBalance,
        category: "Vault Reconciliation",
        description: `${rec.vault.name} - Vault reconciliation`,
        submittedBy: rec.reconciledBy.name,
        submittedAt: rec.reconciliationDate.toISOString(),
        priority: !rec.isBalanced ? "HIGH" : "LOW",
      })),
    ].sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    // ===========================================
    // 10. RECENT ACTIVITY (Last 5 actions)
    // ===========================================
    const recentActivity = await db.auditLog.findMany({
      where: {
        entityType: {
          in: [
            "ExpenditureRecord",
            "IncomeRecord",
            "FloatReconciliation",
            "VaultReconciliation",
            "FinancialPeriod",
          ],
        },
        ...(isScopedUser && user.branchId ? {
          user: { branchId: user.branchId }
        } : {})
      },
      include: {
        user: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 5,
    });

    const recentActivityFormatted = recentActivity.map((log) => {
      let actionType = "OTHER";
      if (log.action.includes("APPROVE")) actionType = "APPROVAL";
      else if (log.action.includes("REJECT")) actionType = "REJECTION";
      else if (
        log.action.includes("CREATE") &&
        log.entityType === "IncomeRecord"
      )
        actionType = "INCOME";
      else if (log.entityType.includes("Reconciliation"))
        actionType = "RECONCILIATION";
      else if (log.entityType === "FinancialPeriod") actionType = "PERIOD";

      return {
        id: log.id,
        action: log.action,
        description: log.details || "No description",
        performedBy: log.user.name,
        timestamp: log.timestamp.toISOString(),
        type: actionType,
      };
    });

    // Calculate statistics (New)
    const todayDeposits = todayTransactions.filter((t) => t.type === TransactionType.DEPOSIT);
    const todayWithdrawals = todayTransactions.filter((t) => t.type === TransactionType.WITHDRAWAL);
    const todayDepositAmount = todayDeposits.reduce((sum, t) => sum + Number(t.amount), 0);
    const todayWithdrawalAmount = todayWithdrawals.reduce((sum, t) => sum + Number(t.amount), 0);

    const monthDeposits = monthTransactions.filter((t) => t.type === TransactionType.DEPOSIT);
    const monthWithdrawals = monthTransactions.filter((t) => t.type === TransactionType.WITHDRAWAL);
    const monthDepositAmount = monthDeposits.reduce((sum, t) => sum + Number(t.amount), 0);
    const monthWithdrawalAmount = monthWithdrawals.reduce((sum, t) => sum + Number(t.amount), 0);

    const totalPortfolio = activeLoans.reduce((sum, loan) => sum + Number(loan.outstandingBalance), 0);
    const totalVaultBalance = branchVaults.reduce((sum, v) => sum + Number(v.balance), 0);
    const totalFloatBalance = userFloats.reduce((sum, f) => sum + Number(f.balance), 0);

    // ===========================================
    // FINAL RESPONSE
    // ===========================================
    const dashboardData = {
      branch: isScopedUser ? { name: user.branchName, location: user.branchLocation } : { name: "HQ", location: "Central" },

      overview: {
        totalIncome,
        totalExpenditure,
        netIncome,
        pendingApprovals,
        incomeGrowth: Number(incomeGrowth.toFixed(1)),
        expenditureGrowth: Number(expenditureGrowth.toFixed(1)),
        totalMembers,
        newMembersThisMonth,
        totalAccounts,
        activeAccounts,
        totalStaff: branchStaff.length,
        activeStaff: branchStaff.filter((s) => s.isActive).length,
      },

      transactions: {
        today: {
          total: todayTransactions.length,
          deposits: { count: todayDeposits.length, amount: todayDepositAmount },
          withdrawals: { count: todayWithdrawals.length, amount: todayWithdrawalAmount },
          netCashFlow: todayDepositAmount - todayWithdrawalAmount,
        },
        month: {
          total: monthTransactions.length,
          deposits: { count: monthDeposits.length, amount: monthDepositAmount },
          withdrawals: { count: monthWithdrawals.length, amount: monthWithdrawalAmount },
          netCashFlow: monthDepositAmount - monthWithdrawalAmount,
        },
      },

      loans: {
        active: activeLoans.length,
        totalOutstanding: totalPortfolio,
      },

      budgetPerformance: {
        totalBudget,
        actualSpent,
        variance,
        percentageUsed: Number(percentageUsed.toFixed(1)),
        onTrack,
      },

      cashPosition: {
        vaultBalance: totalVaultBalance,
        floatBalance: totalFloatBalance,
        bankBalance,
        totalCash: totalVaultBalance + totalFloatBalance + bankBalance,
        previousMonthCash,
        cashGrowth: Number(cashGrowth.toFixed(1)),
      },
      branchLiquidity: branchLiquidityVault?.balance || 0,
      branchLiquidityVault,

      reconciliation,
      monthlyTrends,

      categoryBreakdown: {
        income: incomeBreakdown,
        expenditure: expenditureBreakdown,
      },

      budgetVsActual: budgetVsActualData,
      pendingApprovals: pendingApprovalsList,
      
      staff: branchStaff.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        isActive: s.isActive,
      })),

      recentActivity: recentActivityFormatted,
      
      // Live Log (Transactions Heatmap proxy)
      liveActivity: todayTransactions.slice(0, 10).map(t => ({
        id: t.id,
        memberName: t.member?.user?.name || "Unknown",
        amount: Number(t.amount),
        type: t.type,
        date: t.transactionDate.toISOString(),
      })),
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error("Error fetching accountant dashboard:", error);
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
