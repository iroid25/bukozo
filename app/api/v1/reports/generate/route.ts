// app/api/v1/reports/generate/route.ts
import { db } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { IncomeService } from "@/services/income.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const branchId = user.role === "ADMIN" ? undefined : user.branchId;

    const { reportId, startDate, endDate } = await request.json();

    if (!reportId) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    let data;

    switch (reportId) {
      // ========== SAVINGS REPORTS ==========
      case "savings-deposits":
        data = await generateDepositsReport(start, end, branchId);
        break;
      case "savings-withdrawals":
        data = await generateWithdrawalsReport(start, end, branchId);
        break;
      case "savings-balance":
        data = await generateAccountBalanceReport(branchId);
        break;

      // ========== SHARES REPORTS ==========
      case "shares-statement":
        data = await generateSharesStatementReport(branchId);
        break;
      case "shares-balance":
        data = await generateShareAccountsBalanceReport(branchId);
        break;
      case "shares-concentration":
        data = await generateSharesConcentrationReport();
        break;
      case "shares-listing":
        data = await generateShareAccountsListingReport();
        break;
      case "shares-batch-totals":
        data = await generateShareBatchTotalsReport(start, end);
        break;
      case "shares-on-hold":
        data = await generateSharesOnHoldReport();
        break;
      case "shares-zero-balance":
        data = await generateSharesZeroBalanceReport();
        break;
      case "shares-top-bottom":
        data = await generateTopBottomShareholdersReport();
        break;
      case "shares-transactions":
        data = await generateShareTransactionsReport(start, end);
        break;

      // ========== LOAN REPORTS ==========
      case "loan-disbursements":
        data = await generateLoanDisbursementsReport(start, end, branchId);
        break;
      case "loan-repayments":
        data = await generateLoanRepaymentsReport(start, end, branchId);
        break;
      case "loan-outstanding":
        data = await generateOutstandingLoansReport(branchId);
        break;

      // ========== FINANCIAL REPORTS ==========
      case "income-report":
        data = await generateIncomeReport(start, end, branchId);
        break;
      case "expenditure-report":
        data = await generateExpenditureReport(start, end, branchId);
        break;
      case "income-vs-expenditure":
        data = await generateIncomeVsExpenditureReport(start, end, branchId);
        break;

      // ========== OPERATIONS REPORTS ==========
      case "float-transactions":
        data = await generateFloatTransactionsReport(start, end);
        break;
      case "vault-transactions":
        data = await generateVaultTransactionsReport(start, end);
        break;
      case "branch-performance":
        data = await generateBranchPerformanceReport(start, end);
        break;

      // ========== MEMBER REPORTS ==========
      case "customer-accounts-listing":
        data = await generateCustomerAccountsListingReport();
        break;
      case "customer-contacts":
        data = await generateCustomerContactsReport();
        break;
      case "blacklisted-clients":
        data = await generateBlacklistedClientsReport();
        break;
      case "transferred-clients":
        data = await generateTransferredClientsReport(start, end);
        break;

      // ========== AUDIT & COMPLIANCE REPORTS ==========
      case "audit-trail":
        data = await generateAuditTrailReport(start, end);
        break;
      case "error-corrected-transactions":
        data = await generateErrorCorrectedTransactionsReport(start, end);
        break;
      case "transaction-authorization":
        data = await generateTransactionAuthorizationReport(start, end);
        break;
      case "eod-supervision":
        data = await generateEODSupervisionReport(start, end);
        break;
      case "system-users":
        data = await generateSystemUsersReport();
        break;

      // ========== PERFORMANCE REPORTS ==========
      case "performance-monitoring":
        data = await generatePerformanceMonitoringReport(start, end);
        break;
      case "performance-indicators":
        data = await generatePerformanceIndicatorsReport(start, end);
        break;

      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 }
        );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate report",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ==================== EXISTING REPORTS (KEEP AS IS) ====================
// (Your existing deposit, withdrawal, account balance, loans, financial, operations reports)

async function generateDepositsReport(startDate: Date, endDate: Date, branchId?: string) {
  const deposits = await db.deposit.findMany({
    where: {
      depositDate: {
        gte: startDate,
        lte: endDate,
      },
      ...(branchId && { account: { branchId } }),
    },
    include: {
      transaction: true,
      account: {
        include: {
          accountType: true,
          member: { include: { user: true } },
          institution: { include: { user: true } },
        },
      },
      member: { include: { user: true } },
      institution: { include: { user: true } },
      handler: true,
    },
    orderBy: { depositDate: "asc" },
  });

  const records = deposits.map((deposit) => {
    const depositorName =
      deposit.member?.user?.name ||
      deposit.institution?.user?.name ||
      deposit.depositorName ||
      "Unknown";

    return {
      id: deposit.transaction.transactionRef,
      date: deposit.depositDate.toISOString().split("T")[0],
      depositorName: depositorName,
      accountNumber: deposit.account.accountNumber,
      accountType: deposit.account.accountType.name,
      description:
        deposit.transaction.description || `Deposit via ${deposit.channel}`,
      amount: Number(deposit.amount),
      channel: deposit.channel,
      handledBy: deposit.handler.name,
      balance: Number(deposit.account.balance),
    };
  });

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
      averageAmount: records.length > 0 ? totalAmount / records.length : 0,
    },
    records,
  };
}

