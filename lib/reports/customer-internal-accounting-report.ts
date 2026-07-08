import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import type {
  CustomerInternalAccountingFilters,
  CustomerInternalAccountingRecord,
  CustomerInternalAccountingSummary,
} from "./customer-internal-accounting-types";
import { EMPTY_CUSTOMER_INTERNAL_ACCOUNTING_SUMMARY } from "./customer-internal-accounting-types";

type InternalAccountingUser = {
  role: string;
  branchId?: string | null;
};

type CustomerInternalAccountingOptions = CustomerInternalAccountingFilters & {
  user: InternalAccountingUser;
};

function buildAccountWhere(branchId?: string, status?: string) {
  const where: any = {};

  if (branchId) {
    where.branchId = branchId;
  }

  if (status && status !== "all") {
    where.status = status;
  }

  return where;
}

function safeNumber(value: number | bigint | null | undefined) {
  return Number(value || 0);
}

function toEndOfDay(date?: string): Date | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;
  d.setHours(23, 59, 59, 999);
  return d;
}

function toStartOfDay(date?: string): Date | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildDateFilter(startDate?: string, endDate?: string) {
  const start = toStartOfDay(startDate);
  const end = toEndOfDay(endDate);
  if (!start && !end) return undefined;
  return {
    ...(start ? { gte: start } : {}),
    ...(end ? { lte: end } : {}),
  };
}

