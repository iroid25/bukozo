// ============================================================================
// actions/reports/financial-year-reports.ts - Financial Year Reports (FIXED)
// ============================================================================
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, TransactionStatus } from "@prisma/client";

// ============================================================================
// 9. BALANCE SHEET (FINANCIAL YEAR)
// ============================================================================
export async function getFinancialYearBalanceSheet(
  year: number,
  branchId?: string
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    // ✅ FIX: Proper role check
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ];

    if (!allowedRoles.includes(user.role as UserRole)) {
      return { error: "Access denied", data: null };
    }

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const branchFilter =
      user.role === UserRole.ADMIN && branchId ? { branchId } : {};

    // Fetch all accounts
    const accounts = await db.account.findMany({
      where: {
        status: "ACTIVE",
        ...branchFilter,
      },
      include: {
        accountType: true,
        member: {
          select: {
            memberNumber: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    // Fetch all loans
    const loans = await db.loan.findMany({
      where: {
        status: { in: ["DISBURSED", "OVERDUE"] },
        disbursementDate: { lte: yearEnd },
        ...branchFilter,
      },
    });

    // Fetch income and expenses for the year
    const [incomeRecords, expenditureRecords] = await Promise.all([
      db.incomeRecord.findMany({
        where: {
          recordDate: { gte: yearStart, lte: yearEnd },
          status: TransactionStatus.COMPLETED,
          ...branchFilter,
        },
      }),
      db.expenditureRecord.findMany({
        where: {
          recordDate: { gte: yearStart, lte: yearEnd },
          status: TransactionStatus.COMPLETED,
          ...branchFilter,
        },
      }),
    ]);

    // Calculate totals
    const totalDeposits = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLoansReceivable = loans.reduce(
      (sum, loan) => sum + loan.outstandingBalance,
      0
    );
    const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenditureRecords.reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const retainedEarnings = totalIncome - totalExpenses;

    // Build balance sheet structure
    const assets = {
      currentAssets: {
        cash: 0, // Should fetch from vault/cash accounts
        deposits: totalDeposits,
        loansReceivable: totalLoansReceivable,
        subtotal: totalDeposits + totalLoansReceivable,
      },
      nonCurrentAssets: {
        property: 0,
        equipment: 0,
        subtotal: 0,
      },
      total: totalDeposits + totalLoansReceivable,
    };

    const liabilities = {
      currentLiabilities: {
        memberDepositsPayable: totalDeposits,
        accountsPayable: 0,
        subtotal: totalDeposits,
      },
      nonCurrentLiabilities: {
        longTermDebt: 0,
        subtotal: 0,
      },
      total: totalDeposits,
    };

    const equity = {
      retainedEarnings,
      currentYearProfit: retainedEarnings,
      total: retainedEarnings,
    };

    const balanceSheet = {
      assets,
      liabilitiesAndEquity: {
        liabilities,
        equity,
        total: liabilities.total + equity.total,
      },
    };

    return {
      error: null,
      data: {
        reportType: "Balance Sheet (Financial Year)",
        financialYear: year,
        period: { start: yearStart, end: yearEnd },
        balanceSheet,
        summary: {
          totalAssets: assets.total,
          totalLiabilities: liabilities.total,
          totalEquity: equity.total,
          balanced:
            Math.abs(assets.total - (liabilities.total + equity.total)) < 1,
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating financial year balance sheet:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 10. TRIAL BALANCE (FINANCIAL YEAR)
// ============================================================================
export async function getFinancialYearTrialBalance(
  year: number,
  branchId?: string
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    // ✅ FIX: Proper role check
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ];

    if (!allowedRoles.includes(user.role as UserRole)) {
      return { error: "Access denied", data: null };
    }

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const branchFilter =
      user.role === UserRole.ADMIN && branchId ? { branchId } : {};

    const [incomeRecords, expenditureRecords, accounts, loans] =
      await Promise.all([
        db.incomeRecord.findMany({
          where: {
            recordDate: { gte: yearStart, lte: yearEnd },
            status: TransactionStatus.COMPLETED,
            ...branchFilter,
          },
          include: {
            budgetCategory: { include: { parent: true } },
          },
        }),
        db.expenditureRecord.findMany({
          where: {
            recordDate: { gte: yearStart, lte: yearEnd },
            status: TransactionStatus.COMPLETED,
            ...branchFilter,
          },
          include: {
            budgetCategory: { include: { parent: true } },
          },
        }),
        db.account.findMany({
          where: { status: "ACTIVE", ...branchFilter },
          include: { accountType: true },
        }),
        db.loan.findMany({
          where: {
            status: { in: ["DISBURSED", "OVERDUE"] },
            ...branchFilter,
          },
        }),
      ]);

    // Group by category
    const incomeByCategory = new Map<string, any>();
    incomeRecords.forEach((record) => {
      const parent = record.budgetCategory?.parent || record.budgetCategory;
      if (!parent) return;

      if (!incomeByCategory.has(parent.id)) {
        incomeByCategory.set(parent.id, {
          accountName: parent.name,
          accountCode: parent.code,
          debit: 0,
          credit: 0,
        });
      }
      const cat = incomeByCategory.get(parent.id);
      cat.credit += record.amount;
    });

    const expensesByCategory = new Map<string, any>();
    expenditureRecords.forEach((record) => {
      const parent = record.budgetCategory?.parent || record.budgetCategory;
      if (!parent) return;

      if (!expensesByCategory.has(parent.id)) {
        expensesByCategory.set(parent.id, {
          accountName: parent.name,
          accountCode: parent.code,
          debit: 0,
          credit: 0,
        });
      }
      const cat = expensesByCategory.get(parent.id);
      cat.debit += record.amount;
    });

    const totalDebits = expenditureRecords.reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const totalCredits = incomeRecords.reduce((sum, r) => sum + r.amount, 0);

    const entries = [
      ...Array.from(incomeByCategory.values()),
      ...Array.from(expensesByCategory.values()),
    ];

    return {
      error: null,
      data: {
        reportType: "Trial Balance (Financial Year)",
        financialYear: year,
        period: { start: yearStart, end: yearEnd },
        entries,
        totals: {
          totalDebits,
          totalCredits,
          difference: totalDebits - totalCredits,
          balanced: Math.abs(totalDebits - totalCredits) < 1,
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating financial year trial balance:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 11. PROFIT AND LOSS (FINANCIAL YEAR)
// ============================================================================
export async function getFinancialYearProfitLoss(
  year: number,
  branchId?: string
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const branchFilter =
      user.role === UserRole.ADMIN && branchId ? { branchId } : {};

    const [incomeRecords, expenditureRecords] = await Promise.all([
      db.incomeRecord.findMany({
        where: {
          recordDate: { gte: yearStart, lte: yearEnd },
          status: TransactionStatus.COMPLETED,
          ...branchFilter,
        },
        include: {
          budgetCategory: { include: { parent: true } },
          branch: { select: { name: true } },
        },
      }),
      db.expenditureRecord.findMany({
        where: {
          recordDate: { gte: yearStart, lte: yearEnd },
          status: TransactionStatus.COMPLETED,
          ...branchFilter,
        },
        include: {
          budgetCategory: { include: { parent: true } },
          branch: { select: { name: true } },
        },
      }),
    ]);

    // Monthly breakdown
    const monthlyData: any[] = [];
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

      const monthIncome = incomeRecords.filter(
        (r) => r.recordDate >= monthStart && r.recordDate <= monthEnd
      );
      const monthExpenses = expenditureRecords.filter(
        (r) => r.recordDate >= monthStart && r.recordDate <= monthEnd
      );

      const monthTotalIncome = monthIncome.reduce(
        (sum, r) => sum + r.amount,
        0
      );
      const monthTotalExpenses = monthExpenses.reduce(
        (sum, r) => sum + r.amount,
        0
      );

      monthlyData.push({
        month: monthStart.toLocaleString("default", { month: "long" }),
        monthNumber: month + 1,
        income: monthTotalIncome,
        expenses: monthTotalExpenses,
        netProfit: monthTotalIncome - monthTotalExpenses,
        profitMargin:
          monthTotalIncome > 0
            ? ((monthTotalIncome - monthTotalExpenses) / monthTotalIncome) * 100
            : 0,
      });
    }

    // Group by category
    const incomeByCategory = new Map();
    incomeRecords.forEach((record) => {
      const parent = record.budgetCategory?.parent || record.budgetCategory;
      if (!parent) return;

      if (!incomeByCategory.has(parent.id)) {
        incomeByCategory.set(parent.id, {
          name: parent.name,
          amount: 0,
          items: [],
        });
      }
      const category = incomeByCategory.get(parent.id);
      category.amount += record.amount;
      category.items.push({
        itemName: record.budgetCategory?.name || parent.name,
        amount: record.amount,
        date: record.recordDate,
      });
    });

    const expensesByCategory = new Map();
    expenditureRecords.forEach((record) => {
      const parent = record.budgetCategory?.parent || record.budgetCategory;
      if (!parent) return;

      if (!expensesByCategory.has(parent.id)) {
        expensesByCategory.set(parent.id, {
          name: parent.name,
          amount: 0,
          items: [],
        });
      }
      const category = expensesByCategory.get(parent.id);
      category.amount += record.amount;
      category.items.push({
        itemName: record.budgetCategory?.name || parent.name,
        amount: record.amount,
        date: record.recordDate,
      });
    });

    const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenditureRecords.reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const grossProfit = totalIncome - totalExpenses;

    return {
      error: null,
      data: {
        reportType: "Profit and Loss Statement (Financial Year)",
        financialYear: year,
        period: { start: yearStart, end: yearEnd },
        summary: {
          totalRevenue: totalIncome,
          totalExpenses,
          grossProfit,
          netProfit: grossProfit,
          profitMargin: totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0,
        },
        monthlyBreakdown: monthlyData,
        incomeDetails: {
          categories: Array.from(incomeByCategory.values()),
          total: totalIncome,
        },
        expenseDetails: {
          categories: Array.from(expensesByCategory.values()),
          total: totalExpenses,
        },
        ratios: {
          revenueGrowth: 0,
          expenseRatio:
            totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0,
          profitMargin: totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0,
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating financial year profit loss:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 12. COMPREHENSIVE TRIAL BALANCE
// ============================================================================
export async function getComprehensiveTrialBalance(
  year: number,
  branchId?: string
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const trialBalanceResult = await getFinancialYearTrialBalance(
      year,
      branchId
    );

    // ✅ FIX: Check for error or null data
    if (trialBalanceResult.error || !trialBalanceResult.data) {
      return trialBalanceResult;
    }

    const branchFilter =
      user.role === UserRole.ADMIN && branchId ? { branchId } : {};

    const [accounts, loans, members] = await Promise.all([
      db.account.findMany({
        where: { status: "ACTIVE", ...branchFilter },
        include: {
          accountType: true,
          member: {
            select: { memberNumber: true, user: { select: { name: true } } },
          },
        },
      }),
      db.loan.findMany({
        where: { status: { in: ["DISBURSED", "OVERDUE"] }, ...branchFilter },
        include: { member: { select: { memberNumber: true } } },
      }),
      db.member.findMany({ where: { isApproved: true } }),
    ]);

    const accountsByType = new Map();
    accounts.forEach((acc) => {
      const type = acc.accountType.name;
      if (!accountsByType.has(type)) {
        accountsByType.set(type, { count: 0, balance: 0 });
      }
      const group = accountsByType.get(type);
      group.count++;
      group.balance += acc.balance;
    });

    const loansByStatus = new Map();
    loans.forEach((loan) => {
      const status = loan.status;
      if (!loansByStatus.has(status)) {
        loansByStatus.set(status, { count: 0, outstanding: 0 });
      }
      const group = loansByStatus.get(status);
      group.count++;
      group.outstanding += loan.outstandingBalance;
    });

    return {
      error: null,
      data: {
        ...trialBalanceResult.data,
        reportType: "Statement of Comprehensive Trial Balance",
        comprehensiveDetails: {
          accountsBreakdown: {
            byType: Array.from(accountsByType.entries()).map(
              ([type, data]) => ({
                type,
                ...data,
              })
            ),
            totalAccounts: accounts.length,
            totalBalance: accounts.reduce((sum, acc) => sum + acc.balance, 0),
          },
          loansBreakdown: {
            totalLoans: loans.length,
            totalOutstanding: loans.reduce(
              (sum, l) => sum + l.outstandingBalance,
              0
            ),
            byStatus: Array.from(loansByStatus.entries()).map(
              ([status, data]) => ({
                status,
                ...data,
              })
            ),
          },
          membershipMetrics: {
            totalMembers: members.length,
            averageDepositPerMember:
              members.length > 0
                ? accounts.reduce((sum, acc) => sum + acc.balance, 0) /
                  members.length
                : 0,
          },
        },
      },
    };
  } catch (error) {
    console.error("Error generating comprehensive trial balance:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 13. COMPREHENSIVE BALANCE SHEET
// ============================================================================
export async function getComprehensiveBalanceSheet(
  year: number,
  branchId?: string
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const balanceSheetResult = await getFinancialYearBalanceSheet(
      year,
      branchId
    );

    // ✅ FIX: Check if balanceSheetResult has an error or null data
    if (balanceSheetResult.error || !balanceSheetResult.data) {
      return balanceSheetResult;
    }

    const balanceSheetData = balanceSheetResult.data;

    const branchFilter =
      user.role === UserRole.ADMIN && branchId ? { branchId } : {};

    // Quarterly breakdown
    const quarters = [
      { name: "Q1", months: [0, 1, 2] },
      { name: "Q2", months: [3, 4, 5] },
      { name: "Q3", months: [6, 7, 8] },
      { name: "Q4", months: [9, 10, 11] },
    ];

    const quarterlyBreakdown = [];

    for (const quarter of quarters) {
      const quarterStart = new Date(year, quarter.months[0], 1);
      const quarterEnd = new Date(year, quarter.months[2] + 1, 0, 23, 59, 59);

      const [qIncome, qExpenses] = await Promise.all([
        db.incomeRecord.aggregate({
          where: {
            recordDate: { gte: quarterStart, lte: quarterEnd },
            status: TransactionStatus.COMPLETED,
            ...branchFilter,
          },
          _sum: { amount: true },
        }),
        db.expenditureRecord.aggregate({
          where: {
            recordDate: { gte: quarterStart, lte: quarterEnd },
            status: TransactionStatus.COMPLETED,
            ...branchFilter,
          },
          _sum: { amount: true },
        }),
      ]);

      quarterlyBreakdown.push({
        quarter: quarter.name,
        period: { start: quarterStart, end: quarterEnd },
        income: qIncome._sum.amount || 0,
        expenses: qExpenses._sum.amount || 0,
        netIncome: (qIncome._sum.amount || 0) - (qExpenses._sum.amount || 0),
      });
    }

    return {
      error: null,
      data: {
        ...balanceSheetData,
        reportType: "Statement of Comprehensive Balance Sheet",
        quarterlyBreakdown,
        comprehensiveAnalysis: {
          liquidityRatios: {
            currentRatio:
              balanceSheetData.balanceSheet.liabilitiesAndEquity.liabilities
                .currentLiabilities.subtotal > 0
                ? balanceSheetData.balanceSheet.assets.currentAssets.subtotal /
                  balanceSheetData.balanceSheet.liabilitiesAndEquity.liabilities
                    .currentLiabilities.subtotal
                : 0,
          },
          yearOverYearGrowth: {
            assetsGrowth: 0,
            liabilitiesGrowth: 0,
            equityGrowth: 0,
          },
        },
      },
    };
  } catch (error) {
    console.error("Error generating comprehensive balance sheet:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 14. USER-DEFINED CASH FLOW STATEMENT
// ============================================================================
export async function getCustomCashFlowStatement(config: {
  startDate: Date;
  endDate: Date;
  includedCategories?: string[];
  excludedCategories?: string[];
  groupBy?: "category" | "branch" | "month";
  branchIds?: string[];
}) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const whereClause: any = {
      recordDate: { gte: config.startDate, lte: config.endDate },
      status: TransactionStatus.COMPLETED,
      paymentMethod: "CASH",
    };

    if (config.branchIds && config.branchIds.length > 0) {
      whereClause.branchId = { in: config.branchIds };
    }

    if (config.includedCategories && config.includedCategories.length > 0) {
      whereClause.budgetCategoryId = { in: config.includedCategories };
    }

    if (config.excludedCategories && config.excludedCategories.length > 0) {
      whereClause.budgetCategoryId = { notIn: config.excludedCategories };
    }

    const [incomeRecords, expenditureRecords] = await Promise.all([
      db.incomeRecord.findMany({
        where: whereClause,
        include: {
          budgetCategory: { include: { parent: true } },
          branch: true,
        },
      }),
      db.expenditureRecord.findMany({
        where: whereClause,
        include: {
          budgetCategory: { include: { parent: true } },
          branch: true,
        },
      }),
    ]);

    const totalInflow = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalOutflow = expenditureRecords.reduce(
      (sum, r) => sum + r.amount,
      0
    );

    let groupedData: any = {};

    if (config.groupBy === "category") {
      groupedData = {
        income: groupByCategory(incomeRecords),
        expenses: groupByCategory(expenditureRecords),
      };
    } else if (config.groupBy === "branch") {
      groupedData = {
        income: groupByBranch(incomeRecords),
        expenses: groupByBranch(expenditureRecords),
      };
    } else if (config.groupBy === "month") {
      groupedData = {
        income: groupByMonth(incomeRecords),
        expenses: groupByMonth(expenditureRecords),
      };
    }

    return {
      error: null,
      data: {
        reportType: "User-Defined Cash Flow Statement",
        config,
        period: { startDate: config.startDate, endDate: config.endDate },
        groupedData,
        summary: {
          totalCashInflow: totalInflow,
          totalCashOutflow: totalOutflow,
          netCashFlow: totalInflow - totalOutflow,
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating custom cash flow:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 15. USER-DEFINED BALANCE SHEET
// ============================================================================
export async function getCustomBalanceSheet(config: {
  asOfDate: Date;
  includeSubAccounts?: boolean;
  branchIds?: string[];
  accountTypes?: string[];
}) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    let accountsWhere: any = { status: "ACTIVE" };
    if (config.branchIds && config.branchIds.length > 0) {
      accountsWhere.branchId = { in: config.branchIds };
    }

    const accounts = await db.account.findMany({
      where: accountsWhere,
      include: {
        accountType: true,
        member: {
          select: { memberNumber: true, user: { select: { name: true } } },
        },
      },
    });

    const filteredAccounts =
      config.accountTypes && config.accountTypes.length > 0
        ? accounts.filter((acc) =>
            config.accountTypes!.includes(acc.accountType.name)
          )
        : accounts;

    const loans = await db.loan.findMany({
      where: {
        status: { in: ["DISBURSED", "OVERDUE"] },
        disbursementDate: { lte: config.asOfDate },
      },
    });

    const [incomeRecords, expenditureRecords] = await Promise.all([
      db.incomeRecord.findMany({
        where: {
          recordDate: { lte: config.asOfDate },
          status: TransactionStatus.COMPLETED,
          ...(config.branchIds &&
            config.branchIds.length > 0 && {
              branchId: { in: config.branchIds },
            }),
        },
      }),
      db.expenditureRecord.findMany({
        where: {
          recordDate: { lte: config.asOfDate },
          status: TransactionStatus.COMPLETED,
          ...(config.branchIds &&
            config.branchIds.length > 0 && {
              branchId: { in: config.branchIds },
            }),
        },
      }),
    ]);

    const totalDeposits = filteredAccounts.reduce(
      (sum, acc) => sum + acc.balance,
      0
    );
    const totalLoansReceivable = loans.reduce(
      (sum, loan) => sum + loan.outstandingBalance,
      0
    );
    const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenditureRecords.reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const retainedEarnings = totalIncome - totalExpenses;

    const assets = {
      current: {
        deposits: totalDeposits,
        loansReceivable: totalLoansReceivable,
      },
      total: totalDeposits + totalLoansReceivable,
    };

    const liabilities = {
      current: {
        memberDepositsPayable: totalDeposits,
      },
      total: totalDeposits,
    };

    const equity = {
      retainedEarnings,
      total: retainedEarnings,
    };

    return {
      error: null,
      data: {
        reportType: "User-Defined Balance Sheet",
        config,
        asOfDate: config.asOfDate,
        assets,
        liabilities,
        equity,
        totalLiabilitiesAndEquity: liabilities.total + equity.total,
        balanced:
          Math.abs(assets.total - (liabilities.total + equity.total)) < 1,
        accountsIncluded: filteredAccounts.length,
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating custom balance sheet:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 16. USER-DEFINED PROFIT AND LOSS STATEMENT
// ============================================================================
export async function getCustomProfitLoss(config: {
  startDate: Date;
  endDate: Date;
  includedIncomeCategories?: string[];
  includedExpenseCategories?: string[];
  excludeCategories?: string[];
  branchIds?: string[];
  comparisonPeriod?: { startDate: Date; endDate: Date };
}) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const whereClause: any = {
      recordDate: { gte: config.startDate, lte: config.endDate },
      status: TransactionStatus.COMPLETED,
    };

    if (config.branchIds && config.branchIds.length > 0) {
      whereClause.branchId = { in: config.branchIds };
    }

    const [currentIncome, currentExpenses] = await Promise.all([
      db.incomeRecord.findMany({
        where: {
          ...whereClause,
          ...(config.includedIncomeCategories &&
            config.includedIncomeCategories.length > 0 && {
              budgetCategoryId: { in: config.includedIncomeCategories },
            }),
          ...(config.excludeCategories &&
            config.excludeCategories.length > 0 && {
              budgetCategoryId: { notIn: config.excludeCategories },
            }),
        },
        include: { budgetCategory: { include: { parent: true } } },
      }),
      db.expenditureRecord.findMany({
        where: {
          ...whereClause,
          ...(config.includedExpenseCategories &&
            config.includedExpenseCategories.length > 0 && {
              budgetCategoryId: { in: config.includedExpenseCategories },
            }),
          ...(config.excludeCategories &&
            config.excludeCategories.length > 0 && {
              budgetCategoryId: { notIn: config.excludeCategories },
            }),
        },
        include: { budgetCategory: { include: { parent: true } } },
      }),
    ]);

    const currentTotalIncome = currentIncome.reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const currentTotalExpenses = currentExpenses.reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const currentNetProfit = currentTotalIncome - currentTotalExpenses;

    const result: any = {
      reportType: "User-Defined Profit and Loss Statement",
      config,
      currentPeriod: {
        startDate: config.startDate,
        endDate: config.endDate,
        income: {
          byCategory: groupByCategory(currentIncome),
          total: currentTotalIncome,
        },
        expenses: {
          byCategory: groupByCategory(currentExpenses),
          total: currentTotalExpenses,
        },
        netProfit: currentNetProfit,
        profitMargin:
          currentTotalIncome > 0
            ? (currentNetProfit / currentTotalIncome) * 100
            : 0,
      },
      generatedAt: new Date(),
    };

    if (config.comparisonPeriod) {
      const comparisonWhere = {
        ...whereClause,
        recordDate: {
          gte: config.comparisonPeriod.startDate,
          lte: config.comparisonPeriod.endDate,
        },
      };

      const [compIncome, compExpenses] = await Promise.all([
        db.incomeRecord.findMany({ where: comparisonWhere }),
        db.expenditureRecord.findMany({ where: comparisonWhere }),
      ]);

      const compTotalIncome = compIncome.reduce((sum, r) => sum + r.amount, 0);
      const compTotalExpenses = compExpenses.reduce(
        (sum, r) => sum + r.amount,
        0
      );
      const compNetProfit = compTotalIncome - compTotalExpenses;

      result.comparisonPeriod = {
        ...config.comparisonPeriod,
        income: { total: compTotalIncome },
        expenses: { total: compTotalExpenses },
        netProfit: compNetProfit,
      };

      result.variance = {
        income: currentTotalIncome - compTotalIncome,
        incomePercent:
          compTotalIncome > 0
            ? ((currentTotalIncome - compTotalIncome) / compTotalIncome) * 100
            : 0,
        expenses: currentTotalExpenses - compTotalExpenses,
        expensesPercent:
          compTotalExpenses > 0
            ? ((currentTotalExpenses - compTotalExpenses) / compTotalExpenses) *
              100
            : 0,
        netProfit: currentNetProfit - compNetProfit,
        netProfitPercent:
          compNetProfit !== 0
            ? ((currentNetProfit - compNetProfit) / compNetProfit) * 100
            : 0,
      };
    }

    return { error: null, data: result };
  } catch (error) {
    console.error("Error generating custom profit loss:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function groupByCategory(records: any[]) {
  const grouped = new Map();
  records.forEach((record) => {
    const parent = record.budgetCategory?.parent || record.budgetCategory;
    if (!parent) return;

    if (!grouped.has(parent.id)) {
      grouped.set(parent.id, {
        categoryName: parent.name,
        categoryCode: parent.code,
        items: [],
        total: 0,
      });
    }

    const category = grouped.get(parent.id);
    category.items.push({
      itemName: record.budgetCategory?.name || parent.name,
      amount: record.amount,
      date: record.recordDate,
    });
    category.total += record.amount;
  });

  return Array.from(grouped.values());
}

function groupByBranch(records: any[]) {
  const grouped = new Map();
  records.forEach((record) => {
    const branchName = record.branch?.name || "No Branch";
    const branchId = record.branchId || "none";

    if (!grouped.has(branchId)) {
      grouped.set(branchId, {
        branchName,
        items: [],
        total: 0,
      });
    }

    const branch = grouped.get(branchId);
    branch.items.push({
      amount: record.amount,
      date: record.recordDate,
      category: record.budgetCategory?.name,
    });
    branch.total += record.amount;
  });

  return Array.from(grouped.values());
}

function groupByMonth(records: any[]) {
  const grouped = new Map();
  records.forEach((record) => {
    const date = new Date(record.recordDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthName = date.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, {
        month: monthName,
        items: [],
        total: 0,
      });
    }

    const month = grouped.get(monthKey);
    month.items.push({
      amount: record.amount,
      date: record.recordDate,
      category: record.budgetCategory?.name,
    });
    month.total += record.amount;
  });

  return Array.from(grouped.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );
}