async function generateWithdrawalsReport(startDate: Date, endDate: Date, branchId?: string) {
  const withdrawals = await db.withdrawal.findMany({
    where: {
      withdrawalDate: {
        gte: startDate,
        lte: endDate,
      },
      ...(branchId && { account: { branchId } }),
    },
    include: {
      transaction: true,
      account: {
        include: {
          accountType: true,
          member: { include: { user: true } },
          institution: { include: { user: true } },
        },
      },
      member: { include: { user: true } },
      institution: { include: { user: true } },
      handler: true,
    },
    orderBy: { withdrawalDate: "asc" },
  });

  const records = withdrawals.map((withdrawal) => {
    const withdrawerName =
      withdrawal.member?.user?.name ||
      withdrawal.institution?.user?.name ||
      "Unknown";

    return {
      id: withdrawal.transaction.transactionRef,
      date: withdrawal.withdrawalDate.toISOString().split("T")[0],
      withdrawerName: withdrawerName,
      accountNumber: withdrawal.account.accountNumber,
      accountType: withdrawal.account.accountType.name,
      description:
        withdrawal.transaction.description ||
        `Withdrawal via ${withdrawal.channel}`,
      amount: Number(withdrawal.amount),
      channel: withdrawal.channel,
      handledBy: withdrawal.handler.name,
      balance: Number(withdrawal.account.balance),
    };
  });

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
      averageAmount: records.length > 0 ? totalAmount / records.length : 0,
    },
    records,
  };
}

async function generateAccountBalanceReport(branchId?: string) {
  const accounts = await db.account.findMany({
    where: { 
      status: "ACTIVE",
      ...(branchId && { branchId }),
    },
    include: {
      accountType: true,
      member: { include: { user: true } },
      institution: {
        select: {
          institutionName: true,
        },
      },
      branch: true,
    },
    orderBy: { balance: "desc" },
  });

  const records = accounts.map((account) => {
    const ownerName =
      account.member?.user?.name ||
      account.institution?.institutionName ||
      "Unknown";

    return {
      accountNumber: account.accountNumber,
      ownerName: ownerName,
      accountType: account.accountType.name,
      currentBalance: Number(account.balance),
      interestRate: Number(account.accountType.interestRate),
      status: account.status,
      branch: account.branch?.name || "N/A",
      openedDate: account.openedAt.toISOString().split("T")[0],
    };
  });

  const totalBalance = records.reduce((sum, r) => sum + r.currentBalance, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: totalBalance,
      averageAmount: records.length > 0 ? totalBalance / records.length : 0,
    },
    records,
  };
}

async function generateLoanDisbursementsReport(startDate: Date, endDate: Date, branchId?: string) {
  const loans = await db.loan.findMany({
    where: {
      disbursementDate: {
        gte: startDate,
        lte: endDate,
      },
      status: { not: "PENDING" },
      ...(branchId && { branchId }),
    },
    include: {
      loanApplication: {
        include: {
          member: { include: { user: true } },
          loanProduct: true,
        },
      },
      disbursedByUser: true,
      branch: true,
    },
    orderBy: { disbursementDate: "asc" },
  });

  const records = loans.map((loan) => ({
    loanId: loan.id,
    date: loan.disbursementDate?.toISOString().split("T")[0] || "N/A",
    memberName: loan.loanApplication.member.user.name,
    memberNumber: loan.loanApplication.member.memberNumber,
    loanProduct: loan.loanApplication.loanProduct.name,
    description: loan.loanApplication.purpose || "Loan Disbursement",
    amountGranted: Number(loan.amountGranted),
    interestRate: Number(loan.interestRate),
    totalDue: Number(loan.totalAmountDue),
    disbursedBy: loan.disbursedByUser?.name || "N/A",
    branch: loan.branch?.name || "N/A",
    status: loan.status,
  }));

  const totalAmount = records.reduce((sum, r) => sum + r.amountGranted, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
      averageAmount: records.length > 0 ? totalAmount / records.length : 0,
    },
    records,
  };
}

