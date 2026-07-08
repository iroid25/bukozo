import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getChartOfAccounts } from "@/lib/services/chartOfAccounts";
import { ensureLiabilityStructure } from "@/lib/services/liability-structure";
import { db } from "@/prisma/db";
import { getAccountTypeDisplayName } from "@/types/accountTypes";
import { Prisma } from "@prisma/client";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { getCanonicalSavingsLedgerCode } from "@/lib/accounting/account-type-rules";

export const dynamic = "force-dynamic";
const INSURANCE_POOL_ACCOUNT_CODE = "201010";
const LOAN_INSURANCE_ACCOUNT_CODE = "200600";
const LEGACY_INSURANCE_LIABILITY_CODES = new Set(["201020", "202001"]);

// GET /api/v1/accounts/liabilities - Fetch all LIABILITY accounts
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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const parentId = searchParams.get("parentId") || undefined;
    const level = searchParams.get("level") ? parseInt(searchParams.get("level")!) : undefined;
    const search = searchParams.get("search") || undefined;
    const isActiveStr = searchParams.get("isActive");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : undefined;
    const branchId = searchParams.get("branchId");
    const user = session.user as { role: string; branchId?: string | null };
    const scopedBranchId = resolveBranchScope(user, branchId);

    await ensureLiabilityStructure();

    const result = await getChartOfAccounts({
      page,
      limit,
      ledgerType: "LIABILITIES", // Force Liabilities
      parentId: parentId === "null" ? null : parentId,
      level,
      search,
      isActive,
      branchId: scopedBranchId,
    });

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

    const accountTypeIds = linkedAccountTypes.map((accountType) => accountType.id);
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

    const accounts = result.data || [];

    const isStructuralAccount = (account: (typeof accounts)[number]) => {
      const normalizedName = account.accountName.trim().toLowerCase();
      return (
        account.accountCode === "200000" ||
        account.accountCode === "201000" ||
        account.accountCode === "202000" ||
        normalizedName === "liabilities" ||
        normalizedName === "current liabilities" ||
        normalizedName === "current liabilites" ||
        normalizedName === "non-current liabilities" ||
        normalizedName === "non current liabilities"
      );
    };

    const isCurrentLiability = (account: (typeof accounts)[number]) => {
      const accountName = account.accountName.toLowerCase();
      if (
        account.accountCode.startsWith("202") ||
        account.fullCode?.startsWith("202") ||
        account.parent?.accountCode?.startsWith("202") ||
        accountName.includes("non-current liabil") ||
        accountName.includes("non current liabil")
      ) {
        return false;
      }
      return true;
    };

    const isInsuranceAccount = (account: (typeof accounts)[number]) => {
      const text = [
        account.accountName,
        account.category,
        account.product,
        account.description,
        account.parent?.accountName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes("insurance");
    };

    const isSavingsLiabilityAccount = (account: (typeof accounts)[number]) => {
      const text = [
        account.accountCode,
        account.accountName,
        account.category,
        account.product,
        account.description,
        account.parent?.accountName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        ["201001", "201002", "201003", "201004"].includes(account.accountCode) ||
        text.includes("savings") ||
        text.includes("fixed deposit")
      );
    };

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

      return (
        text.includes("insurance") ||
        text.includes(INSURANCE_POOL_ACCOUNT_CODE) ||
        text.includes("insurance pool")
      );
    };

    const savingsAccountTypes = linkedAccountTypes.filter(
      (accountType) =>
        !isInsuranceAccountType(accountType) &&
        getCanonicalSavingsLedgerCode(accountType.name) !== null,
    );

    const getSavingsAccountCode = (
      accountType: (typeof linkedAccountTypes)[number],
    ) => {
      return getCanonicalSavingsLedgerCode(accountType.name);
    };

    const savingsLedgerAccountIds = new Set(
      savingsAccountTypes
        .flatMap((accountType) => [
          accountType.ledgerAccountId,
          accountType.ledgerAccount?.id,
        ])
        .filter((value): value is string => !!value),
    );

    const savingsLedgerAccountCodes = new Set(
      savingsAccountTypes
        .flatMap((accountType) => [
          getSavingsAccountCode(accountType),
          accountType.ledgerAccount?.accountCode ?? null,
        ])
        .filter((value): value is string => !!value),
    );

    const savingsItems = savingsAccountTypes.map((accountType) => {
      const aggregate = balanceMap.get(accountType.id) || { amount: 0, count: 0 };
      return {
        id: accountType.id,
        sourceType: "ACCOUNT_TYPE",
        accountTypeId: accountType.id,
        ledgerAccountId: accountType.ledgerAccountId,
        accountCode: getSavingsAccountCode(accountType),
        name: getAccountTypeDisplayName(accountType.name),
        rawName: accountType.name,
        amount: aggregate.amount,
        accountCount: aggregate.count,
      };
    });

    const toGlItem = (account: (typeof accounts)[number]) => ({
      id: account.id,
      sourceType: "GL_ACCOUNT",
      accountId: account.id,
      accountCode: account.accountCode,
      name: account.accountName,
      amount: Number(account.balance || 0),
      level: account.level,
      isActive: account.isActive,
    });

    const currentAccounts = accounts.filter(
      (account) => !isStructuralAccount(account) && isCurrentLiability(account),
    );
    const nonCurrentAccounts = accounts.filter(
      (account) => !isStructuralAccount(account) && !isCurrentLiability(account),
    );

    const loanInsuranceAccount = currentAccounts.find(
      (account) =>
        account.accountCode === LOAN_INSURANCE_ACCOUNT_CODE ||
        account.fullCode === LOAN_INSURANCE_ACCOUNT_CODE ||
        account.accountName.trim().toLowerCase() === "loan insurance" ||
        account.accountName.trim().toLowerCase() === "loan insurance account",
    );

    const loanInsuranceItem = loanInsuranceAccount ? [toGlItem(loanInsuranceAccount)] : [];

    const currentInsuranceAccounts = currentAccounts
      .filter(
        (account) =>
          isInsuranceAccount(account) &&
          account.accountCode !== LOAN_INSURANCE_ACCOUNT_CODE &&
          account.accountCode !== INSURANCE_POOL_ACCOUNT_CODE &&
          !LEGACY_INSURANCE_LIABILITY_CODES.has(account.accountCode),
      )
      .map(toGlItem);

    const currentSavingsAccounts = currentAccounts
      .filter(
        (account) =>
          !isInsuranceAccount(account) &&
          isSavingsLiabilityAccount(account) &&
          !savingsLedgerAccountIds.has(account.id) &&
          !savingsLedgerAccountCodes.has(account.accountCode),
      )
      .map(toGlItem);

    const currentOtherAccounts = currentAccounts
      .filter(
        (account) =>
          !isInsuranceAccount(account) &&
          !isSavingsLiabilityAccount(account) &&
          !savingsLedgerAccountIds.has(account.id) &&
          !LEGACY_INSURANCE_LIABILITY_CODES.has(account.accountCode),
      )
      .map(toGlItem);

    const nonCurrentOtherAccounts = nonCurrentAccounts
      .filter((account) => !LEGACY_INSURANCE_LIABILITY_CODES.has(account.accountCode))
      .map(toGlItem);

    const sumItems = (items: Array<{ amount: number }>) =>
      items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const groups = {
      current: {
        savings: {
          title: "Savings",
          items: [...savingsItems, ...currentSavingsAccounts],
          total: sumItems(savingsItems) + sumItems(currentSavingsAccounts),
        },
        loanInsurance: {
          title: "Insurance Pool",
          items: [...loanInsuranceItem, ...currentInsuranceAccounts],
          total: sumItems(loanInsuranceItem) + sumItems(currentInsuranceAccounts),
        },
        other: {
          title: "Other Current Liabilities",
          items: currentOtherAccounts,
          total: sumItems(currentOtherAccounts),
        },
      },
      nonCurrent: {
        other: {
          title: "Other Non-current Liabilities",
          items: nonCurrentOtherAccounts,
          total: sumItems(nonCurrentOtherAccounts),
        },
      },
      summary: {
        currentTotal:
          sumItems(savingsItems) +
          sumItems(currentSavingsAccounts) +
          sumItems(loanInsuranceItem) +
          sumItems(currentInsuranceAccounts) +
          sumItems(currentOtherAccounts),
        nonCurrentTotal: sumItems(nonCurrentOtherAccounts),
        savingsTotal: sumItems(savingsItems) + sumItems(currentSavingsAccounts),
        loanInsuranceTotal:
          sumItems(loanInsuranceItem) + sumItems(currentInsuranceAccounts),
        insurancePoolTotal:
          sumItems(loanInsuranceItem) + sumItems(currentInsuranceAccounts),
      },
    };

    return NextResponse.json({
      ...result,
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
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
