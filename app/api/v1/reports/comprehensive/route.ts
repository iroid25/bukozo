import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { getDirectBalanceSheetAccounts, getDirectIncomeExpenseAccounts, getDirectTrialBalanceAccounts } from "@/lib/reports/direct-source";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;


// Concentration, Reversed, Reversed Withdrawal, Interest Exposure, Share Statement, Overdrawn by Age, COA Listing, Budget Variance, etc.

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;

    const { reportType, startDate, endDate, branchId: requestedBranchId, ...params } = await request.json();
    const branchId = resolveBranchScope(user, requestedBranchId);

    const start = startDate ? new Date(startDate) : new Date(new Date().setFullYear(new Date().getFullYear() - 1));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    let data;

    switch (reportType) {
      // Fixed Deposit Reports
      case "fd-concentration":
        data = await generateFDConcentrationReport(branchId);
        break;
      case "fd-reversed":
        data = await generateFDReversedReport(start, end, branchId);
        break;
      case "fd-interest-exposure":
        data = await generateFDInterestExposureReport(branchId);
        break;

      // Share Reports
      case "share-statement":
        data = await generateShareStatementReport(params.accountId, start, end);
        break;

      // Savings Reports
      case "savings-overdrawn-age":
        data = await generateSavingsOverdrawnByAgeReport(branchId);
        break;

      // Financial Reports
      case "coa-listing":
        data = await generateCOAListingReport(branchId);
        break;
      case "budget-variance":
        data = await generateBudgetVarianceReport(params.year || new Date().getFullYear(), branchId);
        break;
      case "comprehensive-trial-balance":
        data = await generateComprehensiveTrialBalanceReport(start, end, branchId);
        break;
      case "comprehensive-balance-sheet":
        data = await generateComprehensiveBalanceSheetReport(end, branchId);
        break;
      case "comprehensive-income":
        data = await generateComprehensiveIncomeReport(start, end, branchId);
        break;

      // General Reports
      case "account-statement":
        data = await generateAccountStatementReport(params.accountId, start, end);
        break;
      case "personal-ledger":
        data = await generatePersonalLedgerReport(params.memberId, start, end);
        break;
      case "clients-registered":
        data = await generateClientsRegisteredReport(start, end, branchId);
        break;
      case "customer-feedback":
        data = await generateCustomerFeedbackReport(start, end);
        break;

      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

// Fixed Deposit Concentration — queries FixedDeposit table (new model)
async function generateFDConcentrationReport(branchId?: string) {
  const deposits = await db.fixedDeposit.findMany({
    where: { status: "ACTIVE", isReversed: false, ...(branchId ? { branchId } : {}) },
    include: {
      member: { include: { user: { select: { name: true } } } },
      institution: { select: { institutionName: true } },
    },
  });

  const totalAmount = deposits.reduce((sum, fd) => sum + Number(fd.principalAmount), 0);
  const records = deposits
    .map((fd) => ({
      memberName: fd.member?.user?.name || fd.institution?.institutionName || "N/A",
      accountNumber: fd.accountNumber,
      amount: Number(fd.principalAmount),
      percentage: totalAmount > 0 ? (Number(fd.principalAmount) / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { data: records, summary: { totalRecords: records.length, totalAmount } };
}

// FD Reversed — checks both Account (legacy) and FixedDeposit (new) entity types
async function generateFDReversedReport(start: Date, end: Date, branchId?: string) {
  const reversedLogs = await db.auditLog.findMany({
    where: {
      entityType: { in: ["Account", "FixedDeposit"] },
      action: { contains: "REVERSE" },
      timestamp: { gte: start, lte: end },
      ...(branchId ? { user: { branchId } } : {}),
    },
    include: { user: true },
  });

  const records = reversedLogs.map((log) => ({
    date: log.timestamp.toISOString().split("T")[0],
    accountId: log.entityId || "N/A",
    action: log.action,
    details: log.details || "",
    reversedBy: log.user?.name || "System",
  }));

  return { data: records, summary: { totalRecords: records.length } };
}

// FD Interest Exposure — queries FixedDeposit table (new model)
async function generateFDInterestExposureReport(branchId?: string) {
  const deposits = await db.fixedDeposit.findMany({
    where: { status: "ACTIVE", isReversed: false, ...(branchId ? { branchId } : {}) },
    include: {
      member: { include: { user: { select: { name: true } } } },
      institution: { select: { institutionName: true } },
    },
  });

  const records = deposits.map((fd) => {
    const principal = Number(fd.principalAmount);
    const estimatedInterest = Number(fd.maturityAmount) - principal;

    return {
      accountNumber: fd.accountNumber,
      memberName: fd.member?.user?.name || fd.institution?.institutionName || "N/A",
      principal,
      interestRate: Number(fd.interestRate),
      termMonths: fd.termMonths,
      estimatedInterest,
      maturityAmount: Number(fd.maturityAmount),
    };
  });

  const totalInterest = records.reduce((sum, r) => sum + r.estimatedInterest, 0);
  return { data: records, summary: { totalRecords: records.length, totalInterest } };
}

// Share Statement
async function generateShareStatementReport(accountId: string, start: Date, end: Date) {
  if (!accountId) throw new Error("Account ID required");

  // ShareAccount holds the authoritative numberOfShares and totalValue.
  // The generic Account table's balance field is NOT updated by share purchases.
  const shareAccount = await db.shareAccount.findUnique({
    where: { id: accountId },
    include: {
      accountType: true,
      member: { include: { user: { select: { name: true } } } },
      transactions: {
        where: { transactionDate: { gte: start, lte: end } },
        orderBy: { transactionDate: "asc" },
      },
    },
  });

  if (!shareAccount || !shareAccount.accountType?.isShareAccount) {
    throw new Error("Not a share account");
  }

  let runningShares = 0;
  const transactions = shareAccount.transactions.map((txn) => {
    const sharesDelta =
      txn.transactionType === "PURCHASE" || txn.transactionType === "TRANSFER_IN"
        ? Number(txn.shares)
        : -Number(txn.shares);
    runningShares += sharesDelta;
    return {
      date: txn.transactionDate.toISOString().split("T")[0],
      transactionRef: txn.reference || "",
      description: txn.description || txn.transactionType,
      shares: sharesDelta,
      amount: Number(txn.amount),
      runningShares,
    };
  });

  return {
    accountInfo: {
      accountNumber: shareAccount.accountNumber,
      memberName: shareAccount.member?.user?.name || "N/A",
      currentShares: Number(shareAccount.numberOfShares),
      currentValue: Number(shareAccount.totalValue),
      shareValue: Number(shareAccount.shareValue),
    },
    transactions,
  };
}

// Savings Overdrawn by Age
async function generateSavingsOverdrawnByAgeReport(branchId?: string) {
  const accounts = await db.account.findMany({
    where: {
      balance: { lt: 0 },
      accountType: { isShareAccount: false, hasFixedPeriod: false },
      ...(branchId ? { branchId } : {}),
    },
    include: {
      member: { include: { user: true } },
      accountType: true,
      transactions: { orderBy: { transactionDate: "desc" }, take: 1 },
    },
  });

  const records = accounts.map((account) => {
    const lastTransaction = account.transactions[0];
    const daysOverdrawn = lastTransaction
      ? Math.ceil((new Date().getTime() - lastTransaction.transactionDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      accountNumber: account.accountNumber,
      memberName: account.member?.user?.name || "N/A",
      overdrawnAmount: Math.abs(Number(account.balance)),
      daysOverdrawn,
      ageCategory: daysOverdrawn < 30 ? "0-30 days" : daysOverdrawn < 90 ? "30-90 days" : "90+ days",
    };
  });

  return { data: records, summary: { totalRecords: records.length } };
}

// COA Listing (all accounts from direct source)
async function generateCOAListingReport(branchId?: string) {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const allAccounts = await getDirectTrialBalanceAccounts(startOfYear, now, branchId);

  const records = allAccounts
    .filter((a) => !a.isGroup)
    .map((account) => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      ledgerType: account.ledgerType,
      debitBalance: account.debit,
      creditBalance: account.credit,
      balance: account.balance,
    }));

  return { data: records, summary: { totalRecords: records.length } };
}

// Budget Variance
async function generateBudgetVarianceReport(year: number, branchId?: string) {
  const budgets = await db.budget.findMany({
    where: { year, isActive: true },
    include: { category: true },
  });

  const records = await Promise.all(
    budgets.map(async (budget) => {
      const actual = await db.expenditureRecord.aggregate({
        where: {
          budgetCategoryId: budget.categoryId,
          recordDate: {
            gte: new Date(year, 0, 1),
            lte: new Date(year, 11, 31),
          },
          status: "COMPLETED",
          ...(branchId ? { branchId } : {}),
        },
        _sum: { amount: true },
      });

      const actualAmount = actual._sum.amount || 0;
      const budgetedAmount = budget.amount;
      const variance = budgetedAmount - actualAmount;
      const percentageUsed = budgetedAmount > 0 ? (actualAmount / budgetedAmount) * 100 : 0;

      return {
        category: budget.category.name,
        budgeted: budgetedAmount,
        actual: actualAmount,
        variance,
        percentageUsed,
        status: percentageUsed > 100 ? "Over Budget" : percentageUsed > 90 ? "Near Limit" : "On Track",
      };
    })
  );

  const totalBudgeted = records.reduce((sum, item) => sum + item.budgeted, 0);
  const totalActual = records.reduce((sum, item) => sum + item.actual, 0);
  const totalVariance = records.reduce((sum, item) => sum + item.variance, 0);

  return {
    data: records,
    summary: {
      totalRecords: records.length,
      totalBudgeted,
      totalActual,
      totalVariance,
      overBudgetCount: records.filter((item) => item.status === "Over Budget").length,
      nearLimitCount: records.filter((item) => item.status === "Near Limit").length,
      onTrackCount: records.filter((item) => item.status === "On Track").length,
      year,
    },
  };
}

// Comprehensive Trial Balance (direct source)
async function generateComprehensiveTrialBalanceReport(start: Date, end: Date, branchId?: string) {
  const accounts = await getDirectTrialBalanceAccounts(start, end, branchId);

  const records = accounts.map((account) => ({
    accountCode: account.accountCode,
    accountName: account.accountName,
    ledgerType: account.ledgerType,
    debit: account.debit,
    credit: account.credit,
  }));

  const totalDebits = records.reduce((sum, r) => sum + r.debit, 0);
  const totalCredits = records.reduce((sum, r) => sum + r.credit, 0);

  return {
    data: records,
    summary: { totalDebits, totalCredits, difference: totalDebits - totalCredits },
  };
}

// Comprehensive Balance Sheet (direct source)
async function generateComprehensiveBalanceSheetReport(asOfDate: Date, branchId?: string) {
  const accounts = await getDirectBalanceSheetAccounts(asOfDate, branchId);

  const assets = accounts.filter((a) => a.ledgerType === "ASSETS");
  const liabilities = accounts.filter((a) => a.ledgerType === "LIABILITIES");
  const equity = accounts.filter((a) => a.ledgerType === "EQUITY");

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

  return {
    asOfDate: asOfDate.toISOString().split("T")[0],
    assets: assets.map((a) => ({
      code: a.accountCode,
      name: a.accountName,
      amount: a.balance,
    })),
    liabilities: liabilities.map((a) => ({
      code: a.accountCode,
      name: a.accountName,
      amount: a.balance,
    })),
    equity: equity.map((a) => ({
      code: a.accountCode,
      name: a.accountName,
      amount: a.balance,
    })),
    summary: { totalAssets, totalLiabilities, totalEquity },
  };
}

// Comprehensive Income (direct source)
async function generateComprehensiveIncomeReport(start: Date, end: Date, branchId?: string) {
  const accounts = await getDirectIncomeExpenseAccounts(start, end, branchId);

  const income = accounts.filter((a) => a.ledgerType === "INCOME");
  const expenses = accounts.filter((a) => a.ledgerType === "EXPENDITURES");

  const totalIncome = income.reduce((sum, a) => sum + a.balance, 0);
  const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);

  return {
    period: { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] },
    income: income.map((a) => ({
      code: a.accountCode,
      name: a.accountName,
      amount: a.balance,
    })),
    expenses: expenses.map((a) => ({
      code: a.accountCode,
      name: a.accountName,
      amount: a.balance,
    })),
    summary: { totalIncome, totalExpenses, netIncome: totalIncome - totalExpenses },
  };
}

// Account Statement
async function generateAccountStatementReport(accountId: string, start: Date, end: Date) {
  if (!accountId) throw new Error("Account ID required");

  const account = await db.account.findUnique({
    where: { id: accountId },
    include: {
      member: { include: { user: true } },
      accountType: true,
      transactions: {
        where: { transactionDate: { gte: start, lte: end } },
        orderBy: { transactionDate: "asc" },
      },
    },
  });

  if (!account) throw new Error("Account not found");

  let runningBalance = Number(account.balance);
  const transactions = account.transactions.map((txn) => {
    const amount = Number(txn.amount);
    const prevBalance = runningBalance;
    runningBalance += txn.type === "DEPOSIT" ? amount : -amount;

    return {
      date: txn.transactionDate.toISOString().split("T")[0],
      transactionRef: txn.transactionRef,
      description: txn.description || txn.type,
      debit: txn.type === "WITHDRAWAL" ? amount : 0,
      credit: txn.type === "DEPOSIT" ? amount : 0,
      balance: runningBalance,
    };
  });

  return {
    accountInfo: {
      accountNumber: account.accountNumber,
      memberName: account.member?.user?.name || "N/A",
      accountType: account.accountType.name,
      currentBalance: Number(account.balance),
    },
    transactions,
  };
}

// Personal Ledger
async function generatePersonalLedgerReport(memberId: string, start: Date, end: Date) {
  if (!memberId) throw new Error("Member ID required");

  const member = await db.member.findUnique({
    where: { id: memberId },
    include: {
      user: true,
      accounts: {
        include: {
          accountType: true,
          transactions: {
            where: { transactionDate: { gte: start, lte: end } },
            orderBy: { transactionDate: "asc" },
          },
        },
      },
      loanRepayments: {
        where: { repaymentDate: { gte: start, lte: end } },
      },
      deposits: {
        where: { depositDate: { gte: start, lte: end } },
      },
      withdrawals: {
        where: { withdrawalDate: { gte: start, lte: end } },
      },
    },
  });

  if (!member) throw new Error("Member not found");

  const allTransactions = [
    ...member.deposits.map((d) => ({ date: d.depositDate, type: "DEPOSIT", amount: Number(d.amount), account: d.accountId })),
    ...member.withdrawals.map((w) => ({ date: w.withdrawalDate, type: "WITHDRAWAL", amount: Number(w.amount), account: w.accountId })),
    ...member.loanRepayments.map((r) => ({ date: r.repaymentDate, type: "LOAN_REPAYMENT", amount: Number(r.amount), account: "N/A" })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    memberInfo: {
      memberNumber: member.memberNumber,
      name: member.user.name,
      registrationDate: member.registrationDate.toISOString().split("T")[0],
    },
    transactions: allTransactions.map((t) => ({
      date: t.date.toISOString().split("T")[0],
      type: t.type,
      amount: t.amount,
    })),
  };
}

// Clients Registered
async function generateClientsRegisteredReport(start: Date, end: Date, branchId?: string) {
  const members = await db.member.findMany({
    where: {
      registrationDate: { gte: start, lte: end },
      ...(branchId ? { user: { branchId } } : {}),
    },
    include: { user: true },
    orderBy: { registrationDate: "desc" },
  });

  const records = members.map((member) => ({
    memberNumber: member.memberNumber,
    name: member.user.name,
    email: member.user.email,
    phone: member.user.phone || "N/A",
    registrationDate: member.registrationDate.toISOString().split("T")[0],
    isApproved: member.isApproved,
  }));

  return { data: records, summary: { totalRecords: records.length } };
}

// Customer Feedback
async function generateCustomerFeedbackReport(start: Date, end: Date) {
  // Placeholder - would need a CustomerFeedback model
  return {
    data: [],
    summary: { totalRecords: 0 },
    note: "Customer feedback tracking not yet implemented in schema",
  };
}