async function generateLoanRepaymentsReport(startDate: Date, endDate: Date, branchId?: string) {
  const repayments = await db.loanRepayment.findMany({
    where: {
      repaymentDate: {
        gte: startDate,
        lte: endDate,
      },
      ...(branchId && { loan: { branchId } }),
    },
    include: {
      loan: {
        include: {
          loanApplication: {
            include: {
              member: { include: { user: true } },
              loanProduct: true,
            },
          },
        },
      },
      member: { include: { user: true } },
      handler: true,
    },
    orderBy: { repaymentDate: "asc" },
  });

  const records = repayments.map((repayment) => ({
    repaymentId: repayment.id,
    date: repayment.repaymentDate.toISOString().split("T")[0],
    memberName: repayment.member.user.name,
    memberNumber: repayment.member.memberNumber,
    loanProduct: repayment.loan.loanApplication.loanProduct.name,
    amount: Number(repayment.amount),
    channel: repayment.channel,
    handledBy: repayment.handler.name,
    outstandingBalance: Number(repayment.loan.outstandingBalance),
  }));

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
      averageAmount: records.length > 0 ? totalAmount / records.length : 0,
    },
    records,
  };
}

async function generateOutstandingLoansReport(branchId?: string) {
  const loans = await db.loan.findMany({
    where: {
      status: { in: ["DISBURSED", "OVERDUE"] },
      outstandingBalance: { gt: 0 },
      ...(branchId && { branchId }),
    },
    include: {
      loanApplication: {
        include: {
          member: { include: { user: true } },
          loanProduct: true,
        },
      },
      branch: true,
    },
    orderBy: { outstandingBalance: "desc" },
  });

  const records = loans.map((loan) => ({
    loanId: loan.id,
    memberName: loan.loanApplication.member.user.name,
    memberNumber: loan.loanApplication.member.memberNumber,
    loanProduct: loan.loanApplication.loanProduct.name,
    amountGranted: Number(loan.amountGranted),
    totalDue: Number(loan.totalAmountDue),
    amountPaid: Number(loan.amountPaid),
    outstandingBalance: Number(loan.outstandingBalance),
    disbursementDate: loan.disbursementDate?.toISOString().split("T")[0] || "N/A",
    dueDate: loan.dueDate.toISOString().split("T")[0],
    branch: loan.branch?.name || "N/A",
    status: loan.status,
  }));

  const totalOutstanding = records.reduce((sum, r) => sum + r.outstandingBalance, 0);
  const totalGranted = records.reduce((sum, r) => sum + r.amountGranted, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: totalOutstanding,
      totalGranted,
      averageAmount: records.length > 0 ? totalOutstanding / records.length : 0,
    },
    records,
  };
}

async function generateIncomeReport(startDate: Date, endDate: Date, branchId?: string) {
  const income = await IncomeService.getUnifiedIncomeRecords({
    user: { role: "ADMIN", branchId: null },
    branchId,
    startDate,
    endDate,
  });

  const records = income.map((item) => ({
    referenceNumber: item.referenceNumber || item.receiptNo || item.id,
    date: item.date.toISOString().split("T")[0],
    description: item.description || "Income",
    category: item.budgetCategory?.name || "Uncategorized",
    amount: Number(item.amount),
    paymentMethod: item.paymentMethod,
    receivedBy: item.receivedBy?.name || "N/A",
    branch: item.branch?.name || "N/A",
    depositor: item.depositorName || item.member?.user?.name || "N/A",
    status: item.status,
  }));

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
      averageAmount: records.length > 0 ? totalAmount / records.length : 0,
    },
    records,
  };
}

async function generateExpenditureReport(startDate: Date, endDate: Date, branchId?: string) {
  const expenditure = await db.expenditureRecord.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      ...(branchId && { branchId }),
    },
    include: {
      category: true,
      budgetCategory: true,
      submittedBy: true,
      approvedBy: true,
      branch: true,
    },
    orderBy: { date: "asc" },
  });

  const records = expenditure.map((item) => ({
    referenceNumber: item.referenceNumber || item.voucherNo || item.id,
    date: item.date.toISOString().split("T")[0],
    description: item.description || "Expenditure",
    category: item.budgetCategory?.name || item.category?.name || "Uncategorized",
    amount: Number(item.amount),
    paymentMethod: item.paymentMethod,
    payee: item.payee || "N/A",
    submittedBy: item.submittedBy.name,
    approvedBy: item.approvedBy?.name || "Pending",
    branch: item.branch?.name || "N/A",
    status: item.status,
  }));

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
      averageAmount: records.length > 0 ? totalAmount / records.length : 0,
    },
    records,
  };
}

