import { db } from "@/prisma/db";
import { Prisma } from "@prisma/client";
import { calculateAccountBalance } from "@/lib/accounting-rules";

export type GetChartOfAccountsOptions = {
  page?: number;
  limit?: number;
  ledgerType?: string;
  parentId?: string | null;
  level?: number;
  search?: string;
  isActive?: boolean;
  coreOnly?: boolean;
  numericOnly?: boolean;
  branchId?: string;
};

type BalanceSourceAccount = {
  id: string;
  ledgerType: string;
  balance: number;
  debitBalance: number;
  creditBalance: number;
};

export async function hydrateAccountsWithJournalBalances<
  T extends BalanceSourceAccount,
>(accounts: T[], branchId?: string) {
  if (accounts.length === 0) {
    return accounts;
  }

  const accountIds = accounts.map((account) => account.id);
  const where: Prisma.JournalEntryWhereInput = {
    accountId: { in: accountIds },
  };

  if (branchId) {
    where.OR = [
      { transaction: { branchId } },
      { transactionId: null as string | null, branchId },
    ];
  }

  const groupedBalances = await db.journalEntry.groupBy({
    by: ["accountId"],
    where,
    _sum: {
      debitAmount: true,
      creditAmount: true,
    },
  });

  const balanceMap = new Map(
    groupedBalances.map((entry) => [
      entry.accountId,
      {
        debit: Number(entry._sum.debitAmount || 0),
        credit: Number(entry._sum.creditAmount || 0),
      },
    ]),
  );

  return accounts.map((account) => {
    const journalBalance = balanceMap.get(account.id);

    if (!journalBalance) {
      return account;
    }

    const debitBalance = journalBalance.debit;
    const creditBalance = journalBalance.credit;

    return {
      ...account,
      debitBalance,
      creditBalance,
      balance: calculateAccountBalance(
        account.ledgerType,
        debitBalance,
        creditBalance,
      ),
    };
  });
}

export async function getChartOfAccounts(options: GetChartOfAccountsOptions) {
  const {
    page = 1,
    limit = 20,
    ledgerType,
    parentId,
    level,
    search,
    isActive,
    coreOnly = false,
    numericOnly = true,
  } = options;

  const skip = (page - 1) * limit;

  // Build where clause
  const where: Prisma.ChartOfAccountWhereInput = {};
  const andFilters: Prisma.ChartOfAccountWhereInput[] = [];

  if (ledgerType) {
    where.ledgerType = ledgerType as any; // Cast to enum if needed, or leave as string if schema uses string
  }

  if (parentId !== undefined) {
    where.parentId = parentId;
  }

  if (level) {
    where.level = level;
  }

  if (search) {
    where.OR = [
      { accountCode: { contains: search, mode: "insensitive" } },
      { accountName: { contains: search, mode: "insensitive" } },
      { fullCode: { contains: search, mode: "insensitive" } },
    ];
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (coreOnly) {
    where.ledgerType = ledgerType
      ? (ledgerType as any)
      : { in: ["ASSETS", "LIABILITIES", "EQUITY", "INCOME", "EXPENDITURES"] };
  }

  if (numericOnly) {
    andFilters.push({
      OR: [
        { accountCode: { startsWith: "0" } },
        { accountCode: { startsWith: "1" } },
        { accountCode: { startsWith: "2" } },
        { accountCode: { startsWith: "3" } },
        { accountCode: { startsWith: "4" } },
        { accountCode: { startsWith: "5" } },
        { accountCode: { startsWith: "6" } },
        { accountCode: { startsWith: "7" } },
        { accountCode: { startsWith: "8" } },
        { accountCode: { startsWith: "9" } },
      ],
    });
  }

  andFilters.push({
    NOT: {
      accountCode: "401006",
    },
  });

  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  // Fetch accounts with pagination
  const [accounts, total] = await Promise.all([
    db.chartOfAccount.findMany({
      where,
      skip,
      take: limit,
      include: {
        parent: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            fullCode: true,
          },
        },
        _count: {
          select: {
            children: true,
          },
        },
      },
      orderBy: {
        accountCode: "asc",
      },
    }),
    db.chartOfAccount.count({ where }),
  ]);

  const hydratedAccounts = await hydrateAccountsWithJournalBalances(
    accounts,
    options.branchId,
  );

  return {
    data: hydratedAccounts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
