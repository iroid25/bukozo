import { db } from "@/prisma/db";
import { InsuranceContributionType } from "@prisma/client";
import { getAccountTypeDisplayName } from "@/types/accountTypes";
import { getLoanLedgerPenaltySyncSnapshot } from "@/lib/services/loan-ledger";

const SHARE_CAPITAL_CODE = "304000";
const INSURANCE_LIABILITY_CODE = "200600";
const LEGACY_INSURANCE_LIABILITY_CODES = ["201020", "202001"];
const INSURANCE_POOL_ACCOUNT_NUMBER = "SACCO_LOAN_INSURANCE_POOL";

type HealthStatus = "ok" | "warning" | "error";

function roundedDifference(left: number, right: number) {
  return Number((left - right).toFixed(2));
}

function resolveStatus(difference: number, tolerance = 1) {
  const absolute = Math.abs(difference);
  if (absolute <= tolerance) return "ok" as HealthStatus;
  if (absolute <= tolerance * 10) return "warning" as HealthStatus;
  return "error" as HealthStatus;
}

export async function getAccountingIntegrationHealth() {
  const [
    savingsAccountTypes,
    shareAccountsAggregate,
    shareCapitalGl,
    insurancePoolAccount,
    insuranceLiabilityGl,
    insuranceContributions,
  ] = await Promise.all([
    db.accountType.findMany({
      where: {
        isShareAccount: false,
        ledgerAccountId: { not: null },
        ledgerAccount: { ledgerType: "LIABILITIES" },
      },
      select: {
        id: true,
        name: true,
        ledgerAccountId: true,
      },
      orderBy: { name: "asc" },
    }),
    db.account.aggregate({
      where: {
        status: "ACTIVE",
        accountType: { isShareAccount: true },
      },
      _sum: { balance: true },
      _count: { _all: true },
    }),
    db.chartOfAccount.findFirst({
      where: {
        isActive: true,
        ledgerType: "EQUITY",
        OR: [{ accountCode: SHARE_CAPITAL_CODE }, { accountCode: { startsWith: "304" } }],
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        balance: true,
      },
    }),
    db.account.findFirst({
      where: { accountNumber: INSURANCE_POOL_ACCOUNT_NUMBER },
      select: {
        id: true,
        accountNumber: true,
        balance: true,
      },
    }),
    db.chartOfAccount.findFirst({
      where: {
        isActive: true,
        ledgerType: "LIABILITIES",
        OR: [
          { accountCode: INSURANCE_LIABILITY_CODE },
          ...LEGACY_INSURANCE_LIABILITY_CODES.map((accountCode) => ({ accountCode })),
          { accountName: { contains: "insurance", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        balance: true,
      },
    }),
    db.insuranceContribution.groupBy({
      by: ["type"],
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const savingsTypeIds = savingsAccountTypes.map((accountType) => accountType.id);
  const savingsByTypeRows =
    savingsTypeIds.length > 0
      ? await db.account.groupBy({
          by: ["accountTypeId"],
          where: {
            accountTypeId: { in: savingsTypeIds },
            status: "ACTIVE",
          },
          _sum: { balance: true },
          _count: { _all: true },
        })
      : [];

  const savingsOperationalItems = savingsAccountTypes.map((accountType) => {
    const aggregate = savingsByTypeRows.find(
      (row) => row.accountTypeId === accountType.id,
    );

    return {
      accountTypeId: accountType.id,
      ledgerAccountId: accountType.ledgerAccountId,
      name: getAccountTypeDisplayName(accountType.name),
      balance: Number(aggregate?._sum.balance || 0),
      accountCount:
        typeof aggregate?._count === "object" && "_all" in aggregate._count
          ? Number(aggregate._count._all || 0)
          : 0,
    };
  });

  const savingsOperationalTotal = savingsOperationalItems.reduce(
    (sum, item) => sum + item.balance,
    0,
  );

  const savingsLedgerAccountIds = savingsAccountTypes
    .map((accountType) => accountType.ledgerAccountId)
    .filter((value): value is string => !!value);

  const savingsLedgerAccounts =
    savingsLedgerAccountIds.length > 0
      ? await db.chartOfAccount.findMany({
          where: { id: { in: savingsLedgerAccountIds } },
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            balance: true,
          },
          orderBy: { accountCode: "asc" },
        })
      : [];

  const savingsLedgerTotal = savingsLedgerAccounts.reduce(
    (sum, account) => sum + Number(account.balance || 0),
    0,
  );

  const insuranceContributionMap = new Map(
    insuranceContributions.map((row) => [
      row.type,
      {
        amount: Number(row._sum.amount || 0),
        count:
          typeof row._count === "object" && "_all" in row._count
            ? Number(row._count._all || 0)
            : 0,
      },
    ]),
  );

  const insuranceCollected =
    insuranceContributionMap.get(InsuranceContributionType.CONTRIBUTION)?.amount || 0;
  const insurancePaidOut =
    insuranceContributionMap.get(InsuranceContributionType.PAYMENT_OUT)?.amount || 0;
  const insuranceNetContributions = insuranceCollected - insurancePaidOut;

  const shareOperationalTotal = Number(shareAccountsAggregate._sum.balance || 0);
  const shareAccountCount =
    typeof shareAccountsAggregate._count === "object" &&
    "_all" in shareAccountsAggregate._count
      ? Number(shareAccountsAggregate._count._all || 0)
      : 0;
  const shareGlBalance = Number(shareCapitalGl?.balance || 0);
  const insurancePoolBalance = Number(insurancePoolAccount?.balance || 0);
  const insuranceLiabilityBalance = Number(insuranceLiabilityGl?.balance || 0);

  const savingsDifference = roundedDifference(
    savingsOperationalTotal,
    savingsLedgerTotal,
  );
  const shareDifference = roundedDifference(shareOperationalTotal, shareGlBalance);
  const insurancePoolVsLiabilityDifference = roundedDifference(
    insurancePoolBalance,
    insuranceLiabilityBalance,
  );
  const insuranceNetVsLiabilityDifference = roundedDifference(
    insuranceNetContributions,
    insuranceLiabilityBalance,
  );
  const loanLedgerPenaltySync = await getLoanLedgerPenaltySyncSnapshot();
  const loanLedgerPenaltyDifference = roundedDifference(
    loanLedgerPenaltySync.totalPenaltyPaid,
    loanLedgerPenaltySync.nativePenaltyTotal,
  );

  return {
    summary: {
      generatedAt: new Date().toISOString(),
      overallStatus: (
        [
          savingsDifference,
          shareDifference,
          insurancePoolVsLiabilityDifference,
          loanLedgerPenaltyDifference,
        ].some((difference) => resolveStatus(difference) === "error")
          ? "error"
          : [
                savingsDifference,
                shareDifference,
                insurancePoolVsLiabilityDifference,
                loanLedgerPenaltyDifference,
              ].some((difference) => resolveStatus(difference) === "warning")
            ? "warning"
            : "ok"
      ) as HealthStatus,
    },
    savings: {
      status: resolveStatus(savingsDifference),
      operationalTotal: savingsOperationalTotal,
      ledgerTotal: savingsLedgerTotal,
      difference: savingsDifference,
      products: savingsOperationalItems,
      ledgerAccounts: savingsLedgerAccounts,
    },
    shares: {
      status: resolveStatus(shareDifference),
      operationalTotal: shareOperationalTotal,
      shareAccountCount,
      ledgerTotal: shareGlBalance,
      difference: shareDifference,
      ledgerAccount: shareCapitalGl,
    },
    insurance: {
      status: resolveStatus(insurancePoolVsLiabilityDifference),
      poolBalance: insurancePoolBalance,
      liabilityBalance: insuranceLiabilityBalance,
      netContributions: insuranceNetContributions,
      collectedTotal: insuranceCollected,
      paidOutTotal: insurancePaidOut,
      poolVsLiabilityDifference: insurancePoolVsLiabilityDifference,
      netVsLiabilityDifference: insuranceNetVsLiabilityDifference,
      poolAccount: insurancePoolAccount,
      liabilityAccount: insuranceLiabilityGl,
    },
    loanLedger: {
      status: resolveStatus(loanLedgerPenaltyDifference),
      totalPenaltyPaid: loanLedgerPenaltySync.totalPenaltyPaid,
      nativePenaltyTotal: loanLedgerPenaltySync.nativePenaltyTotal,
      difference: loanLedgerPenaltyDifference,
      repaymentCount: loanLedgerPenaltySync.repaymentCount,
      nativeEntryCount: loanLedgerPenaltySync.nativeEntryCount,
      missingCount: loanLedgerPenaltySync.missingCount,
      missingPenaltyTotal: loanLedgerPenaltySync.missingPenaltyTotal,
      missing: loanLedgerPenaltySync.missing,
    },
  };
}