async function generateIncomeVsExpenditureReport(startDate: Date, endDate: Date, branchId?: string) {
  const [income, expenditure] = await Promise.all([
    IncomeService.getUnifiedIncomeRecords({
      user: { role: "ADMIN", branchId: null },
      branchId,
      startDate,
      endDate,
    }),
    db.expenditureRecord.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        status: "COMPLETED",
        ...(branchId && { branchId }),
      },
    }),
  ]);

  const totalIncome = income.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalExpenditure = expenditure.reduce((sum, e) => sum + Number(e.amount), 0);
  const netIncome = totalIncome - totalExpenditure;

  const records = [
    {
      category: "Total Income",
      amount: totalIncome,
      count: income.length,
      percentage: 100,
    },
    {
      category: "Total Expenditure",
      amount: totalExpenditure,
      count: expenditure.length,
      percentage: totalIncome > 0 ? (totalExpenditure / totalIncome) * 100 : 0,
    },
    {
      category: "Net Income",
      amount: netIncome,
      count: "-",
      percentage: totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0,
    },
  ];

  return {
    summary: {
      totalRecords: income.length + expenditure.length,
      totalIncome,
      totalExpenditure,
      netIncome,
      surplus: netIncome > 0,
    },
    records,
  };
}

async function generateFloatTransactionsReport(startDate: Date, endDate: Date) {
  const transactions = await db.floatTransaction.findMany({
    where: {
      transactionDate: { gte: startDate, lte: endDate },
    },
    include: {
      float: { include: { user: true } },
      performedByUser: true,
    },
    orderBy: { transactionDate: "asc" },
  });

  const records = transactions.map((txn) => ({
    id: txn.id,
    date: txn.transactionDate.toISOString().split("T")[0],
    agent: txn.float.user.name,
    type: txn.type,
    description: txn.description || `Float ${txn.type}`,
    amount: Number(txn.amount),
    performedBy: txn.performedByUser.name,
  }));

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
      averageAmount: records.length > 0 ? totalAmount / records.length : 0,
    },
    records,
  };
}

async function generateVaultTransactionsReport(startDate: Date, endDate: Date) {
  const transactions = await db.vaultTransaction.findMany({
    where: {
      transactionDate: { gte: startDate, lte: endDate },
    },
    include: {
      vault: { include: { branch: true } },
      performedBy: true,
      relatedUser: true,
    },
    orderBy: { transactionDate: "asc" },
  });

  const records = transactions.map((txn) => ({
    id: txn.id,
    date: txn.transactionDate.toISOString().split("T")[0],
    vault: txn.vault.name,
    branch: txn.vault.branch?.name || "N/A",
    type: txn.type,
    description: txn.description || `Vault ${txn.type}`,
    amount: Number(txn.amount),
    balanceBefore: Number(txn.balanceBefore),
    balanceAfter: Number(txn.balanceAfter),
    performedBy: txn.performedBy.name,
  }));

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
      averageAmount: records.length > 0 ? totalAmount / records.length : 0,
    },
    records,
  };
}

async function generateBranchPerformanceReport(startDate: Date, endDate: Date) {
  const branches = await db.branch.findMany({
    include: {
      users: { where: { isActive: true } },
      accounts: { where: { status: "ACTIVE" } },
      loans: {
        where: {
          disbursementDate: { gte: startDate, lte: endDate },
        },
      },
    },
  });

  const records = await Promise.all(
    branches.map(async (branch) => {
      const deposits = await db.deposit.findMany({
        where: {
          depositDate: { gte: startDate, lte: endDate },
          account: { branchId: branch.id },
        },
      });

      const withdrawals = await db.withdrawal.findMany({
        where: {
          withdrawalDate: { gte: startDate, lte: endDate },
          account: { branchId: branch.id },
        },
      });

      const totalDeposits = deposits.reduce((sum, d) => sum + Number(d.amount), 0);
      const totalWithdrawals = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
      const totalLoans = branch.loans.reduce((sum, l) => sum + Number(l.amountGranted), 0);

      return {
        branchName: branch.name,
        branchLocation: branch.location,
        totalAccounts: branch.accounts.length,
        totalStaff: branch.users.length,
        totalDeposits,
        totalWithdrawals,
        totalLoans,
        loanCount: branch.loans.length,
        netTransactions: totalDeposits - totalWithdrawals,
      };
    })
  );

  const totalVolume = records.reduce(
    (sum, r) => sum + r.totalDeposits + r.totalWithdrawals + r.totalLoans,
    0
  );

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: totalVolume,
      averageAmount: records.length > 0 ? totalVolume / records.length : 0,
    },
    records,
  };
}

// ==================== NEW SHARE REPORTS ====================