export async function getCustomerInternalAccountingReport(options: CustomerInternalAccountingOptions) {
  const branchId = resolveBranchScope(
    { role: options.user.role, branchId: options.user.branchId || undefined },
    options.branchId,
  );

  const accountWhere = buildAccountWhere(branchId, options.status);
  const dateFilter = buildDateFilter(options.startDate, options.endDate);

  function depositWhere() {
    const w: any = {};
    if (accountWhere.branchId) w.account = { branchId: accountWhere.branchId };
    if (dateFilter) w.depositDate = dateFilter;
    return Object.keys(w).length > 0 ? w : undefined;
  }

  function withdrawalWhere() {
    const w: any = {};
    if (accountWhere.branchId) w.account = { branchId: accountWhere.branchId };
    if (dateFilter) w.withdrawalDate = dateFilter;
    return Object.keys(w).length > 0 ? w : undefined;
  }

  function loanWhere() {
    const w: any = {};
    if (accountWhere.branchId) w.branchId = accountWhere.branchId;
    if (dateFilter) w.disbursementDate = dateFilter;
    return Object.keys(w).length > 0 ? w : undefined;
  }

  function repaymentWhere() {
    const w: any = {};
    if (accountWhere.branchId) w.loan = { branchId: accountWhere.branchId };
    if (dateFilter) w.repaymentDate = dateFilter;
    return Object.keys(w).length > 0 ? w : undefined;
  }

  const [
    accounts,
    depositTotals,
    withdrawalTotals,
    loanTotals,
    repaymentTotals,
    memberCount,
    totalBalance,
    totalDeposits,
    totalWithdrawals,
    totalLoanDisbursements,
    totalLoanRepayments,
  ] = await Promise.all([
    db.account.findMany({
      where: accountWhere,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        member: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        institution: {
          select: {
            institutionName: true,
          },
        },
        accountType: {
          select: {
            name: true,
            isShareAccount: true,
            hasFixedPeriod: true,
          },
        },
        transactions: {
          take: 1,
          orderBy: {
            transactionDate: "desc",
          },
          select: {
            transactionDate: true,
            type: true,
          },
        },
      },
      orderBy: [
        { branchId: "asc" },
        { accountNumber: "asc" },
      ],
    }),
    db.deposit.groupBy({
      by: ["accountId"],
      where: depositWhere(),
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    }),
    db.withdrawal.groupBy({
      by: ["accountId"],
      where: withdrawalWhere(),
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    }),
    db.loan.groupBy({
      by: ["memberId"],
      where: loanWhere(),
      _sum: {
        amountGranted: true,
      },
      _count: {
        _all: true,
      },
    }),
    db.loanRepayment.groupBy({
      by: ["memberId"],
      where: repaymentWhere(),
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    }),
    db.account.findMany({
      where: accountWhere,
      select: {
        memberId: true,
      },
      distinct: ["memberId"],
    }),
    db.account.aggregate({
      where: accountWhere,
      _sum: {
        balance: true,
      },
    }),
    db.deposit.aggregate({
      where: depositWhere(),
      _sum: {
        amount: true,
      },
    }),
    db.withdrawal.aggregate({
      where: withdrawalWhere(),
      _sum: {
        amount: true,
      },
    }),
    db.loan.aggregate({
      where: loanWhere(),
      _sum: {
        amountGranted: true,
      },
    }),
    db.loanRepayment.aggregate({
      where: repaymentWhere(),
      _sum: {
        amount: true,
      },
    }),
  ]);

  const depositMap = new Map(
    depositTotals.map((row) => [
      row.accountId,
      {
        total: safeNumber(row._sum.amount),
        count: row._count._all,
      },
    ]),
  );
  const withdrawalMap = new Map(
    withdrawalTotals.map((row) => [
      row.accountId,
      {
        total: safeNumber(row._sum.amount),
        count: row._count._all,
      },
    ]),
  );
  const loanMap = new Map(
    loanTotals.map((row) => [
      row.memberId,
      {
        total: safeNumber(row._sum.amountGranted),
        count: row._count._all,
      },
    ]),
  );
  const repaymentMap = new Map(
    repaymentTotals.map((row) => [
      row.memberId,
      {
        total: safeNumber(row._sum.amount),
        count: row._count._all,
      },
    ]),
  );

  const records: CustomerInternalAccountingRecord[] = accounts.map((account) => {
    const memberName =
      account.member?.user?.name ||
      account.institution?.institutionName ||
      "Unknown";
    const memberNumber = account.member?.memberNumber || "N/A";
    const depositStats = depositMap.get(account.id) || { total: 0, count: 0 };
    const withdrawalStats = withdrawalMap.get(account.id) || { total: 0, count: 0 };
    const loanStats =
      account.memberId && loanMap.get(account.memberId)
        ? loanMap.get(account.memberId)!
        : { total: 0, count: 0 };
    const repaymentStats =
      account.memberId && repaymentMap.get(account.memberId)
        ? repaymentMap.get(account.memberId)!
        : { total: 0, count: 0 };
    const lastTransaction = account.transactions[0] || null;
    const loanDisbursements = loanStats.total;
    const loanRepayments = repaymentStats.total;

    return {
      id: account.id,
      branchId: account.branch.id,
      branchName: account.branch.name,
      memberId: account.memberId,
      memberNumber,
      memberName,
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountType: account.accountType.name,
      accountStatus: account.status,
      currentBalance: safeNumber(account.balance),
      totalDeposits: depositStats.total,
      depositCount: depositStats.count,
      totalWithdrawals: withdrawalStats.total,
      withdrawalCount: withdrawalStats.count,
      totalLoanDisbursements: loanDisbursements,
      loanCount: loanStats.count,
      totalLoanRepayments: loanRepayments,
      repaymentCount: repaymentStats.count,
      netMovement:
        depositStats.total -
        withdrawalStats.total +
        loanRepayments -
        loanDisbursements,
      lastActivityAt: lastTransaction?.transactionDate
        ? lastTransaction.transactionDate.toISOString()
        : null,
      lastTransactionType: lastTransaction?.type || null,
      openedAt: account.openedAt.toISOString(),
    };
  });

  const summary: CustomerInternalAccountingSummary = {
    totalAccounts: records.length,
    activeAccounts: records.filter((record) => record.accountStatus === "ACTIVE").length,
    suspendedAccounts: records.filter((record) => record.accountStatus === "SUSPENDED").length,
    closedAccounts: records.filter((record) => record.accountStatus === "CLOSED").length,
    totalMembers: memberCount.filter((row) => row.memberId).length,
    totalBalance: safeNumber(totalBalance._sum.balance),
    totalDeposits: safeNumber(totalDeposits._sum.amount),
    totalWithdrawals: safeNumber(totalWithdrawals._sum.amount),
    totalLoanDisbursements: safeNumber(totalLoanDisbursements._sum.amountGranted),
    totalLoanRepayments: safeNumber(totalLoanRepayments._sum.amount),
    netMovement:
      safeNumber(totalDeposits._sum.amount) -
      safeNumber(totalWithdrawals._sum.amount) +
      safeNumber(totalLoanRepayments._sum.amount) -
      safeNumber(totalLoanDisbursements._sum.amountGranted),
  };

  return {
    branchId,
    records,
    summary,
  };
}

export async function getCustomerInternalAccountingSummary(options: CustomerInternalAccountingOptions) {
  const report = await getCustomerInternalAccountingReport(options);
  return report.summary;
}
