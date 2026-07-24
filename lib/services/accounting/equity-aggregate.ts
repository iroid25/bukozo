import { db } from "@/prisma/db";
import { ensureEquityStructure } from "@/lib/services/equity-structure";
import { getRetainedEarnings } from "@/lib/accounting/getRetainedEarnings";
import { getShareCapitalSummary } from "@/lib/services/share-capital-summary";

export async function fetchEquitySummary(branchId?: string) {
  await ensureEquityStructure();

  const manualEntryWhere = branchId
    ? { OR: [{ branchId }, { branchId: null }] }
    : {};

  const [manualEntries, retained, shareCapitalSummary] = await Promise.all([
    db.equityManualEntry.findMany({
      where: manualEntryWhere,
      orderBy: { date: "desc" },
    }),
    getRetainedEarnings(branchId ? { branchId } : {}),
    getShareCapitalSummary(branchId),
  ]);

  const toManualEntryNode = (entry: (typeof manualEntries)[number]) => ({
    source: "EQUITY_MANUAL_ENTRY" as const,
    id: `EQUITY_MANUAL_ENTRY:${entry.id}`,
    key: entry.id,
    isManualLedger: false as const,
    entryId: entry.id,
    type: entry.type,
    amount: entry.amount,
    description: entry.description,
    donorOrSource: entry.source,
    reference: entry.reference,
    date: entry.date,
    branchId: entry.branchId,
    recordedByUserId: entry.recordedByUserId,
  });

  const statutoryReserveItems = manualEntries
    .filter((entry) => entry.type === "STATUTORY_RESERVE")
    .map(toManualEntryNode);
  const grantItems = manualEntries
    .filter((entry) => entry.type === "GRANT_DONATION")
    .map(toManualEntryNode);

  const sumAmount = (items: Array<{ amount: number }>) =>
    items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalIncome = retained.totalIncome;
  const totalExpenditure = retained.totalExpenditure;

  const statutoryReserves = {
    title: "Statutory Reserves",
    items: statutoryReserveItems,
    total: sumAmount(statutoryReserveItems),
  };

  const grantsAndDonations = {
    title: "Grants and Donations",
    items: grantItems,
    total: sumAmount(grantItems),
  };

  const retainedEarnings = {
    title: "Retained Earnings",
    amount: totalIncome - totalExpenditure,
    totalIncome,
    totalExpenditure,
    isComputed: true as const,
  };

  const shareCapitalItems = shareCapitalSummary.accountTypes.map((accountType) => {
    const aggregate = shareCapitalSummary.balanceMap.get(accountType.id) || {
      amount: 0, shares: 0, count: 0,
    };
    return {
      source: "SHARE_ACCOUNT_TYPE" as const,
      id: `SHARE_ACCOUNT_TYPE:${accountType.id}`,
      key: accountType.id,
      isManualLedger: false as const,
      accountTypeId: accountType.id,
      name: accountType.name,
      amount: aggregate.amount,
      accountCount: aggregate.count,
      numberOfShares: aggregate.shares,
      shareValue: Number(accountType.sharePrice || 0),
    };
  });

  const shareCapitalTotal = shareCapitalSummary.sourceTotal;

  const totalEquity =
    statutoryReserves.total +
    grantsAndDonations.total +
    retainedEarnings.amount +
    shareCapitalTotal;

  return {
    statutoryReserves,
    grantsAndDonations,
    retainedEarnings,
    shareCapital: {
      title: "Share Capital",
      items: shareCapitalItems,
      total: shareCapitalTotal,
    },
    totalEquity,
    debits: 0,
    credits: totalEquity,
  };
}