async function fetchAllShareAccounts(whereClause: any, includeClause: any, orderBy?: any) {
  const institutionWhere: any = { institutionId: { not: null }, accountType: { isShareAccount: true } };
  if (whereClause.status) institutionWhere.status = whereClause.status === "ON_HOLD" ? "SUSPENDED" : whereClause.status;
  if (whereClause.branchId) institutionWhere.branchId = whereClause.branchId;
  if (whereClause.numberOfShares !== undefined) institutionWhere.sharesCount = whereClause.numberOfShares;
  if (whereClause.accountTypeId) institutionWhere.accountTypeId = whereClause.accountTypeId;

  const [memberAccounts, institutionAccounts] = await Promise.all([
    db.shareAccount.findMany({ where: whereClause, include: includeClause, ...(orderBy ? { orderBy } : {}) }),
    db.account.findMany({ where: institutionWhere, include: includeClause, ...(orderBy ? { orderBy } : {}) }),
  ]);
  const normalized = institutionAccounts.map((a) => ({
    ...a,
    totalValue: a.balance,
    numberOfShares: (a as any).sharesCount || 0,
    openedDate: a.openedAt,
    closedDate: a.closedAt,
    member: null,
    institution: (a as any).institution,
    _isInstitution: true,
  }));
  return [...memberAccounts, ...normalized] as any[];
}

async function generateSharesStatementReport(branchId?: string) {
  const accounts = await fetchAllShareAccounts({
    status: "ACTIVE",
    ...(branchId && { branchId }),
  }, {
    member: { include: { user: true } },
    branch: true,
    transactions: {
      orderBy: { transactionDate: "desc" },
      take: 10,
    },
  });

  const records = accounts.map((account) => ({
    accountNumber: account.accountNumber,
    memberName: account.member?.user?.name || (account as any).institution?.institutionName || "Unknown",
    numberOfShares: account.numberOfShares,
    totalValue: account.totalValue,
    openedDate: account.openedDate.toISOString().split("T")[0],
    recentTransactions: account.transactions?.length || 0,
  }));

  const totalValue = records.reduce((sum, r) => sum + r.totalValue, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: totalValue,
      averageAmount: records.length > 0 ? totalValue / records.length : 0,
    },
    records,
  };
}

async function generateShareAccountsBalanceReport(branchId?: string) {
  const accounts = await fetchAllShareAccounts({
    status: "ACTIVE",
    ...(branchId && { branchId }),
  }, {
    member: { include: { user: true } },
    branch: true,
  }, { totalValue: "desc" });

  const records = accounts.map((account) => ({
    accountNumber: account.accountNumber,
    memberName: account.member?.user?.name || (account as any).institution?.institutionName || "Unknown",
    numberOfShares: account.numberOfShares,
    shareBalance: account.totalValue,
    branch: account.branch?.name || "N/A",
    status: account.status,
  }));

  const totalBalance = records.reduce((sum, r) => sum + r.shareBalance, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: totalBalance,
      averageAmount: records.length > 0 ? totalBalance / records.length : 0,
    },
    records,
  };
}

async function generateSharesConcentrationReport() {
  const accounts = await fetchAllShareAccounts(
    { status: "ACTIVE" },
    { member: { include: { user: true } } },
  );

  const totalValue = accounts.reduce((sum, a) => sum + a.totalValue, 0);

  const records = accounts
    .map((account) => ({
      memberName: account.member?.user?.name || (account as any).institution?.institutionName || "Unknown",
      accountNumber: account.accountNumber,
      numberOfShares: account.numberOfShares,
      totalValue: account.totalValue,
      percentage: totalValue > 0 ? Number(((account.totalValue / totalValue) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: totalValue,
    },
    records,
  };
}

async function generateShareAccountsListingReport() {
  const accounts = await fetchAllShareAccounts(
    {},
    {
      member: { include: { user: true } },
      branch: true,
      accountType: true,
    },
    { accountNumber: "asc" },
  );

  const records = accounts.map((account) => ({
    accountNumber: account.accountNumber,
    memberName: account.member?.user?.name || (account as any).institution?.institutionName || "Unknown",
    numberOfShares: account.numberOfShares,
    shareValue: account.shareValue,
    totalValue: account.totalValue,
    status: account.status,
    branch: account.branch?.name || "N/A",
    openedDate: account.openedDate.toISOString().split("T")[0],
  }));

  const totalValue = records.reduce((sum, r) => sum + r.totalValue, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: totalValue,
    },
    records,
  };
}

async function generateShareBatchTotalsReport(startDate: Date, endDate: Date) {
  const transactions = await db.shareTransaction.findMany({
    where: {
      transactionDate: { gte: startDate, lte: endDate },
      isReversed: false,
    },
    include: {
      account: {
        include: {
          member: { include: { user: true } },
          branch: true,
        },
      },
    },
    orderBy: { transactionDate: "asc" },
  });

  const batchTotals = transactions.reduce((acc: any, txn) => {
    const date = txn.transactionDate.toISOString().split("T")[0];
    if (!acc[date]) {
      acc[date] = { date, count: 0, totalShares: 0, totalAmount: 0 };
    }
    acc[date].count++;
    acc[date].totalShares += txn.shares;
    acc[date].totalAmount += txn.amount;
    return acc;
  }, {});

  const records = Object.values(batchTotals);
  const totalAmount = records.reduce((sum: number, r: any) => sum + r.totalAmount, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
    },
    records,
  };
}

async function generateSharesOnHoldReport() {
  const accounts = await fetchAllShareAccounts(
    { status: { in: ["ON_HOLD", "CLOSED"] } },
    { member: { include: { user: true } }, branch: true },
  );

  const records = accounts.map((account) => ({
    accountNumber: account.accountNumber,
    memberName: account.member?.user?.name || (account as any).institution?.institutionName || "Unknown",
    numberOfShares: account.numberOfShares,
    totalValue: account.totalValue,
    status: account.status,
    branch: account.branch?.name || "N/A",
    closedDate: (account.closedDate || (account as any).closedAt)?.toISOString().split("T")[0] || "N/A",
  }));

  const totalValue = records.reduce((sum, r) => sum + r.totalValue, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: totalValue,
    },
    records,
  };
}

