// ============================================================================
// actions/reports/financial-reports.ts - All Financial Reports Server Actions
// ============================================================================
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, TransactionStatus, CategoryKind } from "@prisma/client";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getBranchFilter(requestedBranchId?: string) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  if (user.role === UserRole.ADMIN) {
    if (requestedBranchId && requestedBranchId !== "all") {
      return { branchId: requestedBranchId };
    }
    return {};
  }

  // For restricted roles, always return their branch
  if (!user.branchId) return { branchId: "no-branch" };
  return { branchId: user.branchId };
}

function getDateRange(startDate?: Date, endDate?: Date) {
  const start = startDate || new Date(new Date().getFullYear(), 0, 1);
  const end = endDate || new Date();
  return { start, end };
}

// ============================================================================
// 1. PROFIT AND LOSS STATEMENT
// ============================================================================
export async function getProfitAndLossStatement(
  startDate: Date,
  endDate: Date,
  branchId?: string,
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    // ✅ FIX: Type the array with UserRole enum values
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.ACCOUNTANT,
      UserRole.BRANCHMANAGER,
      UserRole.AUDITOR,
    ];

    // ✅ FIX: Cast user.role to UserRole for comparison
    if (!allowedRoles.includes(user.role as UserRole)) {
      return { error: "Access denied", data: null };
    }

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      recordDate: { gte: startDate, lte: endDate },
      status: TransactionStatus.COMPLETED,
      ...branchFilter,
    };

    if (branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = branchId;
    }

    const [incomeRecords, expenditureRecords] = await Promise.all([
      db.incomeRecord.findMany({
        where: whereClause,
        include: {
          budgetCategory: { include: { parent: true } },
          branch: { select: { name: true } },
        },
      }),
      db.expenditureRecord.findMany({
        where: whereClause,
        include: {
          budgetCategory: { include: { parent: true } },
          branch: { select: { name: true } },
        },
      }),
    ]);

    // Group income by category
    const incomeByCategory = new Map<string, any>();
    incomeRecords.forEach((record: any) => {
      const parent = record.budgetCategory?.parent || record.budgetCategory;
      if (!parent) return;

      if (!incomeByCategory.has(parent.id)) {
        incomeByCategory.set(parent.id, {
          name: parent.name,
          code: parent.code,
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
        description: record.description,
      });
    });

    // Group expenses by category
    const expensesByCategory = new Map<string, any>();
    expenditureRecords.forEach((record: any) => {
      const parent = record.budgetCategory?.parent || record.budgetCategory;
      if (!parent) return;

      if (!expensesByCategory.has(parent.id)) {
        expensesByCategory.set(parent.id, {
          name: parent.name,
          code: parent.code,
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
        description: record.description,
      });
    });

    const totalIncome = incomeRecords.reduce(
      (sum: number, r: any) => sum + r.amount,
      0,
    );
    const totalExpenses = expenditureRecords.reduce(
      (sum: number, r: any) => sum + r.amount,
      0,
    );
    const netProfit = totalIncome - totalExpenses;

    return {
      error: null,
      data: {
        reportType: "Profit and Loss Statement",
        period: { startDate, endDate },
        income: {
          categories: Array.from(incomeByCategory.values()),
          total: totalIncome,
        },
        expenses: {
          categories: Array.from(expensesByCategory.values()),
          total: totalExpenses,
        },
        netProfit,
        profitMargin: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating profit and loss:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 2. BALANCE SHEET
// ============================================================================
export async function getBalanceSheet(asOfDate?: Date, branchId?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    // ✅ FIX: Proper type declaration
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ];

    if (!allowedRoles.includes(user.role as UserRole)) {
      return { error: "Access denied", data: null };
    }

    const asOf = asOfDate || new Date();
    const branchFilter = await getBranchFilter(branchId);

    const [accounts, loans, incomeRecords, expenditureRecords, vaults] =
      await Promise.all([
        db.account.findMany({
          where: { status: "ACTIVE", ...branchFilter },
          include: { accountType: true },
        }),
        db.loan.findMany({
          where: {
            status: { in: ["DISBURSED", "OVERDUE"] },
            disbursementDate: { lte: asOf },
            ...branchFilter,
          },
        }),
        db.incomeRecord.findMany({
          where: {
            recordDate: { lte: asOf },
            status: TransactionStatus.COMPLETED,
            ...branchFilter,
          },
        }),
        db.expenditureRecord.findMany({
          where: {
            recordDate: { lte: asOf },
            status: TransactionStatus.COMPLETED,
            ...branchFilter,
          },
        }),
        db.vault.findMany({
          where: { isActive: true, ...branchFilter },
        }),
      ]);

    const cashInVaults = vaults.reduce(
      (sum: number, v: any) => sum + v.balance,
      0,
    );
    const loansReceivable = loans.reduce(
      (sum: number, l: any) => sum + l.outstandingBalance,
      0,
    );
    const memberDeposits = accounts.reduce(
      (sum: number, acc: any) => sum + acc.balance,
      0,
    );
    const totalIncome = incomeRecords.reduce(
      (sum: number, r: any) => sum + r.amount,
      0,
    );
    const totalExpenses = expenditureRecords.reduce(
      (sum: number, r: any) => sum + r.amount,
      0,
    );
    const retainedEarnings = totalIncome - totalExpenses;

    const totalAssets = cashInVaults + loansReceivable;
    const totalLiabilities = memberDeposits;
    const totalEquity = retainedEarnings;

    return {
      error: null,
      data: {
        reportType: "Balance Sheet",
        asOfDate: asOf,
        assets: {
          current: {
            cashInVaults,
            loansReceivable,
            total: cashInVaults + loansReceivable,
          },
          total: totalAssets,
        },
        liabilities: {
          current: {
            memberDeposits,
            total: memberDeposits,
          },
          total: totalLiabilities,
        },
        equity: {
          retainedEarnings,
          total: totalEquity,
        },
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
        balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating balance sheet:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 3. TRIAL BALANCE
// ============================================================================
export async function getTrialBalance(
  startDate: Date,
  endDate: Date,
  branchId?: string,
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    // ✅ FIX: Proper type declaration
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR,
    ];

    if (!allowedRoles.includes(user.role as UserRole)) {
      return { error: "Access denied", data: null };
    }

    const branchFilter = await getBranchFilter(branchId);
    const whereClause: any = {
      recordDate: { gte: startDate, lte: endDate },
      status: TransactionStatus.COMPLETED,
      ...branchFilter,
    };

    const [incomeRecords, expenditureRecords, accounts] = await Promise.all([
      db.incomeRecord.findMany({
        where: whereClause,
        include: { budgetCategory: true },
      }),
      db.expenditureRecord.findMany({
        where: whereClause,
        include: { budgetCategory: true },
      }),
      db.account.findMany({
        where: { status: "ACTIVE", ...branchFilter },
      }),
    ]);

    const trialBalanceEntries: any[] = [];

    // Income accounts (Credit)
    const incomeByCategory = new Map<string, number>();
    incomeRecords.forEach((record: any) => {
      const categoryName =
        record.budgetCategory?.name || "Uncategorized Income";
      incomeByCategory.set(
        categoryName,
        (incomeByCategory.get(categoryName) || 0) + record.amount,
      );
    });

    incomeByCategory.forEach((amount: number, name: string) => {
      trialBalanceEntries.push({
        accountCode: `INC-${name.substring(0, 3).toUpperCase()}`,
        accountName: name,
        accountType: "Income",
        debit: 0,
        credit: amount,
      });
    });

    // Expense accounts (Debit)
    const expensesByCategory = new Map<string, number>();
    expenditureRecords.forEach((record: any) => {
      const categoryName =
        record.budgetCategory?.name || "Uncategorized Expense";
      expensesByCategory.set(
        categoryName,
        (expensesByCategory.get(categoryName) || 0) + record.amount,
      );
    });

    expensesByCategory.forEach((amount: number, name: string) => {
      trialBalanceEntries.push({
        accountCode: `EXP-${name.substring(0, 3).toUpperCase()}`,
        accountName: name,
        accountType: "Expense",
        debit: amount,
        credit: 0,
      });
    });

    // Assets (Debit)
    const totalDeposits = accounts.reduce(
      (sum: number, acc: any) => sum + acc.balance,
      0,
    );
    trialBalanceEntries.push({
      accountCode: "AST-DEP",
      accountName: "Member Deposits",
      accountType: "Asset",
      debit: totalDeposits,
      credit: 0,
    });

    const totalDebits = trialBalanceEntries.reduce(
      (sum: number, e: any) => sum + e.debit,
      0,
    );
    const totalCredits = trialBalanceEntries.reduce(
      (sum: number, e: any) => sum + e.credit,
      0,
    );

    return {
      error: null,
      data: {
        reportType: "Trial Balance",
        period: { startDate, endDate },
        entries: trialBalanceEntries.sort((a, b) =>
          a.accountName.localeCompare(b.accountName),
        ),
        totals: {
          debits: totalDebits,
          credits: totalCredits,
          difference: Math.abs(totalDebits - totalCredits),
          balanced: Math.abs(totalDebits - totalCredits) < 1,
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating trial balance:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 4. CASH FLOW STATEMENT
// ============================================================================
export async function getCashFlowStatement(
  startDate: Date,
  endDate: Date,
  branchId?: string,
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter(branchId);
    const whereClause: any = {
      ...branchFilter,
    };

    const [
      incomeRecords,
      expenditureRecords,
      loanDisbursements,
      loanRepayments,
      deposits,
      withdrawals,
    ] = await Promise.all([
      db.incomeRecord.findMany({
        where: {
          recordDate: { gte: startDate, lte: endDate },
          paymentMethod: "CASH",
          status: TransactionStatus.COMPLETED,
          ...whereClause,
        },
      }),
      db.expenditureRecord.findMany({
        where: {
          recordDate: { gte: startDate, lte: endDate },
          paymentMethod: "CASH",
          status: TransactionStatus.COMPLETED,
          ...whereClause,
        },
      }),
      db.loan.findMany({
        where: {
          disbursementDate: { gte: startDate, lte: endDate },
          ...whereClause,
        },
      }),
      db.loanRepayment.findMany({
        where: {
          repaymentDate: { gte: startDate, lte: endDate },
          ...whereClause,
        },
      }),
      db.deposit.findMany({
        where: {
          depositDate: { gte: startDate, lte: endDate },
          ...(whereClause.branchId
            ? { account: { branchId: whereClause.branchId } }
            : {}),
        },
      }),
      db.withdrawal.findMany({
        where: {
          withdrawalDate: { gte: startDate, lte: endDate },
          ...(whereClause.branchId
            ? { account: { branchId: whereClause.branchId } }
            : {}),
        },
      }),
    ]);

    const operatingInflows = incomeRecords.reduce(
      (sum: number, r: any) => sum + r.amount,
      0,
    );
    const operatingOutflows = expenditureRecords.reduce(
      (sum: number, r: any) => sum + r.amount,
      0,
    );
    const netOperatingCashFlow = operatingInflows - operatingOutflows;

    const loansDisbursed = loanDisbursements.reduce(
      (sum: number, l: any) => sum + l.amountGranted,
      0,
    );
    const loansRepaid = loanRepayments.reduce(
      (sum: number, l: any) => sum + l.amount,
      0,
    );
    const netInvestingCashFlow = loansRepaid - loansDisbursed;

    const depositsReceived = deposits.reduce(
      (sum: number, d: any) => sum + d.amount,
      0,
    );
    const withdrawalsPaid = withdrawals.reduce(
      (sum: number, w: any) => sum + w.amount,
      0,
    );
    const netFinancingCashFlow = depositsReceived - withdrawalsPaid;

    const netCashFlow =
      netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;

    return {
      error: null,
      data: {
        reportType: "Cash Flow Statement",
        period: { startDate, endDate },
        operatingActivities: {
          inflows: operatingInflows,
          outflows: operatingOutflows,
          net: netOperatingCashFlow,
        },
        investingActivities: {
          loansDisbursed: -loansDisbursed,
          loansRepaid,
          net: netInvestingCashFlow,
        },
        financingActivities: {
          depositsReceived,
          withdrawalsPaid: -withdrawalsPaid,
          net: netFinancingCashFlow,
        },
        netCashFlow,
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating cash flow:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 5. PERFORMANCE MONITORING TOOL
// ============================================================================
export async function getPerformanceMonitoring(
  startDate: Date,
  endDate: Date,
  branchId?: string,
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter(branchId);
    const whereClause: any = {
      recordDate: { gte: startDate, lte: endDate },
      status: TransactionStatus.COMPLETED,
      ...branchFilter,
    };

    const [incomeRecords, expenditureRecords, loans, accounts, members] =
      await Promise.all([
        db.incomeRecord.findMany({ where: whereClause }),
        db.expenditureRecord.findMany({ where: whereClause }),
        db.loan.findMany({
          where: {
            status: { in: ["DISBURSED", "OVERDUE", "REPAID"] },
            ...branchFilter,
          },
        }),
        db.account.findMany({ where: { status: "ACTIVE", ...branchFilter } }),
        db.member.findMany({
          where: {
            isApproved: true,
            ...(branchFilter.branchId
              ? { user: { branchId: branchFilter.branchId } }
              : {}),
          },
        }),
      ]);

    const totalIncome = incomeRecords.reduce(
      (sum: number, r: any) => sum + r.amount,
      0,
    );
    const totalExpenses = expenditureRecords.reduce(
      (sum: number, r: any) => sum + r.amount,
      0,
    );
    const netIncome = totalIncome - totalExpenses;

    const totalLoansOutstanding = loans
      .filter((l: any) => l.status === "DISBURSED" || l.status === "OVERDUE")
      .reduce((sum: number, l: any) => sum + l.outstandingBalance, 0);
    const overdueLoans = loans.filter((l: any) => l.status === "OVERDUE");
    const loanDefaultRate =
      loans.length > 0 ? (overdueLoans.length / loans.length) * 100 : 0;

    const totalAssets =
      accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0) +
      totalLoansOutstanding;
    const roa = totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0;
    const operatingEfficiency =
      totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

    return {
      error: null,
      data: {
        reportType: "Performance Monitoring Dashboard",
        period: { startDate, endDate },
        financialPerformance: {
          totalIncome,
          totalExpenses,
          netIncome,
          profitMargin: totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0,
        },
        loanPortfolio: {
          totalLoansOutstanding,
          numberOfLoans: loans.length,
          overdueLoans: overdueLoans.length,
          loanDefaultRate,
          averageLoanSize:
            loans.length > 0 ? totalLoansOutstanding / loans.length : 0,
        },
        memberMetrics: {
          totalMembers: members.length,
          averageDepositPerMember:
            members.length > 0
              ? accounts.reduce(
                  (sum: number, acc: any) => sum + acc.balance,
                  0,
                ) / members.length
              : 0,
        },
        efficiencyRatios: {
          returnOnAssets: roa,
          operatingEfficiencyRatio: operatingEfficiency,
          costToIncomeRatio:
            totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0,
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating performance report:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 6. CHART OF ACCOUNTS
// ============================================================================
export async function getChartOfAccounts(branchId?: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter(branchId);

    const [categories, incomeRecords, expenditureRecords] = await Promise.all([
      db.budgetCategory.findMany({
        where: { isActive: true },
        include: {
          parent: true,
          children: true,
        },
        orderBy: [{ kind: "asc" }, { parentId: "asc" }, { name: "asc" }],
      }),
      db.incomeRecord.findMany({
        where: {
          status: TransactionStatus.COMPLETED,
          ...branchFilter,
        },
      }),
      db.expenditureRecord.findMany({
        where: {
          status: TransactionStatus.COMPLETED,
          ...branchFilter,
        },
      }),
    ]);

    // Map to store balances
    const categoryBalances = new Map<string, number>();

    // Add income balances
    incomeRecords.forEach((record: any) => {
      const catId = record.budgetCategoryId;
      if (catId) {
        categoryBalances.set(
          catId,
          (categoryBalances.get(catId) || 0) + record.amount,
        );
      }
    });

    // Add expense balances
    expenditureRecords.forEach((record: any) => {
      const catId = record.budgetCategoryId;
      if (catId) {
        // For expenses, we typically show positive flow but can be signed
        categoryBalances.set(
          catId,
          (categoryBalances.get(catId) || 0) + record.amount,
        );
      }
    });

    const chartOfAccounts = {
      assets: [] as any[],
      liabilities: [] as any[],
      equity: [] as any[],
      income: [] as any[],
      expenses: [] as any[],
    };

    categories
      .filter((cat: any) => cat.kind === CategoryKind.ASSET)
      .forEach((cat: any) => {
        chartOfAccounts.assets.push({
          code: cat.code || `AST-${cat.id.substring(0, 8)}`,
          name: cat.name,
          description: cat.description,
          parentId: cat.parentId,
          hasChildren: cat.children.length > 0,
          balance: categoryBalances.get(cat.id) || 0,
        });
      });

    categories
      .filter((cat: any) => cat.kind === CategoryKind.LIABILITY)
      .forEach((cat: any) => {
        chartOfAccounts.liabilities.push({
          code: cat.code || `LIA-${cat.id.substring(0, 8)}`,
          name: cat.name,
          description: cat.description,
          parentId: cat.parentId,
          hasChildren: cat.children.length > 0,
          balance: categoryBalances.get(cat.id) || 0,
        });
      });

    categories
      .filter((cat: any) => cat.kind === CategoryKind.EQUITY)
      .forEach((cat: any) => {
        chartOfAccounts.equity.push({
          code: cat.code || `EQT-${cat.id.substring(0, 8)}`,
          name: cat.name,
          description: cat.description,
          parentId: cat.parentId,
          hasChildren: cat.children.length > 0,
          balance: categoryBalances.get(cat.id) || 0,
        });
      });

    categories
      .filter((cat: any) => cat.kind === CategoryKind.INCOME)
      .forEach((cat: any) => {
        chartOfAccounts.income.push({
          code: cat.code || `INC-${cat.id.substring(0, 8)}`,
          name: cat.name,
          description: cat.description,
          parentId: cat.parentId,
          hasChildren: cat.children.length > 0,
          balance: categoryBalances.get(cat.id) || 0,
        });
      });

    categories
      .filter((cat: any) => cat.kind === CategoryKind.EXPENSE)
      .forEach((cat: any) => {
        chartOfAccounts.expenses.push({
          code: cat.code || `EXP-${cat.id.substring(0, 8)}`,
          name: cat.name,
          description: cat.description,
          parentId: cat.parentId,
          hasChildren: cat.children.length > 0,
          balance: categoryBalances.get(cat.id) || 0,
        });
      });

    // Add standard accounts if they aren't already represented by categories
    if (chartOfAccounts.assets.length === 0) {
      chartOfAccounts.assets.push(
        {
          code: "AST-001",
          name: "Cash in Vaults",
          description: "Physical cash",
        },
        {
          code: "AST-002",
          name: "Loans Receivable",
          description: "Outstanding loans",
        },
        {
          code: "AST-003",
          name: "Member Deposits",
          description: "Member balances",
        },
      );
    }

    if (chartOfAccounts.liabilities.length === 0) {
      chartOfAccounts.liabilities.push({
        code: "LIA-001",
        name: "Member Deposits Payable",
        description: "Owed to members",
      });
    }

    if (chartOfAccounts.equity.length === 0) {
      chartOfAccounts.equity.push({
        code: "EQT-001",
        name: "Retained Earnings",
        description: "Accumulated profits",
      });
    }

    return {
      error: null,
      data: {
        reportType: "Chart of Accounts",
        chartOfAccounts,
        summary: {
          totalIncomeAccounts: chartOfAccounts.income.length,
          totalExpenseAccounts: chartOfAccounts.expenses.length,
          totalAssetAccounts: chartOfAccounts.assets.length,
          totalLiabilityAccounts: chartOfAccounts.liabilities.length,
          totalEquityAccounts: chartOfAccounts.equity.length,
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating chart of accounts:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 7. COMPREHENSIVE INCOME AND EXPENSES STATEMENT
// ============================================================================
export async function getComprehensiveIncomeExpenses(
  startDate: Date,
  endDate: Date,
  branchId?: string,
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter(branchId);
    const whereClause: any = {
      recordDate: { gte: startDate, lte: endDate },
      status: TransactionStatus.COMPLETED,
      ...branchFilter,
    };

    const [incomeRecords, expenditureRecords] = await Promise.all([
      db.incomeRecord.findMany({
        where: whereClause,
        include: {
          budgetCategory: { include: { parent: true } },
          member: { select: { memberNumber: true } },
          branch: { select: { name: true } },
          receivedBy: { select: { name: true } },
        },
        orderBy: { recordDate: "desc" },
      }),
      db.expenditureRecord.findMany({
        where: whereClause,
        include: {
          budgetCategory: { include: { parent: true } },
          branch: { select: { name: true } },
          submittedBy: { select: { name: true } },
        },
        orderBy: { recordDate: "desc" },
      }),
    ]);

    const incomeByCategory = new Map<string, any>();
    const expensesByCategory = new Map<string, any>();

    incomeRecords.forEach((record: any) => {
      const parent = record.budgetCategory?.parent || record.budgetCategory;
      if (!parent) return;

      if (!incomeByCategory.has(parent.id)) {
        incomeByCategory.set(parent.id, {
          categoryName: parent.name,
          categoryCode: parent.code,
          items: [],
          total: 0,
        });
      }

      const category = incomeByCategory.get(parent.id);
      category.items.push({
        id: record.id,
        date: record.recordDate,
        item: record.budgetCategory?.name || parent.name,
        description: record.description,
        amount: record.amount,
        branch: record.branch?.name,
        receivedBy: record.receivedBy?.name,
        receiptNo: record.receiptNo,
      });
      category.total += record.amount;
    });

    expenditureRecords.forEach((record: any) => {
      const parent = record.budgetCategory?.parent || record.budgetCategory;
      if (!parent) return;

      if (!expensesByCategory.has(parent.id)) {
        expensesByCategory.set(parent.id, {
          categoryName: parent.name,
          categoryCode: parent.code,
          items: [],
          total: 0,
        });
      }

      const category = expensesByCategory.get(parent.id);
      category.items.push({
        id: record.id,
        date: record.recordDate,
        item: record.budgetCategory?.name || parent.name,
        description: record.description,
        amount: record.amount,
        branch: record.branch?.name,
        submittedBy: record.submittedBy?.name,
        payee: record.payee,
        voucherNo: record.voucherNo,
      });
      category.total += record.amount;
    });

    const totalIncome = incomeRecords.reduce(
      (sum: number, r: any) => sum + r.amount,
      0,
    );
    const totalExpenses = expenditureRecords.reduce(
      (sum: number, r: any) => sum + r.amount,
      0,
    );

    return {
      error: null,
      data: {
        reportType: "Comprehensive Statement of Income and Expenses",
        period: { startDate, endDate },
        income: {
          categories: Array.from(incomeByCategory.values()),
          total: totalIncome,
          recordCount: incomeRecords.length,
        },
        expenses: {
          categories: Array.from(expensesByCategory.values()),
          total: totalExpenses,
          recordCount: expenditureRecords.length,
        },
        netIncome: totalIncome - totalExpenses,
        summary: {
          grossProfit: totalIncome - totalExpenses,
          profitMargin:
            totalIncome > 0
              ? ((totalIncome - totalExpenses) / totalIncome) * 100
              : 0,
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating comprehensive income expenses:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 8. BUDGET VARIANCE REPORT
// ============================================================================
export async function getBudgetVariance(
  startDate: Date,
  endDate: Date,
  branchId?: string,
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      recordDate: { gte: startDate, lte: endDate },
      status: TransactionStatus.COMPLETED,
      ...branchFilter,
    };

    if (branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = branchId;
    }

    const [incomeRecords, expenditureRecords, categories] = await Promise.all([
      db.incomeRecord.findMany({
        where: whereClause,
        include: { budgetCategory: { include: { parent: true } } },
      }),
      db.expenditureRecord.findMany({
        where: whereClause,
        include: { budgetCategory: { include: { parent: true } } },
      }),
      db.budgetCategory.findMany({
        where: { isActive: true },
        include: { parent: true },
      }),
    ]);

    const actualIncomeByCategory = new Map<string, number>();
    incomeRecords.forEach((record: any) => {
      const categoryId = record.budgetCategoryId || "uncategorized";
      actualIncomeByCategory.set(
        categoryId,
        (actualIncomeByCategory.get(categoryId) || 0) + record.amount,
      );
    });

    const actualExpensesByCategory = new Map<string, number>();
    expenditureRecords.forEach((record: any) => {
      const categoryId = record.budgetCategoryId || "uncategorized";
      actualExpensesByCategory.set(
        categoryId,
        (actualExpensesByCategory.get(categoryId) || 0) + record.amount,
      );
    });

    // Get budget data from Budget table
    const budgets = await db.budget.findMany({
      where: {
        year: startDate.getFullYear(),
        isActive: true,
        ...branchFilter,
      },
    });

    const budgetedAmountsByCategory = new Map<string, number>();
    budgets.forEach((budget: any) => {
      budgetedAmountsByCategory.set(budget.categoryId, budget.amount);
    });

    const varianceData = categories.map((category: any) => {
      const actualIncome = actualIncomeByCategory.get(category.id) || 0;
      const actualExpense = actualExpensesByCategory.get(category.id) || 0;
      const budgetedAmount = budgetedAmountsByCategory.get(category.id) || 0;

      let variance = 0;
      let variancePercentage = 0;

      if (category.kind === CategoryKind.INCOME) {
        variance = actualIncome - budgetedAmount;
        variancePercentage =
          budgetedAmount > 0 ? (variance / budgetedAmount) * 100 : 0;
      } else if (category.kind === CategoryKind.EXPENSE) {
        variance = budgetedAmount - actualExpense;
        variancePercentage =
          budgetedAmount > 0 ? (variance / budgetedAmount) * 100 : 0;
      }

      return {
        categoryId: category.id,
        categoryName: category.name,
        categoryCode: category.code,
        categoryType: category.kind,
        budgeted: budgetedAmount,
        actual:
          category.kind === CategoryKind.INCOME ? actualIncome : actualExpense,
        variance,
        variancePercentage,
        status:
          variance > 0
            ? "favorable"
            : variance < 0
              ? "unfavorable"
              : "on-target",
      };
    });

    const totalBudgetedIncome = budgets
      .filter((b: any) => {
        const cat = categories.find((c: any) => c.id === b.categoryId);
        return cat?.kind === CategoryKind.INCOME;
      })
      .reduce((sumValue: number, bValue: any) => sumValue + bValue.amount, 0);

    const totalBudgetedExpenses = budgets
      .filter((b: any) => {
        const cat = categories.find((c: any) => c.id === b.categoryId);
        return cat?.kind === CategoryKind.EXPENSE;
      })
      .reduce((sumValue: number, bValue: any) => sumValue + bValue.amount, 0);

    return {
      error: null,
      data: {
        reportType: "Budget Variance Report",
        period: { startDate, endDate },
        variances: varianceData.filter(
          (v: any) => v.budgeted > 0 || v.actual > 0,
        ),
        summary: {
          totalBudgetedIncome,
          totalActualIncome: Array.from(actualIncomeByCategory.values()).reduce(
            (sum: number, v: number) => sum + v,
            0,
          ),
          totalBudgetedExpenses,
          totalActualExpenses: Array.from(
            actualExpensesByCategory.values(),
          ).reduce((sum: number, v: number) => sum + v, 0),
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating budget variance:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 9. MONTHLY INCOME COMPARISON
// ============================================================================
export async function getMonthlyIncomeComparison(
  year: number,
  branchId?: string,
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      recordDate: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59),
      },
      status: TransactionStatus.COMPLETED,
      ...branchFilter,
    };

    if (branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = branchId;
    }

    const incomeRecords = await db.incomeRecord.findMany({
      where: whereClause,
      include: {
        budgetCategory: { include: { parent: true } },
      },
    });

    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i, 1).toLocaleString("default", { month: "long" }),
      monthNumber: i + 1,
      income: 0,
      transactionCount: 0,
      categories: new Map<string, number>(),
    }));

    incomeRecords.forEach((record: any) => {
      const month = record.recordDate.getMonth();
      const categoryName =
        record.budgetCategory?.parent?.name ||
        record.budgetCategory?.name ||
        "Uncategorized";

      monthlyData[month].income += record.amount;
      monthlyData[month].transactionCount++;
      monthlyData[month].categories.set(
        categoryName,
        (monthlyData[month].categories.get(categoryName) || 0) + record.amount,
      );
    });

    const formattedData = monthlyData.map((data) => ({
      month: data.month,
      monthNumber: data.monthNumber,
      income: data.income,
      transactionCount: data.transactionCount,
      topCategories: Array.from(data.categories.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount })),
    }));

    const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
    const averageMonthlyIncome = totalIncome / 12;
    const highestMonth = monthlyData.reduce(
      (max, m) => (m.income > max.income ? m : max),
      monthlyData[0],
    );
    const lowestMonth = monthlyData.reduce(
      (min, m) => (m.income < min.income ? m : min),
      monthlyData[0],
    );

    return {
      error: null,
      data: {
        reportType: "Monthly Income Comparison",
        year,
        monthlyData: formattedData,
        summary: {
          totalIncome,
          averageMonthlyIncome,
          highestMonth: {
            month: highestMonth.month,
            income: highestMonth.income,
          },
          lowestMonth: {
            month: lowestMonth.month,
            income: lowestMonth.income,
          },
          totalTransactions: monthlyData.reduce(
            (sum, m) => sum + m.transactionCount,
            0,
          ),
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating monthly income comparison:", error);
    return { error: "Failed to generate report", data: null };
  }
}

// ============================================================================
// 10. QUARTERLY EXPENSE ANALYSIS
// ============================================================================
export async function getQuarterlyExpenseAnalysis(
  year: number,
  branchId?: string,
) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    const branchFilter = await getBranchFilter();
    const whereClause: any = {
      recordDate: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59),
      },
      status: TransactionStatus.COMPLETED,
      ...branchFilter,
    };

    if (branchId && user.role === UserRole.ADMIN) {
      whereClause.branchId = branchId;
    }

    const expenditureRecords = await db.expenditureRecord.findMany({
      where: whereClause,
      include: {
        budgetCategory: { include: { parent: true } },
      },
    });

    const quarterlyData = Array.from({ length: 4 }, (_, i) => ({
      quarter: `Q${i + 1}`,
      quarterNumber: i + 1,
      startMonth: i * 3,
      endMonth: i * 3 + 2,
      expenses: 0,
      transactionCount: 0,
      categories: new Map<string, number>(),
    }));

    expenditureRecords.forEach((record) => {
      const month = record.recordDate.getMonth();
      const quarter = Math.floor(month / 3);
      const categoryName =
        record.budgetCategory?.parent?.name ||
        record.budgetCategory?.name ||
        "Uncategorized";

      quarterlyData[quarter].expenses += record.amount;
      quarterlyData[quarter].transactionCount++;
      quarterlyData[quarter].categories.set(
        categoryName,
        (quarterlyData[quarter].categories.get(categoryName) || 0) +
          record.amount,
      );
    });

    const formattedData = quarterlyData.map((data) => ({
      quarter: data.quarter,
      quarterNumber: data.quarterNumber,
      expenses: data.expenses,
      transactionCount: data.transactionCount,
      topCategories: Array.from(data.categories.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount })),
    }));

    const totalExpenses = quarterlyData.reduce((sum, q) => sum + q.expenses, 0);
    const averageQuarterlyExpense = totalExpenses / 4;
    const highestQuarter = quarterlyData.reduce(
      (max, q) => (q.expenses > max.expenses ? q : max),
      quarterlyData[0],
    );

    return {
      error: null,
      data: {
        reportType: "Quarterly Expense Analysis",
        year,
        quarterlyData: formattedData,
        summary: {
          totalExpenses,
          averageQuarterlyExpense,
          highestQuarter: {
            quarter: highestQuarter.quarter,
            expenses: highestQuarter.expenses,
          },
          totalTransactions: quarterlyData.reduce(
            (sum, q) => sum + q.transactionCount,
            0,
          ),
        },
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error generating quarterly expense analysis:", error);
    return { error: "Failed to generate report", data: null };
  }
}
