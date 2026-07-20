import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { getAccountTypeDisplayName } from "@/types/accountTypes";
import { Prisma } from "@prisma/client";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { getCanonicalSavingsLedgerCode } from "@/lib/accounting/account-type-rules";

export const dynamic = "force-dynamic";
const LOAN_INSURANCE_POOL_ACCOUNT_NUMBER = "SACCO_LOAN_INSURANCE_POOL";

// GET /api/v1/accounts/liabilities - Fetch liabilities from real tables
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get("branchId");
    const user = session.user as { role: string; branchId?: string | null };
    const scopedBranchId = resolveBranchScope(user, branchId);

    // --- Insurance Pool (branch-scoped when possible) ---
    const insurancePoolAccount = await db.account.findFirst({
      where: { accountNumber: LOAN_INSURANCE_POOL_ACCOUNT_NUMBER },
      select: { id: true, balance: true },
    });

    const insuranceContributionAgg = await db.insuranceContribution.aggregate({
      where: {
        type: "CONTRIBUTION",
        ...(scopedBranchId
          ? { member: { user: { branchId: scopedBranchId } } }
          : {}),
      },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const insurancePoolAmount = scopedBranchId
      ? Number(insuranceContributionAgg._sum.amount || 0)
      : Number(insurancePoolAccount?.balance || 0);

    const insurancePoolCount =
      typeof insuranceContributionAgg._count === "object" &&
      "_all" in insuranceContributionAgg._count
        ? Number(insuranceContributionAgg._count._all || 0)
        : 0;

    const insurancePoolItem = insurancePoolAmount > 0 || insurancePoolCount > 0 || insurancePoolAccount
      ? [
          {
            id: "INSURANCE_POOL:pool",
            sourceType: "INSURANCE_POOL",
            source: "INSURANCE_POOL",
            isManualLedger: false,
            accountId: insurancePoolAccount?.id,
            name: "Loan Insurance Pool",
            amount: insurancePoolAmount,
            accountCount: insurancePoolCount,
          },
        ]
      : [];

    // --- Savings Account Types (real Account balances) ---
    const linkedAccountTypes = await db.accountType.findMany({
      where: {
        isShareAccount: false,
        OR: [
          {
            ledgerAccountId: { not: null },
            ledgerAccount: { ledgerType: "LIABILITIES" },
          },
          { name: { contains: "savings", mode: "insensitive" } },
          { name: { contains: "saving", mode: "insensitive" } },
          { name: { contains: "deposit", mode: "insensitive" } },
          { name: { contains: "voluntary", mode: "insensitive" } },
          { name: { contains: "compulsory", mode: "insensitive" } },
          { name: { contains: "fixed", mode: "insensitive" } },
        ],
      },
      include: {
        ledgerAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            parentId: true,
            parent: {
              select: {
                id: true,
                accountCode: true,
                accountName: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const isInsuranceAccountType = (
      accountType: (typeof linkedAccountTypes)[number],
    ) => {
      const text = [
        accountType.name,
        accountType.ledgerAccount?.accountCode,
        accountType.ledgerAccount?.accountName,
        accountType.ledgerAccount?.parent?.accountName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes("insurance");
    };

    const savingsAccountTypes = linkedAccountTypes.filter(
      (accountType) =>
        !isInsuranceAccountType(accountType) &&
        getCanonicalSavingsLedgerCode(accountType.name) !== null &&
        getCanonicalSavingsLedgerCode(accountType.name) !== "201001",
    );

    const accountTypeIds = savingsAccountTypes.map((at) => at.id);

    const balanceRows =
      accountTypeIds.length > 0
        ? await db.account.groupBy({
            by: ["accountTypeId"],
            where: {
              accountTypeId: { in: accountTypeIds },
              status: "ACTIVE",
              ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
            },
            _sum: { balance: true },
            _count: { _all: true },
          })
        : [];

    const balanceMap = new Map(
      balanceRows.map((row) => [
        row.accountTypeId,
        {
          amount: Number(row._sum.balance || 0),
          count:
            typeof row._count === "object" && "_all" in row._count
              ? Number(row._count._all || 0)
              : 0,
        },
      ]),
    );

    // --- Fixed Deposits (from FixedDeposit table, not Account) ---
    const fdAgg = await db.fixedDeposit.aggregate({
      where: {
        status: { in: ["ACTIVE", "MATURED"] },
        isReversed: false,
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
      },
      _sum: { principalAmount: true },
      _count: { _all: true },
    });

    const fdTotal = Number(fdAgg._sum.principalAmount || 0);
    const fdCount =
      typeof fdAgg._count === "object" && "_all" in fdAgg._count
        ? Number(fdAgg._count._all || 0)
        : 0;

    const savingsItems = savingsAccountTypes.map((accountType) => {
      const aggregate = balanceMap.get(accountType.id) || { amount: 0, count: 0 };
      return {
        id: `SAVINGS_ACCOUNT_TYPE:${accountType.id}`,
        sourceType: "ACCOUNT_TYPE",
        source: "SAVINGS_ACCOUNT_TYPE",
        isManualLedger: false,
        accountTypeId: accountType.id,
        ledgerAccountId: accountType.ledgerAccountId,
        accountCode: getCanonicalSavingsLedgerCode(accountType.name),
        name: getAccountTypeDisplayName(accountType.name),
        rawName: accountType.name,
        amount: aggregate.amount,
        accountCount: aggregate.count,
      };
    });

    const fixedDepositItems = fdCount > 0
      ? [{
          id: "FIXED_DEPOSITS:aggregate",
          sourceType: "FIXED_DEPOSITS",
          source: "FIXED_DEPOSITS",
          isManualLedger: false,
          name: "Fixed Savings",
          amount: fdTotal,
          accountCount: fdCount,
          accountCode: "201001",
        }]
      : [];

    const savingsTotal = savingsItems.reduce((sum, item) => sum + item.amount, 0);
    const insuranceTotal = insurancePoolItem.reduce((sum, item) => sum + item.amount, 0);

    const groups = {
      current: {
        savings: {
          title: "Savings",
          items: savingsItems,
          total: savingsTotal,
        },
        fixedDeposits: {
          title: "Fixed Savings",
          items: fixedDepositItems,
          total: fdTotal,
        },
        loanInsurance: {
          title: "Insurance Pool",
          items: insurancePoolItem,
          total: insuranceTotal,
        },
        other: {
          title: "Other Current Liabilities",
          items: [],
          total: 0,
        },
      },
      nonCurrent: {
        other: {
          title: "Other Non-current Liabilities",
          items: [],
          total: 0,
        },
      },
      summary: {
        currentTotal: savingsTotal + insuranceTotal + fdTotal,
        nonCurrentTotal: 0,
        savingsTotal,
        fixedDepositsTotal: fdTotal,
        loanInsuranceTotal: insuranceTotal,
        insurancePoolTotal: insuranceTotal,
      },
    };

    return NextResponse.json({
      linkedAccountTypes,
      groups,
    });
  } catch (error) {
    console.error("Error fetching liabilities:", error);

    if (
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P1001") ||
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Error &&
        error.message.includes("Can't reach database server"))
    ) {
      return NextResponse.json(
        {
          error: "Database unavailable",
          details:
            "Unable to reach the database server right now. Please confirm the Neon database is online and your local network can reach it.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch liabilities",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