async function generateSharesZeroBalanceReport() {
  const accounts = await fetchAllShareAccounts(
    { numberOfShares: 0 },
    { member: { include: { user: true } }, branch: true },
  );

  const records = accounts.map((account) => ({
    accountNumber: account.accountNumber,
    memberName: account.member?.user?.name || (account as any).institution?.institutionName || "Unknown",
    status: account.status,
    branch: account.branch?.name || "N/A",
    openedDate: account.openedDate.toISOString().split("T")[0],
  }));

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: 0,
    },
    records,
  };
}

async function generateTopBottomShareholdersReport() {
  const allAccounts = await fetchAllShareAccounts(
    { status: "ACTIVE" },
    { member: { include: { user: true } } },
    { totalValue: "desc" },
  );

  const top10 = allAccounts.slice(0, 10);
  const bottom10 = allAccounts.slice(-10).reverse();

  const records = [
    ...top10.map((account, idx) => ({
      rank: idx + 1,
      category: "Top Shareholders",
      memberName: account.member?.user?.name || (account as any).institution?.institutionName || "Unknown",
      accountNumber: account.accountNumber,
      numberOfShares: account.numberOfShares,
      totalValue: account.totalValue,
    })),
    ...bottom10.map((account, idx) => ({
      rank: idx + 1,
      category: "Bottom Shareholders",
      memberName: account.member?.user?.name || (account as any).institution?.institutionName || "Unknown",
      accountNumber: account.accountNumber,
      numberOfShares: account.numberOfShares,
      totalValue: account.totalValue,
    })),
  ];

  const totalValue = records.reduce((sum, r) => sum + r.totalValue, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: totalValue,
    },
    records,
  };
}

async function generateShareTransactionsReport(startDate: Date, endDate: Date) {
  const transactions = await db.shareTransaction.findMany({
    where: {
      transactionDate: { gte: startDate, lte: endDate },
    },
    include: {
      account: {
        include: {
          member: { include: { user: true } },
          branch: true,
        },
      },
      teller: { select: { name: true } },
    },
    orderBy: { transactionDate: "desc" },
  });

  const records = transactions.map((txn) => ({
    transactionRef: txn.reference || txn.id,
    date: txn.transactionDate.toISOString().split("T")[0],
    memberName: txn.account.member?.user?.name || "Unknown",
    accountNumber: txn.account.accountNumber,
    type: txn.transactionType,
    shares: txn.shares,
    amount: txn.amount,
    processedBy: txn.teller?.name || "System",
  }));

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
    },
    records,
  };
}

// ==================== MEMBER REPORTS ====================

async function generateCustomerAccountsListingReport() {
  const members = await db.member.findMany({
    where: { isApproved: true },
    include: {
      user: true,
      accounts: {
        include: {
          accountType: true,
          branch: true,
        },
      },
    },
    orderBy: { memberNumber: "asc" },
  });

  const records = members.flatMap((member) =>
    member.accounts.map((account) => ({
      memberNumber: member.memberNumber,
      memberName: member.user.name,
      accountNumber: account.accountNumber,
      accountType: account.accountType.name,
      balance: Number(account.balance),
      status: account.status,
      branch: account.branch?.name || "N/A",
    }))
  );

  const totalBalance = records.reduce((sum, r) => sum + r.balance, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: totalBalance,
    },
    records,
  };
}

