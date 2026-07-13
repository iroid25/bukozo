import { db } from "@/prisma/db";

export type ShareCapitalSourceRow = {
  accountId: string;
  accountTypeId: string;
  accountNumber: string;
  ownerName: string;
  ownerNumber: string;
  branchName: string;
  numberOfShares: number;
  shareValue: number;
  totalValue: number;
  status: string;
};

export type ShareCapitalTransactionRow = {
  id: string;
  accountId: string;
  accountNumber: string;
  ownerName: string;
  ownerNumber: string;
  branchName: string;
  transactionType: string;
  date: Date;
  reference: string;
  description: string;
  shares: number;
  shareValue: number;
  amount: number;
  sharesBefore: number;
  sharesAfter: number;
};

export async function getShareCapitalSummary(branchId?: string | null) {
  const accountTypes = await db.accountType.findMany({
    where: {
      OR: [
        { isShareAccount: true },
        { shareAccounts: { some: { status: "ACTIVE" } } },
      ],
    },
    orderBy: { name: "asc" },
  });

  const accountTypeIds = accountTypes.map((accountType) => accountType.id);
  const shareBalanceRows =
    accountTypeIds.length > 0
      ? await db.shareAccount.groupBy({
          by: ["accountTypeId"],
          where: {
            accountTypeId: { in: accountTypeIds },
            status: "ACTIVE",
            ...(branchId ? { branchId } : {}),
          },
          _sum: {
            totalValue: true,
            numberOfShares: true,
          },
          _count: { _all: true },
        })
      : [];

  const balanceMap = new Map(
    shareBalanceRows.map((row) => [
      row.accountTypeId,
      {
        amount: Number(row._sum.totalValue || 0),
        shares: Number(row._sum.numberOfShares || 0),
        count:
          typeof row._count === "object" && "_all" in row._count
            ? Number(row._count._all || 0)
            : 0,
      },
    ]),
  );

  const resolveMemberName = (member?: {
    surname?: string | null;
    otherNames?: string | null;
    user?: { name?: string | null } | null;
  } | null) =>
    member?.user?.name?.trim() ||
    [member?.surname, member?.otherNames].filter(Boolean).join(" ").trim() ||
    "Unknown Member";

  const resolveShareType = (accountTypeName?: string) => {
    const normalized = (accountTypeName || "").toLowerCase();
    if (normalized.includes("affiliate")) return "Affiliate Members";
    if (normalized.includes("ordinary")) return "Ordinary Members";
    if (normalized.includes("associate")) return "Associate Members";
    return accountTypeName || "General";
  };

  const [shareTransactions, loanSharePurchases] = await Promise.all([
    db.shareTransaction.findMany({
      where: {
        isReversed: false,
        transactionType: {
          in: ["PURCHASE", "TRANSFER_IN", "DIVIDEND"],
        },
        ...(branchId ? { account: { branchId } } : {}),
      },
      include: {
        account: {
          include: {
            accountType: { select: { name: true, sharePrice: true } },
            branch: { select: { name: true } },
            member: {
              select: {
                memberNumber: true,
                surname: true,
                otherNames: true,
                user: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { transactionDate: "desc" },
      take: 250,
    }),
    db.transaction.findMany({
      where: {
        type: "SHARES_PURCHASE",
        status: "COMPLETED",
        loanId: { not: null },
        account: {
          accountType: {
            isShareAccount: true,
          },
        },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        account: {
          include: {
            accountType: { select: { name: true, sharePrice: true } },
            branch: { select: { name: true } },
          },
        },
        member: {
          select: {
            memberNumber: true,
            surname: true,
            otherNames: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { transactionDate: "desc" },
      take: 250,
    }),
  ]);

  const existingRefs = new Set(
    shareTransactions
      .map((tx) => tx.reference)
      .filter((value): value is string => Boolean(value)),
  );

  const shareAccounts = await db.shareAccount.findMany({
    where: {
      status: "ACTIVE",
      ...(branchId ? { branchId } : {}),
      accountTypeId: { in: accountTypeIds },
    },
    select: {
      id: true,
      accountNumber: true,
      accountTypeId: true,
      numberOfShares: true,
      shareValue: true,
      totalValue: true,
      status: true,
      branch: { select: { name: true } },
      member: {
        select: {
          memberNumber: true,
          surname: true,
          otherNames: true,
          user: { select: { name: true } },
        },
      },
    },
    orderBy: [{ totalValue: "desc" }, { accountNumber: "asc" }],
  });

  const sourceAccounts: ShareCapitalSourceRow[] = shareAccounts.map((account) => ({
    accountId: account.id,
    accountTypeId: account.accountTypeId,
    accountNumber: account.accountNumber,
    ownerName: resolveMemberName(account.member),
    ownerNumber: account.member?.memberNumber || "-",
    branchName: account.branch?.name || "Unassigned Branch",
    numberOfShares: Number(account.numberOfShares || 0),
    shareValue: Number(account.shareValue || 0),
    totalValue: Number(account.totalValue || 0),
    status: account.status,
  }));

  const transactionRows: ShareCapitalTransactionRow[] = [
    ...shareTransactions.map((tx) => ({
      id: tx.id,
      accountId: tx.accountId,
      accountNumber: tx.account.accountNumber,
      ownerName: resolveMemberName(tx.account.member),
      ownerNumber: tx.account.member?.memberNumber || "-",
      branchName: tx.account.branch?.name || "Unassigned Branch",
      transactionType: tx.transactionType,
      date: tx.transactionDate,
      reference: tx.reference || "-",
      description: tx.description || "-",
      shares: Number(tx.shares || 0),
      shareValue: Number(tx.shareValue || 0),
      amount: Number(tx.amount || 0),
      sharesBefore: Number(tx.sharesBefore || 0),
      sharesAfter: Number(tx.sharesAfter || 0),
    })),
    ...loanSharePurchases
      .filter((tx) => {
        const expectedReference = tx.loanId
          ? `LN-SHARE-${tx.loanId.slice(0, 8)}`
          : null;
        return !expectedReference || !existingRefs.has(expectedReference);
      })
      .map((tx) => ({
        id: `txn-${tx.id}`,
        accountId: tx.accountId,
        accountNumber: tx.account.accountNumber,
        ownerName: resolveMemberName(tx.member),
        ownerNumber: tx.member?.memberNumber || "-",
        branchName: tx.account.branch?.name || "Unassigned Branch",
        transactionType: "PURCHASE",
        date: tx.transactionDate,
        reference: tx.transactionRef || "-",
        description: `Loan deduction - Associate Shares`,
        shares: 0,
        shareValue: Number(tx.account.accountType?.sharePrice || 0),
        amount: Number(tx.amount || 0),
        sharesBefore: 0,
        sharesAfter: 0,
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    accountTypes,
    balanceMap,
    sourceAccounts,
    transactionRows,
    sourceCount: sourceAccounts.length,
    sourceTotal: sourceAccounts.reduce((sum, row) => sum + Number(row.totalValue || 0), 0),
    transactionCount: transactionRows.length,
    transactionTotal: transactionRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
  };
}