async function generateCustomerContactsReport() {
  const members = await db.member.findMany({
    where: { isApproved: true },
    include: { user: true },
    orderBy: { memberNumber: "asc" },
  });

  const records = members.map((member) => ({
    memberNumber: member.memberNumber,
    name: member.user.name,
    email: member.user.email,
    phone: member.user.phone || "N/A",
    district: member.district || "N/A",
    town: member.town || "N/A",
    registrationDate: member.registrationDate.toISOString().split("T")[0],
  }));

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: 0,
    },
    records,
  };
}

async function generateBlacklistedClientsReport() {
  // Members with SUSPENDED status (MemberStatus enum) are the true "blacklisted" records.
  // Also include those whose user account has been deactivated.
  const members = await db.member.findMany({
    where: {
      OR: [
        { status: "SUSPENDED" },
        { user: { isActive: false } },
      ],
    },
    include: {
      user: true,
      accounts: {
        // AccountStatus enum values: ACTIVE | INACTIVE | CLOSED | SUSPENDED | DORMANT
        where: { status: { in: ["SUSPENDED", "CLOSED"] } },
      },
    },
  });

  const records = members.map((member) => ({
    memberNumber: member.memberNumber,
    name: member.user?.name || "Unknown",
    email: member.user?.email || "N/A",
    phone: member.user?.phone || "N/A",
    suspendedAccounts: member.accounts.length,
    status: member.status === "SUSPENDED" ? "SUSPENDED" : "DEACTIVATED",
  }));

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: 0,
    },
    records,
  };
}

async function generateTransferredClientsReport(startDate: Date, endDate: Date) {
  // This would require an audit log of branch transfers
  const auditLogs = await db.auditLog.findMany({
    where: {
      action: "MEMBER_TRANSFER",
      timestamp: { gte: startDate, lte: endDate },
    },
    include: { user: true },
    orderBy: { timestamp: "desc" },
  });

  const records = auditLogs.map((log) => ({
    date: log.timestamp.toISOString().split("T")[0],
    memberName: log.user?.name || "System",
    action: log.action,
    details: log.details || "N/A",
    performedBy: log.user?.name || "System",
  }));

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: 0,
    },
    records,
  };
}

// ==================== AUDIT & COMPLIANCE REPORTS ====================

async function generateAuditTrailReport(startDate: Date, endDate: Date) {
  const logs = await db.auditLog.findMany({
    where: {
      timestamp: { gte: startDate, lte: endDate },
    },
    include: { user: true },
    orderBy: { timestamp: "desc" },
    take: 1000,
  });

  const records = logs.map((log) => ({
    timestamp: log.timestamp.toISOString(),
    user: log.user?.name || "System",
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId || "N/A",
    details: log.details || "N/A",
    ipAddress: log.ipAddress || "N/A",
  }));

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: 0,
    },
    records,
  };
}

async function generateErrorCorrectedTransactionsReport(startDate: Date, endDate: Date) {
  const reversedTransactions = await db.transaction.findMany({
    where: {
      status: "REVERSED",
      transactionDate: { gte: startDate, lte: endDate },
    },
    include: {
      member: { include: { user: true } },
      processedByUser: true,
    },
    orderBy: { transactionDate: "desc" },
  });

  const records = reversedTransactions.map((txn) => ({
    transactionRef: txn.transactionRef,
    date: txn.transactionDate.toISOString().split("T")[0],
    memberName: txn.member?.user?.name || "N/A",
    type: txn.type,
    amount: Number(txn.amount),
    processedBy: txn.processedByUser?.name || "System",
    status: txn.status,
  }));

  const totalAmount = records.reduce((sum, r) => Math.abs(sum + r.amount), 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
    },
    records,
  };
}

async function generateTransactionAuthorizationReport(startDate: Date, endDate: Date) {
  const pendingTransactions = await db.transaction.findMany({
    where: {
      status: "PENDING",
      transactionDate: { gte: startDate, lte: endDate },
    },
    include: {
      member: { include: { user: true } },
      processedByUser: true,
    },
    orderBy: { transactionDate: "desc" },
  });

  const records = pendingTransactions.map((txn) => ({
    transactionRef: txn.transactionRef,
    date: txn.transactionDate.toISOString().split("T")[0],
    memberName: txn.member?.user?.name || "N/A",
    type: txn.type,
    amount: Number(txn.amount),
    initiatedBy: txn.processedByUser?.name || "System",
    status: txn.status,
  }));

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount,
    },
    records,
  };
}

async function generateEODSupervisionReport(startDate: Date, endDate: Date) {
  // End of day reconciliations
  const reconciliations = await db.floatReconciliation.findMany({
    where: {
      reconciliationDate: { gte: startDate, lte: endDate },
      isEndOfDay: true,
    },
    include: {
      reconciledByUser: true,
      approvedBy: true,
    },
    orderBy: { reconciliationDate: "desc" },
  });

  const records = reconciliations.map((rec) => ({
    date: rec.reconciliationDate.toISOString().split("T")[0],
    reconciledBy: rec.reconciledByUser.name,
    systemBalance: Number(rec.systemBalance),
    actualCash: Number(rec.actualCash),
    difference: Number(rec.difference),
    status: rec.status,
    approvedBy: rec.approvedBy?.name || "Pending",
  }));

  const totalDifference = records.reduce((sum, r) => sum + Math.abs(r.difference), 0);

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: totalDifference,
    },
    records,
  };
}

async function generateSystemUsersReport() {
  const users = await db.user.findMany({
    include: {
      branch: true,
      _count: {
        select: {
          auditLogs: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const records = users.map((user) => ({
    name: user.name,
    email: user.email,
    role: user.role,
    branch: user.branch?.name || "N/A",
    isActive: user.isActive,
    lastLogin: user.lastLogin?.toISOString().split("T")[0] || "Never",
    totalActions: user._count.auditLogs,
    createdAt: user.createdAt.toISOString().split("T")[0],
  }));

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: 0,
    },
    records,
  };
}

// ==================== PERFORMANCE REPORTS ====================

async function generatePerformanceMonitoringReport(startDate: Date, endDate: Date) {
  const [
    totalMembers,
    totalDeposits,
    totalWithdrawals,
    totalLoans,
    totalIncome,
    totalExpenditure,
  ] = await Promise.all([
    db.member.count({ where: { isApproved: true } }),
    db.deposit.aggregate({
      where: { depositDate: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: true,
    }),
    db.withdrawal.aggregate({
      where: { withdrawalDate: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: true,
    }),
    db.loan.aggregate({
      where: { disbursementDate: { gte: startDate, lte: endDate } },
      _sum: { amountGranted: true },
      _count: true,
    }),
    IncomeService.getUnifiedIncomeRecords({
      user: { role: "ADMIN", branchId: null },
      startDate,
      endDate,
    }).then((records) => ({
      _sum: {
        amount: records.reduce((sum, record) => sum + Number(record.amount || 0), 0),
      },
    })),
    db.expenditureRecord.aggregate({
      where: { date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
  ]);

  const records = [
    {
      metric: "Total Members",
      value: totalMembers,
      type: "Count",
    },
    {
      metric: "Total Deposits",
      value: Number(totalDeposits._sum.amount || 0),
      type: "Amount",
    },
    {
      metric: "Total Withdrawals",
      value: Number(totalWithdrawals._sum.amount || 0),
      type: "Amount",
    },
    {
      metric: "Total Loans Disbursed",
      value: Number(totalLoans._sum.amountGranted || 0),
      type: "Amount",
    },
    {
      metric: "Total Income",
      value: Number(totalIncome._sum.amount || 0),
      type: "Amount",
    },
    {
      metric: "Total Expenditure",
      value: Number(totalExpenditure._sum.amount || 0),
      type: "Amount",
    },
  ];

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: 0,
    },
    records,
  };
}

async function generatePerformanceIndicatorsReport(startDate: Date, endDate: Date) {
  const [
    activeLoans,
    overdueLoans,
    totalSavings,
    memberCount,
  ] = await Promise.all([
    db.loan.count({ where: { status: "DISBURSED" } }),
    db.loan.count({ where: { status: "OVERDUE" } }),
    db.account.aggregate({
      where: {
        status: "ACTIVE",
        accountType: { isShareAccount: false, hasFixedPeriod: false },
      },
      _sum: { balance: true },
    }),
    db.member.count({ where: { isApproved: true } }),
  ]);

  const records = [
    {
      indicator: "Loan Portfolio at Risk",
      value: activeLoans > 0 ? ((overdueLoans / activeLoans) * 100).toFixed(2) + "%" : "0%",
      category: "Risk",
    },
    {
      indicator: "Total Active Members",
      value: memberCount,
      category: "Growth",
    },
    {
      indicator: "Total Savings",
      value: Number(totalSavings._sum.balance || 0),
      category: "Savings",
    },
    {
      indicator: "Active Loans",
      value: activeLoans,
      category: "Loans",
    },
    {
      indicator: "Overdue Loans",
      value: overdueLoans,
      category: "Risk",
    },
  ];

  return {
    summary: {
      totalRecords: records.length,
      totalAmount: 0,
    },
    records,
  };
}
